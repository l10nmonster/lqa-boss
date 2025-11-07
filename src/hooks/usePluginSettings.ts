import { useState, useEffect, useCallback, useRef } from 'react'
import { IPersistencePlugin, PluginSetting } from '../plugins/types'

/**
 * Centralized settings management for plugins
 * Handles persistence to localStorage and retrieval on startup
 */
export function usePluginSettings(plugins: IPersistencePlugin[]) {
  const [settings, setSettings] = useState<Record<string, Record<string, any>>>({})
  const [initialized, setInitialized] = useState(false)
  const pluginsRef = useRef<IPersistencePlugin[]>(plugins)

  // Update ref when plugins change
  useEffect(() => {
    pluginsRef.current = plugins
  }, [plugins])

  /**
   * Load all plugin settings from localStorage on mount
   * Only runs once when plugins are first available
   */
  useEffect(() => {
    if (initialized || plugins.length === 0) return

    const loadedSettings: Record<string, Record<string, any>> = {}

    for (const plugin of plugins) {
      const pluginSettings = plugin.getSettings?.()
      if (!pluginSettings) continue

      const pluginId = plugin.metadata.id
      loadedSettings[pluginId] = {}

      for (const setting of pluginSettings) {
        const storageKey = `plugin-${pluginId}-${setting.key}`
        const storedValue = localStorage.getItem(storageKey)

        if (storedValue !== null) {
          // Parse stored value based on type
          let value: any = storedValue
          if (setting.type === 'number') {
            value = parseFloat(storedValue)
          } else if (setting.type === 'checkbox') {
            value = storedValue === 'true'
          }
          loadedSettings[pluginId][setting.key] = value
        } else if (setting.defaultValue !== undefined) {
          loadedSettings[pluginId][setting.key] = setting.defaultValue
        }
      }

      // Apply loaded settings to the plugin
      if (plugin.setConfig && Object.keys(loadedSettings[pluginId]).length > 0) {
        plugin.setConfig(loadedSettings[pluginId]).catch(err => {
          console.error(`Failed to apply settings for ${pluginId}:`, err)
        })
      }
    }

    setSettings(loadedSettings)
    setInitialized(true)
  }, [plugins, initialized])

  /**
   * Get a setting value for a specific plugin
   */
  const getSetting = useCallback((pluginId: string, key: string): any => {
    return settings[pluginId]?.[key]
  }, [settings])

  /**
   * Set a setting value for a specific plugin
   * Persists to localStorage and updates plugin config
   */
  const setSetting = useCallback(async (
    pluginId: string,
    key: string,
    value: any
  ): Promise<void> => {
    const plugin = pluginsRef.current.find(p => p.metadata.id === pluginId)
    if (!plugin) {
      console.error(`Plugin ${pluginId} not found`)
      return
    }

    // Update localStorage
    const storageKey = `plugin-${pluginId}-${key}`
    if (value === null || value === undefined || value === '') {
      localStorage.removeItem(storageKey)
    } else {
      localStorage.setItem(storageKey, String(value))
    }

    // Update state
    setSettings(prev => {
      const updatedConfig = {
        ...prev[pluginId],
        [key]: value
      }

      // Update plugin config asynchronously
      if (plugin.setConfig) {
        plugin.setConfig(updatedConfig).catch(err => {
          console.error(`Failed to apply setting for ${pluginId}:`, err)
        })
      }

      return {
        ...prev,
        [pluginId]: updatedConfig
      }
    })
  }, [])

  /**
   * Set multiple settings for a plugin at once
   */
  const setPluginSettings = useCallback(async (
    pluginId: string,
    values: Record<string, any>
  ): Promise<void> => {
    const plugin = pluginsRef.current.find(p => p.metadata.id === pluginId)
    if (!plugin) {
      console.error(`Plugin ${pluginId} not found`)
      return
    }

    // Update localStorage for all values
    for (const [key, value] of Object.entries(values)) {
      const storageKey = `plugin-${pluginId}-${key}`
      if (value === null || value === undefined || value === '') {
        localStorage.removeItem(storageKey)
      } else {
        localStorage.setItem(storageKey, String(value))
      }
    }

    // Update state
    setSettings(prev => {
      const updatedConfig = {
        ...prev[pluginId],
        ...values
      }

      // Update plugin config asynchronously
      if (plugin.setConfig) {
        plugin.setConfig(updatedConfig).catch(err => {
          console.error(`Failed to apply settings for ${pluginId}:`, err)
        })
      }

      return {
        ...prev,
        [pluginId]: updatedConfig
      }
    })
  }, [])

  /**
   * Get all settings for a specific plugin
   */
  const getPluginSettings = useCallback((pluginId: string): Record<string, any> => {
    return settings[pluginId] || {}
  }, [settings])

  /**
   * Get all plugins that have settings defined
   */
  const getPluginsWithSettings = useCallback((): Array<{
    plugin: IPersistencePlugin
    settings: PluginSetting[]
  }> => {
    return pluginsRef.current
      .filter(p => p.getSettings && p.getSettings().length > 0)
      .map(p => ({
        plugin: p,
        settings: p.getSettings!()
      }))
  }, [])

  return {
    settings,
    getSetting,
    setSetting,
    setPluginSettings,
    getPluginSettings,
    getPluginsWithSettings,
  }
}
