import { useState, useEffect, useImperativeHandle, forwardRef, useMemo, useRef } from 'react'
import { Box, Heading, Text, HStack } from '@chakra-ui/react'
import JSZip from 'jszip'
import { FlowData, JobData, TranslationUnit } from '../types'
import { QualityModel } from '../types/qualityModel'
import ScreenshotViewer from './ScreenshotViewer'
import TextSegmentEditor from './TextSegmentEditor'
import GlassBox from './GlassBox'
import ResizablePane from './ResizablePane'
import InfoModal from './InfoModal'
import { TranslationFilterControls } from './TranslationFilterControls'
import { useKeyboardNavigation } from '../hooks/useKeyboardNavigation'
import { normalizedToString } from '../utils/normalizedText'
import { calculateTER } from '../utils/metrics'

interface TranslationEditorProps {
  flowData: FlowData | null
  jobData: JobData | null
  originalJobData: JobData | null
  savedJobData: JobData | null
  zipFile: JSZip | null
  onTranslationUnitChange: (tu: TranslationUnit) => void
  onCandidateSelect: (guid: string, candidateIndex: number) => void
  onInstructionsOpen?: () => void
  sourcePluginName?: string
  sourceLocation?: string
  qualityModel: QualityModel | null
  ept: number | null
  onReviewToggle: (guid: string, reviewed: boolean) => void
}

export interface TranslationEditorRef {
  openInstructions: () => void
}

