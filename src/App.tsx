import React, { useState, useEffect, useRef } from 'react'
import {
  Box,
  Flex,
  Heading,
  Button,
  Input,
  Text,
  Stack,
  IconButton,
} from '@chakra-ui/react'
import { FiUpload, FiSave, FiChevronLeft, FiChevronRight, FiInfo } from 'react-icons/fi'
import JSZip from 'jszip'
import ScreenshotViewer from './components/ScreenshotViewer'
import TextSegmentEditor from './components/TextSegmentEditor'
import GlassBox from './components/GlassBox'
import ResizablePane from './components/ResizablePane'
import InstructionsModal from './components/InstructionsModal'
import { FlowData, Page, JobData, TranslationUnit } from './types'
import { saveChangedTus } from './utils/saveHandler'
import { useKeyboardNavigation } from './hooks/useKeyboardNavigation'

function App() {
  const [flowData, setFlowData] = useState<FlowData | null>(null)
  const [jobData, setJobData] = useState<JobData | null>(null)
  const [originalJobData, setOriginalJobData] = useState<JobData | null>(null)
  const [zipFile, setZipFile] = useState<JSZip | null>(null)
  const [currentPageIndex, setCurrentPageIndex] = useState(0)
  const [activeSegmentIndex, setActiveSegmentIndex] = useState(-1)
  const [originalTexts, setOriginalTexts] = useState<Record<string, string>>({})
  const [fileName, setFileName] = useState<string>('')
  const [isInstructionsModalOpen, setIsInstructionsModalOpen] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Log React version
  useEffect(() => {
    console.log('React version:', React.version)
  }, [])

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

      // Initialize original texts only if we have flow data
      const originals: Record<string, string> = {}
      if (parsedFlowData) {
        parsedFlowData.pages.forEach((page) => {
          page.segments?.forEach((segment, index) => {
            originals[`${page.pageId}_${index}`] = segment.text
          })
        })
      }

      setZipFile(zip)
      setFlowData(parsedFlowData)
      setJobData(parsedJobData)
      setOriginalJobData(JSON.parse(JSON.stringify(parsedJobData)))
      setOriginalTexts(originals)
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

  const handleSaveChanges = () => {
    if (!jobData || !originalJobData || !fileName) return
    saveChangedTus(jobData, originalJobData, fileName)
  }

  const navigatePage = (direction: number) => {
    if (!flowData) return
    const newIndex = currentPageIndex + direction
    if (newIndex >= 0 && newIndex < flowData.pages.length) {
      setCurrentPageIndex(newIndex)
      setActiveSegmentIndex(-1)
    }
  }

  const updateSegmentText = (pageIndex: number, segmentIndex: number, newText: string) => {
    if (!flowData) return
    const newFlowData = { ...flowData }
    newFlowData.pages[pageIndex].segments[segmentIndex].text = newText
    setFlowData(newFlowData)
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
    <Box minH="100vh" background={bgGradient} p={4}>
      <Stack direction="column" gap={4} align="stretch" h="100vh">
          {/* Header */}
          <Flex
            as={GlassBox}
            p={6}
            align="center"
            justify="space-between"
          >
            <Heading size="lg" color="gray.700">
              LQA Boss: {flowData?.flowName || (jobData ? '(out of context)' : '(no flow loaded)')}
            </Heading>
            <Stack direction="row" gap={4}>
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
            </Stack>
          </Flex>

          {/* Main Content */}
          <Box flex="1" overflow="hidden">
            {flowData ? (
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
                <GlassBox p={6} height="100%" overflow="hidden">
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
              <GlassBox p={6} height="100%" overflow="hidden">
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
    </Box>
  )
}

export default App 