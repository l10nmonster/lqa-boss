import React, { useState, useEffect, useRef } from 'react'
import {
  Box,
  Flex,
  Heading,
  Button,
  Input,
  Text,
  Stack,
} from '@chakra-ui/react'
import { FiUpload, FiSave, FiInfo, FiKey, FiLogOut } from 'react-icons/fi'
import JSZip from 'jszip'
import ScreenshotViewer from './components/ScreenshotViewer'
import TextSegmentEditor from './components/TextSegmentEditor'
import GlassBox from './components/GlassBox'
import ResizablePane from './components/ResizablePane'
import InstructionsModal from './components/InstructionsModal'
import { FlowData, JobData, TranslationUnit } from './types'
import { saveChangedTus } from './utils/saveHandler'
import { useKeyboardNavigation } from './hooks/useKeyboardNavigation'
import { useGCSOperations } from './hooks/useGCSOperations'
import { GCSUrlParser, GCSModeConfig } from './utils/gcsUrlParser'
import GCSFilePicker from './components/GCSFilePicker'
import { isEqual } from 'lodash'

function App() {
  const [flowData, setFlowData] = useState<FlowData | null>(null)
  const [jobData, setJobData] = useState<JobData | null>(null)
  const [originalJobData, setOriginalJobData] = useState<JobData | null>(null)
  const [zipFile, setZipFile] = useState<JSZip | null>(null)
  const [currentPageIndex, setCurrentPageIndex] = useState(0)
  const [activeSegmentIndex, setActiveSegmentIndex] = useState(-1)
  const [fileName, setFileName] = useState<string>('')
  const [isInstructionsModalOpen, setIsInstructionsModalOpen] = useState(false)
  const [gcsMode, setGcsMode] = useState<GCSModeConfig | null>(null)
  const [showAuthPrompt, setShowAuthPrompt] = useState(false)
  const [showClientIdPrompt, setShowClientIdPrompt] = useState(false)
  const [clientIdInput, setClientIdInput] = useState('')
  const fileInputRef = useRef<HTMLInputElement>(null)

  // GCS operations hook
  const gcs = useGCSOperations()

  // Log React version
  useEffect(() => {
    console.log('React version:', React.version)
  }, [])

  // Parse URL for GCS mode
  useEffect(() => {
    const gcsConfig = GCSUrlParser.parseUrl(window.location.pathname)
    if (gcsConfig) {
      setGcsMode(gcsConfig)
    }
  }, [])

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
          console.log('Attempting to auto-load file with saved credentials')
          const file = await gcs.loadFileFromMode(gcsMode)
          if (file) {
            await handleFileLoad(file)
          }
        } else {
          // Not authenticated - show auth prompt instead of auto-triggering
          console.log('Not authenticated, showing auth prompt for file load')
          setShowAuthPrompt(true)
        }
      } else {
        // URL has only bucket/prefix - show file picker or auth prompt
        if (gcs.isAuthenticated) {
          console.log('Opening file picker with saved credentials')
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
      alert(`Authentication failed: ${error.message}`)
    }
  }

  // Handle client ID submission
  const handleClientIdSubmit = async () => {
    if (!clientIdInput.trim()) return
    
    const newClientId = clientIdInput.trim()
    
    // Don't hide the client ID prompt yet - only hide after successful authentication
    // Don't clear the input either - keep it in case of retry
    
    // Proceed with auth, passing the client ID directly
    try {
      if (gcsMode?.filename) {
        // User wants to load a specific file
        await gcs.initializeAuth(async () => {
          // Authentication succeeded - now we can hide the prompt and save client ID
          setShowClientIdPrompt(false)
          setClientIdInput('')
          gcs.setClientId(newClientId)
          localStorage.setItem('gcs-client-id', newClientId)
          
          const file = await gcs.loadFile(gcsMode.bucket, gcsMode.prefix, gcsMode.filename!)
          if (file) {
            await handleFileLoad(file)
          }
        }, newClientId)
      } else if (gcsMode) {
        // User wants to browse files
        await gcs.initializeAuth(async () => {
          // Authentication succeeded - now we can hide the prompt and save client ID
          setShowClientIdPrompt(false)
          setClientIdInput('')
          gcs.setClientId(newClientId)
          localStorage.setItem('gcs-client-id', newClientId)
          
          await gcs.loadFileListForMode(gcsMode)
        }, newClientId)
      }
      
      // Authentication succeeded, hide auth prompt
      setShowAuthPrompt(false)
    } catch (error: any) {
      console.error('Authentication failed:', error.message)
      
      // Keep client ID prompt visible for retry
      // Input field still has the invalid client ID for user to correct
      
      alert(`Authentication failed: ${error.message}`)
    }
  }

  const bgGradient = 'linear-gradient(135deg, #f0f9ff 0%, #e0f2fe 25%, #bae6fd 50%, #e0f2fe 75%, #f0f9ff 100%)'

  useEffect(() => {
    // PWA File Handling
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
            alert('Could not open the launched file')
          }
        }
      })
    }
  }, [])

  const handleFileLoad = async (file: File) => {
    if (!file) return

    try {
      const arrayBuffer = await file.arrayBuffer()
      const zip = await JSZip.loadAsync(arrayBuffer)
      
      // Try to load flow_metadata.json, but don't fail if it's missing
      const metadataFile = zip.file("flow_metadata.json")
      let parsedFlowData: FlowData | null = null
      
             if (metadataFile) {
         const metadataContent = await metadataFile.async("string")
         parsedFlowData = JSON.parse(metadataContent)
         
         if (!parsedFlowData?.pages || parsedFlowData?.pages.length === 0) {
           console.warn('Warning: No valid pages data found in flow_metadata.json')
           parsedFlowData = null
         }
       }

      const jobFile = zip.file("job.json");
      if (!jobFile) {
        throw new Error('Invalid .lqaboss file: "job.json" not found.')
      }
      const jobContent = await jobFile.async("string");
      const parsedJobData: JobData = JSON.parse(jobContent);

      // Populate missing ntgt with nsrc content
      parsedJobData.tus = parsedJobData.tus.map(tu => {
        if (!tu.ntgt || (Array.isArray(tu.ntgt) && tu.ntgt.length === 0)) {
          // Create a deep copy of nsrc to avoid reference issues
          const nsrcCopy = tu.nsrc ? JSON.parse(JSON.stringify(tu.nsrc)) : []
          return { ...tu, ntgt: nsrcCopy }
        }
        return tu
      })

      setZipFile(zip)
      setFlowData(parsedFlowData)
      setJobData(parsedJobData)
      setOriginalJobData(JSON.parse(JSON.stringify(parsedJobData)))
      setFileName(file.name)
      setCurrentPageIndex(0)
      setActiveSegmentIndex(-1)

      // Show instructions modal if instructions are present
      if (parsedJobData.instructions) {
        setIsInstructionsModalOpen(true)
      }

      console.log('Successfully loaded:', file.name, parsedFlowData ? 'with flow metadata' : 'without flow metadata')
    } catch (error: any) {
      console.error('Error loading file:', error)
      alert(error.message || 'Failed to load file')
    }
  }

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      handleFileLoad(file)
    }
  }

  const handleSaveChanges = async () => {
    if (!jobData || !originalJobData || !fileName) return
    
    if (gcsMode && gcs.isAuthenticated) {
      // Save to GCS
      const originalTus = new Map(originalJobData.tus.map(tu => [tu.guid, tu]))
      const changedTus = jobData.tus.filter(currentTu => {
        const originalTu = originalTus.get(currentTu.guid)
        if (!originalTu) return true
        return !isEqual(currentTu.ntgt, originalTu.ntgt)
      })

      const outputData = {
        ...jobData,
        tus: changedTus,
      }

      const baseName = fileName.endsWith('.lqaboss') 
        ? fileName.slice(0, -'.lqaboss'.length) 
        : fileName
      const outputFileName = `${baseName}.json`
      
      try {
        const savedName = await gcs.saveFileToMode(gcsMode, outputFileName, outputData)
        if (savedName) {
          alert(`File saved to GCS: ${savedName}`)
        }
      } catch (error: any) {
        alert(`Failed to save file to GCS: ${error.message}`)
      }
    } else {
      // Use original local save
      saveChangedTus(jobData, originalJobData, fileName)
    }
  }


  // GCS file selection handler
  const handleGcsFileSelect = async (filename: string) => {
    if (!gcsMode) return
    
    gcs.setShowFilePicker(false)
    
    const file = await gcs.loadFile(gcsMode.bucket, gcsMode.prefix, filename)
    if (file) {
      await handleFileLoad(file)
      
      // Update URL to include the filename
      const newUrl = GCSUrlParser.buildFileUrl(gcsMode.bucket, gcsMode.prefix, filename)
      window.history.pushState({}, '', newUrl)
      setGcsMode({ ...gcsMode, filename })
    }
  }


  const navigatePage = (direction: number) => {
    if (!flowData) return
    const newIndex = currentPageIndex + direction
    if (newIndex >= 0 && newIndex < flowData.pages.length) {
      setCurrentPageIndex(newIndex)
      setActiveSegmentIndex(-1)
    }
  }

  const updateTranslationUnit = (tu: TranslationUnit) => {
    if (!jobData) return
    const newTus = jobData.tus.map(t => t.guid === tu.guid ? tu : t)
    setJobData({ ...jobData, tus: newTus })
  }

  const currentPage = flowData?.pages[currentPageIndex]

  // Setup keyboard navigation
  useKeyboardNavigation({
    currentPageIndex,
    totalPages: flowData?.pages.length || 0,
    activeSegmentIndex,
    totalSegments: flowData ? (currentPage?.segments.length || 0) : (jobData?.tus.length || 0),
    navigatePage,
    setActiveSegmentIndex,
  })

  // When navigating to a new page or when jobData loads without flowData, focus on the first segment
  useEffect(() => {
    const hasSegments = flowData ? (currentPage?.segments.length || 0) > 0 : (jobData?.tus.length || 0) > 0
    if (hasSegments && activeSegmentIndex === -1) {
      setActiveSegmentIndex(0)
    }
  }, [currentPageIndex, flowData, jobData])

  return (
    <Box minH="100vh" background={bgGradient} p={4} data-testid="app-container" overflow="hidden">
      <Stack direction="column" gap={4} align="stretch" h="calc(100vh - 2rem)" maxW="100vw" overflow="hidden">
          {/* Header */}
          <Flex
            as={GlassBox}
            p={6}
            align="center"
            justify="space-between"
          >
            <Heading size="lg" color="gray.700">
              {gcsMode ? (
                `LQA Boss - GCS: ${gcsMode.bucket}/${gcsMode.prefix}${gcsMode.filename ? `/${gcsMode.filename}` : ''}`
              ) : (
                `LQA Boss: ${flowData?.flowName || (jobData ? '(out of context)' : '(no flow loaded)')}`
              )}
            </Heading>
            <Stack direction="row" gap={4}>
              {gcsMode ? (
                // GCS Mode buttons
                <>
                  <Button
                    variant="outline"
                    colorScheme="blue"
                    onClick={() => gcs.loadFileListForMode(gcsMode!)}
                    size="md"
                    disabled={!gcs.isAuthenticated}
                  >
                    <FiUpload /> Load from GCS
                  </Button>
                  {jobData?.instructions && (
                    <Button
                      variant="outline"
                      colorScheme="blue"
                      onClick={() => setIsInstructionsModalOpen(true)}
                      size="md"
                      px={3}
                      data-testid="instructions-button"
                    >
                      <FiInfo />
                    </Button>
                  )}
                  <Button
                    variant="solid"
                    colorScheme="blue"
                    onClick={handleSaveChanges}
                    disabled={!jobData || !gcs.isAuthenticated}
                    size="md"
                  >
                    <FiSave /> Save to GCS
                  </Button>
                  {!gcs.isAuthenticated ? (
                    <Button
                      variant="solid"
                      colorScheme="green"
                      onClick={() => {
                        if (!gcs.clientId) {
                          setShowClientIdPrompt(true)
                        } else {
                          gcs.initializeAuth()
                        }
                      }}
                      size="md"
                    >
                      <FiKey /> Sign In to GCS
                    </Button>
                  ) : (
                    <Button
                      variant="outline"
                      colorScheme="gray"
                      onClick={gcs.signOut}
                      size="md"
                    >
                      <FiLogOut /> Sign Out
                    </Button>
                  )}
                </>
              ) : (
                // Local Mode buttons
                <>
                  <Input
                    ref={fileInputRef}
                    type="file"
                    accept=".lqaboss"
                    onChange={handleFileInputChange}
                    display="none"
                  />
                  <Button
                    variant="outline"
                    colorScheme="blue"
                    onClick={() => fileInputRef.current?.click()}
                    size="md"
                  >
                    <FiUpload /> Load .lqaboss File
                  </Button>
                  {jobData?.instructions && (
                    <Button
                      variant="outline"
                      colorScheme="blue"
                      onClick={() => setIsInstructionsModalOpen(true)}
                      size="md"
                      px={3}
                      data-testid="instructions-button"
                    >
                      <FiInfo />
                    </Button>
                  )}
                  <Button
                    variant="solid"
                    colorScheme="blue"
                    onClick={handleSaveChanges}
                    disabled={!jobData}
                    size="md"
                  >
                    <FiSave /> Save Changes
                  </Button>
                </>
              )}
            </Stack>
          </Flex>

          {/* GCS File Picker */}
          <GCSFilePicker
            isOpen={gcs.showFilePicker}
            files={gcs.files}
            bucket={gcsMode?.bucket || ''}
            prefix={gcsMode?.prefix || ''}
            onClose={() => gcs.setShowFilePicker(false)}
            onFileSelect={handleGcsFileSelect}
          />

          {/* Main Content */}
          <Box flex="1" overflow="hidden" minWidth={0} maxW="100%">
            {showClientIdPrompt ? (
              // Client ID input prompt
              <GlassBox p={6} height="100%" display="flex" alignItems="center" justifyContent="center">
                <Stack gap={6} textAlign="center" maxW="md">
                  <Heading size="lg" color="gray.700">
                    Google OAuth2 Client ID Required
                  </Heading>
                  <Text color="gray.600" fontSize="lg">
                    To access Google Cloud Storage, please enter your Google OAuth2 Client ID.
                  </Text>
                  <Input
                    placeholder="Enter your Google OAuth2 Client ID"
                    value={clientIdInput}
                    onChange={(e) => setClientIdInput(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && handleClientIdSubmit()}
                    size="lg"
                  />
                  <Stack direction="row" gap={4} justify="center">
                    <Button
                      variant="solid"
                      colorScheme="blue"
                      size="lg"
                      onClick={handleClientIdSubmit}
                      disabled={!clientIdInput.trim()}
                    >
                      Continue
                    </Button>
                    <Button
                      variant="outline"
                      colorScheme="gray"
                      size="lg"
                      onClick={() => {
                        setShowClientIdPrompt(false)
                        setClientIdInput('')
                      }}
                    >
                      Cancel
                    </Button>
                  </Stack>
                </Stack>
              </GlassBox>
            ) : showAuthPrompt ? (
              // Auth prompt when user needs to sign in
              <GlassBox p={6} height="100%" display="flex" alignItems="center" justifyContent="center">
                <Stack gap={6} textAlign="center" maxW="md">
                  <Heading size="lg" color="gray.700">
                    Google Cloud Storage Access Required
                  </Heading>
                  <Text color="gray.600" fontSize="lg">
                    {gcsMode?.filename ? (
                      <>To access the file <strong>{gcsMode.filename}</strong> in <strong>{gcsMode.bucket}/{gcsMode.prefix}</strong>, you need to sign in to Google Cloud Storage.</>
                    ) : (
                      <>To browse files in <strong>{gcsMode?.bucket}/{gcsMode?.prefix}</strong>, you need to sign in to Google Cloud Storage.</>
                    )}
                  </Text>
                  <Stack direction="row" gap={4} justify="center">
                    <Button
                      variant="solid"
                      colorScheme="blue"
                      size="lg"
                      onClick={handleAuthPromptAccept}
                    >
                      <FiKey /> Sign In to GCS
                    </Button>
                    <Button
                      variant="outline"
                      colorScheme="gray"
                      size="lg"
                      onClick={() => setShowAuthPrompt(false)}
                    >
                      Cancel
                    </Button>
                  </Stack>
                </Stack>
              </GlassBox>
            ) : flowData ? (
              // Two-pane layout when flowData exists
              <ResizablePane>
                {/* Screenshot Section */}
                <GlassBox 
                  p={0} 
                  height="100%"
                  position="relative"
                  display="flex"
                  flexDirection="column"
                >
                  {currentPage && zipFile ? (
                    <ScreenshotViewer
                      page={currentPage}
                      zipFile={zipFile}
                      activeSegmentIndex={activeSegmentIndex}
                      onSegmentClick={setActiveSegmentIndex}
                      currentPageIndex={currentPageIndex}
                      totalPages={flowData.pages.length}
                      onNavigatePage={navigatePage}
                    />
                  ) : (
                    <Text color="gray.600" textAlign="center" py={20}>
                      Load a .lqaboss file to view screenshots
                    </Text>
                  )}
                </GlassBox>

                {/* Editor Section */}
                <GlassBox p={6} height="100%" overflow="hidden" minWidth={0} maxW="100%">
                  <Heading size="md" mb={4} color="gray.700">
                    Editable Text Segments
                  </Heading>
                  {currentPage && jobData && originalJobData ? (
                    <TextSegmentEditor
                      page={currentPage}
                      jobData={jobData}
                      originalJobData={originalJobData}
                      onTranslationUnitChange={updateTranslationUnit}
                      activeSegmentIndex={activeSegmentIndex}
                      onSegmentFocus={setActiveSegmentIndex}
                    />
                  ) : (
                    <Text color="gray.600" textAlign="center" py={20}>
                      Load a .lqaboss file to view and edit
                    </Text>
                  )}
                </GlassBox>
              </ResizablePane>
            ) : (
              // Single-pane layout when no flowData (screenshot-less mode)
              <GlassBox p={6} height="100%" overflow="hidden" minWidth={0} maxW="100%">
                <Heading size="md" mb={4} color="gray.700">
                  Editable Translation Units
                </Heading>
                {jobData && originalJobData ? (
                  <TextSegmentEditor
                    page={null}
                    jobData={jobData}
                    originalJobData={originalJobData}
                    onTranslationUnitChange={updateTranslationUnit}
                    activeSegmentIndex={activeSegmentIndex}
                    onSegmentFocus={setActiveSegmentIndex}
                  />
                ) : (
                  <Text color="gray.600" textAlign="center" py={20}>
                    Load a .lqaboss file to view and edit
                  </Text>
                )}
              </GlassBox>
            )}
          </Box>
        </Stack>

        {/* Instructions Modal */}
        {jobData?.instructions && (
          <InstructionsModal
            isOpen={isInstructionsModalOpen}
            onClose={() => setIsInstructionsModalOpen(false)}
            instructions={jobData.instructions}
          />
        )}

        {/* Footer */}
        <Box
          as="footer"
          textAlign="center"
          py={2}
          mt="auto"
          color="gray.500"
          fontSize="sm"
        >
          v{import.meta.env.PACKAGE_VERSION || '1.0.0'}
        </Box>
    </Box>
  )
}

export default App 