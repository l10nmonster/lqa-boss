import React, { useEffect, useState } from 'react'
import { Flex, Button, HStack, Image, Text, Menu, Portal, Separator } from '@chakra-ui/react'
import { FiInfo, FiChevronDown, FiFolder, FiSave, FiLogOut, FiFilePlus, FiEdit2, FiBarChart2, FiX, FiSettings } from 'react-icons/fi'
import GlassBox from '../GlassBox'
import { StatusBadge, FileStatus } from '../StatusBadge'
import { IPersistencePlugin } from '../../plugins/types'
import { QualityModel } from '../../types/qualityModel'

interface UnifiedHeaderProps {
  plugins: IPersistencePlugin[]
  onSave: (plugin: IPersistencePlugin) => void
  onLoad: (plugin: IPersistencePlugin) => void
  hasData: boolean
  fileStatus: FileStatus
  onShowInstructions?: () => void
  ter?: number | null
  ept?: number | null
  reviewStats?: { reviewed: number; total: number; percentage: number }
  qualityModel?: QualityModel | null
  onNewModel?: () => void
  onLoadModel?: () => void
  onEditModel?: () => void
  onUnloadModel?: () => void
  onShowSummary?: () => void
  onShowPluginSettings?: (pluginId: string) => void
  onShowPreferences?: () => void
  refreshExtensionAvailability?: number
  refreshAuthState?: number
}

