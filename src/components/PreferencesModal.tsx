import React from 'react'
import {
  Box,
  Text,
  Button,
  Portal,
  VStack,
  HStack,
  Checkbox,
} from '@chakra-ui/react'
import { FiX } from 'react-icons/fi'
import { IPersistencePlugin } from '../plugins/types'

interface PluginWithState {
  plugin: IPersistencePlugin
  enabled: boolean
  canDisable: boolean
}

interface PreferencesModalProps {
  isOpen: boolean
  onClose: () => void
  pluginsWithState: PluginWithState[]
  onTogglePlugin: (pluginId: string, enabled: boolean) => void
}

export const PreferencesModal: React.FC<PreferencesModalProps> = ({
  isOpen,
  onClose,
  pluginsWithState,
  onTogglePlugin,
}) => {
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
        maxW="md"
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
          <Text fontSize="xl" fontWeight="bold" color="gray.700">
            Preferences
          </Text>
          <Button
            variant="ghost"
            size="sm"
            onClick={onClose}
            color="gray.500"
            _hover={{ color: 'gray.700' }}
            aria-label="close modal"
          >
            <FiX size={20} />
          </Button>
        </Box>

        {/* Body */}
        <Box p={6} overflow="auto" maxH="60vh">
          <VStack align="stretch" gap={4}>
            <Box>
              <Text fontSize="md" fontWeight="semibold" color="gray.700" mb={3}>
                Enabled Plugins
              </Text>
              <Text fontSize="sm" color="gray.500" mb={4}>
                Select which plugins to show in the File and Settings menus.
              </Text>
              <VStack align="stretch" gap={2}>
                {pluginsWithState.map(({ plugin, enabled, canDisable }) => (
                  <HStack
                    key={plugin.metadata.id}
                    p={3}
                    bg="gray.50"
                    borderRadius="md"
                    justify="space-between"
                  >
                    <Box flex="1">
                      <Text fontWeight="medium" color="gray.700">
                        {plugin.metadata.name}
                      </Text>
                      <Text fontSize="sm" color="gray.500">
                        {plugin.metadata.description}
                      </Text>
                    </Box>
                    <Checkbox.Root
                      checked={enabled}
                      onCheckedChange={(e: { checked: boolean | string }) => {
                        if (canDisable) {
                          onTogglePlugin(plugin.metadata.id, e.checked === true)
                        }
                      }}
                      disabled={!canDisable}
                    >
                      <Checkbox.HiddenInput />
                      <Checkbox.Control />
                    </Checkbox.Root>
                  </HStack>
                ))}
              </VStack>
            </Box>
          </VStack>
        </Box>

        {/* Footer */}
        <Box
          p={6}
          borderTop="1px solid"
          borderColor="gray.100"
          bg="gray.50"
        >
          <HStack justify="flex-end">
            <Button
              variant="solid"
              colorScheme="blue"
              onClick={onClose}
            >
              Done
            </Button>
          </HStack>
        </Box>
      </Box>
    </Portal>
  )
}
