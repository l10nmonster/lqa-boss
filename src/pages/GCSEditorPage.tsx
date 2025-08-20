import React, { useState, useEffect, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { EditorLayout } from '../components/layout/EditorLayout'
import { GCSEditorHeader } from '../components/headers/GCSEditorHeader'
import { TranslationEditor, TranslationEditorRef } from '../components/TranslationEditor'
import { ClientIdPrompt } from '../components/prompts/ClientIdPrompt'
import { AuthPrompt } from '../components/prompts/AuthPrompt'

import { useTranslationData } from '../hooks/useTranslationData'
import { useFileLoader } from '../hooks/useFileLoader'
import { useGCSOperations } from '../hooks/useGCSOperations'
import { GCSUrlParser, GCSModeConfig } from '../utils/gcsUrlParser'
import { toaster } from '../components/ui/toaster'
import { JobData } from '../types'
import { isEqual } from 'lodash'

export const GCSEditorPage: React.FC = () => {
  const { bucket, prefix, filename } = useParams<{
    bucket: string
    prefix: string
    filename?: string
  }>()
  const navigate = useNavigate()
  
  const [gcsMode, setGcsMode] = useState<GCSModeConfig | null>(null)
  const [showAuthPrompt, setShowAuthPrompt] = useState(false)
  const [showClientIdPrompt, setShowClientIdPrompt] = useState(false)
  
  const currentFileNameRef = useRef<string>('')
  const fileLoadingIdRef = useRef<number>(0)
  const translationEditorRef = useRef<TranslationEditorRef>(null)
  
  const gcs = useGCSOperations()
  const fileLoader = useFileLoader()
  const translationData = useTranslationData()
  
  // Parse URL parameters into GCS mode config
  useEffect(() => {
    if (bucket && prefix) {
      const config: GCSModeConfig = {
        bucket: decodeURIComponent(bucket),
        prefix: decodeURIComponent(prefix),
        filename: filename ? decodeURIComponent(filename) : undefined
      }
      setGcsMode(config)
      console.log('GCS mode configured:', config)
    }
  }, [bucket, prefix, filename])
  
  // Auto-load file or show auth prompt when GCS mode is detected
  useEffect(() => {
    let retryCount = 0
    const maxRetries = 10
    
    const attemptAutoAction = async () => {
      if (!gcsMode) return
      
      // Check if Google Identity Services is loaded, with retry mechanism
      if (!(window as any).google?.accounts?.oauth2) {
        if (retryCount < maxRetries) {
          retryCount++
          console.log(`Google Identity Services not yet loaded, retrying (${retryCount}/${maxRetries})...`)
          setTimeout(attemptAutoAction, 500)
          return
        } else {
          console.warn('Google Identity Services failed to load after maximum retries')
          return
        }
      }
      
      if (gcsMode.filename) {
        // URL has filename - try to load the specific file
        if (gcs.isAuthenticated) {
          // Check if this file is already loaded to prevent duplicate loading
          if (currentFileNameRef.current !== gcsMode.filename) {
            console.log('Attempting to auto-load file with saved credentials')
            const file = await gcs.loadFileFromMode(gcsMode)
            if (file) {
              await handleFileLoad(file)
            }
          } else {
            console.log('File already loaded, skipping auto-load')
          }
        } else {
          // Not authenticated - show auth prompt instead of auto-triggering
          console.log('Not authenticated, showing auth prompt for file load')
          setShowAuthPrompt(true)
        }
      } else {
        // URL has only bucket/prefix - load file list for popover
        if (gcs.isAuthenticated) {
          console.log('Loading file list for popover with saved credentials')
          await gcs.loadFileListForMode(gcsMode)
        } else {
          // Not authenticated - show auth prompt instead of auto-triggering
          console.log('Not authenticated, showing auth prompt for file picker')
          setShowAuthPrompt(true)
        }
      }
    }
    
    // Start attempting auto action after a small delay
    const timer = setTimeout(attemptAutoAction, 200)
    return () => clearTimeout(timer)
  }, [gcsMode, gcs.isAuthenticated, gcs.accessToken, gcs.clientId])
  
  // Function to load saved translations for a job
  const loadSavedTranslations = async (filename: string, jobData?: JobData): Promise<{ foundEdited: boolean; editedCount: number }> => {
    if (!gcsMode || !filename.endsWith('.lqaboss')) {
      // Not a .lqaboss file, set up two-state system (original = saved = current)
      if (translationData.jobData) {
        translationData.setupTwoStateSystem(translationData.jobData)
      }
      return { foundEdited: false, editedCount: 0 }
    }

    const jobId = filename.replace('.lqaboss', '')
    const jsonFilename = `${jobId}.json`
    
    try {
      const jsonFile = await gcs.loadFile(gcsMode.bucket, gcsMode.prefix, jsonFilename)
      
      if (jsonFile) {
        const jsonContent = await jsonFile.text()
        const savedJobData = JSON.parse(jsonContent)
        
        
        // Use the provided jobData parameter or fall back to translationData.jobData
        const currentJobData = jobData || translationData.jobData
        
        // Only apply translations if there are any saved
        if (savedJobData.tus && savedJobData.tus.length > 0 && currentJobData) {
          const result = translationData.applyLoadedTranslations(
            currentJobData,
            savedJobData
          )
          
          // Set up three-state system
          translationData.setupThreeStateSystem(currentJobData, result.jobData)
          
          return { foundEdited: true, editedCount: result.editedCount }
        } else {
          // No saved translations, set up two-state system
          if (translationData.jobData) {
            translationData.setupTwoStateSystem(translationData.jobData)
          }
          return { foundEdited: false, editedCount: 0 }
        }
      } else {
        // No JSON file found, set up two-state system
        if (translationData.jobData) {
          translationData.setupTwoStateSystem(translationData.jobData)
        }
        return { foundEdited: false, editedCount: 0 }
      }
    } catch (error) {
      console.log(`No saved translations found for job: ${error}`)
      if (translationData.jobData) {
        translationData.setupTwoStateSystem(translationData.jobData)
      }
      return { foundEdited: false, editedCount: 0 }
    }
  }
  
  const handleFileLoad = async (file: File) => {
    if (!file) return

    // Increment file loading ID to track this specific load
    const currentLoadId = fileLoadingIdRef.current + 1
    fileLoadingIdRef.current = currentLoadId

    try {
      const result = await fileLoader.loadLqaBossFile(file)
      
      // Set up initial job data
      translationData.setupTwoStateSystem(result.jobData)
      
      currentFileNameRef.current = file.name
      
      console.log('Successfully loaded:', file.name, result.flowData ? 'with flow metadata' : 'without flow metadata')
      // Load saved translations immediately using the jobData we just loaded
      const translationResult = await loadSavedTranslations(file.name, result.jobData)
      
      // Show toast after loading is complete
      toaster.create({
        title: "File loaded successfully",
        description: translationResult.foundEdited 
          ? `Found ${translationResult.editedCount} edited translation${translationResult.editedCount === 1 ? '' : 's'}` 
          : 'No edited translations found',
        type: "success",
        duration: 4000,
      })
    } catch (error: any) {
      console.error('Error loading file:', error)
      toaster.create({
        title: "Error loading file",
        description: error.message || 'Failed to load file',
        type: "error",
        duration: 6000,
      })
    }
  }
  
  // Handle auth prompt action
  const handleAuthPromptAccept = async () => {
    if (!gcsMode) return
    
    // Check if we need to collect client ID first
    if (!gcs.clientId) {
      setShowAuthPrompt(false)
      setShowClientIdPrompt(true)
      return
    }
    
    // We have client ID, proceed with auth
    setShowAuthPrompt(false)
    
    try {
      if (gcsMode.filename) {
        // User wants to load a specific file
        await gcs.initializeAuth(async () => {
          const file = await gcs.loadFile(gcsMode.bucket, gcsMode.prefix, gcsMode.filename!)
          if (file) {
            await handleFileLoad(file)
          }
        })
      } else {
        // User wants to browse files
        await gcs.initializeAuth(async () => {
          await gcs.loadFileListForMode(gcsMode)
        })
      }
    } catch (error: any) {
      console.error('Authentication failed:', error.message)
      toaster.create({
        title: "Authentication failed",
        description: error.message,
        type: "error",
        duration: 6000,
      })
    }
  }
  
  // Handle client ID submission
  const handleClientIdSubmit = async (clientId: string) => {
    if (!gcsMode) return
    
    try {
      if (gcsMode.filename) {
        // User wants to load a specific file
        await gcs.initializeAuth(async () => {
          // Authentication succeeded - now we can hide the prompt and save client ID
          setShowClientIdPrompt(false)
          gcs.setClientId(clientId)
          localStorage.setItem('gcs-client-id', clientId)
          
          const file = await gcs.loadFile(gcsMode.bucket, gcsMode.prefix, gcsMode.filename!)
          if (file) {
            await handleFileLoad(file)
          }
        }, clientId)
      } else {
        // User wants to browse files
        await gcs.initializeAuth(async () => {
          // Authentication succeeded - now we can hide the prompt and save client ID
          setShowClientIdPrompt(false)
          gcs.setClientId(clientId)
          localStorage.setItem('gcs-client-id', clientId)
          
          await gcs.loadFileListForMode(gcsMode)
        }, clientId)
      }
      
      // Authentication succeeded, hide auth prompt
      setShowAuthPrompt(false)
    } catch (error: any) {
      console.error('Authentication failed:', error.message)
      
      toaster.create({
        title: "Authentication failed",
        description: error.message,
        type: "error",
        duration: 6000,
      })
    }
  }
  
  const handleClientIdCancel = () => {
    setShowClientIdPrompt(false)
  }
  
  const handleSaveChanges = async () => {
    if (!translationData.jobData || !translationData.originalJobData || !fileLoader.fileName || !gcsMode) {
      return
    }
    
    if (!gcs.isAuthenticated) {
      toaster.create({
        title: "Authentication required",
        description: "Please sign in to save to GCS",
        type: "error",
        duration: 6000,
      })
      return
    }
    
    // Save to GCS
    const originalTus = new Map(translationData.originalJobData.tus.map(tu => [tu.guid, tu]))
    const changedTus = translationData.jobData.tus.filter(currentTu => {
      const originalTu = originalTus.get(currentTu.guid)
      if (!originalTu) return true
      return !isEqual(currentTu.ntgt, originalTu.ntgt)
    })

    const outputData = {
      ...translationData.jobData,
      tus: changedTus,
    }

    const baseName = fileLoader.fileName.endsWith('.lqaboss') 
      ? fileLoader.fileName.slice(0, -'.lqaboss'.length) 
      : fileLoader.fileName
    const outputFileName = `${baseName}.json`
    
    try {
      const savedName = await gcs.saveFileToMode(gcsMode, outputFileName, outputData)
      if (savedName) {
        translationData.markAsSaved()
        toaster.create({
          title: "File saved successfully",
          description: `Saved to GCS: ${savedName}`,
          type: "success",
          duration: 4000,
        })
      }
    } catch (error: any) {
      toaster.create({
        title: "Save failed",
        description: `Failed to save to GCS: ${error.message}`,
        type: "error",
        duration: 6000,
      })
    }
  }
  
  
  const handleShowInstructions = () => {
    translationEditorRef.current?.openInstructions()
  }
  
  // Load file list handler
  const handleLoadFileList = async () => {
    if (!gcsMode) return
    await gcs.loadFileListForMode(gcsMode)
  }

  // GCS file selection handler
  const handleGcsFileSelect = async (selectedFilename: string) => {
    if (!gcsMode) return
    
    // Load the file list first if not already loaded
    if (gcs.files.length === 0) {
      await gcs.loadFileListForMode(gcsMode)
    }
    
    const file = await gcs.loadFile(gcsMode.bucket, gcsMode.prefix, selectedFilename)
    if (file) {
      await handleFileLoad(file)
      
      // Update URL to include the filename
      const newUrl = GCSUrlParser.buildFileUrl(gcsMode.bucket, gcsMode.prefix, selectedFilename)
      navigate(newUrl, { replace: true })
      setGcsMode({ ...gcsMode, filename: selectedFilename })
      currentFileNameRef.current = selectedFilename
    }
  }
  
  if (!gcsMode) {
    return (
      <EditorLayout
        header={
          <GCSEditorHeader
            bucket="unknown"
            prefix="unknown"
            isAuthenticated={false}
            onSave={() => {}}
            onSignOut={() => {}}
            hasInstructions={false}
            onShowInstructions={() => {}}
            hasData={false}
            files={[]}
            onFileSelect={() => {}}
            onLoadFileList={handleLoadFileList}
            fileStatus={translationData.fileStatus}
          />
        }
      >
        <div>Loading GCS configuration...</div>
      </EditorLayout>
    )
  }
  
  if (showClientIdPrompt) {
    return (
      <EditorLayout
        header={
          <GCSEditorHeader
            bucket={gcsMode.bucket}
            prefix={gcsMode.prefix}
            filename={gcsMode.filename}
            isAuthenticated={gcs.isAuthenticated}
            onSave={handleSaveChanges}
            onSignOut={gcs.signOut}
            hasInstructions={!!translationData.jobData?.instructions}
            hasLanguageInfo={!!(translationData.jobData?.sourceLang || translationData.jobData?.targetLang)}
            onShowInstructions={handleShowInstructions}
            hasData={!!translationData.jobData}
            files={gcs.files}
            onFileSelect={handleGcsFileSelect}
            onLoadFileList={handleLoadFileList}
            fileStatus={translationData.fileStatus}
          />
        }
      >
        <ClientIdPrompt
          onSubmit={handleClientIdSubmit}
          onCancel={handleClientIdCancel}
        />
      </EditorLayout>
    )
  }
  
  if (showAuthPrompt) {
    return (
      <EditorLayout
        header={
          <GCSEditorHeader
            bucket={gcsMode.bucket}
            prefix={gcsMode.prefix}
            filename={gcsMode.filename}
            isAuthenticated={gcs.isAuthenticated}
            onSave={handleSaveChanges}
            onSignOut={gcs.signOut}
            hasInstructions={!!translationData.jobData?.instructions}
            hasLanguageInfo={!!(translationData.jobData?.sourceLang || translationData.jobData?.targetLang)}
            onShowInstructions={handleShowInstructions}
            hasData={!!translationData.jobData}
            files={gcs.files}
            onFileSelect={handleGcsFileSelect}
            onLoadFileList={handleLoadFileList}
            fileStatus={translationData.fileStatus}
          />
        }
      >
        <AuthPrompt
          bucket={gcsMode.bucket}
          prefix={gcsMode.prefix}
          filename={gcsMode.filename}
          onAccept={handleAuthPromptAccept}
        />
      </EditorLayout>
    )
  }
  
  return (
    <>
      <EditorLayout
        header={
          <GCSEditorHeader
            bucket={gcsMode.bucket}
            prefix={gcsMode.prefix}
            filename={gcsMode.filename}
            isAuthenticated={gcs.isAuthenticated}
            onSave={handleSaveChanges}
            onSignOut={gcs.signOut}
            hasInstructions={!!translationData.jobData?.instructions}
            hasLanguageInfo={!!(translationData.jobData?.sourceLang || translationData.jobData?.targetLang)}
            onShowInstructions={handleShowInstructions}
            hasData={!!translationData.jobData}
            files={gcs.files}
            onFileSelect={handleGcsFileSelect}
            onLoadFileList={handleLoadFileList}
            fileStatus={translationData.fileStatus}
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