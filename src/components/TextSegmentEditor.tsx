import React, { useEffect, useRef } from 'react'
import { Box, Stack, Text, VStack, HStack, Button } from '@chakra-ui/react'
import { FiRotateCcw } from 'react-icons/fi'
import { Page, JobData, TranslationUnit, NormalizedItem } from '../types'
import NormalizedTextEditor from './NormalizedTextEditor'
import { normalizedToDisplayString, normalizedToDisplayStringForTarget } from '../utils/normalizedText'
import { isEqual } from 'lodash'

interface TextSegmentEditorProps {
  page: Page
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
  const editorRefs = useRef<{ [key: string]: HTMLDivElement }>({})
  const tusByGuid = new Map(jobData.tus.map(tu => [tu.guid, tu]))
  const originalTusByGuid = new Map(originalJobData.tus.map(tu => [tu.guid, tu]))

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

  if (!page.segments || page.segments.length === 0) {
    return (
      <Text color="gray.600" textAlign="center" py={10}>
        No text segments on this page.
      </Text>
    )
  }

  return (
    <Stack
      direction="column"
      gap={4}
      align="stretch"
      height="100%"
      overflowY="auto"
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
      {page.segments.map((segment, index) => {
        const tu = tusByGuid.get(segment.g)
        const isActive = activeSegmentIndex === index

        if (!tu) {
          return (
            <Box key={index} p={4} bg="rgba(239, 68, 68, 0.1)" backdropFilter="blur(10px)" borderRadius="lg" border="1px solid" borderColor="rgba(239, 68, 68, 0.3)">
              <Text color="red.600">Error: No translation unit found for segment with guid: {segment.g}</Text>
            </Box>
          )
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
            transform={isActive ? 'scale(1.02)' : 'scale(1)'}
            transition="all 0.3s cubic-bezier(0.4, 0, 0.2, 1)"
            onClick={() => onSegmentFocus(index)}
            cursor="pointer"
            _hover={{
              bg: isActive ? 'rgba(59, 130, 246, 0.15)' : 'rgba(255, 255, 255, 0.3)',
              borderColor: isActive ? 'rgba(59, 130, 246, 0.4)' : 'rgba(255, 255, 255, 0.4)',
              transform: isActive ? 'scale(1.02) translateY(-2px)' : 'scale(1.01) translateY(-1px)',
              boxShadow: isActive ? '0 12px 32px 0 rgba(59, 130, 246, 0.2)' : '0 4px 12px 0 rgba(0, 0, 0, 0.1)',
            }}
          >
            {isActive ? (
              <VStack align="stretch" gap={3}>
                <HStack justify="space-between">
                  <HStack>
                    <Text fontFamily="mono" fontSize="xs" color="gray.500" fontWeight="medium">{normalizedToDisplayString(tu.nsrc)}</Text>
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
                  normalizedContent={tu.ntgt}
                  onChange={(newNtgt) => handleNormalizedChange(tu.guid, newNtgt)}
                  isActive={isActive}
                />
                <HStack gap={4} justify="flex-end" color="gray.500" fontSize="xs">
                  <Text>rid: {tu.rid}</Text>
                  <Text>sid: {tu.sid}</Text>
                  {tu.notes && <Text>Notes: {tu.notes}</Text>}
                </HStack>
              </VStack>
            ) : (
              <Text color="gray.600" fontSize="sm" lineHeight="1.4">
                {normalizedToDisplayStringForTarget(tu.ntgt)}
              </Text>
            )}
          </Box>
        )
      })}
    </Stack>
  )
}

export default TextSegmentEditor 