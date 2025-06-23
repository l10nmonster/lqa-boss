import React, { useEffect, useRef } from 'react'
import { Box, Stack, IconButton, Text } from '@chakra-ui/react'
import { FiRotateCcw } from 'react-icons/fi'
import { Page } from '../types'
import LexicalEditor from './LexicalEditor'

interface TextSegmentEditorProps {
  page: Page
  pageIndex: number
  originalTexts: Record<string, string>
  activeSegmentIndex: number
  onSegmentFocus: (index: number) => void
  onTextChange: (pageIndex: number, segmentIndex: number, text: string) => void
}

const TextSegmentEditor: React.FC<TextSegmentEditorProps> = ({
  page,
  pageIndex,
  originalTexts,
  activeSegmentIndex,
  onSegmentFocus,
  onTextChange,
}) => {
  const editorRefs = useRef<{ [key: number]: HTMLDivElement }>({})

  useEffect(() => {
    // Scroll active segment into view
    if (activeSegmentIndex >= 0 && editorRefs.current[activeSegmentIndex]) {
      editorRefs.current[activeSegmentIndex].scrollIntoView({
        behavior: 'smooth',
        block: 'nearest',
      })
    }
  }, [activeSegmentIndex])

  const handleUndo = (segmentIndex: number) => {
    const originalText = originalTexts[`${page.pageId}_${segmentIndex}`]
    if (originalText !== undefined) {
      onTextChange(pageIndex, segmentIndex, originalText)
    }
  }

  const isModified = (segmentIndex: number): boolean => {
    const originalText = originalTexts[`${page.pageId}_${segmentIndex}`]
    const currentText = page.segments[segmentIndex].text
    return originalText !== currentText
  }

  if (!page.segments || page.segments.length === 0) {
    return (
      <Text color="whiteAlpha.700" textAlign="center" py={10}>
        No text segments on this page.
      </Text>
    )
  }

  return (
    <Stack
      direction="column"
      gap={4}
      align="stretch"
      maxH="70vh"
      overflowY="auto"
      css={{
        '&::-webkit-scrollbar': {
          width: '8px',
        },
        '&::-webkit-scrollbar-track': {
          background: 'rgba(255, 255, 255, 0.1)',
          borderRadius: '4px',
        },
        '&::-webkit-scrollbar-thumb': {
          background: 'rgba(255, 255, 255, 0.3)',
          borderRadius: '4px',
        },
        '&::-webkit-scrollbar-thumb:hover': {
          background: 'rgba(255, 255, 255, 0.4)',
        },
      }}
    >
      {page.segments.map((segment, index) => (
        <Box
          key={index}
          ref={(el) => {
            if (el) editorRefs.current[index] = el
          }}
          p={4}
          bg={activeSegmentIndex === index ? 'whiteAlpha.200' : 'whiteAlpha.100'}
          borderRadius="lg"
          border="1px solid"
          borderColor={
            activeSegmentIndex === index
              ? 'blue.400'
              : isModified(index)
              ? 'red.400'
              : 'green.400'
          }
          borderLeftWidth="4px"
          transition="all 0.2s"
          position="relative"
          onClick={() => onSegmentFocus(index)}
          cursor="pointer"
          _hover={{
            bg: 'whiteAlpha.200',
          }}
        >
          <Stack direction="row" position="absolute" top={2} right={2}>
            <IconButton
              aria-label="Undo changes"
              size="sm"
              variant="ghost"
              colorScheme="whiteAlpha"
              onClick={(e) => {
                e.stopPropagation()
                handleUndo(index)
              }}
              disabled={!isModified(index)}
            >
              <FiRotateCcw />
            </IconButton>
          </Stack>
          
          <LexicalEditor
            initialText={segment.text}
            onChange={(text) => onTextChange(pageIndex, index, text)}
            onFocus={() => onSegmentFocus(index)}
            isActive={activeSegmentIndex === index}
          />
        </Box>
      ))}
    </Stack>
  )
}

export default TextSegmentEditor 