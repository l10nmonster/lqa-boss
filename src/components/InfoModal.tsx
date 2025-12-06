import React from 'react'
import {
  Box,
  Text,
  Button,
  Portal,
  Link,
} from '@chakra-ui/react'
import { FiX } from 'react-icons/fi'

/**
 * Parses text and converts URLs to clickable links while preserving formatting
 */
function parseTextWithLinks(text: string): React.ReactNode {
  // Regular expression to match URLs
  const urlPattern = /(https?:\/\/[^\s]+)/g

  const parts: React.ReactNode[] = []
  let lastIndex = 0
  let match: RegExpExecArray | null
  let keyCounter = 0

  while ((match = urlPattern.exec(text)) !== null) {
    // Add text before the URL
    if (match.index > lastIndex) {
      const textBefore = text.substring(lastIndex, match.index)
      parts.push(<React.Fragment key={`text-${keyCounter++}`}>{textBefore}</React.Fragment>)
    }

    // Add the URL as a clickable link
    const url = match[0]
    parts.push(
      <Link
        key={`link-${keyCounter++}`}
        href={url}
        color="blue.600"
        textDecoration="underline"
        target="_blank"
        rel="noopener noreferrer"
      >
        {url}
      </Link>
    )

    lastIndex = match.index + url.length
  }

  // Add any remaining text after the last URL
  if (lastIndex < text.length) {
    const textAfter = text.substring(lastIndex)
    parts.push(<React.Fragment key={`text-${keyCounter++}`}>{textAfter}</React.Fragment>)
  }

  return parts.length > 0 ? parts : text
}

interface SourceDisplayInfo {
  pluginName: string
  locationLabel: string
  locationUrl?: string
  filename?: string
}

interface InfoModalProps {
  isOpen: boolean
  onClose: () => void
  instructions?: string
  sourceLang?: string
  targetLang?: string
  jobName?: string
  jobGuid?: string
  updatedAt?: string
  sourceInfo?: SourceDisplayInfo
  ter?: number | null
  ept?: number | null
  segmentWordCounts?: {
    totalSegments: number
    totalWords: number
    reviewedSegments: number
    reviewedWords: number
  }
  qualityModelName?: string
  qualityModelVersion?: string
}

