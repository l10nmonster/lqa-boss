import React, { useRef, useEffect, useMemo, useState } from 'react'
import { EditorLayout } from '../components/layout/EditorLayout'
import { UnifiedHeader } from '../components/headers/UnifiedHeader'
import { TranslationEditor, TranslationEditorRef } from '../components/TranslationEditor'
import { ClientIdPrompt } from '../components/prompts/ClientIdPrompt'
import { AuthPrompt } from '../components/prompts/AuthPrompt'
import GCSFilePicker from '../components/GCSFilePicker'
import { ModelEditor } from '../components/ModelEditor'
import QASummaryModal from '../components/QASummaryModal'

import { usePluginAuth } from '../hooks/usePluginAuth'
import { useQualityModel } from '../hooks/useQualityModel'
import { useFileOperations } from '../hooks/useFileOperations'
import { usePluginSettings } from '../hooks/usePluginSettings'
import { pluginRegistry } from '../plugins/PluginRegistry'
import { IPersistencePlugin, FileIdentifier } from '../plugins/types'
import { useNavigate } from 'react-router-dom'
import { calculateTER, calculateEPT, calculateQASummary, calculateTERStatistics } from '../utils/metrics'
import { SettingsModal } from '../components/SettingsModal'

// Track processed URLs during this session (not persisted)
let processedUrl: string | null = null

export const EditorPage: React.FC = () => {
  const translationEditorRef = useRef<TranslationEditorRef>(null)
  const navigate = useNavigate()

  // Get all available plugins
  const plugins = pluginRegistry.getAllPlugins()

  // Initialize plugin settings hook
  const pluginSettings = usePluginSettings(plugins)
  const [showSettingsForPlugin, setShowSettingsForPlugin] = useState<string | null>(null)
  const [refreshExtensionAvailability, setRefreshExtensionAvailability] = useState(0)

  // Initialize quality model hook
  const qualityModelHook = useQualityModel()

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
    }
  })

  // Initialize auth hook with post-auth callback
  const auth = usePluginAuth({
    onAuthComplete: async (plugin: IPersistencePlugin, fileId: FileIdentifier | null) => {
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

        if (fileId.filename) {
          await fileOps.loadFileFromPlugin(plugin, fileId)
        } else {
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

  // Calculate review completion statistics
  const reviewStats = useMemo(() => {
    if (!fileOps.translationData.jobData) {
      return { reviewed: 0, total: 0, percentage: 0 }
    }

    const total = fileOps.translationData.jobData.tus.length
    const reviewed = fileOps.translationData.jobData.tus.filter(tu => tu.reviewedTs).length
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

  const handleReviewToggle = (guid: string, reviewed: boolean) => {
    if (!fileOps.translationData.jobData) return

    const tu = fileOps.translationData.jobData.tus.find(t => t.guid === guid)
    if (!tu) return

    const updatedTu = {
      ...tu,
      reviewedTs: reviewed ? Date.now() : undefined
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
    refreshExtensionAvailability,
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
  ])

  const header = <UnifiedHeader {...headerProps} />

  // Show client ID prompt if needed
  if (auth.showClientIdPrompt) {
    return (
      <EditorLayout header={header}>
        <ClientIdPrompt
          onSubmit={auth.handleClientIdSubmit}
          onCancel={auth.handleClientIdCancel}
        />
      </EditorLayout>
    )
  }

  // Show auth prompt if needed
  if (auth.showAuthPrompt) {
    return (
      <EditorLayout header={header}>
        <AuthPrompt
          bucket={(auth.pendingFileId as any)?.bucket || ''}
          prefix={(auth.pendingFileId as any)?.prefix || ''}
          filename={(auth.pendingFileId as any)?.filename}
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

      <GCSFilePicker
        files={fileOps.fileList}
        bucket={fileOps.sourceFileId?.bucket || ''}
        prefix={fileOps.sourceFileId?.prefix || ''}
        onFileSelect={fileOps.handleFileSelect}
        onReloadWithLocation={async (bucket: string, prefix: string) => {
          const gcsPlugin = plugins.find(p => p.metadata.id === 'gcs')
          if (gcsPlugin) {
            await fileOps.showFileListBrowser(gcsPlugin, { bucket, prefix })
          }
        }}
        isOpen={fileOps.showFilePicker}
        onClose={fileOps.handleFilePickerClose}
      />

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

      <EditorLayout header={header}>
        <TranslationEditor
          ref={translationEditorRef}
          flowData={fileOps.fileLoader.flowData}
          jobData={fileOps.translationData.jobData}
          originalJobData={fileOps.translationData.originalJobData}
          savedJobData={fileOps.translationData.savedJobData}
          zipFile={fileOps.fileLoader.zipFile}
          onTranslationUnitChange={fileOps.translationData.updateTranslationUnit}
          onCandidateSelect={fileOps.translationData.selectCandidate}
          onInstructionsOpen={() => {}}
          sourcePluginName={fileOps.sourcePlugin?.metadata.name}
          sourceLocation={fileOps.getSourceLocation()}
          qualityModel={qualityModelHook.qualityModel}
          ept={ept}
          onReviewToggle={handleReviewToggle}
        />
      </EditorLayout>
    </>
  )
}
