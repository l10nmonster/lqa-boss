import React, { useRef, useEffect, useMemo, useState } from 'react'
import { EditorLayout } from '../components/layout/EditorLayout'
import { UnifiedHeader } from '../components/headers/UnifiedHeader'
import { TranslationEditor, TranslationEditorRef } from '../components/TranslationEditor'
import { ClientIdPrompt } from '../components/prompts/ClientIdPrompt'
import { AuthPrompt } from '../components/prompts/AuthPrompt'
import { GDriveLocationPrompt } from '../components/prompts/GDriveLocationPrompt'
import FilePicker from '../components/FilePicker'
import { ModelEditor } from '../components/ModelEditor'
import QASummaryModal from '../components/QASummaryModal'
import { PreferencesModal } from '../components/PreferencesModal'

import { usePluginAuth } from '../hooks/usePluginAuth'
import { useQualityModel } from '../hooks/useQualityModel'
import { useFileOperations } from '../hooks/useFileOperations'
import { usePluginSettings } from '../hooks/usePluginSettings'
import { usePluginPreferences } from '../hooks/usePluginPreferences'
import { useReviewTimers } from '../hooks/useReviewTimers'
import { pluginRegistry } from '../plugins/PluginRegistry'
import { IPersistencePlugin, FileIdentifier } from '../plugins/types'
import { useNavigate } from 'react-router-dom'
import { calculateTER, calculateEPT, calculateQASummary, calculateTERStatistics, calculateSegmentWordCounts } from '../utils/metrics'
import { SettingsModal } from '../components/SettingsModal'

// Track processed URLs during this session (not persisted)
let processedUrl: string | null = null

