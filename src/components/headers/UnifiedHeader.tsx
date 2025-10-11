import React, { useEffect, useState } from 'react'
import { Flex, Button, HStack, Image, Text, Menu, Portal, Separator } from '@chakra-ui/react'
import { FiInfo, FiChevronDown, FiFolder, FiSave, FiLogOut, FiFilePlus } from 'react-icons/fi'
import GlassBox from '../GlassBox'
import { StatusBadge, FileStatus } from '../StatusBadge'
import { IPersistencePlugin } from '../../plugins/types'

interface UnifiedHeaderProps {
  plugins: IPersistencePlugin[]
  onSave: (plugin: IPersistencePlugin) => void
  onLoad: (plugin: IPersistencePlugin) => void
  hasData: boolean
  fileStatus: FileStatus
  onShowInstructions?: () => void
  hasInstructions?: boolean
  hasLanguageInfo?: boolean
}

export const UnifiedHeader: React.FC<UnifiedHeaderProps> = ({
  plugins,
  onSave,
  onLoad,
  hasData,
  fileStatus,
  onShowInstructions,
  hasInstructions = false,
  hasLanguageInfo = false,
}) => {
  // Get plugins by ID for easy lookup
  const extensionPlugin = plugins.find(p => p.metadata.id === 'extension')
  const localPlugin = plugins.find(p => p.metadata.id === 'local')
  const gcsPlugin = plugins.find(p => p.metadata.id === 'gcs')

  // Check GCS authentication state
  const gcsIsAuthenticated = gcsPlugin?.getAuthState?.().isAuthenticated || false

  // Check extension availability
  const [extensionAvailable, setExtensionAvailable] = useState(false)

  useEffect(() => {
    if (extensionPlugin?.isAvailable) {
      extensionPlugin.isAvailable().then(setExtensionAvailable)
    }
  }, [extensionPlugin])

  const handleSignOut = async () => {
    if (gcsPlugin?.signOut) {
      await gcsPlugin.signOut()
    }
  }

  return (
    <Flex as={GlassBox} p={3} align="center" justify="space-between">
      <HStack gap={4} align="center">
        <Image
          src={`${import.meta.env.BASE_URL}icons/icon-512x512.png`}
          alt="LQA Boss Logo"
          height="40px"
          width="40px"
          borderRadius="full"
        />
        <Text fontSize="md" fontWeight="bold" color="gray.700">
          LQA Boss
        </Text>

        <Separator orientation="vertical" height="40px" />

        {/* File Menu */}
        <Menu.Root>
          <Menu.Trigger asChild>
            <Button variant="ghost" size="sm">
              File
              <FiChevronDown />
            </Button>
          </Menu.Trigger>
          <Portal>
            <Menu.Positioner>
              <Menu.Content>
                {/* Local Files Group */}
                {localPlugin && (
                  <>
                    <Menu.ItemGroup>
                      <Menu.ItemGroupLabel>{localPlugin.metadata.name}</Menu.ItemGroupLabel>
                      <Menu.Item
                        value="local-open"
                        onClick={() => onLoad(localPlugin)}
                      >
                        <FiFolder /> Open File…
                      </Menu.Item>
                      <Menu.Item
                        value="local-save"
                        onClick={() => onSave(localPlugin)}
                        disabled={!hasData}
                      >
                        <FiSave /> Save
                      </Menu.Item>
                    </Menu.ItemGroup>
                    <Separator />
                  </>
                )}

                {/* GCS Group */}
                {gcsPlugin && (
                  <>
                    <Menu.ItemGroup>
                      <Menu.ItemGroupLabel>{gcsPlugin.metadata.name}</Menu.ItemGroupLabel>
                      <Menu.Item
                        value="gcs-open"
                        onClick={() => onLoad(gcsPlugin)}
                      >
                        <FiFolder /> Open File…
                      </Menu.Item>
                      {gcsIsAuthenticated && (
                        <Menu.Item
                          value="gcs-save"
                          onClick={() => onSave(gcsPlugin)}
                          disabled={!hasData}
                        >
                          <FiSave /> Save
                        </Menu.Item>
                      )}
                      {gcsIsAuthenticated && (
                        <Menu.Item
                          value="gcs-sign-out"
                          onClick={handleSignOut}
                        >
                          <FiLogOut /> Sign Out
                        </Menu.Item>
                      )}
                    </Menu.ItemGroup>
                    <Separator />
                  </>
                )}

                {/* Chrome Extension Group */}
                {extensionPlugin && (
                  <Menu.ItemGroup>
                    <Menu.ItemGroupLabel>{extensionPlugin.metadata.name}</Menu.ItemGroupLabel>
                    <Menu.Item
                      value="extension-new"
                      onClick={() => onLoad(extensionPlugin)}
                      disabled={!extensionAvailable}
                    >
                      <FiFilePlus /> New…
                      {!extensionAvailable && ' (Not Installed)'}
                    </Menu.Item>
                  </Menu.ItemGroup>
                )}
              </Menu.Content>
            </Menu.Positioner>
          </Portal>
        </Menu.Root>
      </HStack>

      <HStack gap={2}>
        {/* Instructions Button */}
        {(hasInstructions || hasLanguageInfo) && onShowInstructions && (
          <Button
            variant="outline"
            colorScheme="blue"
            onClick={onShowInstructions}
            size="sm"
            px={3}
            data-testid="instructions-button"
          >
            <FiInfo />
          </Button>
        )}
        {/* Status Badge */}
        <StatusBadge status={fileStatus} />
      </HStack>
    </Flex>
  )
}