export const UnifiedHeader: React.FC<UnifiedHeaderProps> = ({
  plugins,
  onSave,
  onLoad,
  hasData,
  fileStatus,
  onShowInstructions,
  ter,
  ept,
  reviewStats,
  qualityModel,
  onNewModel,
  onLoadModel,
  onEditModel,
  onUnloadModel,
  onShowSummary,
  onShowPluginSettings,
  onShowPreferences,
  refreshExtensionAvailability,
  refreshAuthState,
}) => {
  // Get plugins by ID for easy lookup
  const extensionPlugin = plugins.find(p => p.metadata.id === 'extension')
  const localPlugin = plugins.find(p => p.metadata.id === 'local')
  const gcsPlugin = plugins.find(p => p.metadata.id === 'gcs')
  const gdrivePlugin = plugins.find(p => p.metadata.id === 'gdrive')

  // Force re-render trigger for auth state changes (internal + external via prop)
  const [authRefreshInternal, setAuthRefreshInternal] = useState(0)

  // Check auth state from plugins directly
  // Dependencies on authRefreshInternal and refreshAuthState ensure re-render after sign in/out
  const gcsIsAuthenticated = gcsPlugin?.getAuthState?.().isAuthenticated || false
  const gdriveIsAuthenticated = gdrivePlugin?.getAuthState?.().isAuthenticated || false
  // Use refresh counters to avoid unused variable warnings
  void authRefreshInternal
  void refreshAuthState

  // Check extension availability
  const [extensionAvailable, setExtensionAvailable] = useState(false)

  // Get plugins with settings
  const pluginsWithSettings = plugins.filter(p => p.getSettings && p.getSettings().length > 0)

  useEffect(() => {
    if (extensionPlugin?.isAvailable) {
      extensionPlugin.isAvailable().then(setExtensionAvailable)
    }
  }, [extensionPlugin, refreshExtensionAvailability])

  const handleGcsSignOut = async () => {
    if (gcsPlugin?.signOut) {
      await gcsPlugin.signOut()
      setAuthRefreshInternal(n => n + 1)
    }
  }

  const handleGdriveSignOut = async () => {
    if (gdrivePlugin?.signOut) {
      await gdrivePlugin.signOut()
      setAuthRefreshInternal(n => n + 1)
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
                    {(gcsPlugin || gdrivePlugin || extensionPlugin) && <Separator />}
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
                      <Menu.Item
                        value="gcs-save"
                        onClick={() => onSave(gcsPlugin)}
                        disabled={!hasData}
                      >
                        <FiSave /> Save
                      </Menu.Item>
                      {gcsIsAuthenticated && (
                        <Menu.Item
                          value="gcs-sign-out"
                          onClick={handleGcsSignOut}
                        >
                          <FiLogOut /> Sign Out
                        </Menu.Item>
                      )}
                    </Menu.ItemGroup>
                    {(gdrivePlugin || extensionPlugin) && <Separator />}
                  </>
                )}

                {/* Google Drive Group */}
                {gdrivePlugin && (
                  <>
                    <Menu.ItemGroup>
                      <Menu.ItemGroupLabel>{gdrivePlugin.metadata.name}</Menu.ItemGroupLabel>
                      <Menu.Item
                        value="gdrive-open"
                        onClick={() => onLoad(gdrivePlugin)}
                      >
                        <FiFolder /> Open File…
                      </Menu.Item>
                      <Menu.Item
                        value="gdrive-save"
                        onClick={() => onSave(gdrivePlugin)}
                        disabled={!hasData}
                      >
                        <FiSave /> Save
                      </Menu.Item>
                      {gdriveIsAuthenticated && (
                        <Menu.Item
                          value="gdrive-sign-out"
                          onClick={handleGdriveSignOut}
                        >
                          <FiLogOut /> Sign Out
                        </Menu.Item>
                      )}
                    </Menu.ItemGroup>
                    {extensionPlugin && <Separator />}
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

        {/* Quality Menu */}
        <Menu.Root>
          <Menu.Trigger asChild>
            <Button variant="ghost" size="sm">
              Quality
              <FiChevronDown />
            </Button>
          </Menu.Trigger>
          <Portal>
            <Menu.Positioner>
              <Menu.Content>
                <Menu.Item
                  value="new-model"
                  onClick={onNewModel}
                >
                  <FiFilePlus /> New Model…
                </Menu.Item>
                <Menu.Item
                  value="load-model"
                  onClick={onLoadModel}
                >
                  <FiFolder /> Load Model…
                </Menu.Item>
                <Menu.Item
                  value="edit-model"
                  onClick={onEditModel}
                  disabled={!qualityModel}
                >
                  <FiEdit2 /> Edit Model…
                </Menu.Item>
                <Menu.Item
                  value="unload-model"
                  onClick={onUnloadModel}
                  disabled={!qualityModel}
                >
                  <FiX /> Unload Model
                </Menu.Item>
                <Separator />
                <Menu.Item
                  value="summary"
                  onClick={onShowSummary}
                >
                  <FiBarChart2 /> Summary…
                </Menu.Item>
                <Separator />
                {/* Model Info */}
                <Text fontSize="sm" color="gray.600" px={3} py={1}>
                  Model: <Text as="span" fontWeight="semibold" color="gray.800">{qualityModel ? `${qualityModel.name} v${qualityModel.version}` : 'None'}</Text>
                </Text>
                {/* TER Score */}
                <Text
                  fontSize="sm"
                  color="gray.600"
                  px={3}
                  py={1}
                  data-testid="ter-label"
                >
                  TER: <Text as="span" fontWeight="semibold" color="gray.800">{typeof ter === 'number' ? `${(ter * 100).toFixed(0)}%` : 'N/A'}</Text>
                </Text>
                {/* EPT Score */}
                <Text
                  fontSize="sm"
                  color="gray.600"
                  px={3}
                  py={1}
                  data-testid="ept-label"
                >
                  EPT: <Text as="span" fontWeight="semibold" color="gray.800">{typeof ept === 'number' ? `${ept.toFixed(1)}` : 'N/A'}</Text>
                </Text>
              </Menu.Content>
            </Menu.Positioner>
          </Portal>
        </Menu.Root>

        {/* Settings Menu */}
        <Menu.Root>
          <Menu.Trigger asChild>
            <Button variant="ghost" size="sm">
              Settings
              <FiChevronDown />
            </Button>
          </Menu.Trigger>
          <Portal>
            <Menu.Positioner>
              <Menu.Content>
                {onShowPreferences && (
                  <>
                    <Menu.Item
                      value="preferences"
                      onClick={onShowPreferences}
                    >
                      <FiSettings /> Preferences…
                    </Menu.Item>
                    {pluginsWithSettings.length > 0 && <Separator />}
                  </>
                )}
                {onShowPluginSettings && pluginsWithSettings.map(plugin => (
                  <Menu.Item
                    key={plugin.metadata.id}
                    value={`settings-${plugin.metadata.id}`}
                    onClick={() => onShowPluginSettings(plugin.metadata.id)}
                  >
                    <FiSettings /> {plugin.metadata.name}…
                  </Menu.Item>
                ))}
              </Menu.Content>
            </Menu.Positioner>
          </Portal>
        </Menu.Root>
      </HStack>

      <HStack gap={2}>
        {/* Job Info Button */}
        {hasData && onShowInstructions && (
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
        {/* Review Completion */}
        {reviewStats && reviewStats.total > 0 && (
          <Text
            fontSize="sm"
            color="gray.700"
            fontWeight="semibold"
            data-testid="review-completion-label"
          >
            {reviewStats.reviewed}/{reviewStats.total} ({reviewStats.percentage}%)
          </Text>
        )}
        {/* Status Badge */}
        <StatusBadge status={fileStatus} />
      </HStack>
    </Flex>
  )
}
