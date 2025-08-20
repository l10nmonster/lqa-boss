import React from 'react'
import {
  Box,
  Text,
  Button,
  Portal,
} from '@chakra-ui/react'
import { FiX } from 'react-icons/fi'

interface InstructionsModalProps {
  isOpen: boolean
  onClose: () => void
  instructions?: string
  sourceLang?: string
  targetLang?: string
}

const InstructionsModal: React.FC<InstructionsModalProps> = ({
  isOpen,
  onClose,
  instructions,
  sourceLang,
  targetLang,
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