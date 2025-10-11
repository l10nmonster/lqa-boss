import { IPersistencePlugin } from './types'

/**
 * Central registry for managing persistence plugins
 */
export class PluginRegistry {
  private plugins: Map<string, IPersistencePlugin> = new Map()

  /**
   * Register a new plugin
   */
  register(plugin: IPersistencePlugin): void {
    if (this.plugins.has(plugin.metadata.id)) {
      throw new Error(`Plugin ${plugin.metadata.id} already registered`)
    }
    this.plugins.set(plugin.metadata.id, plugin)
    console.log(`Registered plugin: ${plugin.metadata.name} v${plugin.metadata.version}`)
  }

  /**
   * Unregister a plugin and dispose of it
   */
  async unregister(pluginId: string): Promise<void> {
    const plugin = this.plugins.get(pluginId)
    if (plugin?.dispose) {
      await plugin.dispose()
    }
    this.plugins.delete(pluginId)
    console.log(`Unregistered plugin: ${pluginId}`)
  }

  /**
   * Get a specific plugin by ID
   */
  getPlugin(pluginId: string): IPersistencePlugin | undefined {
    return this.plugins.get(pluginId)
  }

  /**
   * Get all registered plugins
   */
  getAllPlugins(): IPersistencePlugin[] {
    return Array.from(this.plugins.values())
  }

  /**
   * Get only plugins that are currently available for use
   * (e.g., authenticated if auth is required)
   */
  getAvailablePlugins(): IPersistencePlugin[] {
    return this.getAllPlugins().filter(plugin => {
      if (!plugin.capabilities.requiresAuth) return true
      return plugin.getAuthState?.().isAuthenticated ?? false
    })
  }

  /**
   * Initialize all registered plugins
   */
  async initializeAll(): Promise<void> {
    const initPromises = Array.from(this.plugins.values())
      .filter(plugin => plugin.initialize)
      .map(plugin => plugin.initialize!())

    await Promise.all(initPromises)
    console.log(`Initialized ${initPromises.length} plugins`)
  }

  /**
   * Dispose of all registered plugins
   */
  async disposeAll(): Promise<void> {
    const disposePromises = Array.from(this.plugins.values())
      .filter(plugin => plugin.dispose)
      .map(plugin => plugin.dispose!())

    await Promise.all(disposePromises)
    this.plugins.clear()
    console.log('Disposed all plugins')
  }
}

// Singleton instance
export const pluginRegistry = new PluginRegistry()
