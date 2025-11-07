import React, { useState, useEffect } from 'react'
import {
  Box,
  Text,
  Button,
  Portal,
  Input,
  Stack,
  Field,
  Separator,
  IconButton,
  Checkbox,
} from '@chakra-ui/react'
import { FiX } from 'react-icons/fi'
import { IPersistencePlugin, PluginSetting } from '../plugins/types'
import { toaster } from './ui/toaster'

interface SettingsModalProps {
  isOpen: boolean
  onClose: () => void
  pluginsWithSettings: Array<{
    plugin: IPersistencePlugin
    settings: PluginSetting[]
  }>
  currentSettings: Record<string, Record<string, any>>
  onSave: (pluginId: string, values: Record<string, any>) => Promise<void>
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  pluginsWithSettings,
  currentSettings,
  onSave,
}) => {
  const [editedSettings, setEditedSettings] = useState<Record<string, Record<string, any>>>({})

  useEffect(() => {
    if (isOpen) {
      // Deep copy current settings when opening
      setEditedSettings(JSON.parse(JSON.stringify(currentSettings)))
    }
  }, [isOpen, currentSettings])

  if (!isOpen) return null

  const validateSettings = (): string[] => {
    const errors: string[] = []

    for (const { plugin, settings } of pluginsWithSettings) {
      const pluginId = plugin.metadata.id
      const values = editedSettings[pluginId] || {}

      for (const setting of settings) {
        const value = values[setting.key]

        // Check required fields
        if (setting.required && (value === undefined || value === null || value === '')) {
          errors.push(`${plugin.metadata.name}: ${setting.label} is required`)
        }

        // Run custom validation if provided
        if (value !== undefined && value !== null && value !== '' && setting.validation) {
          const error = setting.validation(value)
          if (error) {
            errors.push(`${plugin.metadata.name}: ${error}`)
          }
        }
      }
    }

    return errors
  }

  const handleSave = async () => {
    const errors = validateSettings()
    if (errors.length > 0) {
      toaster.create({
        title: 'Validation errors',
        description: errors.join('\n'),
        type: 'error',
        duration: 6000,
      })
      return
    }

    try {
      // Save settings for each plugin
      for (const { plugin } of pluginsWithSettings) {
        const pluginId = plugin.metadata.id
        const values = editedSettings[pluginId] || {}
        await onSave(pluginId, values)
      }

      toaster.create({
        title: 'Settings saved',
        description: 'All plugin settings have been saved',
        type: 'success',
        duration: 3000,
      })

      onClose()
    } catch (error: any) {
      toaster.create({
        title: 'Failed to save settings',
        description: error.message,
        type: 'error',
        duration: 6000,
      })
    }
  }

  const handleChange = (pluginId: string, key: string, value: any) => {
    setEditedSettings(prev => ({
      ...prev,
      [pluginId]: {
        ...(prev[pluginId] || {}),
        [key]: value
      }
    }))
  }

  const renderSettingField = (
    plugin: IPersistencePlugin,
    setting: PluginSetting
  ) => {
    const pluginId = plugin.metadata.id
    const value = editedSettings[pluginId]?.[setting.key] ?? setting.defaultValue ?? ''

    switch (setting.type) {
      case 'checkbox':
        return (
          <Field.Root key={setting.key}>
            <Checkbox.Root
              checked={value}
              onCheckedChange={(details) => handleChange(pluginId, setting.key, !!details.checked)}
            >
              <Checkbox.HiddenInput />
              <Checkbox.Control>
                <Checkbox.Indicator />
              </Checkbox.Control>
              <Checkbox.Label>{setting.label}</Checkbox.Label>
            </Checkbox.Root>
            {setting.description && (
              <Field.HelperText>{setting.description}</Field.HelperText>
            )}
          </Field.Root>
        )

      case 'select':
        return (
          <Field.Root key={setting.key}>
            <Field.Label>{setting.label}</Field.Label>
            <select
              value={value}
              onChange={(e) => handleChange(pluginId, setting.key, e.target.value)}
              style={{
                width: '100%',
                padding: '8px',
                borderRadius: '4px',
                border: '1px solid #cbd5e0',
              }}
            >
              <option value="">Select...</option>
              {setting.options?.map(opt => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
            {setting.description && (
              <Field.HelperText>{setting.description}</Field.HelperText>
            )}
          </Field.Root>
        )

      case 'number':
        return (
          <Field.Root key={setting.key}>
            <Field.Label>{setting.label}</Field.Label>
            <Input
              type="number"
              value={value}
              onChange={(e) => handleChange(pluginId, setting.key, parseFloat(e.target.value))}
              placeholder={setting.placeholder}
            />
            {setting.description && (
              <Field.HelperText>{setting.description}</Field.HelperText>
            )}
          </Field.Root>
        )

      case 'password':
        return (
          <Field.Root key={setting.key}>
            <Field.Label>{setting.label}</Field.Label>
            <Input
              type="password"
              value={value}
              onChange={(e) => handleChange(pluginId, setting.key, e.target.value)}
              placeholder={setting.placeholder}
            />
            {setting.description && (
              <Field.HelperText>{setting.description}</Field.HelperText>
            )}
          </Field.Root>
        )

      case 'text':
      default:
        return (
          <Field.Root key={setting.key}>
            <Field.Label>{setting.label}</Field.Label>
            <Input
              value={value}
              onChange={(e) => handleChange(pluginId, setting.key, e.target.value)}
              placeholder={setting.placeholder}
            />
            {setting.description && (
              <Field.HelperText>{setting.description}</Field.HelperText>
            )}
          </Field.Root>
        )
    }
  }

  return (
    <Portal>
      <Box
        position="fixed"
        top={0}
        left={0}
        right={0}
        bottom={0}
        bg="rgba(0,0,0,0.5)"
        zIndex={1000}
        display="flex"
        alignItems="center"
        justifyContent="center"
        onClick={onClose}
      >
        <Box
          bg="white"
          borderRadius="md"
          boxShadow="lg"
          maxWidth="800px"
          maxHeight="90vh"
          width="90%"
          overflow="auto"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <Box
            p={4}
            borderBottom="1px solid"
            borderColor="gray.200"
            display="flex"
            alignItems="center"
            justifyContent="space-between"
            position="sticky"
            top={0}
            bg="white"
            zIndex={1}
          >
            <Text fontSize="xl" fontWeight="bold">
              {pluginsWithSettings.length === 1
                ? `${pluginsWithSettings[0].plugin.metadata.name} Settings`
                : 'Plugin Settings'}
            </Text>
            <IconButton onClick={onClose} variant="ghost" aria-label="Close">
              <FiX />
            </IconButton>
          </Box>

          {/* Content */}
          <Box p={6}>
            {pluginsWithSettings.length === 0 ? (
              <Text color="gray.500">No plugins have configurable settings.</Text>
            ) : (
              <Stack gap={6}>
                {pluginsWithSettings.map(({ plugin, settings }, index) => (
                  <Box key={plugin.metadata.id}>
                    {/* Only show plugin name if there are multiple plugins */}
                    {pluginsWithSettings.length > 1 && (
                      <Text fontSize="lg" fontWeight="semibold" mb={3}>
                        {plugin.metadata.name}
                      </Text>
                    )}
                    <Stack gap={4}>
                      {settings.map(setting => renderSettingField(plugin, setting))}
                    </Stack>
                    {/* Only show separator if not the last plugin and there are multiple plugins */}
                    {pluginsWithSettings.length > 1 && index < pluginsWithSettings.length - 1 && (
                      <Separator mt={6} />
                    )}
                  </Box>
                ))}
              </Stack>
            )}
          </Box>

          {/* Footer */}
          <Box
            p={4}
            borderTop="1px solid"
            borderColor="gray.200"
            display="flex"
            justifyContent="flex-end"
            gap={2}
            position="sticky"
            bottom={0}
            bg="white"
          >
            <Button onClick={onClose} variant="outline">
              Cancel
            </Button>
            <Button onClick={handleSave} colorScheme="blue">
              Save Settings
            </Button>
          </Box>
        </Box>
      </Box>
    </Portal>
  )
}
