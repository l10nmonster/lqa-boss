import React, { useRef, useEffect } from 'react'
import { Input } from '@chakra-ui/react'
import { EditorLayout } from '../components/layout/EditorLayout'
import { LocalEditorHeader } from '../components/headers/LocalEditorHeader'
import { TranslationEditor, TranslationEditorRef } from '../components/TranslationEditor'
import { useTranslationData } from '../hooks/useTranslationData'
import { useFileLoader } from '../hooks/useFileLoader'
import { saveChangedTus } from '../utils/saveHandler'
import { toaster } from '../components/ui/toaster'

export const LocalEditorPage: React.FC = () => {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const translationEditorRef = useRef<TranslationEditorRef>(null)
  
  const fileLoader = useFileLoader()
  const translationData = useTranslationData()
  
  // PWA File Handling
  useEffect(() => {
    if ('launchQueue' in window && window.launchQueue) {
      ;(window as any).launchQueue.setConsumer(async (launchParams: any) => {
        console.log("Launch Queue Consumer Fired. Params:", launchParams)
        if (launchParams.files && launchParams.files.length > 0) {
          const fileHandle = launchParams.files[0]
          try {
            const file = await fileHandle.getFile()
            await handleFileLoad(file)
          } catch (err) {
            console.error('Error processing launched file:', err)
            toaster.create({
              title: "Error",
              description: "Could not open the launched file",
              type: "error",
              duration: 6000,
            })
          }
        }
      })
    }
  }, [])
  
  const handleFileLoad = async (file: File) => {
    if (!file) return
    
    try {
      const result = await fileLoader.loadLqaBossFile(file)
      
      // Set up the translation data - for local mode, we use two-state system
      // since we don't have saved translations
      translationData.setupTwoStateSystem(result.jobData)
      
      console.log('Successfully loaded:', file.name, result.flowData ? 'with flow metadata' : 'without flow metadata')
      
      toaster.create({
        title: "File loaded successfully",
        description: `Loaded ${file.name}`,
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
  
  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      handleFileLoad(file)
    }
  }
  
  const handleFileLoadClick = () => {
    fileInputRef.current?.click()
  }
  
  const handleSaveChanges = () => {
    if (!translationData.jobData || !translationData.originalJobData || !fileLoader.fileName) {
      return
    }
    
    try {
      saveChangedTus(translationData.jobData, translationData.originalJobData, fileLoader.fileName)
      translationData.markAsSaved()
      toaster.create({
        title: "Changes saved",
        description: "Your changes have been saved successfully",
        type: "success",
        duration: 4000,
      })
    } catch (error: any) {
      console.error('Error saving changes:', error)
      toaster.create({
        title: "Error saving changes",
        description: error.message || 'Failed to save changes',
        type: "error",
        duration: 6000,
      })
    }
  }
  
  const handleShowInstructions = () => {
    translationEditorRef.current?.openInstructions()
  }
  
  return (
    <>
      <Input
        ref={fileInputRef}
        type="file"
        accept=".lqaboss"
        onChange={handleFileInputChange}
        display="none"
      />
      
      <EditorLayout
        header={
          <LocalEditorHeader
            onFileLoad={handleFileLoadClick}
            onSave={handleSaveChanges}
            hasInstructions={!!translationData.jobData?.instructions}
            onShowInstructions={handleShowInstructions}
            fileName={fileLoader.fileName}
            hasData={!!translationData.jobData}
            flowName={fileLoader.flowData?.flowName}
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