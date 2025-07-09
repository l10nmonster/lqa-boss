import React from 'react'
import { Stack, Heading, Text, Button } from '@chakra-ui/react'
import { FiKey } from 'react-icons/fi'
import GlassBox from '../GlassBox'

interface AuthPromptProps {
  bucket: string
  prefix: string
  filename?: string
  onAccept: () => void
  onCancel: () => void
}

export const AuthPrompt: React.FC<AuthPromptProps> = ({ 
  bucket, 
  prefix, 
  filename, 
  onAccept, 
  onCancel 
}) => {
  return (
    <GlassBox p={6} height="100%" display="flex" alignItems="center" justifyContent="center">
      <Stack gap={6} textAlign="center" maxW="md">
        <Heading size="lg" color="gray.700">
          Google Cloud Storage Access Required
        </Heading>
        <Text color="gray.600" fontSize="lg">
          {filename ? (
            <>
              To access the file <strong>{filename}</strong> in{' '}
              <strong>{bucket}/{prefix}</strong>, you need to sign in to Google Cloud Storage.
            </>
          ) : (
            <>
              To browse files in <strong>{bucket}/{prefix}</strong>, you need to sign in to Google Cloud Storage.
            </>
          )}
        </Text>
        <Stack direction="row" gap={4} justify="center">
          <Button
            variant="solid"
            colorScheme="blue"
            size="lg"
            onClick={onAccept}
          >
            <FiKey /> Sign In to GCS
          </Button>
          <Button
            variant="outline"
            colorScheme="gray"
            size="lg"
            onClick={onCancel}
          >
            Cancel
          </Button>
        </Stack>
      </Stack>
    </GlassBox>
  )
} 