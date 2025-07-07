import React from 'react'
import {
  Box,
  Flex,
  Heading,
  Button,
  Text,
  VStack,
} from '@chakra-ui/react'
import GlassBox from './GlassBox'
import { GCSFile } from '../utils/gcsOperations'

interface GCSFilePickerProps {
  isOpen: boolean
  files: GCSFile[]
  bucket: string
  prefix: string
  onClose: () => void
  onFileSelect: (filename: string) => void
}

const GCSFilePicker: React.FC<GCSFilePickerProps> = ({
  isOpen,
  files,
  bucket,
  prefix,
  onClose,
  onFileSelect
}) => {
  if (!isOpen) return null

  return (
    <GlassBox p={4}>
      <Flex justify="space-between" align="center" mb={4}>
        <Heading size="sm" color="gray.700">
          Select .lqaboss File from GCS
        </Heading>
        <Button size="sm" onClick={onClose}>
          Close
        </Button>
      </Flex>
      
      {files.length === 0 ? (
        <Text color="gray.600">
          No .lqaboss files found in {bucket}/{prefix}
        </Text>
      ) : (
        <VStack align="stretch" gap={2}>
          {files.map((file, index) => (
            <Button
              key={index}
              variant="outline"
              justifyContent="flex-start"
              onClick={() => onFileSelect(file.name)}
              p={4}
              height="auto"
              whiteSpace="normal"
            >
              <Box textAlign="left">
                <Text fontWeight="bold">{file.name}</Text>
                <Text fontSize="sm" color="gray.500">
                  {(parseInt(file.size) / 1024).toFixed(1)} KB • {new Date(file.updated).toLocaleDateString()}
                </Text>
              </Box>
            </Button>
          ))}
        </VStack>
      )}
    </GlassBox>
  )
}

export default GCSFilePicker