export const EditorPage: React.FC = () => {
  const translationEditorRef = useRef<TranslationEditorRef>(null)
  const navigate = useNavigate()

  // Get all available plugins
  const allPlugins = pluginRegistry.getAllPlugins()

  // Initialize plugin preferences hook (for enabling/disabling plugins)
  const pluginPrefs = usePluginPreferences(allPlugins)

  // Use only enabled plugins for the UI
  const plugins = pluginPrefs.enabledPlugins

  // Initialize plugin settings hook
  const pluginSettings = usePluginSettings(plugins)
  const [showSettingsForPlugin, setShowSettingsForPlugin] = useState<string | null>(null)
  const [showPreferences, setShowPreferences] = useState(false)
  const [refreshExtensionAvailability, setRefreshExtensionAvailability] = useState(0)
  const [refreshAuthState, setRefreshAuthState] = useState(0)

  // Initialize quality model hook
  const qualityModelHook = useQualityModel()

  // Initialize review timers hook for STTR/ATTR tracking
  const reviewTimers = useReviewTimers()

  // Initialize file operations hook with callbacks
  const fileOps = useFileOperations({
    onAuthRequired: async (plugin: IPersistencePlugin, fileId: FileIdentifier) => {
      auth.setPendingFileId(fileId)
      auth.setCurrentPlugin(plugin)
      auth.setShowAuthPrompt(true)
      return true
    },
    onQualityModelLoaded: (model) => {
      if (model) {
        qualityModelHook.setQualityModel(model)
        console.log('Quality model loaded:', model.name)
      }
    },
    onFileLoaded: () => {
      // Reset auth state when a file is successfully loaded
      // This ensures we exit auth screens when loading via a different plugin
      auth.setShowAuthPrompt(false)
      auth.setCurrentPlugin(null)
      auth.setPendingFileId(null)
    }
  })

  // Initialize auth hook with post-auth callback
  const auth = usePluginAuth({
    onAuthComplete: async (plugin: IPersistencePlugin, fileId: FileIdentifier | null) => {
      // Trigger header to re-check auth state
      setRefreshAuthState(n => n + 1)

      if (!fileId) return

      // Determine if this is a save operation
      const isSaveOperation = !!fileOps.translationData.jobData && !!(fileId as any).fileName

      if (isSaveOperation) {
        // Continue with save flow
        if (plugin.validateIdentifier) {
          const validation = plugin.validateIdentifier(fileId, 'save')

          if (!validation.valid) {
            if (plugin.LocationPromptComponent) {
              fileOps.setShowLocationPrompt('save')
              auth.setPendingFileId(null)
              return
            }
          }
        }
        await fileOps.performSave(plugin, fileId)
        auth.setPendingFileId(null)
      } else {
        // Load flow
        fileOps.setSourceFileId(fileId)
        fileOps.setCurrentFileId(fileId)

        if (fileId.filename || fileId.fileId) {
          // Has specific file to load
          await fileOps.loadFileFromPlugin(plugin, fileId)
        } else if (fileId.folderId || (fileId.bucket && fileId.prefix)) {
          // GDrive or GCS: show unified file picker
          await fileOps.showFileListBrowser(plugin, fileId)
        }
        auth.setPendingFileId(null)
      }
    }
  })

  // Calculate metrics
  const ter = useMemo(() => {
    return calculateTER(fileOps.translationData.jobData, fileOps.translationData.originalJobData)
  }, [fileOps.translationData.jobData, fileOps.translationData.originalJobData])

  const ept = useMemo(() => {
    if (!qualityModelHook.qualityModel) return null
    return calculateEPT(fileOps.translationData.jobData)
  }, [fileOps.translationData.jobData, qualityModelHook.qualityModel])

  const qaSummary = useMemo(() => {
    return calculateQASummary(fileOps.translationData.jobData, fileOps.translationData.originalJobData)
  }, [fileOps.translationData.jobData, fileOps.translationData.originalJobData])

  const terStats = useMemo(() => {
    return calculateTERStatistics(fileOps.translationData.jobData, fileOps.translationData.originalJobData)
  }, [fileOps.translationData.jobData, fileOps.translationData.originalJobData])

  const segmentWordCounts = useMemo(() => {
    return calculateSegmentWordCounts(fileOps.translationData.jobData)
  }, [fileOps.translationData.jobData])

  // Calculate review completion statistics
  const reviewStats = useMemo(() => {
    if (!fileOps.translationData.jobData) {
      return { reviewed: 0, total: 0, percentage: 0 }
    }

    const total = fileOps.translationData.jobData.tus.length
    const reviewed = fileOps.translationData.jobData.tus.filter(tu => tu.ts).length
    const percentage = total > 0 ? Math.round((reviewed / total) * 100) : 0

    return { reviewed, total, percentage }
  }, [fileOps.translationData.jobData])

  // URL parsing for deep links (only on initial mount)
  useEffect(() => {
    const currentUrl = window.location.pathname + window.location.search

    // Skip if this URL was already processed in this session
    if (processedUrl === currentUrl) return

    // Check for path-based GCS URLs first (e.g., /gcs/bucket/prefix/file.lqaboss)
    const pathSegments = window.location.pathname.split('/').filter(s => s)
    if (pathSegments[0] === 'gcs') {
      const gcsPlugin = pluginRegistry.getPlugin('gcs')
      if (gcsPlugin && gcsPlugin.parsePathUrl) {
        const fileId = gcsPlugin.parsePathUrl(pathSegments)
        if (fileId) {
          processedUrl = currentUrl
          fileOps.setCurrentPlugin(gcsPlugin)
          fileOps.handleAutoLoad(gcsPlugin, fileId)
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
        processedUrl = currentUrl
        fileOps.setCurrentPlugin(plugin)

        // Extension plugin: immediately load file
        if (pluginId === 'extension') {
          fileOps.loadFileFromPlugin(plugin, {})
          return
        }

        // Other plugins: Let plugin parse URL for file identifier
        const fileId = plugin.parseUrl?.(params)
        if (fileId) {
          fileOps.handleAutoLoad(plugin, fileId)
        }
      }
    }
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
            const localPlugin = pluginRegistry.getPlugin('local')
            if (localPlugin) {
              fileOps.setCurrentPlugin(localPlugin)
              await fileOps.loadFileFromPlugin(localPlugin, { file })
            }
          } catch (err) {
            console.error('Error processing launched file:', err)
          }
        }
      })
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Update URL when file is loaded
  useEffect(() => {
    if (fileOps.currentPlugin && fileOps.currentFileId && fileOps.currentPlugin.buildUrl) {
      const newUrl = fileOps.currentPlugin.buildUrl(fileOps.currentFileId)
      const currentPath = window.location.pathname + window.location.search

      if (newUrl !== currentPath) {
        navigate(newUrl, { replace: true })
      }
    }
  }, [fileOps.currentPlugin, fileOps.currentFileId, navigate])

  // Warn user about unsaved changes when closing tab or navigating away
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (fileOps.translationData.fileStatus === 'CHANGED') {
        e.preventDefault()
        // Modern browsers ignore custom messages but still show a generic prompt
        e.returnValue = 'You have unsaved changes. Are you sure you want to leave?'
        return e.returnValue
      }
    }

    window.addEventListener('beforeunload', handleBeforeUnload)
    return () => window.removeEventListener('beforeunload', handleBeforeUnload)
  }, [fileOps.translationData.fileStatus])

  const handleShowInstructions = () => {
    translationEditorRef.current?.openInstructions()
  }

  const handleShowPluginSettings = (pluginId: string) => {
    setShowSettingsForPlugin(pluginId)
  }

  const handleSettingsSaved = () => {
    // Trigger re-check of extension availability
    setRefreshExtensionAvailability(prev => prev + 1)
  }

  const handleReviewToggle = (guid: string, reviewed: boolean, sttr?: number, attr?: number) => {
    if (!fileOps.translationData.jobData) return

    const tu = fileOps.translationData.jobData.tus.find(t => t.guid === guid)
    if (!tu) return

    const updatedTu = {
      ...tu,
      ts: reviewed ? Date.now() : undefined,
      sttr: sttr ?? tu.sttr,  // Set new or preserve existing
      attr: attr ?? tu.attr   // Set new or preserve existing
    }

    fileOps.translationData.updateTranslationUnit(updatedTu)
  }

  // Memoize header props to avoid re-renders
  const headerProps = useMemo(() => ({
    plugins,
    onSave: fileOps.handleSave,
    onLoad: fileOps.handleLoad,
    hasData: !!fileOps.translationData.jobData,
    fileStatus: fileOps.translationData.fileStatus,
    onShowInstructions: handleShowInstructions,
    ter,
    ept,
    reviewStats,
    qualityModel: qualityModelHook.qualityModel,
    onNewModel: qualityModelHook.handleNewModel,
    onLoadModel: qualityModelHook.handleLoadModel,
    onEditModel: qualityModelHook.handleEditModel,
    onUnloadModel: qualityModelHook.handleUnloadModel,
    onShowSummary: qualityModelHook.handleShowSummary,
    onShowPluginSettings: handleShowPluginSettings,
    onShowPreferences: () => setShowPreferences(true),
    refreshExtensionAvailability,
    refreshAuthState,
  }), [
    plugins,
    fileOps.handleSave,
    fileOps.handleLoad,
    fileOps.translationData.jobData,
    fileOps.translationData.fileStatus,
    ter,
    ept,
    reviewStats,
    qualityModelHook.qualityModel,
    qualityModelHook.handleNewModel,
    qualityModelHook.handleLoadModel,
    qualityModelHook.handleEditModel,
    qualityModelHook.handleUnloadModel,
    qualityModelHook.handleShowSummary,
    refreshExtensionAvailability,
    refreshAuthState,
  ])

  const header = <UnifiedHeader {...headerProps} />

  // Helper to build location description for auth prompt
  const getLocationDescription = (): string | undefined => {
    const fileId = auth.pendingFileId as any
    if (!fileId) return undefined

    // GCS format: bucket/prefix/filename
    if (fileId.bucket && fileId.prefix) {
      const parts = [fileId.bucket, fileId.prefix]
      if (fileId.filename) parts.push(fileId.filename)
      return parts.join('/')
    }

    // GDrive format: just filename if present
    if (fileId.filename) {
      return fileId.filename
    }

    return undefined
  }

  // Show client ID prompt if needed
  if (auth.showClientIdPrompt && auth.currentPlugin) {
    return (
      <EditorLayout header={header}>
        <ClientIdPrompt
          pluginName={auth.currentPlugin.metadata.name}
          onSubmit={auth.handleClientIdSubmit}
          onCancel={auth.handleClientIdCancel}
        />
      </EditorLayout>
    )
  }

  // Show auth prompt if needed
  if (auth.showAuthPrompt && auth.currentPlugin) {
    return (
      <EditorLayout header={header}>
        <AuthPrompt
          pluginName={auth.currentPlugin.metadata.name}
          locationDescription={getLocationDescription()}
          onAccept={auth.handleAuthPromptAccept}
        />
      </EditorLayout>
    )
  }

  return (
    <>
      {fileOps.showLocationPrompt && fileOps.currentPlugin?.LocationPromptComponent && (
        <fileOps.currentPlugin.LocationPromptComponent
          currentIdentifier={fileOps.sourceFileId || undefined}
          fileName={fileOps.fileLoader.fileName}
          operation={fileOps.showLocationPrompt}
          onSubmit={fileOps.handleLocationPromptSubmit}
          onCancel={fileOps.handleLocationPromptCancel}
        />
      )}

      <FilePicker
        title={`Load Job from ${fileOps.currentPlugin?.metadata.name || 'Cloud'}`}
        files={fileOps.fileList}
        loading={fileOps.fileListLoading}
        error={fileOps.fileListError || undefined}
        onFileSelect={fileOps.handleFileSelect}
        onRetry={fileOps.handleFileListRetry}
        isOpen={fileOps.showFilePicker}
        onClose={fileOps.handleFilePickerClose}
        location={fileOps.filePickerLocation}
        onLocationChange={fileOps.handleFilePickerLocationChange}
        onBrowseFolders={fileOps.handleBrowseFolders}
      />

      {/* GDrive folder browser for changing folder */}
      {fileOps.showFolderBrowser && fileOps.currentPlugin?.metadata.id === 'gdrive' && (
        <GDriveLocationPrompt
          accessToken={(fileOps.currentPlugin as any).getAccessToken?.() || ''}
          currentFolderId={fileOps.filePickerLocation.folderId || 'root'}
          operation="load"
          onSubmit={(folderId: string, folderName: string) => {
            fileOps.handleFolderSelected(folderId, folderName)
          }}
          onCancel={() => fileOps.setShowFolderBrowser(false)}
        />
      )}

      <ModelEditor
        isOpen={qualityModelHook.showModelEditor}
        onClose={qualityModelHook.handleCloseModelEditor}
        model={qualityModelHook.editingModel}
        onSave={qualityModelHook.handleSaveModel}
      />

      <QASummaryModal
        isOpen={qualityModelHook.showQASummary}
        onClose={qualityModelHook.handleCloseQASummary}
        qualityModel={qualityModelHook.qualityModel}
        qaSummary={qaSummary}
        terStats={terStats}
        ter={ter}
        ept={ept}
        segmentWordCounts={segmentWordCounts}
      />

      <SettingsModal
        isOpen={!!showSettingsForPlugin}
        onClose={() => setShowSettingsForPlugin(null)}
        pluginsWithSettings={
          showSettingsForPlugin
            ? pluginSettings.getPluginsWithSettings().filter(p => p.plugin.metadata.id === showSettingsForPlugin)
            : []
        }
        currentSettings={pluginSettings.settings}
        onSave={pluginSettings.setPluginSettings}
        onAfterSave={handleSettingsSaved}
      />

      <PreferencesModal
        isOpen={showPreferences}
        onClose={() => setShowPreferences(false)}
        pluginsWithState={pluginPrefs.pluginsWithState}
        onTogglePlugin={pluginPrefs.togglePlugin}
      />

      <EditorLayout header={header}>
        <TranslationEditor
          ref={translationEditorRef}
          flowData={fileOps.fileLoader.flowData}
          jobData={fileOps.translationData.jobData}
          originalJobData={fileOps.translationData.originalJobData}
          savedJobData={fileOps.translationData.savedJobData}
          pageImages={fileOps.fileLoader.pageImages}
          loadingProgress={fileOps.fileLoader.loadingProgress}
          onTranslationUnitChange={fileOps.translationData.updateTranslationUnit}
          onCandidateSelect={fileOps.translationData.selectCandidate}
          onInstructionsOpen={() => {}}
          sourceInfo={fileOps.getSourceDisplayInfo()}
          qualityModel={qualityModelHook.qualityModel}
          ept={ept}
          onReviewToggle={handleReviewToggle}
          onSegmentFocusStart={reviewTimers.startSegmentTimer}
          onSegmentFocusEnd={reviewTimers.stopSegmentTimer}
          onSegmentEdited={reviewTimers.markSegmentEdited}
          onPageTimerStart={reviewTimers.startPageTimer}
          onPageTimerStop={reviewTimers.stopPageTimer}
        />
      </EditorLayout>
    </>
  )
}
