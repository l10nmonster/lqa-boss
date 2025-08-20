import { useState, useEffect, useRef, useImperativeHandle, forwardRef } from 'react'
import { Box, Heading, Text, Input, HStack, Kbd, InputGroup, Menu, IconButton } from '@chakra-ui/react'
import { FiSearch, FiSliders } from 'react-icons/fi'
import JSZip from 'jszip'
import { FlowData, JobData, TranslationUnit } from '../types'
import ScreenshotViewer from './ScreenshotViewer'
import TextSegmentEditor from './TextSegmentEditor'
import GlassBox from './GlassBox'
import ResizablePane from './ResizablePane'
import InstructionsModal from './InstructionsModal'
import { useKeyboardNavigation } from '../hooks/useKeyboardNavigation'
import { normalizedToString } from '../utils/normalizedText'

interface TranslationEditorProps {
  flowData: FlowData | null
  jobData: JobData | null
  originalJobData: JobData | null
  savedJobData: JobData | null
  zipFile: JSZip | null
  onTranslationUnitChange: (tu: TranslationUnit) => void
  onInstructionsOpen?: () => void
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
  onInstructionsOpen,
}, ref) => {
  const [currentPageIndex, setCurrentPageIndex] = useState(0)
  const [activeSegmentIndex, setActiveSegmentIndex] = useState(-1)
  const [isInstructionsModalOpen, setIsInstructionsModalOpen] = useState(false)

  // Expose openInstructions method via ref
  useImperativeHandle(ref, () => ({
    openInstructions: () => setIsInstructionsModalOpen(true)
  }), [])
  const [filterText, setFilterText] = useState('')
  const filterInputRef = useRef<HTMLInputElement>(null)
  const userDeselected = useRef(false)
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
  
  // Show instructions modal every time a new file is loaded with language info
  const sourceLang = jobData?.sourceLang
  const targetLang = jobData?.targetLang
  const jobDataRef = useRef<any>(undefined)
  
  useEffect(() => {
    if (jobData && (sourceLang || targetLang)) {
      // Check if this is a different jobData object (new file load)
      if (jobDataRef.current !== jobData && onInstructionsOpen) {
        setIsInstructionsModalOpen(true)
        onInstructionsOpen()
        jobDataRef.current = jobData
      }
    } else {
      // Reset ref when jobData is null/undefined (no file loaded)
      jobDataRef.current = undefined
    }
  }, [jobData, sourceLang, targetLang, onInstructionsOpen])
  
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
    if (!filterText.trim()) return tus
    
    const searchText = filterText.toLowerCase()
    return tus.filter(tu => {
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
  
  // Handle Cmd/Ctrl+K shortcut for filter focus
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key === 'k') {
        event.preventDefault()
        filterInputRef.current?.focus()
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [])
  
  // Get filtered job data
  const filteredJobData = jobData ? { ...jobData, tus: filterTranslationUnits(jobData.tus) } : null
  
  // Setup keyboard navigation
  useKeyboardNavigation({
    currentPageIndex,
    totalPages: flowData?.pages.length || 0,
    activeSegmentIndex,
    totalSegments: flowData ? (currentPage?.segments.length || 0) : (filteredJobData?.tus.length || 0),
    navigatePage,
    setActiveSegmentIndex: handleSetActiveSegmentIndex,
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
              <HStack gap={2}>
                <InputGroup 
                  width="200px" 
                  startElement={<FiSearch color="gray.500" />} 
                  endElement={
                    <Kbd fontSize="xs" color="gray.500" bg="gray.100" px="1" py="0.5">
                      {navigator.platform.includes('Mac') ? '⌘K' : 'Ctrl+K'}
                    </Kbd>
                  }
                >
                  <Input
                    ref={filterInputRef}
                    placeholder="Filter"
                    size="sm"
                    value={filterText}
                    onChange={(e) => setFilterText(e.target.value)}
                    bg="rgba(255, 255, 255, 0.9)"
                    borderColor="rgba(0, 0, 0, 0.2)"
                    _focus={{
                      borderColor: "blue.500",
                      boxShadow: "0 0 0 1px rgba(66, 153, 225, 0.6)"
                    }}
                  />
                </InputGroup>
                <Menu.Root>
                  <Menu.Trigger asChild>
                    <IconButton
                      aria-label="Filter settings"
                      size="sm"
                      variant="ghost"
                    >
                      <FiSliders />
                    </IconButton>
                  </Menu.Trigger>
                  <Menu.Positioner>
                    <Menu.Content>
                      <Menu.CheckboxItem 
                        value="source"
                        checked={searchableFields.source}
                        onCheckedChange={(checked) => setSearchableFields(prev => ({ ...prev, source: checked }))}
                      >
                        <Menu.ItemIndicator />
                        Source
                      </Menu.CheckboxItem>
                      <Menu.CheckboxItem 
                        value="target"
                        checked={searchableFields.target}
                        onCheckedChange={(checked) => setSearchableFields(prev => ({ ...prev, target: checked }))}
                      >
                        <Menu.ItemIndicator />
                        Target
                      </Menu.CheckboxItem>
                      <Menu.CheckboxItem 
                        value="notes"
                        checked={searchableFields.notes}
                        onCheckedChange={(checked) => setSearchableFields(prev => ({ ...prev, notes: checked }))}
                      >
                        <Menu.ItemIndicator />
                        Notes
                      </Menu.CheckboxItem>
                      <Menu.CheckboxItem 
                        value="rid"
                        checked={searchableFields.rid}
                        onCheckedChange={(checked) => setSearchableFields(prev => ({ ...prev, rid: checked }))}
                      >
                        <Menu.ItemIndicator />
                        RID
                      </Menu.CheckboxItem>
                      <Menu.CheckboxItem 
                        value="sid"
                        checked={searchableFields.sid}
                        onCheckedChange={(checked) => setSearchableFields(prev => ({ ...prev, sid: checked }))}
                      >
                        <Menu.ItemIndicator />
                        SID
                      </Menu.CheckboxItem>
                      <Menu.CheckboxItem 
                        value="guid"
                        checked={searchableFields.guid}
                        onCheckedChange={(checked) => setSearchableFields(prev => ({ ...prev, guid: checked }))}
                      >
                        <Menu.ItemIndicator />
                        GUID
                      </Menu.CheckboxItem>
                    </Menu.Content>
                  </Menu.Positioner>
                </Menu.Root>
              </HStack>
            </HStack>
            <TextSegmentEditor
              page={currentPage || null}
              jobData={filteredJobData || jobData}
              originalJobData={originalJobData}
              savedJobData={savedJobData}
              onTranslationUnitChange={onTranslationUnitChange}
              activeSegmentIndex={activeSegmentIndex}
              onSegmentFocus={handleSetActiveSegmentIndex}
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
            <HStack gap={2}>
              <InputGroup 
                width="200px" 
                startElement={<FiSearch color="gray.500" />} 
                endElement={
                  <Kbd fontSize="xs" color="gray.500" bg="gray.100" px="1" py="0.5">
                    {navigator.platform.includes('Mac') ? '⌘K' : 'Ctrl+K'}
                  </Kbd>
                }
              >
                <Input
                  ref={filterInputRef}
                  placeholder="Filter"
                  size="sm"
                  value={filterText}
                  onChange={(e) => setFilterText(e.target.value)}
                  bg="rgba(255, 255, 255, 0.9)"
                  borderColor="rgba(0, 0, 0, 0.2)"
                  _focus={{
                    borderColor: "blue.500",
                    boxShadow: "0 0 0 1px rgba(66, 153, 225, 0.6)"
                  }}
                />
              </InputGroup>
              <Menu.Root>
                <Menu.Trigger asChild>
                  <IconButton
                    aria-label="Filter settings"
                    size="sm"
                    variant="ghost"
                  >
                    <FiSliders />
                  </IconButton>
                </Menu.Trigger>
                <Menu.Positioner>
                  <Menu.Content>
                    <Menu.CheckboxItem 
                      value="source"
                      checked={searchableFields.source}
                      onCheckedChange={(checked) => setSearchableFields(prev => ({ ...prev, source: checked }))}
                    >
                      <Menu.ItemIndicator />
                      Source
                    </Menu.CheckboxItem>
                    <Menu.CheckboxItem 
                      value="target"
                      checked={searchableFields.target}
                      onCheckedChange={(checked) => setSearchableFields(prev => ({ ...prev, target: checked }))}
                    >
                      <Menu.ItemIndicator />
                      Target
                    </Menu.CheckboxItem>
                    <Menu.CheckboxItem 
                      value="notes"
                      checked={searchableFields.notes}
                      onCheckedChange={(checked) => setSearchableFields(prev => ({ ...prev, notes: checked }))}
                    >
                      <Menu.ItemIndicator />
                      Notes
                    </Menu.CheckboxItem>
                    <Menu.CheckboxItem 
                      value="rid"
                      checked={searchableFields.rid}
                      onCheckedChange={(checked) => setSearchableFields(prev => ({ ...prev, rid: checked }))}
                    >
                      <Menu.ItemIndicator />
                      RID
                    </Menu.CheckboxItem>
                    <Menu.CheckboxItem 
                      value="sid"
                      checked={searchableFields.sid}
                      onCheckedChange={(checked) => setSearchableFields(prev => ({ ...prev, sid: checked }))}
                    >
                      <Menu.ItemIndicator />
                      SID
                    </Menu.CheckboxItem>
                    <Menu.CheckboxItem 
                      value="guid"
                      checked={searchableFields.guid}
                      onCheckedChange={(checked) => setSearchableFields(prev => ({ ...prev, guid: checked }))}
                    >
                      <Menu.ItemIndicator />
                      GUID
                    </Menu.CheckboxItem>
                  </Menu.Content>
                </Menu.Positioner>
              </Menu.Root>
            </HStack>
          </HStack>
          <Box flex="1" minHeight={0}>
            <TextSegmentEditor
              page={null}
              jobData={filteredJobData || jobData}
              originalJobData={originalJobData}
              savedJobData={savedJobData}
              onTranslationUnitChange={onTranslationUnitChange}
              activeSegmentIndex={activeSegmentIndex}
              onSegmentFocus={handleSetActiveSegmentIndex}
            />
          </Box>
        </GlassBox>
      )}
      
      {/* Instructions Modal */}
      {jobData && (jobData.sourceLang || jobData.targetLang || jobData.instructions) && (
        <InstructionsModal
          isOpen={isInstructionsModalOpen}
          onClose={() => setIsInstructionsModalOpen(false)}
          instructions={jobData.instructions}
          sourceLang={jobData.sourceLang}
          targetLang={jobData.targetLang}
        />
      )}
    </>
  )
}) 