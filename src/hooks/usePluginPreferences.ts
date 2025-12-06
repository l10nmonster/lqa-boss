import { useState, useCallback, useMemo } from 'react'
import { IPersistencePlugin } from '../plugins/types'

const STORAGE_KEY = 'plugin-preferences'

interface PluginPreferences {
  enabledPlugins: Record<string, boolean>
}

/**
 * Hook to manage plugin enabled/disabled preferences
 * Persists to localStorage to survive sessions
 */
export function usePluginPreferences(allPlugins: IPersistencePlugin[]) {
  // Load initial state from localStorage
  const loadPreferences = (): PluginPreferences => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY)
      if (stored) {
        return JSON.parse(stored)
      }
    } catch (e) {
      console.error('Failed to load plugin preferences:', e)
    }
    // Default: all plugins enabled
    return { enabledPlugins: {} }
  }

  const [preferences, setPreferences] = useState<PluginPreferences>(loadPreferences)

  // Save preferences to localStorage
  const savePreferences = useCallback((prefs: PluginPreferences) => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs))
    } catch (e) {
      console.error('Failed to save plugin preferences:', e)
    }
  }, [])

  // Check if a plugin is enabled (default to true if not explicitly disabled)
  const isPluginEnabled = useCallback((pluginId: string): boolean => {
    return preferences.enabledPlugins[pluginId] !== false
  }, [preferences])

  // Toggle a plugin's enabled state
  const togglePlugin = useCallback((pluginId: string, enabled: boolean) => {
    const newPrefs: PluginPreferences = {
      ...preferences,
      enabledPlugins: {
        ...preferences.enabledPlugins,
        [pluginId]: enabled
      }
    }
    setPreferences(newPrefs)
    savePreferences(newPrefs)
  }, [preferences, savePreferences])

  // Get only enabled plugins
  const enabledPlugins = useMemo(() => {
    return allPlugins.filter(plugin => isPluginEnabled(plugin.metadata.id))
  }, [allPlugins, isPluginEnabled])

  // Get all plugins with their enabled state for the preferences UI
  const pluginsWithState = useMemo(() => {
    return allPlugins.map(plugin => ({
      plugin,
      enabled: isPluginEnabled(plugin.metadata.id),
      canDisable: true
    }))
  }, [allPlugins, isPluginEnabled])

  return {
    enabledPlugins,
    pluginsWithState,
    isPluginEnabled,
    togglePlugin
  }
}
