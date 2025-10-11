import { IPersistencePlugin, FileIdentifier, PluginMetadata, PluginCapabilities } from './types'
import { JobData } from '../types'

// Declare chrome types for TypeScript
declare const chrome: {
  runtime: {
    sendMessage: (extensionId: string, message: any, responseCallback: (response: any) => void) => void
    lastError?: { message: string }
  }
}

// Extension ID - update this with your actual extension ID
// You can find it in chrome://extensions when developer mode is enabled
const EXTENSION_ID = 'kikdgalghgdmaabcjbbkdbjchmnonlhb'

/**
 * Chrome Extension plugin for receiving .lqaboss files from a Chrome extension
 * Uses chrome.runtime messaging API for cross-origin communication
 */
export class ChromeExtensionPlugin implements IPersistencePlugin {

  readonly metadata: PluginMetadata = {
    id: 'extension',
    name: 'Chrome Extension',
    description: 'Receive files from Chrome extension',
    icon: 'extension',
    version: '1.0.0'
  }

  readonly capabilities: PluginCapabilities = {
    canLoad: true,
    canSave: false,  // Extension creates files, doesn't receive them back
    canList: false,
    requiresAuth: false
  }

  /**
   * Initialize the plugin
   */
  async initialize(): Promise<void> {
    console.log('Chrome Extension plugin initialized')
  }

  /**
   * Clean up
   */
  async dispose(): Promise<void> {
    console.log('Chrome Extension plugin disposed')
  }

  /**
   * Check if the Chrome extension is installed and accessible
   */
  async isAvailable(): Promise<boolean> {
    // Check if chrome.runtime is available
    if (typeof chrome === 'undefined' || !chrome.runtime?.sendMessage) {
      return false
    }

    return new Promise((resolve) => {
      const timeout = setTimeout(() => {
        resolve(false)
      }, 1000)

      chrome.runtime.sendMessage(
        EXTENSION_ID,
        { action: 'ping' },
        (_response: any) => {
          clearTimeout(timeout)

          // If there's a runtime error, extension is not installed
          if (chrome.runtime.lastError) {
            resolve(false)
            return
          }

          // Extension responded (even with an error means it's installed)
          resolve(true)
        }
      )
    })
  }

  /**
   * Load a file from the extension
   * Requests flow data from extension via chrome.runtime messaging
   */
  async loadFile(_identifier: FileIdentifier): Promise<File> {
    // Check if chrome.runtime is available (only in Chrome/Edge browsers)
    if (typeof chrome === 'undefined' || !chrome.runtime?.sendMessage) {
      throw new Error('Chrome extension API not available. Please use Chrome or Edge browser.')
    }

    console.log(`[ChromeExtensionPlugin] Requesting flow from extension ID: ${EXTENSION_ID}`)

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        console.error('[ChromeExtensionPlugin] Timeout waiting for extension response')
        reject(new Error(`Timeout waiting for extension response (30s). Extension ID: ${EXTENSION_ID}. Check chrome://extensions for the correct ID.`))
      }, 30000)

      // Request flow from extension
      chrome.runtime.sendMessage(
        EXTENSION_ID,
        { action: 'requestFlow' },
        (response: any) => {
          clearTimeout(timeout)

          // Check for Chrome runtime errors
          if (chrome.runtime.lastError) {
            console.error('[ChromeExtensionPlugin] Extension communication error:', chrome.runtime.lastError.message)
            console.error(`[ChromeExtensionPlugin] Current extension ID: ${EXTENSION_ID}`)
            console.error('[ChromeExtensionPlugin] If ID is incorrect, update src/plugins/ChromeExtensionPlugin.ts line 14 and rebuild')
            reject(new Error(`Extension communication failed: ${chrome.runtime.lastError.message}. Current extension ID: ${EXTENSION_ID}. Check chrome://extensions for the correct ID.`))
            return
          }

          if (!response) {
            console.error('[ChromeExtensionPlugin] No response from extension')
            reject(new Error('No response from extension. Is the LQA Boss Capture extension installed?'))
            return
          }

          console.log('[ChromeExtensionPlugin] Received response:', { success: response.success, hasData: !!response.data, error: response.error })

          if (!response.success) {
            console.error('[ChromeExtensionPlugin] Extension returned error:', response.error)
            reject(new Error(response.error || 'Failed to get flow from extension'))
            return
          }

          try {
            // Convert array back to Uint8Array then to Blob
            const uint8Array = new Uint8Array(response.data.zipData)
            const blob = new Blob([uint8Array], { type: 'application/zip' })
            const file = new File([blob], response.data.fileName || 'extension.lqaboss')
            console.log(`[ChromeExtensionPlugin] Successfully created file: ${file.name} (${file.size} bytes)`)
            resolve(file)
          } catch (error: any) {
            console.error('[ChromeExtensionPlugin] Failed to create file:', error)
            reject(new Error(`Failed to create file from extension data: ${error.message}`))
          }
        }
      )
    })
  }

  /**
   * Save operation not supported for extension plugin
   */
  async saveFile(_identifier: FileIdentifier, _data: JobData): Promise<void> {
    throw new Error('Chrome Extension plugin does not support saving files')
  }

  /**
   * Parse URL - extension plugin doesn't use URL parameters
   */
  parseUrl(params: URLSearchParams): FileIdentifier | null {
    if (params.get('plugin') === 'extension') {
      return {}
    }
    return null
  }

  /**
   * Build URL for extension plugin
   */
  buildUrl(_identifier: FileIdentifier): string {
    return '?plugin=extension'
  }

  /**
   * Parse path URL (not used for extension plugin)
   */
  parsePathUrl(_pathSegments: string[]): FileIdentifier | null {
    return null
  }

  /**
   * Extension plugin doesn't need setup
   */
  needsSetup(): boolean {
    return false
  }

  /**
   * Extension plugin always has valid identifier (handled internally)
   */
  validateIdentifier(_identifier: FileIdentifier, _operation: 'load' | 'save'): { valid: boolean } {
    return { valid: true }
  }
}
