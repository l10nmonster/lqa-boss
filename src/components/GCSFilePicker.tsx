import React, { useState, useEffect } from 'react'
import {
  Box,
  Flex,
  Heading,
  Button,
  Text,
  HStack,
  Badge,
  Grid,
  Checkbox,
  Popover,
  Portal,
} from '@chakra-ui/react'
import { FiUpload } from 'react-icons/fi'
import { GCSFile } from '../utils/gcsOperations'

interface GCSFilePickerProps {
  files: GCSFile[]
  bucket: string
  prefix: string
  onFileSelect: (filename: string) => void
  onLoadFileList?: () => Promise<void>
  disabled?: boolean
  triggerButton?: React.ReactNode
  autoOpen?: boolean
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
  onLoadFileList,
  disabled = false,
  triggerButton,
  autoOpen = false
}) => {
  const [showDoneJobs, setShowDoneJobs] = useState(true)
  const [isOpen, setIsOpen] = useState(false)

  // Auto-open when autoOpen prop is true
  useEffect(() => {
    if (autoOpen && !disabled) {
      setIsOpen(true)
    }
  }, [autoOpen, disabled])

  // Load file list when popover opens and files array is empty
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
  
  // Limit to maximum 10 jobs
  lqabossFiles = lqabossFiles.slice(0, 10)

  const handleFileSelect = (filename: string) => {
    onFileSelect(filename)
    setIsOpen(false)
  }

  const defaultTrigger = (
    <Button
      variant="outline"
      colorScheme="blue"
      size="md"
      disabled={disabled}
    >
      <FiUpload /> Load from GCS
    </Button>
  )

  return (
    <Popover.Root 
      open={isOpen} 
      onOpenChange={(details) => setIsOpen(details.open)}
      positioning={{ 
        placement: "bottom-end", 
        gutter: 8
      }}
    >
      <Popover.Trigger asChild>
        {triggerButton || defaultTrigger}
      </Popover.Trigger>
      <Portal>
        <Popover.Positioner>
          <Popover.Content 
            width="800px" 
            maxWidth="90vw"
            maxHeight="500px" 
            overflow="auto"
            bg="rgba(255, 255, 255, 0.95)"
            backdropFilter="blur(20px)"
            border="1px solid"
            borderColor="rgba(255, 255, 255, 0.2)"
            borderRadius="xl"
            boxShadow="0 25px 50px -12px rgba(0, 0, 0, 0.25)"
            p={6}
          >
          <Flex justify="space-between" align="center" mb={6}>
            <Heading size="sm" color="gray.700">
              Select .lqaboss File from GCS
            </Heading>
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
          </Flex>
          
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
                    bg="rgba(255, 255, 255, 0.8)"
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
          </Popover.Content>
        </Popover.Positioner>
      </Portal>
    </Popover.Root>
  )
}

export default GCSFilePicker