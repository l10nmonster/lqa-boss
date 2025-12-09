import { useState } from 'react'
import { IPersistencePlugin, FileIdentifier } from '../plugins/types'
import { toaster } from '../components/ui/toaster'
import { JobData } from '../types'
import { QualityModel } from '../types/qualityModel'
import { useFileLoader } from './useFileLoader'
import { useTranslationData } from './useTranslationData'
import { PickerFile, LocationInfo } from '../components/FilePicker'

export interface UseFileOperationsOptions {
  onAuthRequired?: (plugin: IPersistencePlugin, fileId: FileIdentifier) => Promise<boolean>
  onQualityModelLoaded?: (model: QualityModel | null) => void
}

export function useFileOperations(options?: UseFileOperationsOptions) {
  const [currentPlugin, setCurrentPlugin] = useState<IPersistencePlugin | null>(null)
  const [currentFileId, setCurrentFileId] = useState<FileIdentifier | null>(null)
  const [sourcePlugin, setSourcePlugin] = useState<IPersistencePlugin | null>(null)
  const [sourceFileId, setSourceFileId] = useState<FileIdentifier | null>(null)
  const [showLocationPrompt, setShowLocationPrompt] = useState<'load' | 'save' | null>(null)
  const [showFilePicker, setShowFilePicker] = useState(false)
  const [fileList, setFileList] = useState<PickerFile[]>([])
  const [fileListLoading, setFileListLoading] = useState(false)
  const [fileListError, setFileListError] = useState<string | null>(null)
  const [filePickerLocation, setFilePickerLocation] = useState<LocationInfo>({})
  const [showFolderBrowser, setShowFolderBrowser] = useState(false)

  const fileLoader = useFileLoader()
  const translationData = useTranslationData()

  /**
   * Load file list and show unified file picker
   * Works for both GCS (bucket/prefix) and GDrive (folderId)
   */
  const showFileListBrowser = async (
    plugin: IPersistencePlugin,
    fileId: FileIdentifier
  ): Promise<void> => {
    if (!plugin.listFiles) {
      return
    }

    // Determine location based on plugin type
    let location: string | undefined
    if (fileId.bucket && fileId.prefix) {
      // GCS format
      location = `${fileId.bucket}/${fileId.prefix}`
    } else if (fileId.folderId) {
      // GDrive format
      location = fileId.folderId
    } else {
      return
    }

    // Update sourceFileId so the picker shows the correct location
    setSourceFileId(fileId)
    setCurrentFileId(fileId)
    setFileListLoading(true)
    setFileListError(null)
    setShowFilePicker(true)

    // Set location info for the picker
    if (fileId.bucket && fileId.prefix) {
      setFilePickerLocation({ bucket: fileId.bucket, prefix: fileId.prefix })
    } else if (fileId.folderId) {
      setFilePickerLocation({ folderId: fileId.folderId, folderName: fileId.folderName })
    }

    try {
      const files = await plugin.listFiles(location)

      const pickerFiles: PickerFile[] = files.map(f => ({
        id: f.identifier?.fileId || f.name,
        name: f.name,
        size: f.size || '0',
        updated: f.updated || new Date().toISOString()
      }))

      setFileList(pickerFiles)
    } catch (error: any) {
      setFileListError(error.message)
      toaster.create({
        title: 'Failed to list files',
        description: error.message,
        type: 'error',
        duration: 6000,
      })
    } finally {
      setFileListLoading(false)
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
        if (options?.onAuthRequired) {
          const authInitiated = await options.onAuthRequired(plugin, fileId)
          if (authInitiated) return
        }
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

      // Update fileId to include filename for tracking source location
      const updatedFileId = {
        ...fileId,
        fileName: file.name
      }

      setCurrentFileId(updatedFileId)
      setSourceFileId(updatedFileId)
      setCurrentPlugin(plugin)
      setSourcePlugin(plugin)

      // Set quality model if one was found in the .lqaboss file
      if (options?.onQualityModelLoaded) {
        options.onQualityModelLoaded(result.qualityModel || null)
      }

      toaster.create({
        title: 'File loaded',
        description: translationResult.foundEdited
          ? `Found ${translationResult.editedCount} edited translation${translationResult.editedCount === 1 ? '' : 's'}`
          : `Loaded via ${plugin.metadata.name}`,
        type: 'success',
        duration: 4000,
      })

      return { fileId, result }
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
        sourcePluginId: sourcePlugin?.metadata.id, // Track where file was originally loaded from
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
      if (options?.onAuthRequired) {
        // Build save identifier to pass through auth flow
        const saveIdentifier = {
          ...currentFileId,
          fileName: fileLoader.fileName,
          filename: fileLoader.fileName
        }
        await options.onAuthRequired(plugin, saveIdentifier)
        return
      }
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
   * Handle load button click - trigger file picker from specified plugin
   */
  const handleLoad = async (plugin: IPersistencePlugin) => {
    // Switch to the specified plugin
    setCurrentPlugin(plugin)

    // Check if plugin has a LocationPromptComponent and needs location info
    if (plugin.LocationPromptComponent && plugin.validateIdentifier) {
      // For GCS plugin, use settings instead of last used location
      let identifierToValidate: FileIdentifier

      if (plugin.metadata.id === 'gcs') {
        // Read from settings
        const defaultBucket = localStorage.getItem('plugin-gcs-defaultBucket') || ''
        const defaultPrefix = localStorage.getItem('plugin-gcs-defaultPrefix') || ''

        identifierToValidate = {
          bucket: defaultBucket,
          prefix: defaultPrefix
        }
      } else if (plugin.metadata.id === 'gdrive') {
        // For GDrive, read default folder from settings
        const defaultFolderId = localStorage.getItem('plugin-gdrive-defaultFolderId') || 'root'
        identifierToValidate = {
          folderId: defaultFolderId
        }
      } else {
        // For other plugins, use sourceFileId
        identifierToValidate = sourceFileId || {}
      }

      // Validate the identifier
      const validation = plugin.validateIdentifier(identifierToValidate, 'load')

      if (!validation.valid) {
        // For GCS, show error instead of prompt if settings are not configured
        if (plugin.metadata.id === 'gcs') {
          toaster.create({
            title: 'GCS settings not configured',
            description: `Please configure ${validation.missing?.join(', ')} in Settings → Google Cloud Storage`,
            type: 'error',
            duration: 8000,
          })
          return
        }

        // For plugins requiring auth, check authentication before showing location prompt
        if (plugin.capabilities.requiresAuth) {
          // Check if needs setup first
          if (plugin.needsSetup?.()) {
            if (options?.onAuthRequired) {
              await options.onAuthRequired(plugin, identifierToValidate)
              return
            }
          }

          // Check if not authenticated
          if (!plugin.getAuthState?.().isAuthenticated) {
            if (options?.onAuthRequired) {
              await options.onAuthRequired(plugin, identifierToValidate)
              return
            }
          }
        }

        // For other plugins, show location prompt
        setShowLocationPrompt('load')
        return
      }

      // Has valid location (bucket/prefix for GCS, folderId for GDrive) - show file browser
      if (identifierToValidate.bucket && identifierToValidate.prefix && plugin.listFiles) {
        try {
          // Check authentication
          if (plugin.capabilities.requiresAuth && !plugin.getAuthState?.().isAuthenticated) {
            if (options?.onAuthRequired) {
              // Remove filename from pending ID so we just show browser after auth
              await options.onAuthRequired(plugin, {
                bucket: identifierToValidate.bucket,
                prefix: identifierToValidate.prefix
              })
              return
            }
          }

          // Show file browser
          await showFileListBrowser(plugin, identifierToValidate)
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

      // For GDrive with valid folderId, check auth then show file picker
      if (plugin.metadata.id === 'gdrive' && identifierToValidate.folderId) {
        // Check authentication first
        if (plugin.capabilities.requiresAuth) {
          if (plugin.needsSetup?.()) {
            if (options?.onAuthRequired) {
              await options.onAuthRequired(plugin, identifierToValidate)
              return
            }
          }

          if (!plugin.getAuthState?.().isAuthenticated) {
            if (options?.onAuthRequired) {
              await options.onAuthRequired(plugin, identifierToValidate)
              return
            }
          }
        }

        // Authenticated - show unified file picker
        await showFileListBrowser(plugin, identifierToValidate)
        return
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
      if (options?.onAuthRequired) {
        await options.onAuthRequired(currentPlugin, identifier)
        return
      }
    }

    if (operation === 'save') {
      // Save with the provided identifier
      await performSave(currentPlugin, identifier)
    } else if (operation === 'load') {
      // Save location to settings for next time based on plugin
      if (currentPlugin.metadata.id === 'gcs' && identifier.bucket && identifier.prefix) {
        localStorage.setItem('plugin-gcs-defaultBucket', identifier.bucket)
        localStorage.setItem('plugin-gcs-defaultPrefix', identifier.prefix)
      } else if (currentPlugin.metadata.id === 'gdrive' && identifier.folderId) {
        localStorage.setItem('plugin-gdrive-defaultFolderId', identifier.folderId)
      }

      // Update the source file ID
      setSourceFileId(identifier)
      setCurrentFileId(identifier)

      // If identifier includes filename, load it directly
      if (identifier.filename) {
        await loadFileFromPlugin(currentPlugin, identifier)
      } else {
        // No filename - show file browser to select a file (for GCS)
        if (currentPlugin.listFiles && identifier.bucket && identifier.prefix) {
          await showFileListBrowser(currentPlugin, identifier)
        } else {
          // Plugin doesn't support file listing or no location info
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

  /**
   * Handle file selection from file picker
   */
  const handleFileSelect = async (file: PickerFile) => {
    if (!currentPlugin || !sourceFileId) return

    // Build file identifier based on plugin type
    let fileId: FileIdentifier

    if (sourceFileId.bucket && sourceFileId.prefix) {
      // GCS format
      fileId = {
        bucket: sourceFileId.bucket,
        prefix: sourceFileId.prefix,
        filename: file.name
      }
    } else if (sourceFileId.folderId) {
      // GDrive format
      fileId = {
        folderId: sourceFileId.folderId,
        fileId: file.id,
        filename: file.name
      }
    } else {
      console.error('Unknown source file ID format:', sourceFileId)
      toaster.create({
        title: 'Configuration error',
        description: 'Unknown file source format',
        type: 'error',
        duration: 4000,
      })
      setShowFilePicker(false)
      return
    }

    setShowFilePicker(false)
    await loadFileFromPlugin(currentPlugin, fileId)
  }

  /**
   * Auto-load file from URL or show auth prompt if needed
   */
  const handleAutoLoad = async (plugin: IPersistencePlugin, fileId: FileIdentifier) => {
    try {
      // Check if plugin needs setup (e.g., client ID for GCS)
      if (plugin.needsSetup?.()) {
        if (options?.onAuthRequired) {
          await options.onAuthRequired(plugin, fileId)
        }
        return
      }

      // Check if auth is required
      if (plugin.capabilities.requiresAuth && !plugin.getAuthState?.().isAuthenticated) {
        if (options?.onAuthRequired) {
          await options.onAuthRequired(plugin, fileId)
        }
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
        await showFileListBrowser(plugin, fileId)
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
   * Get source display info from the plugin
   */
  const getSourceDisplayInfo = () => {
    if (!sourcePlugin || !sourceFileId) return undefined
    return sourcePlugin.getSourceDisplayInfo?.(sourceFileId) || undefined
  }

  // Handle location change from file picker (for GCS inline editing)
  const handleFilePickerLocationChange = async (location: LocationInfo) => {
    if (!currentPlugin) return

    if (location.bucket && location.prefix) {
      const newFileId = { bucket: location.bucket, prefix: location.prefix }
      await showFileListBrowser(currentPlugin, newFileId)
    }
  }

  // Handle browse folders button click (for GDrive)
  const handleBrowseFolders = () => {
    setShowFolderBrowser(true)
  }

  // Handle folder selection from GDrive folder browser
  const handleFolderSelected = async (folderId: string, folderName: string) => {
    if (!currentPlugin) return

    setShowFolderBrowser(false)
    const newFileId = { folderId, folderName }
    await showFileListBrowser(currentPlugin, newFileId)
  }

  return {
    // State
    currentPlugin,
    currentFileId,
    sourcePlugin,
    sourceFileId,
    showLocationPrompt,
    showFilePicker,
    fileList,
    fileListLoading,
    fileListError,
    filePickerLocation,
    showFolderBrowser,
    fileLoader,
    translationData,

    // Actions
    loadFileFromPlugin,
    handleSave,
    handleLoad,
    handleAutoLoad,
    handleLocationPromptSubmit,
    handleFileSelect,
    performSave,
    showFileListBrowser,
    getSourceDisplayInfo,
    handleFilePickerLocationChange,
    handleBrowseFolders,
    handleFolderSelected,

    // Setters
    setCurrentPlugin,
    setCurrentFileId,
    setSourceFileId,
    setShowLocationPrompt,
    setShowFilePicker,
    setShowFolderBrowser,
    handleLocationPromptCancel: () => setShowLocationPrompt(null),
    handleFilePickerClose: () => setShowFilePicker(false),
    handleFileListRetry: () => {
      if (currentPlugin && sourceFileId) {
        showFileListBrowser(currentPlugin, sourceFileId)
      }
    },
  }
}
