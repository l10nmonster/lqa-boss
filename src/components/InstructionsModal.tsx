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
  instructions: string
}

const InstructionsModal: React.FC<InstructionsModalProps> = ({
  isOpen,
  onClose,
  instructions,
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
            📋 Instructions
          </Text>
          <Button
            variant="ghost"
            size="sm"
            onClick={onClose}
            color="gray.500"
            _hover={{ color: "gray.700" }}
          >
            <FiX size={20} />
          </Button>
        </Box>
        
        {/* Body */}
        <Box p={6} overflow="auto" maxH="60vh">
          <Text
            color="gray.700"
            lineHeight="tall"
            whiteSpace="pre-wrap"
            fontSize="md"
          >
            {instructions}
          </Text>
        </Box>
      </Box>
    </Portal>
  )
}

export default InstructionsModal 