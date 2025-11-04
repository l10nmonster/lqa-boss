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

interface InstructionsModalProps {
  isOpen: boolean
  onClose: () => void
  instructions?: string
  sourceLang?: string
  targetLang?: string
  jobGuid?: string
  updatedAt?: string
  sourceInfo?: {
    pluginName: string
    location?: string
  }
  ter?: number | null
  ept?: number | null
}

const InstructionsModal: React.FC<InstructionsModalProps> = ({
  isOpen,
  onClose,
  instructions,
  sourceLang,
  targetLang,
  jobGuid,
  updatedAt,
  sourceInfo,
  ter,
  ept,
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
        data-testid="instructions-modal"
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
                🌐 {sourceLang || 'Not specified'} → {targetLang || 'Not specified'}
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
          {sourceInfo && (
            <Box mb={4}>
              <Text fontSize="sm" fontWeight="semibold" color="gray.600" mb={1}>
                Loaded From
              </Text>
              <Text fontSize="sm" color="gray.700">
                {sourceInfo.pluginName}
                {sourceInfo.location && ` (${sourceInfo.location})`}
              </Text>
            </Box>
          )}

          {/* Updated At */}
          {updatedAt && (
            <Box mb={4}>
              <Text fontSize="sm" fontWeight="semibold" color="gray.600" mb={1}>
                Last Updated
              </Text>
              <Text fontSize="sm" color="gray.700">
                {new Date(updatedAt).toLocaleString()}
              </Text>
            </Box>
          )}

          {/* Quality Metrics */}
          {(ter !== null && ter !== undefined) || (ept !== null && ept !== undefined) ? (
            <Box mb={4}>
              <Text fontSize="sm" fontWeight="semibold" color="gray.600" mb={2}>
                Quality Metrics
              </Text>
              <Box
                bg="gray.50"
                p={3}
                borderRadius="md"
                border="1px solid"
                borderColor="gray.200"
              >
                {ter !== null && ter !== undefined && (
                  <Text fontSize="sm" color="gray.700" mb={1}>
                    TER: {(ter * 100).toFixed(0)}%
                  </Text>
                )}
                {ept !== null && ept !== undefined && (
                  <Text fontSize="sm" color="gray.700">
                    EPT: {ept.toFixed(1)}
                  </Text>
                )}
              </Box>
            </Box>
          ) : null}
        </Box>
      </Box>
    </Portal>
  )
}

export default InstructionsModal 