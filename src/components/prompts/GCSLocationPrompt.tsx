import React, { useState, useEffect, useRef } from 'react'
import { Box, Button, Stack, Text, VStack, Portal } from '@chakra-ui/react'
import { FiX } from 'react-icons/fi'

interface GCSLocationPromptProps {
  currentBucket?: string
  currentPrefix?: string
  currentFilename?: string
  operation: 'load' | 'save'
  onSubmit: (bucket: string, prefix: string, filename?: string) => void
  onCancel: () => void
}

export const GCSLocationPrompt: React.FC<GCSLocationPromptProps> = ({
  currentBucket = '',
  currentPrefix = '',
  currentFilename = '',
  operation,
  onSubmit,
  onCancel,
}) => {
  const [bucket, setBucket] = useState(currentBucket)
  const [prefix, setPrefix] = useState(currentPrefix)
  const [filename, setFilename] = useState(currentFilename)
  const firstInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    // Focus first input when modal opens
    setTimeout(() => {
      firstInputRef.current?.focus()
    }, 100)

    // Prevent body scroll when modal is open
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = ''
    }
  }, [])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()

    if (!bucket.trim() || !prefix.trim()) {
      return
    }

    if (operation === 'save' && !filename.trim()) {
      return
    }

    onSubmit(bucket.trim(), prefix.trim(), filename.trim() || undefined)
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      e.preventDefault()
      e.stopPropagation()
      onCancel()
    }
  }

  const isValid = bucket.trim() && prefix.trim() && (operation === 'load' || filename.trim())

  // Custom input style that matches Chakra UI
  const inputStyle: React.CSSProperties = {
    width: '100%',
    height: '40px',
    padding: '0 16px',
    fontSize: '16px',
    borderRadius: '6px',
    border: '1px solid #E2E8F0',
    background: 'white',
    outline: 'none',
    transition: 'all 0.2s',
  }

  const inputFocusStyle = {
    borderColor: '#3182CE',
    boxShadow: '0 0 0 1px #3182CE',
  }

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
        onClick={onCancel}
      />

      {/* Modal Content */}
      <Box
        position="fixed"
        top="50%"
        left="50%"
        transform="translate(-50%, -50%)"
        zIndex="modal"
        maxW="500px"
        w="90%"
        bg="white"
        backdropFilter="blur(20px)"
        border="1px solid"
        borderColor="gray.200"
        boxShadow="xl"
        borderRadius="xl"
        overflow="hidden"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={handleKeyDown}
      >
        <form onSubmit={handleSubmit}>
          <VStack gap={0} align="stretch">
            {/* Header */}
            <Box
              p={6}
              borderBottom="1px solid"
              borderColor="gray.100"
              display="flex"
              alignItems="center"
              justifyContent="space-between"
            >
              <Text fontSize="xl" fontWeight="bold" color="gray.700">
                {operation === 'save' ? 'Save to GCS' : 'Load from GCS'}
              </Text>
              <Button
                variant="ghost"
                size="sm"
                onClick={onCancel}
                color="gray.500"
                _hover={{ color: "gray.700" }}
                aria-label="close modal"
                type="button"
              >
                <FiX size={20} />
              </Button>
            </Box>

            {/* Body */}
            <Box p={6}>
              <Text fontSize="sm" color="gray.600" mb={6}>
                {operation === 'save'
                  ? 'Enter the GCS location where you want to save this file.'
                  : 'Enter the GCS bucket and prefix to browse files.'}
              </Text>

              <Stack gap={4}>
                <Box>
                  <Text fontSize="sm" fontWeight="medium" color="gray.700" mb={2}>
                    Bucket <Text as="span" color="red.500">*</Text>
                  </Text>
                  <input
                    ref={firstInputRef}
                    type="text"
                    value={bucket}
                    onChange={(e) => setBucket(e.target.value)}
                    placeholder="my-bucket"
                    style={inputStyle}
                    onFocus={(e) => {
                      Object.assign(e.target.style, inputFocusStyle)
                    }}
                    onBlur={(e) => {
                      e.target.style.borderColor = '#E2E8F0'
                      e.target.style.boxShadow = 'none'
                    }}
                    autoComplete="off"
                    autoCorrect="off"
                    autoCapitalize="off"
                    spellCheck={false}
                    data-lpignore="true"
                    data-1p-ignore="true"
                    role="textbox"
                    aria-label="Bucket"
                  />
                </Box>

                <Box>
                  <Text fontSize="sm" fontWeight="medium" color="gray.700" mb={2}>
                    Prefix <Text as="span" color="red.500">*</Text>
                  </Text>
                  <input
                    type="text"
                    value={prefix}
                    onChange={(e) => setPrefix(e.target.value)}
                    placeholder="path/to/folder"
                    style={inputStyle}
                    onFocus={(e) => {
                      Object.assign(e.target.style, inputFocusStyle)
                    }}
                    onBlur={(e) => {
                      e.target.style.borderColor = '#E2E8F0'
                      e.target.style.boxShadow = 'none'
                    }}
                    autoComplete="off"
                    autoCorrect="off"
                    autoCapitalize="off"
                    spellCheck={false}
                    data-lpignore="true"
                    data-1p-ignore="true"
                    role="textbox"
                    aria-label="Prefix"
                  />
                </Box>

                {operation === 'save' && (
                  <Box>
                    <Text fontSize="sm" fontWeight="medium" color="gray.700" mb={2}>
                      Filename <Text as="span" color="red.500">*</Text>
                    </Text>
                    <input
                      type="text"
                      value={filename}
                      onChange={(e) => setFilename(e.target.value)}
                      placeholder="translation.json"
                      style={inputStyle}
                      onFocus={(e) => {
                        Object.assign(e.target.style, inputFocusStyle)
                      }}
                      onBlur={(e) => {
                        e.target.style.borderColor = '#E2E8F0'
                        e.target.style.boxShadow = 'none'
                      }}
                      autoComplete="off"
                      autoCorrect="off"
                      autoCapitalize="off"
                      spellCheck={false}
                      data-lpignore="true"
                      data-1p-ignore="true"
                      role="textbox"
                      aria-label="Filename"
                    />
                  </Box>
                )}
              </Stack>
            </Box>

            {/* Footer */}
            <Box
              p={6}
              borderTop="1px solid"
              borderColor="gray.100"
              bg="gray.50"
            >
              <Stack direction="row" gap={3} justify="flex-end">
                <Button
                  variant="ghost"
                  onClick={onCancel}
                  type="button"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  variant="solid"
                  colorScheme="blue"
                  disabled={!isValid}
                >
                  {operation === 'save' ? 'Save' : 'Browse Files'}
                </Button>
              </Stack>
            </Box>
          </VStack>
        </form>
      </Box>
    </Portal>
  )
}