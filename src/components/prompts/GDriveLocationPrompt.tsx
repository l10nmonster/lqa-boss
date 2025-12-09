import React, { useState, useEffect, useCallback } from 'react'
import { Box, Button, Stack, Text, VStack, Portal, Spinner, HStack } from '@chakra-ui/react'
import { FiX, FiFolder, FiChevronRight, FiHome } from 'react-icons/fi'
import { GDriveOperations, GDriveFolder, GDriveFile } from '../../utils/gdriveOperations'

interface GDriveLocationPromptProps {
  accessToken: string
  currentFolderId?: string
  currentFilename?: string
  operation: 'load' | 'save'
  onSubmit: (folderId: string, folderName: string, filename?: string) => void
  onCancel: () => void
}

export const GDriveLocationPrompt: React.FC<GDriveLocationPromptProps> = ({
  accessToken,
  currentFolderId,
  currentFilename = '',
  operation,
  onSubmit,
  onCancel,
}) => {
  const [folderId, setFolderId] = useState(currentFolderId || 'root')
  const [folderPath, setFolderPath] = useState<GDriveFolder[]>([])
  const [folders, setFolders] = useState<GDriveFolder[]>([])
  const [files, setFiles] = useState<GDriveFile[]>([])
  const [filename, setFilename] = useState(currentFilename)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [folderIdInput, setFolderIdInput] = useState('')

  const gdriveOps = React.useMemo(() => new GDriveOperations(), [])

  const loadFolderContents = useCallback(async (id: string) => {
    setLoading(true)
    setError(null)
    try {
      // First verify we have access to this folder
      await gdriveOps.verifyFolderAccess(id, accessToken)

      const [foldersList, filesList, path] = await Promise.all([
        gdriveOps.listFolders(id, accessToken),
        gdriveOps.listFiles(id, accessToken),
        gdriveOps.getFolderPath(id, accessToken)
      ])

      setFolders(foldersList)
      // Filter to only show .lqaboss and .json files for loading
      const relevantFiles = filesList.filter(f =>
        f.name.endsWith('.lqaboss') || f.name.endsWith('.json')
      )
      setFiles(relevantFiles)
      setFolderPath(path)
    } catch (err: any) {
      setError(err.message || 'Failed to load folder contents')
    } finally {
      setLoading(false)
    }
  }, [gdriveOps, accessToken])

  useEffect(() => {
    loadFolderContents(folderId)
  }, [folderId, loadFolderContents])

  useEffect(() => {
    // Prevent body scroll when modal is open
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = ''
    }
  }, [])

  const handleFolderClick = (folder: GDriveFolder) => {
    setFolderId(folder.id)
  }

  const handleFileClick = (file: GDriveFile) => {
    if (operation === 'load') {
      // For load, select the file directly
      const currentFolder = folderPath[folderPath.length - 1]
      onSubmit(folderId, currentFolder?.name || 'My Drive', file.name)
    } else {
      // For save, just populate the filename
      setFilename(file.name)
    }
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()

    if (operation === 'save' && !filename.trim()) {
      return
    }

    const currentFolder = folderPath[folderPath.length - 1]
    onSubmit(folderId, currentFolder?.name || 'My Drive', operation === 'save' ? filename.trim() : undefined)
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      e.preventDefault()
      e.stopPropagation()
      onCancel()
    }
  }

  const navigateToPathFolder = (folder: GDriveFolder) => {
    setFolderId(folder.id)
  }

  const handleFolderIdSubmit = () => {
    const trimmedId = folderIdInput.trim()
    if (trimmedId) {
      // Extract folder ID from a Google Drive URL if pasted
      let extractedId = trimmedId
      // Handle URLs like https://drive.google.com/drive/folders/FOLDER_ID
      const folderMatch = trimmedId.match(/\/folders\/([a-zA-Z0-9_-]+)/)
      if (folderMatch) {
        extractedId = folderMatch[1]
      }
      // Handle URLs like https://drive.google.com/drive/u/0/folders/FOLDER_ID
      const folderMatch2 = trimmedId.match(/folders\/([a-zA-Z0-9_-]+)/)
      if (folderMatch2) {
        extractedId = folderMatch2[1]
      }
      setFolderId(extractedId)
      setFolderIdInput('')
    }
  }

  const isValid = operation === 'load' || filename.trim()

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
        maxW="600px"
        w="90%"
        maxH="80vh"
        bg="white"
        backdropFilter="blur(20px)"
        border="1px solid"
        borderColor="gray.200"
        boxShadow="xl"
        borderRadius="xl"
        overflow="hidden"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={handleKeyDown}
        display="flex"
        flexDirection="column"
      >
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0 }}>
          <VStack gap={0} align="stretch" flex="1" overflow="hidden" minH={0}>
            {/* Header */}
            <Box
              p={6}
              borderBottom="1px solid"
              borderColor="gray.100"
              display="flex"
              alignItems="center"
              justifyContent="space-between"
              flexShrink={0}
            >
              <Text fontSize="xl" fontWeight="bold" color="gray.700">
                {operation === 'save' ? 'Save to Google Drive' : 'Open from Google Drive'}
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

            {/* Breadcrumb */}
            <Box px={6} py={3} borderBottom="1px solid" borderColor="gray.100" flexShrink={0}>
              <HStack gap={1} flexWrap="wrap">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setFolderId('root')}
                  color="gray.600"
                  _hover={{ color: "blue.500" }}
                  p={1}
                  minW="auto"
                >
                  <FiHome size={16} />
                </Button>
                {folderPath.map((folder, index) => (
                  <React.Fragment key={folder.id}>
                    <FiChevronRight size={14} color="#A0AEC0" />
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => navigateToPathFolder(folder)}
                      color={index === folderPath.length - 1 ? "gray.800" : "gray.600"}
                      fontWeight={index === folderPath.length - 1 ? "semibold" : "normal"}
                      _hover={{ color: "blue.500" }}
                      p={1}
                      minW="auto"
                    >
                      {folder.name}
                    </Button>
                  </React.Fragment>
                ))}
              </HStack>
              <HStack mt={2} gap={2}>
                <input
                  type="text"
                  value={folderIdInput}
                  onChange={(e) => setFolderIdInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault()
                      handleFolderIdSubmit()
                    }
                  }}
                  placeholder="Paste folder ID or Google Drive URL"
                  style={{
                    ...inputStyle,
                    flex: 1,
                    height: '32px',
                    fontSize: '14px',
                  }}
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
                />
                <Button
                  size="sm"
                  colorScheme="blue"
                  onClick={handleFolderIdSubmit}
                  disabled={!folderIdInput.trim()}
                  type="button"
                >
                  Go
                </Button>
              </HStack>
            </Box>

            {/* File/Folder List */}
            <Box flex="1" overflow="auto" p={4} minH={0}>
              {loading ? (
                <Box display="flex" justifyContent="center" alignItems="center" py={8}>
                  <Spinner size="lg" color="blue.500" />
                </Box>
              ) : error ? (
                <Box textAlign="center" py={8}>
                  <Text color="red.500">{error}</Text>
                </Box>
              ) : (
                <VStack gap={1} align="stretch">
                  {folders.length === 0 && files.length === 0 && (
                    <Text color="gray.500" textAlign="center" py={4}>
                      This folder is empty
                    </Text>
                  )}
                  {folders.map(folder => (
                    <Box
                      key={folder.id}
                      p={3}
                      borderRadius="md"
                      cursor="pointer"
                      _hover={{ bg: "gray.50" }}
                      onClick={() => handleFolderClick(folder)}
                      display="flex"
                      alignItems="center"
                      gap={3}
                    >
                      <FiFolder size={20} color="#4299E1" />
                      <Text>{folder.name}</Text>
                    </Box>
                  ))}
                  {files.map(file => (
                    <Box
                      key={file.id}
                      p={3}
                      borderRadius="md"
                      cursor="pointer"
                      _hover={{ bg: "gray.50" }}
                      onClick={() => handleFileClick(file)}
                      display="flex"
                      alignItems="center"
                      gap={3}
                    >
                      <Box
                        w={5}
                        h={5}
                        borderRadius="sm"
                        bg={file.name.endsWith('.lqaboss') ? 'purple.100' : 'green.100'}
                        display="flex"
                        alignItems="center"
                        justifyContent="center"
                      >
                        <Text fontSize="xs" fontWeight="bold" color={file.name.endsWith('.lqaboss') ? 'purple.600' : 'green.600'}>
                          {file.name.endsWith('.lqaboss') ? 'L' : 'J'}
                        </Text>
                      </Box>
                      <Text flex="1">{file.name}</Text>
                      {file.modifiedTime && (
                        <Text fontSize="xs" color="gray.400">
                          {new Date(file.modifiedTime).toLocaleDateString()}
                        </Text>
                      )}
                    </Box>
                  ))}
                </VStack>
              )}
            </Box>

            {/* Footer */}
            <Box
              p={6}
              borderTop="1px solid"
              borderColor="gray.100"
              bg="gray.50"
              flexShrink={0}
            >
              {operation === 'save' && (
                <Box mb={4}>
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
                  />
                </Box>
              )}
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
                  {operation === 'save' ? 'Save Here' : 'Select Folder'}
                </Button>
              </Stack>
            </Box>
          </VStack>
        </form>
      </Box>
    </Portal>
  )
}
