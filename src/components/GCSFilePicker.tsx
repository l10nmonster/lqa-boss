import React, { useState, useEffect } from 'react'
import {
  Box,
  Heading,
  Button,
  Text,
  HStack,
  Badge,
  Grid,
  Checkbox,
  Portal,
  IconButton,
  Input,
} from '@chakra-ui/react'
import { FiX, FiEdit2, FiCheck } from 'react-icons/fi'
import { GCSFile } from '../utils/gcsOperations'

interface GCSFilePickerProps {
  files: GCSFile[]
  bucket: string
  prefix: string
  onFileSelect: (filename: string) => void
  onReloadWithLocation?: (bucket: string, prefix: string) => Promise<void>
  onLoadFileList?: () => Promise<void>
  disabled?: boolean
  isOpen: boolean
  onClose: () => void
}

// Helper function to check if a job is done (has corresponding .json file)
const isJobDone = (files: GCSFile[], jobId: string): boolean => {
  return files.some(file => file.name === `${jobId}.json`)
}

// Helper function to extract job ID from .lqaboss filename
const extractJobId = (filename: string): string => {
  return filename.replace('.lqaboss', '')
}

const GCSFilePicker: React.FC<GCSFilePickerProps> = ({
  files,
  bucket,
  prefix,
  onFileSelect,
  onReloadWithLocation,
  onLoadFileList,
  disabled = false,
  isOpen,
  onClose
}) => {
  const [showDoneJobs, setShowDoneJobs] = useState(true)
  const [isEditing, setIsEditing] = useState(false)
  const [editBucket, setEditBucket] = useState(bucket)
  const [editPrefix, setEditPrefix] = useState(prefix)
  const [isLoading, setIsLoading] = useState(false)

  // Update edit values when props change
  useEffect(() => {
    setEditBucket(bucket)
    setEditPrefix(prefix)
  }, [bucket, prefix])

  const handleStartEdit = () => {
    setIsEditing(true)
  }

  const handleCancelEdit = () => {
    setEditBucket(bucket)
    setEditPrefix(prefix)
    setIsEditing(false)
  }

  const handleSaveEdit = async () => {
    if (!onReloadWithLocation) return

    const trimmedBucket = editBucket.trim()
    const trimmedPrefix = editPrefix.trim()

    if (!trimmedBucket || !trimmedPrefix) {
      return
    }

    setIsLoading(true)
    try {
      await onReloadWithLocation(trimmedBucket, trimmedPrefix)
      setIsEditing(false)
    } catch (error) {
      // Error is handled by parent
    } finally {
      setIsLoading(false)
    }
  }

  // Load file list when modal opens and files array is empty
  useEffect(() => {
    if (isOpen && files.length === 0 && onLoadFileList && !disabled) {
      onLoadFileList()
    }
  }, [isOpen, files.length, onLoadFileList, disabled])

  // Filter and sort .lqaboss files by updated date (descending)
  let lqabossFiles = files
    .filter(file => file.name.endsWith('.lqaboss'))
    .sort((a, b) => new Date(b.updated).getTime() - new Date(a.updated).getTime())
  
  // Filter by job status if needed
  if (!showDoneJobs) {
    lqabossFiles = lqabossFiles.filter(file => {
      const jobId = extractJobId(file.name)
      return !isJobDone(files, jobId)
    })
  }

  // Limit to maximum 100 jobs
  lqabossFiles = lqabossFiles.slice(0, 100)

  const handleFileSelect = (filename: string) => {
    onFileSelect(filename)
    onClose()
  }

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
        maxW="4xl"
        w="90%"
        maxH="80vh"
        bg="white"
        backdropFilter="blur(20px)"
        border="1px solid"
        borderColor="gray.200"
        boxShadow="xl"
        borderRadius="xl"
        overflow="hidden"
        data-testid="gcs-file-picker-modal"
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
          <Heading size="lg" color="gray.700">
            Load Job from GCS
          </Heading>
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
        
        {/* Subheader with filter */}
        <Box
          px={6}
          py={4}
          borderBottom="1px solid"
          borderColor="gray.100"
          display="flex"
          alignItems="center"
          justifyContent="space-between"
          bg="gray.50"
        >
          {isEditing ? (
            <HStack gap={2} flex={1}>
              <Input
                size="sm"
                value={editBucket}
                onChange={(e) => setEditBucket(e.target.value)}
                placeholder="bucket-name"
                width="200px"
              />
              <Text fontSize="sm" color="gray.600">/</Text>
              <Input
                size="sm"
                value={editPrefix}
                onChange={(e) => setEditPrefix(e.target.value)}
                placeholder="path/to/folder"
                width="300px"
              />
              <IconButton
                onClick={handleSaveEdit}
                colorScheme="blue"
                size="sm"
                aria-label="Save location"
                title="Save and reload"
                loading={isLoading}
                disabled={!editBucket.trim() || !editPrefix.trim()}
              >
                <FiCheck />
              </IconButton>
              <Button
                onClick={handleCancelEdit}
                variant="ghost"
                size="sm"
                disabled={isLoading}
              >
                Cancel
              </Button>
            </HStack>
          ) : (
            <HStack gap={2}>
              <Text fontSize="sm" color="gray.600">
                {bucket}/{prefix}
              </Text>
              {onReloadWithLocation && (
                <IconButton
                  onClick={handleStartEdit}
                  variant="ghost"
                  size="xs"
                  aria-label="Edit location"
                  title="Edit bucket and prefix"
                >
                  <FiEdit2 />
                </IconButton>
              )}
            </HStack>
          )}
          {!isEditing && (
            <Checkbox.Root
              checked={showDoneJobs}
              onCheckedChange={(details) => setShowDoneJobs(!!details.checked)}
              colorPalette="green"
            >
              <Checkbox.HiddenInput />
              <Checkbox.Control>
                <Checkbox.Indicator />
              </Checkbox.Control>
              <Checkbox.Label>Show DONE jobs</Checkbox.Label>
            </Checkbox.Root>
          )}
        </Box>
        
        {/* Body */}
        <Box p={6} overflow="auto" maxH="60vh">
          {lqabossFiles.length === 0 ? (
            <Text color="gray.600" textAlign="center" py={8}>
              No .lqaboss files found in {bucket}/{prefix}
            </Text>
          ) : (
            <Grid templateColumns="repeat(auto-fit, minmax(300px, 1fr))" gap={4}>
              {lqabossFiles.map((file, index) => {
                const jobId = extractJobId(file.name)
                const isDone = isJobDone(files, jobId)
                
                return (
                  <Button
                    key={index}
                    variant="outline"
                    justifyContent="flex-start"
                    onClick={() => handleFileSelect(file.name)}
                    p={4}
                    height="auto"
                    whiteSpace="normal"
                    width="100%"
                    bg="white"
                    _hover={{ 
                      bg: "rgba(59, 130, 246, 0.1)",
                      borderColor: "blue.400",
                      transform: "translateY(-1px)",
                      boxShadow: "0 4px 12px rgba(0, 0, 0, 0.15)"
                    }}
                    transition="all 0.2s"
                  >
                    <Box textAlign="left" width="100%">
                      <HStack justify="space-between" align="center" mb={2}>
                        <Text fontWeight="bold" fontSize="sm" color="gray.800">
                          Job: {jobId}
                        </Text>
                        <Badge 
                          colorPalette={isDone ? "green" : "orange"}
                          variant={isDone ? "solid" : "subtle"}
                          size="sm"
                        >
                          {isDone ? "DONE" : "WIP"}
                        </Badge>
                      </HStack>
                      <Text fontSize="xs" color="gray.600">
                        {(parseInt(file.size) / 1024).toFixed(1)} KB • {new Date(file.updated).toLocaleDateString()}
                      </Text>
                    </Box>
                  </Button>
                )
              })}
            </Grid>
          )}
        </Box>
      </Box>
    </Portal>
  )
}

export default GCSFilePicker