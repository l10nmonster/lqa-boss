import React, { useState } from 'react'
import {
  Box,
  Flex,
  Heading,
  Button,
  Text,
  HStack,
  Badge,
  Grid,
  Stack,
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

// Helper function to check if a job is done (has corresponding .json file)
const isJobDone = (files: GCSFile[], jobId: string): boolean => {
  return files.some(file => file.name === `${jobId}.json`)
}

// Helper function to extract job ID from .lqaboss filename
const extractJobId = (filename: string): string => {
  return filename.replace('.lqaboss', '')
}

const GCSFilePicker: React.FC<GCSFilePickerProps> = ({
  isOpen,
  files,
  bucket,
  prefix,
  onClose,
  onFileSelect
}) => {
  const [showDoneJobs, setShowDoneJobs] = useState(true)
  
  if (!isOpen) return null

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

  return (
    <GlassBox p={4}>
      <Flex justify="space-between" align="center" mb={4}>
        <Heading size="sm" color="gray.700">
          Select .lqaboss File from GCS
        </Heading>
        <Stack direction="row" gap={3}>
          <Button
            size="sm"
            onClick={() => setShowDoneJobs(!showDoneJobs)}
            colorScheme={showDoneJobs ? "green" : "gray"}
            variant={showDoneJobs ? "solid" : "outline"}
          >
            {showDoneJobs ? "✓" : ""} DONE
          </Button>
          <Button size="sm" onClick={onClose}>
            Close
          </Button>
        </Stack>
      </Flex>
      
      {lqabossFiles.length === 0 ? (
        <Text color="gray.600">
          No .lqaboss files found in {bucket}/{prefix}
        </Text>
      ) : (
        <Grid templateColumns="repeat(auto-fit, minmax(280px, 1fr))" gap={3}>
          {lqabossFiles.map((file, index) => {
            const jobId = extractJobId(file.name)
            const isDone = isJobDone(files, jobId)
            
            return (
              <Button
                key={index}
                variant="outline"
                justifyContent="flex-start"
                onClick={() => onFileSelect(file.name)}
                p={3}
                height="auto"
                whiteSpace="normal"
                width="100%"
              >
                <Box textAlign="left" width="100%">
                  <HStack justify="space-between" align="center" mb={1}>
                    <Text fontWeight="bold" fontSize="sm">
                      Job: {jobId}
                    </Text>
                    <Badge 
                      colorScheme={isDone ? "green" : "orange"}
                      variant={isDone ? "solid" : "subtle"}
                      size="sm"
                    >
                      {isDone ? "DONE" : "WIP"}
                    </Badge>
                  </HStack>
                  <Text fontSize="xs" color="gray.500">
                    {(parseInt(file.size) / 1024).toFixed(1)} KB • {new Date(file.updated).toLocaleDateString()}
                  </Text>
                </Box>
              </Button>
            )
          })}
        </Grid>
      )}
    </GlassBox>
  )
}

export default GCSFilePicker