import React, { useEffect, useRef } from 'react'
import { Box, Stack, Text, VStack, HStack, Button, Flex } from '@chakra-ui/react'
import { Page, JobData, TranslationUnit, NormalizedItem } from '../types'
import NormalizedTextEditor from './NormalizedTextEditor'
import { normalizedToDisplayString, normalizedToDisplayStringForTarget } from '../utils/normalizedText'
import { isEqual } from 'lodash'

interface TextSegmentEditorProps {
  page: Page | null
  jobData: JobData
  originalJobData: JobData
  onTranslationUnitChange: (tu: TranslationUnit) => void
  activeSegmentIndex: number
  onSegmentFocus: (index: number) => void
}

const TextSegmentEditor: React.FC<TextSegmentEditorProps> = ({
  page,
  jobData,
  originalJobData,
  onTranslationUnitChange,
  activeSegmentIndex,
  onSegmentFocus,
}) => {
  const editorRefs = useRef<{ [key: number]: HTMLDivElement }>({})
  const scrollContainerRef = useRef<HTMLDivElement>(null)
  const tusByGuid = new Map(jobData.tus.map(tu => [tu.guid, tu]))
  const originalTusByGuid = new Map(originalJobData.tus.map(tu => [tu.guid, tu]))

  // Handle Esc key to deselect segment
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && activeSegmentIndex !== -1) {
        onSegmentFocus(-1)
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [activeSegmentIndex, onSegmentFocus])

  // Auto-scroll to center active segment
  useEffect(() => {
    if (activeSegmentIndex >= 0) {
      // Use requestAnimationFrame to ensure DOM is fully rendered
      const frameId = requestAnimationFrame(() => {
        const activeElement = editorRefs.current[activeSegmentIndex]
        const scrollContainer = scrollContainerRef.current

        if (activeElement && scrollContainer) {
          const containerHeight = scrollContainer.clientHeight
          const elementHeight = activeElement.offsetHeight
          const elementOffsetTop = activeElement.offsetTop
          
          // Calculate target scroll position to center the element
          const targetScrollTop = elementOffsetTop + (elementHeight / 2) - (containerHeight / 2)
          
          // Use instant scroll to avoid conflicts with scrollIntoView
          scrollContainer.scrollTo({
            top: targetScrollTop,
            behavior: 'instant'
          })
        }
      })

      return () => cancelAnimationFrame(frameId)
    }
  }, [activeSegmentIndex])

  // Get translation units to display
  // If we have page data, use segments to determine which TUs to show
  // If no page data, show all translation units
  const translationUnitsToShow = page 
    ? page.segments?.map((segment, index) => ({ tu: tusByGuid.get(segment.g), segmentIndex: index, segment })).filter(item => item.tu) || []
    : jobData.tus.map((tu, index) => ({ tu, segmentIndex: index, segment: null }))

  useEffect(() => {
    // Scroll active segment into view
    if (activeSegmentIndex >= 0 && editorRefs.current[activeSegmentIndex]) {
      editorRefs.current[activeSegmentIndex].scrollIntoView({
        behavior: 'smooth',
        block: 'nearest',
      })
    }
  }, [activeSegmentIndex])

  const handleNormalizedChange = (guid: string, newNtgt: NormalizedItem[]) => {
    const tu = tusByGuid.get(guid)
    if (tu) {
      onTranslationUnitChange({ ...tu, ntgt: newNtgt })
    }
  }

  const handleUndo = (guid: string) => {
    const originalTu = originalTusByGuid.get(guid)
    if (originalTu) {
      onTranslationUnitChange(originalTu)
    }
  }

  const isTuModified = (guid: string): boolean => {
    const currentTu = tusByGuid.get(guid)
    const originalTu = originalTusByGuid.get(guid)
    if (!currentTu || !originalTu) return false
    return !isEqual(currentTu.ntgt, originalTu.ntgt)
  }

  if (page && (!page.segments || page.segments.length === 0)) {
    return (
      <Text color="gray.600" textAlign="center" py={10}>
        No text segments on this page.
      </Text>
    )
  }

  if (!page && translationUnitsToShow.length === 0) {
    return (
      <Text color="gray.600" textAlign="center" py={10}>
        No translation units to display.
      </Text>
    )
  }

  return (
    <Stack
      ref={scrollContainerRef}
      direction="column"
      gap={4}
      align="stretch"
      height="100%"
      overflowY="auto"
      minWidth={0}
      maxW="100%"
      py={4}
      css={{
        '&::-webkit-scrollbar': {
          width: '8px',
        },
        '&::-webkit-scrollbar-track': {
          background: 'rgba(203, 213, 225, 0.3)',
          borderRadius: '4px',
        },
        '&::-webkit-scrollbar-thumb': {
          background: 'rgba(148, 163, 184, 0.6)',
          borderRadius: '4px',
        },
        '&::-webkit-scrollbar-thumb:hover': {
          background: 'rgba(148, 163, 184, 0.8)',
        },
      }}
    >
      {translationUnitsToShow.map((item, index) => {
        const { tu } = item
        const isActive = activeSegmentIndex === index

        if (!tu) {
          return (
            <Box key={index} p={4} bg="rgba(239, 68, 68, 0.1)" backdropFilter="blur(10px)" borderRadius="lg" border="1px solid" borderColor="rgba(239, 68, 68, 0.3)">
              <Text color="red.600">Error: No translation unit found for segment with guid: {item.segment?.g}</Text>
            </Box>
          )
        }

        // Add defensive checks for tu properties
        const safeRid = tu.rid !== undefined ? (typeof tu.rid === 'object' ? JSON.stringify(tu.rid) : String(tu.rid)) : 'unknown'
        const safeSid = tu.sid !== undefined ? (typeof tu.sid === 'object' ? JSON.stringify(tu.sid) : String(tu.sid)) : 'unknown'
        const safeGuid = tu.guid || 'unknown'
        
        // Handle notes - check if it's an object with desc property
        let notesDesc: string | null = null
        if (tu.notes) {
          if (typeof tu.notes === 'object' && 'desc' in tu.notes && tu.notes.desc) {
            notesDesc = tu.notes.desc
          } else if (typeof tu.notes === 'string') {
            // Legacy string notes - don't show in the info line anymore
            notesDesc = tu.notes
          }
        }

        const isModified = isTuModified(tu.guid)
        
        return (
          <Box
            key={index}
            ref={(el: HTMLDivElement | null) => {
              if (el) editorRefs.current[index] = el
            }}
            p={isActive ? 6 : 4}
            bg={isActive ? 'rgba(59, 130, 246, 0.1)' : 'rgba(255, 255, 255, 0.2)'}
            backdropFilter="blur(10px)"
            borderRadius="lg"
            border="1px solid"
            borderColor={isActive ? 'rgba(59, 130, 246, 0.3)' : 'rgba(255, 255, 255, 0.3)'}
            borderLeftWidth="4px"
            borderLeftColor={isModified ? 'orange.400' : (isActive ? 'blue.400' : 'green.400')}
            boxShadow={isActive ? '0 8px 24px 0 rgba(59, 130, 246, 0.15)' : '0 2px 8px 0 rgba(0, 0, 0, 0.05)'}
            transform={isActive ? 'scale(1)' : 'scale(0.98)'}
            transition="all 0.3s cubic-bezier(0.4, 0, 0.2, 1)"
            onClick={() => onSegmentFocus(index)}
            cursor="pointer"
            minWidth={0}
            maxW="100%"
            _hover={{
              bg: isActive ? 'rgba(59, 130, 246, 0.15)' : 'rgba(255, 255, 255, 0.3)',
              borderColor: isActive ? 'rgba(59, 130, 246, 0.4)' : 'rgba(255, 255, 255, 0.4)',
              transform: isActive ? 'scale(1) translateY(-2px)' : 'scale(0.98) translateY(-2px)',
              boxShadow: isActive ? '0 12px 32px 0 rgba(59, 130, 246, 0.2)' : '0 4px 12px 0 rgba(0, 0, 0, 0.1)',
            }}
          >
            {isActive ? (
              <VStack align="stretch" gap={3}>
                <HStack justify="space-between">
                  <HStack>
                    <Text fontFamily="mono" fontSize="xs" color="gray.500" fontWeight="medium">
                      {tu.nsrc ? normalizedToDisplayString(tu.nsrc) : '(no source text)'}
                    </Text>
                  </HStack>
                  <Button
                    aria-label="Undo changes"
                    size="sm"
                    variant="ghost"
                    colorScheme="blue"
                    onClick={(e) => {
                      e.stopPropagation()
                      handleUndo(tu.guid)
                    }}
                    disabled={!isModified}
                  >
                    Undo
                  </Button>
                </HStack>
                <NormalizedTextEditor
                  key={tu.guid}
                  normalizedContent={tu.ntgt || []}
                  onChange={(newNtgt) => handleNormalizedChange(tu.guid, newNtgt)}
                  isActive={isActive}
                />
                {notesDesc && (
                  <Box
                    p={3}
                    bg="rgba(255, 193, 7, 0.1)"
                    borderRadius="md"
                    border="1px solid"
                    borderColor="rgba(255, 193, 7, 0.3)"
                  >
                    <Text fontSize="sm" color="gray.700" fontWeight="medium" mb={1}>
                      Notes:
                    </Text>
                    <Text fontSize="sm" color="gray.600">
                      {notesDesc}
                    </Text>
                  </Box>
                )}
                <Flex gap={2} justify="flex-end" align="center" color="gray.500" fontSize="xs" wrap="wrap" rowGap={1}>
                  <Text><Text as="span" fontWeight="bold">rid:</Text> {safeRid}</Text>
                  <Text><Text as="span" fontWeight="bold">sid:</Text> {safeSid}</Text>
                  <Text><Text as="span" fontWeight="bold">guid:</Text> {safeGuid}</Text>
                </Flex>
              </VStack>
            ) : (
              <Text color="gray.600" fontSize="sm" lineHeight="1.4">
                {tu.ntgt ? normalizedToDisplayStringForTarget(tu.ntgt) : '(no target text)'}
              </Text>
            )}
          </Box>
        )
      })}
    </Stack>
  )
}

export default TextSegmentEditor 