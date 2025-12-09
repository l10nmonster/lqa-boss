import React from 'react'
import { Box, Stack } from '@chakra-ui/react'
import { Toaster } from '../ui/toaster'

interface EditorLayoutProps {
  header: React.ReactNode
  children: React.ReactNode
}

export const EditorLayout: React.FC<EditorLayoutProps> = ({ header, children }) => {
  const bgGradient = 'linear-gradient(135deg, #f0f9ff 0%, #e0f2fe 25%, #bae6fd 50%, #e0f2fe 75%, #f0f9ff 100%)'
  
  return (
    <Box minH="100vh" background={bgGradient} p={4} data-testid="app-container" overflow="hidden">
      <Stack direction="column" gap={4} align="stretch" h="calc(100vh - 2rem)" maxW="100vw" overflow="hidden">
        {header}
        <Box flex="1" overflow="hidden" minWidth={0} maxW="100%">
          {children}
        </Box>
      </Stack>
      <Toaster />
    </Box>
  )
} 