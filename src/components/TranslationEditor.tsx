import React, { useState, useEffect } from 'react'
import { Box, Heading, Text } from '@chakra-ui/react'
import JSZip from 'jszip'
import { FlowData, JobData, TranslationUnit } from '../types'
import ScreenshotViewer from './ScreenshotViewer'
import TextSegmentEditor from './TextSegmentEditor'
import GlassBox from './GlassBox'
import ResizablePane from './ResizablePane'
import InstructionsModal from './InstructionsModal'
import { useKeyboardNavigation } from '../hooks/useKeyboardNavigation'

interface TranslationEditorProps {
  flowData: FlowData | null
  jobData: JobData | null
  originalJobData: JobData | null
  savedJobData: JobData | null
  zipFile: JSZip | null
  onTranslationUnitChange: (tu: TranslationUnit) => void
  onInstructionsOpen?: () => void
}

export const TranslationEditor: React.FC<TranslationEditorProps> = ({
  flowData,
  jobData,
  originalJobData,
  savedJobData,
  zipFile,
  onTranslationUnitChange,
  onInstructionsOpen,
}) => {
  const [currentPageIndex, setCurrentPageIndex] = useState(0)
  const [activeSegmentIndex, setActiveSegmentIndex] = useState(-1)
  const [isInstructionsModalOpen, setIsInstructionsModalOpen] = useState(false)
  
  // Show instructions modal if instructions are present and trigger external handler
  useEffect(() => {
    if (jobData?.instructions && onInstructionsOpen) {
      setIsInstructionsModalOpen(true)
      onInstructionsOpen()
    }
  }, [jobData?.instructions, onInstructionsOpen])
  
  const navigatePage = (direction: number) => {
    if (!flowData) return
    const newIndex = currentPageIndex + direction
    if (newIndex >= 0 && newIndex < flowData.pages.length) {
      setCurrentPageIndex(newIndex)
      setActiveSegmentIndex(-1)
    }
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
  }, [currentPageIndex, flowData, jobData, currentPage, activeSegmentIndex])
  
  // Reset page index when new flow data is loaded
  useEffect(() => {
    setCurrentPageIndex(0)
    setActiveSegmentIndex(-1)
  }, [flowData])
  
  if (!jobData || !originalJobData || !savedJobData) {
    return (
      <GlassBox p={6} height="100%" display="flex" alignItems="center" justifyContent="center">
        <Text color="gray.600" textAlign="center" py={20}>
          Load a .lqaboss file to view and edit
        </Text>
      </GlassBox>
    )
  }
  
  return (
    <>
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
                No screenshot available for this page
              </Text>
            )}
          </GlassBox>

          {/* Editor Section */}
          <GlassBox p={6} height="100%" overflow="hidden" minWidth={0} maxW="100%">
            <Heading size="md" mb={4} color="gray.700">
              Editable Text Segments
            </Heading>
            <TextSegmentEditor
              page={currentPage || null}
              jobData={jobData}
              originalJobData={originalJobData}
              savedJobData={savedJobData}
              onTranslationUnitChange={onTranslationUnitChange}
              activeSegmentIndex={activeSegmentIndex}
              onSegmentFocus={setActiveSegmentIndex}
            />
          </GlassBox>
        </ResizablePane>
      ) : (
        // Single-pane layout when no flowData (screenshot-less mode)
        <GlassBox p={6} height="100%" overflow="hidden" minWidth={0} maxW="100%" boxSizing="border-box" display="flex" flexDirection="column">
          <Heading size="md" mb={4} color="gray.700" flexShrink={0}>
            Editable Translation Units
          </Heading>
          <Box flex="1" minHeight={0}>
            <TextSegmentEditor
              page={null}
              jobData={jobData}
              originalJobData={originalJobData}
              savedJobData={savedJobData}
              onTranslationUnitChange={onTranslationUnitChange}
              activeSegmentIndex={activeSegmentIndex}
              onSegmentFocus={setActiveSegmentIndex}
            />
          </Box>
        </GlassBox>
      )}
      
      {/* Instructions Modal */}
      {jobData?.instructions && (
        <InstructionsModal
          isOpen={isInstructionsModalOpen}
          onClose={() => setIsInstructionsModalOpen(false)}
          instructions={jobData.instructions}
        />
      )}
    </>
  )
} 