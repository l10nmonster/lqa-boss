import React, { useState, useEffect } from 'react'
import { Flex, Button, Stack, HStack, VStack, Image, Text, Menu, IconButton, Portal } from '@chakra-ui/react'
import { FiInfo, FiLogOut, FiArchive, FiUploadCloud, FiDownloadCloud } from 'react-icons/fi'
import GlassBox from '../GlassBox'
import GCSFilePicker from '../GCSFilePicker'
import { GCSFile } from '../../utils/gcsOperations'
import { StatusBadge, FileStatus } from '../StatusBadge'

interface GCSEditorHeaderProps {
  bucket: string
  prefix: string
  filename?: string
  isAuthenticated: boolean
  onSave: () => void
  onSignOut: () => void
  hasInstructions: boolean
  onShowInstructions: () => void
  hasData: boolean
  files: GCSFile[]
  onFileSelect: (filename: string) => void
  onLoadFileList?: () => Promise<void>
  fileStatus: FileStatus
  hasLanguageInfo?: boolean
}

export const GCSEditorHeader: React.FC<GCSEditorHeaderProps> = ({
  bucket,
  prefix,
  filename,
  isAuthenticated,
  onSave,
  onSignOut,
  hasInstructions,
  onShowInstructions,
  hasData,
  files,
  onFileSelect,
  onLoadFileList,
  fileStatus,
  hasLanguageInfo = false,
}) => {
  // Auto-open popover when there's no filename (user is browsing files)
  const shouldAutoOpen = !filename && isAuthenticated && files.length > 0
  const [showFilePicker, setShowFilePicker] = useState(shouldAutoOpen)

  // Update file picker state when authentication or files change
  useEffect(() => {
    const newShouldAutoOpen = !filename && isAuthenticated && files.length > 0
    if (newShouldAutoOpen && !showFilePicker) {
      setShowFilePicker(true)
    }
  }, [isAuthenticated, files.length, filename, showFilePicker])

  const handleLoadFromGCS = () => {
    setShowFilePicker(true)
  }

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
          <HStack gap={2} align="center">
            <Text fontSize="lg" fontWeight="bold" color="gray.700">
              LQA Boss
            </Text>
            <StatusBadge status={fileStatus} />
          </HStack>
          <Text fontSize="sm" color="gray.500">
            GCS: {bucket}/{prefix}{filename ? `/${filename}` : ''}
          </Text>
        </VStack>
      </HStack>
      <Stack direction="row" gap={4}>
        {(hasInstructions || hasLanguageInfo) && (
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
        <Menu.Root>
          <Menu.Trigger asChild>
            <IconButton
              variant="outline"
              colorScheme="blue"
              size="md"
              aria-label="GCS Operations"
            >
              <FiArchive />
            </IconButton>
          </Menu.Trigger>
          <Portal>
            <Menu.Positioner>
              <Menu.Content>
                <Menu.Item
                  value="load"
                  disabled={!isAuthenticated}
                  cursor={!isAuthenticated ? 'not-allowed' : 'pointer'}
                  onClick={handleLoadFromGCS}
                >
                  <FiDownloadCloud style={{ marginRight: '8px' }} />
                  Load Job
                </Menu.Item>
                <Menu.Item
                  value="save"
                  disabled={!hasData || !isAuthenticated}
                  cursor={(!hasData || !isAuthenticated) ? 'not-allowed' : 'pointer'}
                  onClick={onSave}
                >
                  <FiUploadCloud style={{ marginRight: '8px' }} />
                  Save Job
                </Menu.Item>
                <Menu.Separator />
                <Menu.Item
                  value="signout"
                  disabled={!isAuthenticated}
                  cursor={!isAuthenticated ? 'not-allowed' : 'pointer'}
                  onClick={onSignOut}
                >
                  <FiLogOut style={{ marginRight: '8px' }} />
                  Sign Out
                </Menu.Item>
              </Menu.Content>
            </Menu.Positioner>
          </Portal>
        </Menu.Root>
      </Stack>
      
      {/* GCS File Picker Modal */}
      <GCSFilePicker
        files={files}
        bucket={bucket}
        prefix={prefix}
        onFileSelect={(filename) => {
          onFileSelect(filename)
          setShowFilePicker(false)
        }}
        onLoadFileList={onLoadFileList}
        disabled={!isAuthenticated}
        isOpen={showFilePicker}
        onClose={() => setShowFilePicker(false)}
      />
    </Flex>
  )
} 