import React from 'react'
import { Flex, Button, Stack, HStack, VStack, Image, Text } from '@chakra-ui/react'
import { FiSave, FiInfo, FiKey, FiLogOut } from 'react-icons/fi'
import GlassBox from '../GlassBox'
import GCSFilePicker from '../GCSFilePicker'
import { GCSFile } from '../../utils/gcsOperations'

interface GCSEditorHeaderProps {
  bucket: string
  prefix: string
  filename?: string
  isAuthenticated: boolean
  onSave: () => void
  onSignIn: () => void
  onSignOut: () => void
  hasInstructions: boolean
  onShowInstructions: () => void
  hasData: boolean
  files: GCSFile[]
  onFileSelect: (filename: string) => void
  onLoadFileList?: () => Promise<void>
}

export const GCSEditorHeader: React.FC<GCSEditorHeaderProps> = ({
  bucket,
  prefix,
  filename,
  isAuthenticated,
  onSave,
  onSignIn,
  onSignOut,
  hasInstructions,
  onShowInstructions,
  hasData,
  files,
  onFileSelect,
  onLoadFileList,
}) => {
  // Auto-open popover when there's no filename (user is browsing files)
  const shouldAutoOpen = !filename && isAuthenticated && files.length > 0

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
            GCS: {bucket}/{prefix}{filename ? `/${filename}` : ''}
          </Text>
        </VStack>
      </HStack>
      <Stack direction="row" gap={4}>
        <GCSFilePicker
          files={files}
          bucket={bucket}
          prefix={prefix}
          onFileSelect={onFileSelect}
          onLoadFileList={onLoadFileList}
          disabled={!isAuthenticated}
          autoOpen={shouldAutoOpen}
        />
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
          disabled={!hasData || !isAuthenticated}
          size="md"
        >
          <FiSave /> Save to GCS
        </Button>
        {!isAuthenticated ? (
          <Button
            variant="solid"
            colorScheme="green"
            onClick={onSignIn}
            size="md"
          >
            <FiKey /> Sign In to GCS
          </Button>
        ) : (
          <Button
            variant="outline"
            colorScheme="gray"
            onClick={onSignOut}
            size="md"
          >
            <FiLogOut /> Sign Out
          </Button>
        )}
      </Stack>
    </Flex>
  )
} 