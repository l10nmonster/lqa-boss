import React from 'react'
import { Stack, Heading, Text, Button } from '@chakra-ui/react'
import { FiKey } from 'react-icons/fi'
import GlassBox from '../GlassBox'

interface AuthPromptProps {
  pluginName: string
  locationDescription?: string
  onAccept: () => void
}

export const AuthPrompt: React.FC<AuthPromptProps> = ({
  pluginName,
  locationDescription,
  onAccept
}) => {
  return (
    <GlassBox p={6} height="100%" display="flex" alignItems="center" justifyContent="center">
      <Stack gap={6} textAlign="center" maxW="md">
        <Heading size="lg" color="gray.700">
          {pluginName} Access Required
        </Heading>
        <Text color="gray.600" fontSize="lg">
          {locationDescription ? (
            <>
              To access <strong>{locationDescription}</strong>, you need to sign in to {pluginName}.
            </>
          ) : (
            <>
              To browse files, you need to sign in to {pluginName}.
            </>
          )}
        </Text>
        <Button
          variant="solid"
          colorScheme="blue"
          size="lg"
          onClick={onAccept}
        >
          <FiKey /> Sign In
        </Button>
      </Stack>
    </GlassBox>
  )
} 