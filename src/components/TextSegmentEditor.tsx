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
  savedJobData: JobData
  onTranslationUnitChange: (tu: TranslationUnit) => void
  activeSegmentIndex: number
  onSegmentFocus: (index: number) => void
}

const TextSegmentEditor: React.FC<TextSegmentEditorProps> = ({
  page,
  jobData,
  originalJobData,
  savedJobData,
  onTranslationUnitChange,
  activeSegmentIndex,
  onSegmentFocus,
}) => {
  const editorRefs = useRef<{ [key: number]: HTMLDivElement }>({})
  const scrollContainerRef = useRef<HTMLDivElement>(null)
  const tusByGuid = new Map(jobData.tus.map(tu => [tu.guid, tu]))
  const originalTusByGuid = new Map(originalJobData.tus.map(tu => [tu.guid, tu]))
  const savedTusByGuid = new Map(savedJobData.tus.map(tu => [tu.guid, tu]))

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


  // Get translation units to display
  // If we have page data, use segments to determine which TUs to show
  // If no page data, show all translation units
  const translationUnitsToShow = page 
    ? page.segments?.map((segment, index) => ({ tu: tusByGuid.get(segment.g), segmentIndex: index, segment })).filter(item => item.tu) || []
    : jobData.tus.map((tu, index) => ({ tu, segmentIndex: index, segment: null }))

  useEffect(() => {
    // Scroll active segment into view with centering
    if (activeSegmentIndex >= 0 && editorRefs.current[activeSegmentIndex]) {
      editorRefs.current[activeSegmentIndex].scrollIntoView({
        behavior: 'smooth',
        block: 'center',
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
    const savedTu = savedTusByGuid.get(guid)
    if (savedTu) {
      onTranslationUnitChange(savedTu)
    }
  }

  const handleOriginal = (guid: string) => {
    const originalTu = originalTusByGuid.get(guid)
    if (originalTu) {
      onTranslationUnitChange(originalTu)
    }
  }

  // Three-state system for segment colors
  const getSegmentState = (guid: string): 'original' | 'saved' | 'modified' => {
    const currentTu = tusByGuid.get(guid)
    const originalTu = originalTusByGuid.get(guid)
    const savedTu = savedTusByGuid.get(guid)
    
    if (!currentTu || !originalTu || !savedTu) return 'original'
    
    // Check if current matches original source text (green)
    if (isEqual(currentTu.ntgt, originalTu.ntgt)) {
      return 'original' // Green - matches original source text
    }
    
    // Check if current matches saved translation (yellow)  
    if (isEqual(currentTu.ntgt, savedTu.ntgt)) {
      return 'saved' // Yellow - matches saved translation
    }
    
    // Current differs from both original and saved
    return 'modified' // Red - has unsaved changes
  }
  
  const getSegmentBorderColor = (guid: string, isActive: boolean): string => {
    const state = getSegmentState(guid)
    switch (state) {
      case 'original': return isActive ? 'blue.500' : 'green.300'
      case 'saved': return isActive ? 'blue.500' : 'yellow.400' 
      case 'modified': return isActive ? 'blue.500' : 'red.500'
      default: return isActive ? 'blue.500' : 'green.300'
    }
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
        // Chrome scroll performance optimizations
        willChange: 'scroll-position',
        transform: 'translateZ(0)',
        backfaceVisibility: 'hidden',
        perspective: '1000px',
        // Scrollbar styling
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

        const segmentState = getSegmentState(tu.guid)
        
        return (
          <Box
            key={index}
            ref={(el: HTMLDivElement | null) => {
              if (el) editorRefs.current[index] = el
            }}
            p={isActive ? 6 : 4}
            bg={isActive ? 'rgba(255, 255, 255, 0.95)' : 'rgba(30, 58, 138, 0.8)'}
            css={{
              willChange: 'transform, background-color, border-color, box-shadow',
              backfaceVisibility: 'hidden',
              transform: 'translateZ(0)',
              filter: isActive ? 'none' : 'blur(0.4px)',
            }}
            borderRadius="lg"
            border="1px solid"
            borderColor={isActive ? 'rgba(59, 130, 246, 0.6)' : 'rgba(255, 255, 255, 0.2)'}
            borderLeftWidth="4px"
            borderLeftColor={getSegmentBorderColor(tu.guid, isActive)}
            boxShadow={isActive ? '0 8px 24px 0 rgba(59, 130, 246, 0.3)' : '0 2px 8px 0 rgba(0, 0, 0, 0.2)'}
            transform={isActive ? 'scale(1)' : 'scale(0.99)'}
            transition="transform 0.4s ease-in-out, background-color 0.4s ease-in-out, border-color 0.4s ease-in-out, box-shadow 0.4s ease-in-out, filter 0.4s ease-in-out"
            onClick={() => onSegmentFocus(index)}
            cursor="pointer"
            minWidth={0}
            maxW="100%"
            _hover={{
              bg: isActive ? 'rgba(255, 255, 255, 1)' : 'rgba(30, 58, 138, 0.9)',
              borderColor: isActive ? 'rgba(59, 130, 246, 0.8)' : 'rgba(255, 255, 255, 0.3)',
              transform: isActive ? 'scale(1) translateY(-1px)' : 'scale(0.99) translateY(-1px)',
              boxShadow: isActive ? '0 8px 16px 0 rgba(59, 130, 246, 0.4)' : '0 4px 8px 0 rgba(30, 58, 138, 0.4)',
              filter: isActive ? 'none' : 'blur(0.2px)',
            }}
          >
            {isActive ? (
              <VStack align="stretch" gap={3}>
                <HStack justify="space-between">
                  <HStack>
                    <Box p={2} bg="gray.100" borderRadius="md" maxW="100%">
                      <Text fontSize="sm" color="gray.700" fontWeight="normal">
                        {tu.nsrc ? normalizedToDisplayString(tu.nsrc) : '(no source text)'}
                      </Text>
                    </Box>
                  </HStack>
                  <HStack>
                    <Button
                      aria-label="Revert to original source text"
                      size="sm"
                      variant="ghost"
                      colorScheme="green"
                      onClick={(e) => {
                        e.stopPropagation()
                        handleOriginal(tu.guid)
                      }}
                      disabled={segmentState === 'original'}
                    >
                      Original
                    </Button>
                    <Button
                      aria-label="Undo to saved translation"
                      size="sm"
                      variant="ghost"
                      colorScheme="yellow"
                      onClick={(e) => {
                        e.stopPropagation()
                        handleUndo(tu.guid)
                      }}
                      disabled={segmentState === 'original' || segmentState === 'saved'}
                    >
                      Undo
                    </Button>
                  </HStack>
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
                    <Text fontSize="xs" color="gray.800" fontWeight="normal" mb={1}>
                      Notes:
                    </Text>
                    <Text fontSize="xs" color="gray.700" fontWeight="normal">
                      {notesDesc}
                    </Text>
                  </Box>
                )}
                <Flex gap={2} justify="flex-end" align="center" color="gray.600" fontSize="xs" wrap="wrap" rowGap={1}>
                  <Text fontWeight="normal"><Text as="span" fontWeight="normal">rid:</Text> {safeRid}</Text>
                  <Text fontWeight="normal"><Text as="span" fontWeight="normal">sid:</Text> {safeSid}</Text>
                  <Text fontWeight="normal"><Text as="span" fontWeight="normal">guid:</Text> {safeGuid}</Text>
                </Flex>
              </VStack>
            ) : (
              <Text color="gray.200" fontSize="sm" lineHeight="1.4" fontWeight="normal">
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