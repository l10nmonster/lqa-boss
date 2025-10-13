import React, { useRef, useEffect, useState } from 'react'
import { EditorLayout } from '../components/layout/EditorLayout'
import { UnifiedHeader } from '../components/headers/UnifiedHeader'
import { TranslationEditor, TranslationEditorRef } from '../components/TranslationEditor'
import { ClientIdPrompt } from '../components/prompts/ClientIdPrompt'
import { AuthPrompt } from '../components/prompts/AuthPrompt'
import GCSFilePicker from '../components/GCSFilePicker'

import { useTranslationData } from '../hooks/useTranslationData'
import { useFileLoader } from '../hooks/useFileLoader'
import { pluginRegistry } from '../plugins/PluginRegistry'
import { IPersistencePlugin, FileIdentifier } from '../plugins/types'
import { toaster } from '../components/ui/toaster'
import { JobData } from '../types'
import { GCSFile } from '../utils/gcsOperations'
import { useNavigate } from 'react-router-dom'

export const EditorPage: React.FC = () => {
  // Initialize with local plugin as default
  const [currentPlugin, setCurrentPlugin] = useState<IPersistencePlugin | null>(
    () => pluginRegistry.getPlugin('local') || null
  )
  const [currentFileId, setCurrentFileId] = useState<FileIdentifier | null>(null)
  const [sourcePlugin, setSourcePlugin] = useState<IPersistencePlugin | null>(null)
  const [sourceFileId, setSourceFileId] = useState<FileIdentifier | null>(null)
  const [showAuthPrompt, setShowAuthPrompt] = useState(false)
  const [showClientIdPrompt, setShowClientIdPrompt] = useState(false)
  const [showLocationPrompt, setShowLocationPrompt] = useState<'load' | 'save' | null>(null)
  const [showFilePicker, setShowFilePicker] = useState(false)
  const [fileList, setFileList] = useState<GCSFile[]>([])
  const [pendingFileId, setPendingFileId] = useState<FileIdentifier | null>(null)

  const translationEditorRef = useRef<TranslationEditorRef>(null)
  const fileLoader = useFileLoader()
  const translationData = useTranslationData()
  const navigate = useNavigate()

  // Get all available plugins
  const plugins = pluginRegistry.getAllPlugins()

  // URL parsing for deep links (only on initial mount)
  useEffect(() => {
    const currentUrl = window.location.pathname + window.location.search
    const lastProcessedUrl = sessionStorage.getItem('last-processed-url')

    // Skip if this URL was already processed
    // This prevents duplicate loads from React StrictMode or navigation
    if (lastProcessedUrl === currentUrl) return

    // Check for path-based GCS URLs first (e.g., /gcs/bucket/prefix/file.lqaboss)
    const pathSegments = window.location.pathname.split('/').filter(s => s)
    if (pathSegments[0] === 'gcs') {
      const gcsPlugin = pluginRegistry.getPlugin('gcs')
      if (gcsPlugin && gcsPlugin.parsePathUrl) {
        const fileId = gcsPlugin.parsePathUrl(pathSegments)
        if (fileId) {
          // Mark as processed immediately
          sessionStorage.setItem('last-processed-url', currentUrl)
          setCurrentPlugin(gcsPlugin)
          handleAutoLoad(gcsPlugin, fileId)
          return
        }
      }
    }

    // Otherwise check query parameters
    const params = new URLSearchParams(window.location.search)
    const pluginId = params.get('plugin')

    if (pluginId) {
      const plugin = pluginRegistry.getPlugin(pluginId)
      if (plugin) {
        // Mark as processed immediately to prevent duplicate loads
        sessionStorage.setItem('last-processed-url', currentUrl)
        setCurrentPlugin(plugin)

        // Extension plugin: immediately load file
        if (pluginId === 'extension') {
          loadFileFromPlugin(plugin, {})
          return
        }

        // Other plugins: Let plugin parse URL for file identifier
        const fileId = plugin.parseUrl?.(params)
        if (fileId) {
          handleAutoLoad(plugin, fileId)
        }
      }
    }
    // If no plugin specified in URL, keep the default (local) already set in state
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // PWA File Handling
  useEffect(() => {
    if ('launchQueue' in window && window.launchQueue) {
      (window as any).launchQueue.setConsumer(async (launchParams: any) => {
        console.log('PWA Launch Queue Consumer Fired')
        if (launchParams.files?.[0]) {
          const fileHandle = launchParams.files[0]
          try {
            const file = await fileHandle.getFile()

            // Use local plugin for PWA-launched files
            const localPlugin = pluginRegistry.getPlugin('local')
            if (localPlugin) {
              setCurrentPlugin(localPlugin)
              await loadFileFromPlugin(localPlugin, { file })
            }
          } catch (err) {
            console.error('Error processing launched file:', err)
            toaster.create({
              title: 'Error',
              description: 'Could not open the launched file',
              type: 'error',
              duration: 6000,
            })
          }
        }
      })
    }
  }, [])

  /**
   * Auto-load file from URL or show auth prompt if needed
   */
  const handleAutoLoad = async (plugin: IPersistencePlugin, fileId: FileIdentifier) => {
    try {
      // Check if auth is required
      if (plugin.capabilities.requiresAuth && !plugin.getAuthState?.().isAuthenticated) {
        // Not authenticated - save fileId and show auth prompt
        setPendingFileId(fileId)
        setShowAuthPrompt(true)
        return
      }

      // Update source file ID for future operations
      setSourceFileId(fileId)
      setCurrentFileId(fileId)

      // Check if we have a specific filename to load
      if (fileId.filename) {
        // Load the specific file
        await loadFileFromPlugin(plugin, fileId)
      } else {
        // No filename - show file browser for the bucket/prefix
        if (plugin.listFiles && fileId.bucket && fileId.prefix) {
          try {
            const location = `${fileId.bucket}/${fileId.prefix}`
            const files = await plugin.listFiles(location)

            // Convert FileInfo[] to GCSFile[] format
            const gcsFiles: GCSFile[] = files.map(f => ({
              name: f.name,
              fullName: f.name,
              size: f.size || '0',
              updated: f.updated || new Date().toISOString()
            }))

            setFileList(gcsFiles)
            setShowFilePicker(true)
          } catch (error: any) {
            toaster.create({
              title: 'Failed to list files',
              description: error.message,
              type: 'error',
              duration: 6000,
            })
          }
        }
      }
    } catch (error: any) {
      console.error('Auto-load failed:', error)
      toaster.create({
        title: 'Failed to load file',
        description: error.message,
        type: 'error',
        duration: 6000,
      })
    }
  }

  /**
   * Load saved translations using plugin auto-save support (three-state system)
   */
  const loadSavedTranslations = async (
    plugin: IPersistencePlugin,
    fileId: FileIdentifier,
    filename: string,
    jobData: JobData
  ): Promise<{ foundEdited: boolean; editedCount: number }> => {
    // Check if plugin supports auto-save
    if (!plugin.loadAutoSaveData) {
      translationData.setupTwoStateSystem(jobData)
      return { foundEdited: false, editedCount: 0 }
    }

    try {
      const savedJobData = await plugin.loadAutoSaveData(fileId, filename)

      // Apply translations if there are any saved
      if (savedJobData && savedJobData.tus && savedJobData.tus.length > 0) {
        const result = translationData.applyLoadedTranslations(jobData, savedJobData)

        // Set up three-state system
        translationData.setupThreeStateSystem(jobData, result.jobData)

        return { foundEdited: true, editedCount: result.editedCount }
      } else {
        // No saved translations
        translationData.setupTwoStateSystem(jobData)
        return { foundEdited: false, editedCount: 0 }
      }
    } catch (error) {
      console.log(`Error loading auto-save data: ${error}`)
      translationData.setupTwoStateSystem(jobData)
      return { foundEdited: false, editedCount: 0 }
    }
  }

  /**
   * Load a file from a plugin
   */
  const loadFileFromPlugin = async (plugin: IPersistencePlugin, fileId: FileIdentifier) => {
    try {
      // Check auth if needed
      if (plugin.capabilities.requiresAuth && !plugin.getAuthState?.().isAuthenticated) {
        setPendingFileId(fileId)
        setShowAuthPrompt(true)
        return
      }

      const file = await plugin.loadFile(fileId)
      const result = await fileLoader.loadLqaBossFile(file)

      // Load saved translations (this will set up either two-state or three-state system)
      const translationResult = await loadSavedTranslations(
        plugin,
        fileId,
        file.name,
        result.jobData
      )

      setCurrentFileId(fileId)
      setSourceFileId(fileId)
      setCurrentPlugin(plugin)
      setSourcePlugin(plugin)

      toaster.create({
        title: 'File loaded',
        description: translationResult.foundEdited
          ? `Found ${translationResult.editedCount} edited translation${translationResult.editedCount === 1 ? '' : 's'}`
          : `Loaded via ${plugin.metadata.name}`,
        type: 'success',
        duration: 4000,
      })

      // Update URL if plugin supports it (only if it's different from current)
      if (plugin.buildUrl) {
        const newUrl = plugin.buildUrl(fileId)
        const currentPath = window.location.pathname + window.location.search

        // Only navigate if URL is actually changing
        if (newUrl !== currentPath) {
          navigate(newUrl, { replace: true })
        }
      }
    } catch (error: any) {
      console.error('Error loading file:', error)

      // Special handling for extension plugin "no flow available" error
      if (plugin.metadata.id === 'extension' && error.message.includes('No flow available')) {
        toaster.create({
          title: 'No pages captured',
          description: 'Open the LQA Boss Capture extension and capture at least one page',
          type: 'info',
          duration: 8000,
        })
        return
      }

      toaster.create({
        title: 'Load failed',
        description: error.message,
        type: 'error',
        duration: 6000,
      })
    }
  }

  /**
   * Handle auth prompt acceptance
   */
  const handleAuthPromptAccept = async () => {
    if (!currentPlugin) return

    // Check if plugin needs setup before authentication
    if (currentPlugin.needsSetup?.()) {
      setShowAuthPrompt(false)
      setShowClientIdPrompt(true)
      return
    }

    setShowAuthPrompt(false)

    try {
      await currentPlugin.authenticate?.()

      // If we have a pending file ID
      if (pendingFileId) {
        // Determine if this is a save operation (we have jobData and fileName)
        const isSaveOperation = !!translationData.jobData && !!(pendingFileId as any).fileName

        if (isSaveOperation) {
          // Continue with save flow
          // Check if plugin can validate identifiers
          if (currentPlugin.validateIdentifier) {
            const validation = currentPlugin.validateIdentifier(pendingFileId, 'save')

            if (!validation.valid) {
              // Need to prompt for missing information
              if (currentPlugin.LocationPromptComponent) {
                setShowLocationPrompt('save')
                setPendingFileId(null)
                return
              } else {
                toaster.create({
                  title: 'Missing information',
                  description: `Cannot save: missing ${validation.missing?.join(', ')}`,
                  type: 'error',
                  duration: 6000,
                })
                setPendingFileId(null)
                return
              }
            }
          }

          // Proceed with save
          await performSave(currentPlugin, pendingFileId)
          setPendingFileId(null)
        } else {
          // Load flow
          // Update source file ID for future operations
          setSourceFileId(pendingFileId)
          setCurrentFileId(pendingFileId)

          // Check if we have a specific filename to load
          if (pendingFileId.filename) {
            // Load the specific file
            await loadFileFromPlugin(currentPlugin, pendingFileId)
          } else {
            // No filename - show file browser for the bucket/prefix
            if (currentPlugin.listFiles && pendingFileId.bucket && pendingFileId.prefix) {
              try {
                const location = `${pendingFileId.bucket}/${pendingFileId.prefix}`
                const files = await currentPlugin.listFiles(location)

                // Convert FileInfo[] to GCSFile[] format
                const gcsFiles: GCSFile[] = files.map(f => ({
                  name: f.name,
                  fullName: f.name,
                  size: f.size || '0',
                  updated: f.updated || new Date().toISOString()
                }))

                setFileList(gcsFiles)
                setShowFilePicker(true)
              } catch (error: any) {
                toaster.create({
                  title: 'Failed to list files',
                  description: error.message,
                  type: 'error',
                  duration: 6000,
                })
              }
            }
          }
          setPendingFileId(null)
        }
      }
    } catch (error: any) {
      console.error('Authentication failed:', error)
      toaster.create({
        title: 'Authentication failed',
        description: error.message,
        type: 'error',
        duration: 6000,
      })
    }
  }

  /**
   * Handle client ID submission (plugin setup)
   */
  const handleClientIdSubmit = async (clientId: string) => {
    if (!currentPlugin) return

    try {
      // Save configuration
      await currentPlugin.setConfig?.({ clientId })

      // Attempt authentication
      await currentPlugin.authenticate?.()

      setShowClientIdPrompt(false)

      // If we have a pending file ID
      if (pendingFileId) {
        // Determine if this is a save operation (we have jobData and fileName)
        const isSaveOperation = !!translationData.jobData && !!(pendingFileId as any).fileName

        if (isSaveOperation) {
          // Continue with save flow
          // Check if plugin can validate identifiers
          if (currentPlugin.validateIdentifier) {
            const validation = currentPlugin.validateIdentifier(pendingFileId, 'save')

            if (!validation.valid) {
              // Need to prompt for missing information
              if (currentPlugin.LocationPromptComponent) {
                setShowLocationPrompt('save')
                setPendingFileId(null)
                return
              } else {
                toaster.create({
                  title: 'Missing information',
                  description: `Cannot save: missing ${validation.missing?.join(', ')}`,
                  type: 'error',
                  duration: 6000,
                })
                setPendingFileId(null)
                return
              }
            }
          }

          // Proceed with save
          await performSave(currentPlugin, pendingFileId)
          setPendingFileId(null)
        } else {
          // Load flow
          // Update source file ID for future operations
          setSourceFileId(pendingFileId)
          setCurrentFileId(pendingFileId)

          // Check if we have a specific filename to load
          if (pendingFileId.filename) {
            // Load the specific file
            await loadFileFromPlugin(currentPlugin, pendingFileId)
          } else {
            // No filename - show file browser for the bucket/prefix
            if (currentPlugin.listFiles && pendingFileId.bucket && pendingFileId.prefix) {
              try {
                const location = `${pendingFileId.bucket}/${pendingFileId.prefix}`
                const files = await currentPlugin.listFiles(location)

                // Convert FileInfo[] to GCSFile[] format
                const gcsFiles: GCSFile[] = files.map(f => ({
                  name: f.name,
                  fullName: f.name,
                  size: f.size || '0',
                  updated: f.updated || new Date().toISOString()
                }))

                setFileList(gcsFiles)
                setShowFilePicker(true)
              } catch (error: any) {
                toaster.create({
                  title: 'Failed to list files',
                  description: error.message,
                  type: 'error',
                  duration: 6000,
                })
              }
            }
          }
          setPendingFileId(null)
        }
      }
    } catch (error: any) {
      console.error('Setup/Authentication failed:', error)
      toaster.create({
        title: 'Setup failed',
        description: error.message,
        type: 'error',
        duration: 6000,
      })
    }
  }

  const handleClientIdCancel = () => {
    setShowClientIdPrompt(false)
    setPendingFileId(null)
  }

  /**
   * Handle save via specified plugin
   */
  const handleSave = async (plugin: IPersistencePlugin) => {
    if (!translationData.jobData) return

    // Switch to the specified plugin for saving
    setCurrentPlugin(plugin)

    if (!plugin.capabilities.canSave) {
      toaster.create({
        title: 'Cannot save',
        description: `${plugin.metadata.name} does not support saving`,
        type: 'error',
        duration: 6000,
      })
      return
    }

    // Check auth if needed
    if (plugin.capabilities.requiresAuth && !plugin.getAuthState?.().isAuthenticated) {
      // Build save identifier to pass through auth flow
      const saveIdentifier = {
        ...currentFileId,
        fileName: fileLoader.fileName,
        filename: fileLoader.fileName
      }
      setPendingFileId(saveIdentifier)
      setShowAuthPrompt(true)
      return
    }

    // Build file identifier for save
    const saveIdentifier = {
      ...currentFileId,
      fileName: fileLoader.fileName,
      filename: fileLoader.fileName // Some plugins use 'filename', some use 'fileName'
    }

    // Check if plugin can validate identifiers
    if (plugin.validateIdentifier) {
      const validation = plugin.validateIdentifier(saveIdentifier, 'save')

      if (!validation.valid) {
        // Need to prompt for missing information
        if (plugin.LocationPromptComponent) {
          setShowLocationPrompt('save')
          return
        } else {
          toaster.create({
            title: 'Missing information',
            description: `Cannot save: missing ${validation.missing?.join(', ')}`,
            type: 'error',
            duration: 6000,
          })
          return
        }
      }
    }

    // Proceed with save
    await performSave(plugin, saveIdentifier)
  }

  /**
   * Perform the actual save operation
   */
  const performSave = async (plugin: IPersistencePlugin, fileId: FileIdentifier | null) => {
    if (!translationData.jobData) return

    try {
      // Build save identifier - plugins may need different data
      const saveFileId = {
        ...fileId,
        fileName: fileLoader.fileName,
        originalJobData: translationData.originalJobData,
        zipFile: fileLoader.zipFile, // Include original ZIP for plugins that can save both .lqaboss and .json
      }

      await plugin.saveFile(saveFileId, translationData.jobData)
      translationData.markAsSaved()

      // Update source tracking if we saved to a different location
      if (plugin !== sourcePlugin) {
        setSourcePlugin(plugin)
        setSourceFileId(saveFileId)
        setCurrentFileId(saveFileId)
      }

      toaster.create({
        title: 'Saved',
        description: `Saved via ${plugin.metadata.name}`,
        type: 'success',
        duration: 4000,
      })
    } catch (error: any) {
      toaster.create({
        title: 'Save failed',
        description: error.message,
        type: 'error',
        duration: 6000,
      })
    }
  }

  /**
   * Handle load button click - trigger file picker from specified plugin
   * This always opens the dialog/picker, never reloads current file
   */
  const handleLoad = async (plugin: IPersistencePlugin) => {
    // Switch to the specified plugin
    setCurrentPlugin(plugin)

    // Check if plugin has a LocationPromptComponent and needs location info
    if (plugin.LocationPromptComponent && plugin.validateIdentifier) {
      // Validate current sourceFileId (or empty object if none)
      const validation = plugin.validateIdentifier(sourceFileId || {}, 'load')

      if (!validation.valid) {
        // Need to prompt for location info
        setShowLocationPrompt('load')
        return
      }

      // Has valid location (bucket/prefix) - show file browser
      if (sourceFileId && sourceFileId.bucket && sourceFileId.prefix && plugin.listFiles) {
        try {
          // Check authentication
          if (plugin.capabilities.requiresAuth && !plugin.getAuthState?.().isAuthenticated) {
            // Remove filename from pending ID so we just show browser after auth
            setPendingFileId({ bucket: sourceFileId.bucket, prefix: sourceFileId.prefix })
            setShowAuthPrompt(true)
            return
          }

          // List files using plugin's listFiles method
          const location = `${sourceFileId.bucket}/${sourceFileId.prefix}`
          const files = await plugin.listFiles(location)

          // Convert FileInfo[] to GCSFile[] format
          const gcsFiles: GCSFile[] = files.map(f => ({
            name: f.name,
            fullName: f.name,
            size: f.size || '0',
            updated: f.updated || new Date().toISOString()
          }))

          setFileList(gcsFiles)
          setShowFilePicker(true)
          return
        } catch (error: any) {
          toaster.create({
            title: 'Failed to list files',
            description: error.message,
            type: 'error',
            duration: 6000,
          })
          return
        }
      }
    }

    // Local plugin: trigger file picker
    try {
      await loadFileFromPlugin(plugin, {})
    } catch (error: any) {
      // User cancelled or error
      if (error.message !== 'No file selected') {
        console.error('Load error:', error)
      }
    }
  }

  /**
   * Handle location prompt submission (generic for all plugins)
   */
  const handleLocationPromptSubmit = async (identifier: FileIdentifier) => {
    if (!currentPlugin) return

    const operation = showLocationPrompt
    setShowLocationPrompt(null)

    // Check authentication if required
    if (currentPlugin.capabilities.requiresAuth && !currentPlugin.getAuthState?.().isAuthenticated) {
      setPendingFileId(identifier)
      setShowAuthPrompt(true)
      return
    }

    if (operation === 'save') {
      // Save with the provided identifier
      await performSave(currentPlugin, identifier)
    } else if (operation === 'load') {
      // Save bucket/prefix to localStorage for next time
      if (identifier.bucket && identifier.prefix) {
        localStorage.setItem('gcs-last-bucket', identifier.bucket)
        localStorage.setItem('gcs-last-prefix', identifier.prefix)
      }

      // Update the source file ID
      setSourceFileId(identifier)
      setCurrentFileId(identifier)

      // If identifier includes filename, load it directly
      if (identifier.filename) {
        await loadFileFromPlugin(currentPlugin, identifier)
      } else {
        // No filename - show file browser to select a file
        if (currentPlugin.listFiles) {
          try {
            const location = `${identifier.bucket}/${identifier.prefix}`
            const files = await currentPlugin.listFiles(location)

            // Convert FileInfo[] to GCSFile[] format
            const gcsFiles: GCSFile[] = files.map(f => ({
              name: f.name,
              fullName: f.name,
              size: f.size || '0',
              updated: f.updated || new Date().toISOString()
            }))

            setFileList(gcsFiles)
            setShowFilePicker(true)
          } catch (error: any) {
            toaster.create({
              title: 'Failed to list files',
              description: error.message,
              type: 'error',
              duration: 6000,
            })
          }
        } else {
          // Plugin doesn't support file listing
          toaster.create({
            title: 'Location saved',
            description: 'Click Load File again to continue',
            type: 'info',
            duration: 3000,
          })
        }
      }
    }
  }

  const handleLocationPromptCancel = () => {
    setShowLocationPrompt(null)
  }

  /**
   * Handle file selection from file picker
   */
  const handleFileSelect = async (filename: string) => {
    if (!currentPlugin || !sourceFileId) return

    // Ensure we have all required fields for GCS
    if (!sourceFileId.bucket || !sourceFileId.prefix) {
      console.error('Missing bucket or prefix in sourceFileId:', sourceFileId)
      toaster.create({
        title: 'Configuration error',
        description: 'Missing bucket or prefix information',
        type: 'error',
        duration: 4000,
      })
      setShowFilePicker(false)
      return
    }

    const fileId: FileIdentifier = {
      bucket: sourceFileId.bucket,
      prefix: sourceFileId.prefix,
      filename
    }

    setShowFilePicker(false)
    await loadFileFromPlugin(currentPlugin, fileId)
  }

  const handleFilePickerClose = () => {
    setShowFilePicker(false)
  }

  const handleShowInstructions = () => {
    translationEditorRef.current?.openInstructions()
  }

  // Show client ID prompt if needed
  if (showClientIdPrompt) {
    return (
      <EditorLayout
        header={
          <UnifiedHeader
            plugins={plugins}
            onSave={handleSave}
            onLoad={handleLoad}
            hasData={!!translationData.jobData}
            fileStatus={translationData.fileStatus}
            onShowInstructions={handleShowInstructions}
            hasInstructions={!!translationData.jobData?.instructions}
            hasLanguageInfo={!!(translationData.jobData?.sourceLang || translationData.jobData?.targetLang)}
          />
        }
      >
        <ClientIdPrompt onSubmit={handleClientIdSubmit} onCancel={handleClientIdCancel} />
      </EditorLayout>
    )
  }

  // Show auth prompt if needed
  if (showAuthPrompt) {
    return (
      <EditorLayout
        header={
          <UnifiedHeader
            plugins={plugins}
            onSave={handleSave}
            onLoad={handleLoad}
            hasData={!!translationData.jobData}
            fileStatus={translationData.fileStatus}
            onShowInstructions={handleShowInstructions}
            hasInstructions={!!translationData.jobData?.instructions}
            hasLanguageInfo={!!(translationData.jobData?.sourceLang || translationData.jobData?.targetLang)}
          />
        }
      >
        <AuthPrompt
          bucket={(pendingFileId as any)?.bucket || ''}
          prefix={(pendingFileId as any)?.prefix || ''}
          filename={(pendingFileId as any)?.filename}
          onAccept={handleAuthPromptAccept}
        />
      </EditorLayout>
    )
  }

  return (
    <>
      {showLocationPrompt && currentPlugin?.LocationPromptComponent && (
        <currentPlugin.LocationPromptComponent
          currentIdentifier={sourceFileId || undefined}
          fileName={fileLoader.fileName}
          operation={showLocationPrompt}
          onSubmit={handleLocationPromptSubmit}
          onCancel={handleLocationPromptCancel}
        />
      )}

      <GCSFilePicker
        files={fileList}
        bucket={sourceFileId?.bucket || ''}
        prefix={sourceFileId?.prefix || ''}
        onFileSelect={handleFileSelect}
        isOpen={showFilePicker}
        onClose={handleFilePickerClose}
      />

    <EditorLayout
      header={
        <UnifiedHeader
          plugins={plugins}
          onSave={handleSave}
          onLoad={handleLoad}
          hasData={!!translationData.jobData}
          fileStatus={translationData.fileStatus}
          onShowInstructions={handleShowInstructions}
          hasInstructions={!!translationData.jobData?.instructions}
          hasLanguageInfo={!!(translationData.jobData?.sourceLang || translationData.jobData?.targetLang)}
        />
      }
    >
      <TranslationEditor
        ref={translationEditorRef}
        flowData={fileLoader.flowData}
        jobData={translationData.jobData}
        originalJobData={translationData.originalJobData}
        savedJobData={translationData.savedJobData}
        zipFile={fileLoader.zipFile}
        onTranslationUnitChange={translationData.updateTranslationUnit}
        onInstructionsOpen={() => {}}
      />
    </EditorLayout>
    </>
  )
}
