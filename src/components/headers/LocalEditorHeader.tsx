import React from 'react'
import { Flex, Button, Stack, HStack, VStack, Image, Text } from '@chakra-ui/react'
import { FiUpload, FiSave, FiInfo } from 'react-icons/fi'
import GlassBox from '../GlassBox'

interface LocalEditorHeaderProps {
  onFileLoad: () => void
  onSave: () => void
  hasInstructions: boolean
  onShowInstructions: () => void
  fileName: string
  hasData: boolean
  flowName?: string
}

export const LocalEditorHeader: React.FC<LocalEditorHeaderProps> = ({
  onFileLoad,
  onSave,
  hasInstructions,
  onShowInstructions,
  fileName: _fileName,
  hasData,
  flowName,
}) => {
  return (
    <Flex
      as={GlassBox}
      p={6}
      align="center"
      justify="space-between"
    >
      <HStack gap={3} align="center">
        <Image 
          src={`${import.meta.env.BASE_URL}icons/icon-512x512.png`}
          alt="LQA Boss Logo" 
          height="64px" 
          width="64px"
          borderRadius="full"
        />
        <VStack align="start" gap={0}>
          <Text fontSize="lg" fontWeight="bold" color="gray.700">
            LQA Boss
          </Text>
          <Text fontSize="sm" color="gray.500">
            {flowName || (hasData ? '(out of context)' : '(no flow loaded)')}
          </Text>
        </VStack>
      </HStack>
      <Stack direction="row" gap={4}>
        <Button
          variant="outline"
          colorScheme="blue"
          onClick={onFileLoad}
          size="md"
        >
          <FiUpload /> Load .lqaboss File
        </Button>
        {hasInstructions && (
          <Button
            variant="outline"
            colorScheme="blue"
            onClick={onShowInstructions}
            size="md"
            px={3}
            data-testid="instructions-button"
          >
            <FiInfo />
          </Button>
        )}
        <Button
          variant="solid"
          colorScheme="blue"
          onClick={onSave}
          disabled={!hasData}
          size="md"
        >
          <FiSave /> Save Changes
        </Button>
      </Stack>
    </Flex>
  )
} 