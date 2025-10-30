import React from 'react'
import {
  Box,
  Text,
  Button,
  Portal,
  Separator,
} from '@chakra-ui/react'
import { FiX } from 'react-icons/fi'
import { EPTStatistics } from '../utils/metrics'

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
  eptStats?: EPTStatistics | null
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
  eptStats,
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

          {/* EPT Statistics */}
          {eptStats && (
            <>
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
                  <Text fontSize="sm" color="gray.700" mb={1}>
                    Input: {eptStats.totalSegments} segments, {eptStats.totalWords} words
                  </Text>
                  <Text fontSize="sm" color="gray.700" mb={1}>
                    Corrected: {eptStats.changedSegments} segments, {eptStats.changedWords} words
                  </Text>
                  <Separator my={2} />
                  <Text fontSize="sm" fontWeight="bold" color="gray.800">
                    EPT: {eptStats.ept.toFixed(1)}
                  </Text>
                </Box>
              </Box>
            </>
          )}

          {/* Language Information */}
          {(sourceLang || targetLang) && (
            <Box mb={instructions ? 6 : 0}>
              <Text
                fontSize="lg"
                fontWeight="semibold"
                color="gray.700"
                mb={3}
              >
                🌐 Language Pair: {sourceLang || 'Not specified'} → {targetLang || 'Not specified'}
              </Text>
            </Box>
          )}

          {/* Instructions */}
          {instructions && (
            <>
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
              >
                {instructions}
              </Text>
            </>
          )}
        </Box>
      </Box>
    </Portal>
  )
}

export default InstructionsModal 