export const TranslationEditor = forwardRef<TranslationEditorRef, TranslationEditorProps>(({
  flowData,
  jobData,
  originalJobData,
  savedJobData,
  zipFile,
  onTranslationUnitChange,
  onCandidateSelect,
  onInstructionsOpen,
  sourcePluginName,
  sourceLocation,
  qualityModel,
  ept,
  onReviewToggle,
}, ref) => {
  const [currentPageIndex, setCurrentPageIndex] = useState(0)
  const [activeSegmentIndex, setActiveSegmentIndex] = useState(-1)
  const [isInfoModalOpen, setIsInfoModalOpen] = useState(false)
  const [showOnlyNonReviewed, setShowOnlyNonReviewed] = useState(false)
  const [filterText, setFilterText] = useState('')
  const userDeselected = useRef(false)

  // Expose openInstructions method via ref (keeping method name for backward compatibility)
  useImperativeHandle(ref, () => ({
    openInstructions: () => setIsInfoModalOpen(true)
  }), [])
  const [searchableFields, setSearchableFields] = useState({
    source: true,
    target: true,
    notes: true,
    rid: true,
    sid: true,
    guid: true,
  })
  
  // Wrapper for setActiveSegmentIndex that tracks user deselection
  const handleSetActiveSegmentIndex = (index: number) => {
    if (index === -1 && activeSegmentIndex !== -1) {
      userDeselected.current = true
    } else if (index !== -1) {
      userDeselected.current = false
    }
    setActiveSegmentIndex(index)
  }
  
  // Show instructions modal only when a new file is loaded with language info
  const sourceLang = jobData?.sourceLang
  const targetLang = jobData?.targetLang
  const currentJobGuidRef = useRef<string | undefined>(undefined)
  
  useEffect(() => {
    if (jobData && (sourceLang || targetLang)) {
      // Use jobGuid to detect new file loads since it's unique per job
      // and doesn't change when translation units are edited
      if (currentJobGuidRef.current !== jobData.jobGuid) {
        // Reset filters to default values when loading new file
        setShowOnlyNonReviewed(false)
        setFilterText('')
        setSearchableFields({
          source: true,
          target: true,
          notes: true,
          rid: true,
          sid: true,
          guid: true,
        })

        if (onInstructionsOpen) {
          setIsInfoModalOpen(true)
          onInstructionsOpen()
        }
        currentJobGuidRef.current = jobData.jobGuid
      }
    } else {
      // Reset ref when jobData is null/undefined (no file loaded)
      currentJobGuidRef.current = undefined
    }
  }, [jobData, sourceLang, targetLang, onInstructionsOpen])

  // Calculate TER (Translation Error Rate)
  const ter = useMemo(() => {
    return calculateTER(jobData, originalJobData)
  }, [jobData, originalJobData])

  const navigatePage = (direction: number) => {
    if (!flowData) return
    const newIndex = currentPageIndex + direction
    if (newIndex >= 0 && newIndex < flowData.pages.length) {
      setCurrentPageIndex(newIndex)
      userDeselected.current = false // Reset on page navigation
      setActiveSegmentIndex(-1)
    }
  }
  
  const currentPage = flowData?.pages[currentPageIndex]
  
  // Filter function for translation units
  const filterTranslationUnits = (tus: TranslationUnit[]): TranslationUnit[] => {
    let filtered = tus

    // Apply review status filter first
    if (showOnlyNonReviewed) {
      filtered = filtered.filter(tu => !tu.ts)
    }

    // Then apply text search filter
    if (!filterText.trim()) return filtered

    const searchText = filterText.toLowerCase()
    return filtered.filter(tu => {
      // Search in source text
      if (searchableFields.source) {
        const sourceText = tu.nsrc ? normalizedToString(tu.nsrc).toLowerCase() : ''
        if (sourceText.includes(searchText)) return true
      }
      
      // Search in target text
      if (searchableFields.target) {
        const targetText = tu.ntgt ? normalizedToString(tu.ntgt).toLowerCase() : ''
        if (targetText.includes(searchText)) return true
      }
      
      // Search in notes
      if (searchableFields.notes && tu.notes) {
        let notesText = ''
        if (typeof tu.notes === 'object' && 'desc' in tu.notes && tu.notes.desc) {
          notesText = tu.notes.desc.toLowerCase()
        } else if (typeof tu.notes === 'string') {
          notesText = tu.notes.toLowerCase()
        }
        if (notesText.includes(searchText)) return true
      }
      
      // Search in rid, sid, guid
      if (searchableFields.rid) {
        const rid = tu.rid !== undefined ? String(tu.rid).toLowerCase() : ''
        if (rid.includes(searchText)) return true
      }
      
      if (searchableFields.sid) {
        const sid = tu.sid !== undefined ? String(tu.sid).toLowerCase() : ''
        if (sid.includes(searchText)) return true
      }
      
      if (searchableFields.guid) {
        const guid = tu.guid ? tu.guid.toLowerCase() : ''
        if (guid.includes(searchText)) return true
      }
      
      return false
    })
  }
  
  // Get filtered job data
  const filteredJobData = jobData ? { ...jobData, tus: filterTranslationUnits(jobData.tus) } : null

  // Handle marking current segment as reviewed before navigation
  const handleBeforeNavigate = () => {
    if (!jobData || activeSegmentIndex < 0) return

    // Get the current segment's GUID
    let currentGuid: string | undefined
    if (flowData && currentPage) {
      currentGuid = currentPage.segments?.[activeSegmentIndex]?.g
    } else if (filteredJobData) {
      currentGuid = filteredJobData.tus[activeSegmentIndex]?.guid
    }

    if (currentGuid) {
      onReviewToggle(currentGuid, true)
    }
  }

  // Mark all visible segments on current page as reviewed
  const handleMarkAllVisibleAsReviewed = () => {
    if (!currentPage || !currentPage.segments) return

    // Filter for visible segments (width > 0 and height > 0)
    const visibleSegments = currentPage.segments.filter(
      segment => segment.width > 0 && segment.height > 0
    )

    // Mark all visible segments as reviewed
    visibleSegments.forEach(segment => {
      onReviewToggle(segment.g, true)
    })
  }

  // Setup keyboard navigation
  useKeyboardNavigation({
    currentPageIndex,
    totalPages: flowData?.pages.length || 0,
    activeSegmentIndex,
    totalSegments: flowData ? (currentPage?.segments.length || 0) : (filteredJobData?.tus.length || 0),
    navigatePage,
    setActiveSegmentIndex: handleSetActiveSegmentIndex,
    onBeforeNavigate: handleBeforeNavigate,
  })
  
  // When navigating to a new page or when jobData loads without flowData, focus on the first segment
  // But don't auto-select when user has explicitly deselected or when only the filter changes
  useEffect(() => {
    const hasSegments = flowData ? (currentPage?.segments.length || 0) > 0 : (jobData?.tus.length || 0) > 0
    if (hasSegments && activeSegmentIndex === -1 && !userDeselected.current) {
      setActiveSegmentIndex(0)
    }
  }, [currentPageIndex, flowData, jobData, currentPage, activeSegmentIndex])
  
  // Handle case where active segment gets filtered out - deselect instead of auto-selecting
  useEffect(() => {
    if (activeSegmentIndex !== -1 && filteredJobData) {
      const filteredCount = filteredJobData.tus.length
      if (filteredCount === 0 || activeSegmentIndex >= filteredCount) {
        handleSetActiveSegmentIndex(-1)
      }
    }
  }, [filteredJobData, activeSegmentIndex])
  
  // Reset page index when new flow data is loaded
  useEffect(() => {
    setCurrentPageIndex(0)
    userDeselected.current = false // Reset on new data
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
                onMarkAllVisibleAsReviewed={handleMarkAllVisibleAsReviewed}
              />
            ) : (
              <Text color="gray.600" textAlign="center" py={20}>
                No screenshot available for this page
              </Text>
            )}
          </GlassBox>

          {/* Editor Section */}
          <GlassBox p={6} height="100%" overflow="hidden" minWidth={0} maxW="100%">
            <HStack justify="space-between" align="center" mb={4}>
              <Heading size="md" color="gray.700">
                Editable Text Segments
              </Heading>
              <TranslationFilterControls
                showOnlyNonReviewed={showOnlyNonReviewed}
                onShowOnlyNonReviewedChange={setShowOnlyNonReviewed}
                filterText={filterText}
                onFilterTextChange={setFilterText}
                searchableFields={searchableFields}
                onSearchableFieldsChange={setSearchableFields}
                onFilterFocus={() => handleSetActiveSegmentIndex(-1)}
              />
            </HStack>
            <TextSegmentEditor
              page={currentPage || null}
              jobData={filteredJobData || jobData}
              originalJobData={originalJobData}
              savedJobData={savedJobData}
              onTranslationUnitChange={onTranslationUnitChange}
              onCandidateSelect={onCandidateSelect}
              activeSegmentIndex={activeSegmentIndex}
              onSegmentFocus={handleSetActiveSegmentIndex}
              qualityModel={qualityModel}
              onReviewToggle={onReviewToggle}
            />
          </GlassBox>
        </ResizablePane>
      ) : (
        // Single-pane layout when no flowData (screenshot-less mode)
        <GlassBox p={6} height="100%" overflow="hidden" minWidth={0} maxW="100%" boxSizing="border-box" display="flex" flexDirection="column">
          <HStack justify="space-between" align="center" mb={4} flexShrink={0}>
            <Heading size="md" color="gray.700">
              Editable Translation Units
            </Heading>
            <TranslationFilterControls
              showOnlyNonReviewed={showOnlyNonReviewed}
              onShowOnlyNonReviewedChange={setShowOnlyNonReviewed}
              filterText={filterText}
              onFilterTextChange={setFilterText}
              searchableFields={searchableFields}
              onSearchableFieldsChange={setSearchableFields}
              onFilterFocus={() => handleSetActiveSegmentIndex(-1)}
            />
          </HStack>
          <Box flex="1" minHeight={0}>
            <TextSegmentEditor
              page={null}
              jobData={filteredJobData || jobData}
              originalJobData={originalJobData}
              savedJobData={savedJobData}
              onTranslationUnitChange={onTranslationUnitChange}
              onCandidateSelect={onCandidateSelect}
              activeSegmentIndex={activeSegmentIndex}
              onSegmentFocus={handleSetActiveSegmentIndex}
              qualityModel={qualityModel}
              onReviewToggle={onReviewToggle}
            />
          </Box>
        </GlassBox>
      )}
      
      {/* Info Modal */}
      {jobData && (jobData.sourceLang || jobData.targetLang || jobData.instructions || jobData.jobGuid || jobData.updatedAt || sourcePluginName || ter !== null || ept !== null) && (
        <InfoModal
          isOpen={isInfoModalOpen}
          onClose={() => setIsInfoModalOpen(false)}
          instructions={jobData.instructions}
          sourceLang={jobData.sourceLang}
          targetLang={jobData.targetLang}
          jobName={jobData.jobName}
          jobGuid={jobData.jobGuid}
          updatedAt={jobData.updatedAt}
          sourceInfo={sourcePluginName ? {
            pluginName: sourcePluginName,
            location: sourceLocation
          } : undefined}
          ter={ter}
          ept={ept}
        />
      )}
    </>
  )
}) 