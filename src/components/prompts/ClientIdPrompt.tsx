import React, { useState } from 'react'
import { Stack, Heading, Text, Input, Button } from '@chakra-ui/react'
import GlassBox from '../GlassBox'

interface ClientIdPromptProps {
  pluginName: string
  onSubmit: (clientId: string) => void
  onCancel: () => void
}

export const ClientIdPrompt: React.FC<ClientIdPromptProps> = ({ pluginName, onSubmit, onCancel }) => {
  const [clientIdInput, setClientIdInput] = useState('')

  const handleSubmit = () => {
    if (clientIdInput.trim()) {
      onSubmit(clientIdInput.trim())
    }
  }

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSubmit()
    }
  }

  return (
    <GlassBox p={6} height="100%" display="flex" alignItems="center" justifyContent="center">
      <Stack gap={6} textAlign="center" maxW="md">
        <Heading size="lg" color="gray.700">
          Google OAuth2 Client ID Required
        </Heading>
        <Text color="gray.600" fontSize="lg">
          To access {pluginName}, please enter your Google OAuth2 Client ID.
        </Text>
        <Input
          placeholder="Enter your Google OAuth2 Client ID"
          value={clientIdInput}
          onChange={(e) => setClientIdInput(e.target.value)}
          onKeyPress={handleKeyPress}
          size="lg"
        />
        <Stack direction="row" gap={4} justify="center">
          <Button
            variant="solid"
            colorScheme="blue"
            size="lg"
            onClick={handleSubmit}
            disabled={!clientIdInput.trim()}
          >
            Continue
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