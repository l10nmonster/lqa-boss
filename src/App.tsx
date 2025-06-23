import React, { useState, useEffect, useRef } from 'react'
import {
  Box,
  Container,
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
import { FlowData, Page } from './types'
import { saveChangedSegments } from './utils/saveHandler'
import { useKeyboardNavigation } from './hooks/useKeyboardNavigation'

function App() {
  const [flowData, setFlowData] = useState<FlowData | null>(null)
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

  const bgGradient = 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)'

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
    if (!flowData) return
    saveChangedSegments(flowData, originalTexts)
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
    <Box minH="100vh" background={bgGradient} py={8}>
      <Container maxW="container.2xl">
        <Stack direction="column" gap={6} align="stretch">
          {/* Header */}
          <Flex
            as={GlassBox}
            p={6}
            align="center"
            justify="space-between"
          >
            <Heading size="lg" color="white">
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
                onClick={() => fileInputRef.current?.click()}
                size="md"
              >
                <FiUpload /> Load .lqaboss File
              </Button>
              <Button
                variant="solid"
                onClick={handleSaveChanges}
                disabled={!flowData}
                size="md"
              >
                <FiSave /> Save Changes
              </Button>
            </Stack>
          </Flex>

          {/* Navigation */}
          {flowData && (
            <GlassBox p={4}>
              <Stack direction="row" justify="center" gap={4}>
                <IconButton
                  aria-label="Previous page"
                  onClick={() => navigatePage(-1)}
                  disabled={currentPageIndex === 0}
                  variant="outline"
                >
                  <FiChevronLeft />
                </IconButton>
                <Text color="white" fontWeight="semibold">
                  Page {currentPageIndex + 1} of {flowData.pages.length}
                </Text>
                <IconButton
                  aria-label="Next page"
                  onClick={() => navigatePage(1)}
                  disabled={currentPageIndex === flowData.pages.length - 1}
                  variant="outline"
                >
                  <FiChevronRight />
                </IconButton>
              </Stack>
            </GlassBox>
          )}

          {/* Main Content */}
          <Flex gap={6} direction={{ base: 'column', lg: 'row' }}>
            {/* Screenshot Section */}
            <GlassBox flex="1" p={6} overflow="auto" maxH="80vh">
              {currentPage && zipFile ? (
                <ScreenshotViewer
                  page={currentPage}
                  zipFile={zipFile}
                  activeSegmentIndex={activeSegmentIndex}
                  onSegmentClick={setActiveSegmentIndex}
                />
              ) : (
                <Text color="white" textAlign="center" py={20}>
                  Load a .lqaboss file to view screenshots
                </Text>
              )}
            </GlassBox>

            {/* Editor Section */}
            <GlassBox flex="1" p={6} maxH="80vh" overflow="hidden">
              <Heading size="md" mb={4} color="white">
                Editable Text Segments
              </Heading>
              {currentPage ? (
                <TextSegmentEditor
                  page={currentPage}
                  pageIndex={currentPageIndex}
                  originalTexts={originalTexts}
                  activeSegmentIndex={activeSegmentIndex}
                  onSegmentFocus={setActiveSegmentIndex}
                  onTextChange={updateSegmentText}
                />
              ) : (
                <Text color="white" textAlign="center" py={20}>
                  Load a .lqaboss file to view and edit
                </Text>
              )}
            </GlassBox>
          </Flex>
        </Stack>
      </Container>
    </Box>
  )
}

export default App 