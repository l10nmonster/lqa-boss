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
import { FiUpload, FiSave, FiChevronLeft, FiChevronRight } from 'react-icons/fi'
import JSZip from 'jszip'
import ScreenshotViewer from './components/ScreenshotViewer'
import TextSegmentEditor from './components/TextSegmentEditor'
import GlassBox from './components/GlassBox'
import ResizablePane from './components/ResizablePane'
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
      
      const metadataFile = zip.file("flow_metadata.json")
      if (!metadataFile) {
        throw new Error('Invalid .lqaboss file: "flow_metadata.json" not found.')
      }

      const metadataContent = await metadataFile.async("string")
      const parsedFlowData: FlowData = JSON.parse(metadataContent)

      const jobFile = zip.file("job.json");
      if (!jobFile) {
        throw new Error('Invalid .lqaboss file: "job.json" not found.')
      }
      const jobContent = await jobFile.async("string");
      const parsedJobData: JobData = JSON.parse(jobContent);

      if (!parsedFlowData.pages || parsedFlowData.pages.length === 0) {
        throw new Error('Invalid .lqaboss file: No valid pages data found.')
      }

      // Initialize original texts
      const originals: Record<string, string> = {}
      parsedFlowData.pages.forEach((page) => {
        page.segments?.forEach((segment, index) => {
          originals[`${page.pageId}_${index}`] = segment.text
        })
      })

      setZipFile(zip)
      setFlowData(parsedFlowData)
      setJobData(parsedJobData)
      setOriginalJobData(JSON.parse(JSON.stringify(parsedJobData)))
      setOriginalTexts(originals)
      setFileName(file.name)
      setCurrentPageIndex(0)
      setActiveSegmentIndex(-1)

      console.log('Successfully loaded:', file.name)
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
    totalSegments: currentPage?.segments.length || 0,
    navigatePage,
    setActiveSegmentIndex,
  })

  // When navigating to a new page, focus on the first segment
  useEffect(() => {
    if (currentPage?.segments.length && activeSegmentIndex === -1) {
      setActiveSegmentIndex(0)
    }
  }, [currentPageIndex])

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
              LQA Boss: {flowData?.flowName || '(no flow loaded)'}
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
              <Button
                variant="solid"
                colorScheme="blue"
                onClick={handleSaveChanges}
                disabled={!flowData}
                size="md"
              >
                <FiSave /> Save Changes
              </Button>
            </Stack>
          </Flex>

          {/* Main Content */}
          <Box flex="1" overflow="hidden">
            <ResizablePane>
              {/* Screenshot Section */}
              <GlassBox 
                p={0} 
                height="100%"
                position="relative"
                display="flex"
                flexDirection="column"
              >
                {currentPage && zipFile && flowData ? (
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
          </Box>
        </Stack>
    </Box>
  )
}

export default App 