const InfoModal: React.FC<InfoModalProps> = ({
  isOpen,
  onClose,
  instructions,
  sourceLang,
  targetLang,
  jobName,
  jobGuid,
  updatedAt,
  sourceInfo,
  ter,
  ept,
  segmentWordCounts,
  qualityModelName,
  qualityModelVersion,
}) => {
  if (!isOpen) return null

  return (
    <Portal>
      {/* Overlay */}
      <Box
        position="fixed"
        top="0"
        left="0"
        right="0"
        bottom="0"
        bg="blackAlpha.600"
        backdropFilter="blur(10px)"
        zIndex="overlay"
        onClick={onClose}
      />
      
      {/* Modal Content */}
      <Box
        position="fixed"
        top="50%"
        left="50%"
        transform="translate(-50%, -50%)"
        zIndex="modal"
        maxW="lg"
        w="90%"
        maxH="80vh"
        bg="white"
        backdropFilter="blur(20px)"
        border="1px solid"
        borderColor="gray.200"
        boxShadow="xl"
        borderRadius="xl"
        overflow="hidden"
        data-testid="info-modal"
      >
        {/* Header */}
        <Box
          p={6}
          borderBottom="1px solid"
          borderColor="gray.100"
          display="flex"
          alignItems="center"
          justifyContent="space-between"
        >
          <Text
            fontSize="xl"
            fontWeight="bold"
            color="gray.700"
          >
            📋 Job Information
          </Text>
          <Button
            variant="ghost"
            size="sm"
            onClick={onClose}
            color="gray.500"
            _hover={{ color: "gray.700" }}
            aria-label="close modal"
          >
            <FiX size={20} />
          </Button>
        </Box>
        
        {/* Body */}
        <Box p={6} overflow="auto" maxH="60vh">
          {/* Language Information */}
          {(sourceLang || targetLang) && (
            <Box mb={4}>
              <Text
                fontSize="lg"
                fontWeight="semibold"
                color="gray.700"
                mb={3}
              >
                🌐 {jobName ? `${jobName} (${sourceLang || 'Not specified'} → ${targetLang || 'Not specified'})` : `${sourceLang || 'Not specified'} → ${targetLang || 'Not specified'}`}
              </Text>
            </Box>
          )}

          {/* Instructions */}
          {instructions && (
            <Box mb={4}>
              <Text
                fontSize="lg"
                fontWeight="semibold"
                color="gray.700"
                mb={3}
              >
                📝 Instructions
              </Text>
              <Text
                color="gray.700"
                lineHeight="tall"
                whiteSpace="pre-wrap"
                fontSize="md"
                mb={4}
              >
                {parseTextWithLinks(instructions)}
              </Text>
            </Box>
          )}

          {/* Segment & Word Counts */}
          {segmentWordCounts && (
            <Box mb={4}>
              <Text fontSize="sm" fontWeight="semibold" color="gray.600" mb={2}>
                Progress
              </Text>
              <Box
                bg="gray.50"
                p={3}
                borderRadius="md"
                border="1px solid"
                borderColor="gray.200"
              >
                <Text fontSize="sm" color="gray.700" mb={1}>
                  Segments: <Text as="span" fontWeight="bold" color="blue.600">{segmentWordCounts.reviewedSegments}</Text> / {segmentWordCounts.totalSegments} reviewed ({segmentWordCounts.totalSegments > 0 ? ((segmentWordCounts.reviewedSegments / segmentWordCounts.totalSegments) * 100).toFixed(0) : 0}%)
                </Text>
                <Text fontSize="sm" color="gray.700" mb={1}>
                  Words: <Text as="span" fontWeight="bold" color="blue.600">{segmentWordCounts.reviewedWords}</Text> / {segmentWordCounts.totalWords} reviewed ({segmentWordCounts.totalWords > 0 ? ((segmentWordCounts.reviewedWords / segmentWordCounts.totalWords) * 100).toFixed(0) : 0}%)
                </Text>
                {((ter !== null && ter !== undefined) || (ept !== null && ept !== undefined)) && (
                  <Text fontSize="sm" color="gray.700">
                    {ter !== null && ter !== undefined && <>TER: <Text as="span" fontWeight="bold" color="blue.600">{(ter * 100).toFixed(0)}%</Text></>}
                    {ter !== null && ter !== undefined && ept !== null && ept !== undefined && ' • '}
                    {ept !== null && ept !== undefined && <>EPT: <Text as="span" fontWeight="bold" color="blue.600">{ept.toFixed(1)}</Text></>}
                  </Text>
                )}
              </Box>
            </Box>
          )}

          {/* Job GUID */}
          {jobGuid && (
            <Box mb={4}>
              <Text fontSize="sm" fontWeight="semibold" color="gray.600" mb={1}>
                Job GUID
              </Text>
              <Text fontSize="sm" color="gray.700" fontFamily="mono">
                {jobGuid}
              </Text>
            </Box>
          )}

          {/* Source Information */}
          {(sourceInfo || qualityModelName) && (
            <Box mb={4}>
              <Text fontSize="sm" fontWeight="semibold" color="gray.600" mb={1}>
                Loaded From
              </Text>
              {sourceInfo && (
                <Box>
                  <Text fontSize="sm" color="gray.700">
                    {sourceInfo.pluginName} (
                    {sourceInfo.locationUrl ? (
                      <Link
                        href={sourceInfo.locationUrl}
                        color="blue.600"
                        textDecoration="underline"
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        {sourceInfo.locationLabel}
                      </Link>
                    ) : (
                      sourceInfo.locationLabel
                    )}
                    )
                  </Text>
                  {sourceInfo.filename && (
                    <Text fontSize="sm" color="gray.700">
                      Filename: <Text as="span" fontFamily="mono">{sourceInfo.filename}</Text>
                    </Text>
                  )}
                </Box>
              )}
              {qualityModelName && (
                <Text fontSize="sm" color="gray.700">
                  Quality Model: {qualityModelName}{qualityModelVersion ? ` v${qualityModelVersion}` : ''}
                </Text>
              )}
            </Box>
          )}

          {/* Updated At */}
          {updatedAt && (
            <Box mb={4}>
              <Text fontSize="sm" fontWeight="semibold" color="gray.600" mb={1}>
                Last Updated
              </Text>
              <Text fontSize="sm" color="gray.700">
                {new Date(updatedAt).toLocaleDateString(undefined, {
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit'
                })}
              </Text>
            </Box>
          )}

        </Box>
      </Box>
    </Portal>
  )
}

export default InfoModal 