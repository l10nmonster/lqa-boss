import React, { useEffect, useRef, useMemo, useCallback } from 'react'
import { Box, Stack, Text, VStack, HStack, Flex, Menu, IconButton, Portal, Tooltip } from '@chakra-ui/react'
import { FiEdit, FiHome, FiRotateCcw, FiCopy, FiTarget } from 'react-icons/fi'
import { Page, JobData, TranslationUnit, NormalizedItem, NormalizedPlaceholder, PlaceholderDescription } from '../types'
import NormalizedTextEditor, { NormalizedTextEditorRef } from './NormalizedTextEditor'
import { normalizedToString } from '../utils/normalizedText'
import { isEqual } from 'lodash'

// Helper to extract placeholders with their indices
function extractPlaceholders(items: NormalizedItem[]): Array<{ index: number, placeholder: NormalizedPlaceholder }> {
  const placeholders: Array<{ index: number, placeholder: NormalizedPlaceholder }> = []
  let index = 1

  items.forEach(item => {
    if (typeof item !== 'string') {
      placeholders.push({ index, placeholder: item })
      index++
    }
  })

  return placeholders
}

// Component to display normalized text with indexed placeholders (read-only)
function NormalizedTextDisplay({
  items,
  showSample = false,
  placeholderDescriptions
}: {
  items: NormalizedItem[],
  showSample?: boolean,
  placeholderDescriptions?: { [key: string]: PlaceholderDescription }
}) {
  let placeholderIndex = 1

  return (
    <>
      {items.map((item, idx) => {
        if (typeof item === 'string') {
          return <React.Fragment key={idx}>{item}</React.Fragment>
        }

        const placeholder = item as NormalizedPlaceholder
        const currentIndex = placeholderIndex++

        // Get placeholder description from notes.ph if available
        // Match using the placeholder's v value, not the visual index
        const phKey = placeholder.v
        const phDesc = placeholderDescriptions?.[phKey]

        // Build tooltip content
        let tooltipContent = `Code: ${placeholder.v}`
        if (placeholder.s) {
          tooltipContent += `\nSample: ${placeholder.s}`
        }
        if (phDesc?.desc) {
          tooltipContent += `\n\n${phDesc.desc}`
        }

        // Determine what to display in the pill
        const displayText = showSample ? (placeholder.s || placeholder.v) : currentIndex

        return (
          <Tooltip.Root key={idx} openDelay={0} closeDelay={0}>
            <Tooltip.Trigger asChild>
              <span
                style={{
                  display: 'inline-block',
                  backgroundColor: showSample ? 'rgba(255, 255, 255, 0.95)' : 'rgba(59, 130, 246, 0.15)',
                  padding: '2px 8px',
                  borderRadius: '12px',
                  border: showSample ? '1px solid rgba(148, 163, 184, 0.6)' : '1px solid rgba(59, 130, 246, 0.4)',
                  fontFamily: 'monospace',
                  fontSize: '0.85em',
                  fontWeight: '600',
                  userSelect: 'none',
                  color: showSample ? 'rgba(51, 65, 85, 1)' : 'rgba(37, 99, 235, 1)',
                  whiteSpace: 'nowrap'
                }}
              >
                {displayText}
              </span>
            </Tooltip.Trigger>
            <Portal>
              <Tooltip.Positioner>
                <Tooltip.Content>
                  <Text fontSize="xs" whiteSpace="pre-line">{tooltipContent}</Text>
                </Tooltip.Content>
              </Tooltip.Positioner>
            </Portal>
          </Tooltip.Root>
        )
      })}
    </>
  )
}

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
  const normalizedEditorRefs = useRef<{ [key: string]: NormalizedTextEditorRef | null }>({})
  
  // Memoize the maps to prevent unnecessary re-creation
  const tusByGuid = useMemo(() => new Map(jobData.tus.map(tu => [tu.guid, tu])), [jobData.tus])
  const originalTusByGuid = useMemo(() => new Map(originalJobData.tus.map(tu => [tu.guid, tu])), [originalJobData.tus])
  const savedTusByGuid = useMemo(() => new Map(savedJobData.tus.map(tu => [tu.guid, tu])), [savedJobData.tus])

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

  const handleNormalizedChange = useCallback((guid: string, newNtgt: NormalizedItem[]) => {
    const tu = tusByGuid.get(guid)
    if (tu) {
      onTranslationUnitChange({ ...tu, ntgt: newNtgt })
    }
  }, [tusByGuid, onTranslationUnitChange])

  const handleUndo = useCallback((guid: string) => {
    const savedTu = savedTusByGuid.get(guid)
    if (savedTu) {
      // Force update the editor content immediately
      normalizedEditorRefs.current[guid]?.forceUpdate(savedTu.ntgt || [])
      // Update the state as well
      onTranslationUnitChange(savedTu)
    }
  }, [savedTusByGuid, onTranslationUnitChange])

  const handleOriginal = useCallback((guid: string) => {
    const originalTu = originalTusByGuid.get(guid)
    if (originalTu) {
      // Force update the editor content immediately
      normalizedEditorRefs.current[guid]?.forceUpdate(originalTu.ntgt || [])
      // Update the state as well
      onTranslationUnitChange(originalTu)
    }
  }, [originalTusByGuid, onTranslationUnitChange])

  const handleCopySource = useCallback((guid: string) => {
    const tu = tusByGuid.get(guid)
    if (tu && tu.nsrc) {
      const sourceText = normalizedToString(tu.nsrc)
      navigator.clipboard.writeText(sourceText)
    }
  }, [tusByGuid])

  const handleCopyTarget = useCallback((guid: string) => {
    const tu = tusByGuid.get(guid)
    if (tu && tu.ntgt) {
      const targetText = normalizedToString(tu.ntgt)
      navigator.clipboard.writeText(targetText)
    }
  }, [tusByGuid])

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
        let placeholderDescriptions: { [key: string]: PlaceholderDescription } | undefined = undefined
        if (tu.notes) {
          if (typeof tu.notes === 'object') {
            if ('desc' in tu.notes && tu.notes.desc && tu.notes.desc.trim()) {
              notesDesc = tu.notes.desc
            }
            if ('ph' in tu.notes && tu.notes.ph) {
              placeholderDescriptions = tu.notes.ph
            }
          } else if (typeof tu.notes === 'string') {
            // Legacy string notes - don't show in the info line anymore
            notesDesc = tu.notes
          }
        }

        const segmentState = getSegmentState(tu.guid)

        // Extract placeholders from source for mapping display
        const placeholders = tu.nsrc ? extractPlaceholders(tu.nsrc) : []

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
                        {tu.nsrc ? <NormalizedTextDisplay items={tu.nsrc} placeholderDescriptions={placeholderDescriptions} /> : '(no source text)'}
                      </Text>
                    </Box>
                  </HStack>
                  <Menu.Root>
                    <Menu.Trigger asChild>
                      <IconButton
                        aria-label="Edit options"
                        size="sm"
                        variant="ghost"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <FiEdit />
                      </IconButton>
                    </Menu.Trigger>
                    <Portal>
                      <Menu.Positioner zIndex={9999}>
                        <Menu.Content>
                          <Menu.Item
                            value="original"
                            disabled={segmentState === 'original'}
                            onClick={() => handleOriginal(tu.guid)}
                          >
                            <FiHome />
                            Original
                          </Menu.Item>
                          <Menu.Item
                            value="undo"
                            disabled={segmentState === 'original' || segmentState === 'saved'}
                            onClick={() => handleUndo(tu.guid)}
                          >
                            <FiRotateCcw />
                            Undo
                          </Menu.Item>
                          <Menu.Item
                            value="copy-source"
                            onClick={() => handleCopySource(tu.guid)}
                          >
                            <FiCopy />
                            Copy source
                          </Menu.Item>
                          <Menu.Item
                            value="copy-target"
                            onClick={() => handleCopyTarget(tu.guid)}
                          >
                            <FiTarget />
                            Copy target
                          </Menu.Item>
                        </Menu.Content>
                      </Menu.Positioner>
                    </Portal>
                  </Menu.Root>
                </HStack>
                <NormalizedTextEditor
                  key={tu.guid}
                  ref={(ref) => {
                    normalizedEditorRefs.current[tu.guid] = ref
                  }}
                  normalizedContent={tu.ntgt || []}
                  onChange={(newNtgt) => handleNormalizedChange(tu.guid, newNtgt)}
                  isActive={isActive}
                  placeholderDescriptions={placeholderDescriptions}
                />
                {/* Placeholder Mapping */}
                {placeholders.length > 0 && (
                  <Box
                    p={3}
                    bg="rgba(255, 193, 7, 0.1)"
                    borderRadius="md"
                    border="1px solid"
                    borderColor="rgba(255, 193, 7, 0.3)"
                  >
                    <Text fontSize="xs" color="gray.800" fontWeight="semibold" mb={2}>
                      Placeholders:
                    </Text>
                    <Box
                      display="grid"
                      gridTemplateColumns="repeat(auto-fill, minmax(200px, 1fr))"
                      gap={2}
                    >
                      {placeholders.map(({ index, placeholder }) => {
                        // Match using the placeholder's v value, not the visual index
                        const phKey = placeholder.v
                        const phDesc = placeholderDescriptions?.[phKey]
                        return (
                          <Text key={index} fontSize="xs" color="gray.700">
                            <span style={{
                              display: 'inline-block',
                              backgroundColor: 'rgba(59, 130, 246, 0.15)',
                              padding: '1px 6px',
                              borderRadius: '10px',
                              border: '1px solid rgba(59, 130, 246, 0.4)',
                              fontSize: '0.85em',
                              fontWeight: '600',
                              color: 'rgba(37, 99, 235, 1)',
                              marginRight: '6px'
                            }}>
                              {index}
                            </span>
                            <span style={{
                              fontFamily: 'monospace',
                              fontWeight: '600',
                              color: 'rgba(71, 85, 105, 1)'
                            }}>
                              {placeholder.v}
                            </span>
                            {phDesc?.desc && (
                              <span style={{ fontWeight: 'normal' }}>
                                {' - '}{phDesc.desc}
                              </span>
                            )}
                            {placeholder.s && (
                              <span style={{ fontWeight: 'normal' }}>
                                {' (e.g. '}{placeholder.s}{')'}
                              </span>
                            )}
                          </Text>
                        )
                      })}
                    </Box>
                  </Box>
                )}
                {/* Notes */}
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
                {tu.ntgt ? <NormalizedTextDisplay items={tu.ntgt} showSample={true} placeholderDescriptions={placeholderDescriptions} /> : '(no target text)'}
              </Text>
            )}
          </Box>
        )
      })}
    </Stack>
  )
}

export default TextSegmentEditor 