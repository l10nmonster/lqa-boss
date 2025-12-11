import { IPersistencePlugin, FileIdentifier, PluginMetadata, PluginCapabilities, PluginSetting } from './types'
import { JobData } from '../types'
import JSZip from 'jszip'
import { generateJobGuid } from '../utils/idGenerator'
import { toaster } from '../components/ui/toaster'

// Import version from package.json
// @ts-ignore - vite handles this import
import packageJson from '../../package.json'

// Declare chrome types for TypeScript
declare const chrome: {
  runtime: {
    sendMessage: (extensionId: string, message: any, responseCallback: (response: any) => void) => void
    lastError?: { message: string }
  }
}

/**
 * Chrome Extension plugin for receiving .lqaboss files from a Chrome extension
 * Uses chrome.runtime messaging API for cross-origin communication
 */
export class ChromeExtensionPlugin implements IPersistencePlugin {
  private extensionId: string = ''

  readonly metadata: PluginMetadata = {
    id: 'extension',
    name: 'Chrome Extension',
    description: 'Receive jobs from LQA Boss Capture',
    icon: 'extension',
    version: '1.0.0'
  }

  readonly capabilities: PluginCapabilities = {
    canLoad: true,
    canSave: false,  // Extension creates files, doesn't receive them back
    canList: false,
    requiresAuth: false
  }

  constructor() {
    // Load extension ID from localStorage
    this.extensionId = localStorage.getItem('plugin-extension-extensionId') || ''
  }

  /**
   * Send a message to the extension and return a promise
   * @param message The message to send
   * @param timeoutMs Timeout in milliseconds (default: 30s, use longer for large operations)
   */
  private sendMessage(message: any, timeoutMs: number = 30000): Promise<any> {
    return new Promise((resolve, reject) => {
      const timeoutSec = Math.round(timeoutMs / 1000)
      const timeout = setTimeout(() => {
        reject(new Error(`Timeout waiting for extension response (${timeoutSec}s). Extension ID: ${this.extensionId}`))
      }, timeoutMs)

      chrome.runtime.sendMessage(this.extensionId, message, (response: any) => {
        clearTimeout(timeout)

        if (chrome.runtime.lastError) {
          reject(new Error(`Extension communication failed: ${chrome.runtime.lastError.message}`))
          return
        }

        if (!response) {
          reject(new Error('No response from extension'))
          return
        }

        resolve(response)
      })
    })
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

    // Extension ID must be configured
    if (!this.extensionId) {
      return false
    }

    return new Promise((resolve) => {
      const timeout = setTimeout(() => {
        resolve(false)
      }, 1000)

      chrome.runtime.sendMessage(
        this.extensionId,
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
   * Supports chunked transfer for large flows (> 50MB)
   */
  async loadFile(_identifier: FileIdentifier): Promise<File> {
    // Check if chrome.runtime is available (only in Chrome/Edge browsers)
    if (typeof chrome === 'undefined' || !chrome.runtime?.sendMessage) {
      throw new Error('Chrome extension API not available. Please use Chrome or Edge browser.')
    }

    // Extension ID must be configured
    if (!this.extensionId) {
      throw new Error('Extension ID not configured. Please set the Extension ID in Settings.')
    }

    // Show loading toast
    const loadingToast = toaster.create({
      title: 'Loading from extension',
      description: 'Requesting flow data...',
      type: 'loading',
      duration: 120000, // Will be dismissed manually
    })

    try {
      // Request flow from extension (2 minute timeout - may need to create ZIP for large flows)
      const response = await this.sendMessage({ action: 'requestFlow' }, 120000)

      if (!response.success) {
        throw new Error(response.error || 'Failed to get flow from extension')
      }

      let uint8Array: Uint8Array

      // Check if chunked transfer is needed (for large flows)
      if (response.data.chunked) {
        const { flowId, totalChunks, totalSize } = response.data
        const totalSizeMB = (totalSize / 1024 / 1024).toFixed(1)
        console.log(`Receiving large flow via chunked transfer: ${totalSizeMB}MB in ${totalChunks} chunks`)

        // Update toast for chunked transfer
        toaster.update(loadingToast, {
          title: 'Receiving large flow',
          description: `0% of ${totalSizeMB}MB...`,
        })

        const chunks: Uint8Array[] = []

        for (let i = 0; i < totalChunks; i++) {
          const progress = Math.round((i / totalChunks) * 100)
          console.log(`Fetching chunk ${i + 1}/${totalChunks}...`)

          // Update progress before fetching (use setTimeout to avoid flushSync warning)
          setTimeout(() => {
            toaster.update(loadingToast, {
              title: 'Receiving large flow',
              description: `${progress}% of ${totalSizeMB}MB (chunk ${i + 1}/${totalChunks})...`,
            })
          }, 0)

          // 120 second timeout per chunk (each chunk is up to 10MB)
          const chunkResponse = await this.sendMessage({
            action: 'requestFlowChunk',
            flowId,
            chunkIndex: i
          }, 120000)

          if (!chunkResponse.success) {
            throw new Error(chunkResponse.error || `Failed to get chunk ${i}`)
          }

          chunks.push(Uint8Array.fromBase64(chunkResponse.data.chunkBase64))
        }

        // Reassemble chunks
        toaster.update(loadingToast, {
          title: 'Processing flow',
          description: 'Reassembling data...',
        })

        const totalLength = chunks.reduce((sum, chunk) => sum + chunk.length, 0)
        uint8Array = new Uint8Array(totalLength)
        let offset = 0
        for (const chunk of chunks) {
          uint8Array.set(chunk, offset)
          offset += chunk.length
        }

        console.log(`Chunked transfer complete: ${(totalLength / 1024 / 1024).toFixed(1)}MB received`)
      } else {
        // Small flow - direct data (existing behavior)
        toaster.update(loadingToast, {
          title: 'Processing flow',
          description: 'Unpacking data...',
        })
        uint8Array = Uint8Array.fromBase64(response.data.zipBase64)
      }

      // Load the ZIP to modify job.json
      const zip = await JSZip.loadAsync(uint8Array)

      // Read and parse job.json
      const jobFile = zip.file('job.json')
      if (!jobFile) {
        throw new Error('Invalid .lqaboss file: "job.json" not found in extension data')
      }

      const jobContent = await jobFile.async('string')
      const originalJobData: JobData = JSON.parse(jobContent)

      // Generate new jobGuid
      const jobGuid = generateJobGuid()

      // Create updated job data, preserving all existing fields
      const jobData: JobData = {
        ...originalJobData, // Preserve all existing fields (including instructions)
        jobGuid,
        status: 'created',
        translationProvider: `lqaboss-v${packageJson.version}`,
      }

      // Update job.json in the ZIP
      zip.file('job.json', JSON.stringify(jobData, null, 2))

      // Generate updated ZIP
      const updatedZipData = await zip.generateAsync({ type: 'arraybuffer' })
      const blob = new Blob([updatedZipData], { type: 'application/zip' })

      // Use filename from extension if provided, otherwise fallback to jobGuid
      const fileName = response.data.fileName || `${jobGuid}.lqaboss`
      const file = new File([blob], fileName)

      // Dismiss loading toast before returning
      toaster.dismiss(loadingToast)

      return file
    } catch (error) {
      // Dismiss loading toast on error
      toaster.dismiss(loadingToast)
      throw error
    }
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

  /**
   * Get plugin configuration
   */
  getConfig(): Record<string, any> {
    return {
      extensionId: this.extensionId
    }
  }

  /**
   * Set plugin configuration
   */
  async setConfig(config: Record<string, any>): Promise<void> {
    if (config.extensionId !== undefined) {
      this.extensionId = config.extensionId
    }
  }

  /**
   * Get plugin settings definition
   */
  getSettings(): PluginSetting[] {
    return [
      {
        key: 'extensionId',
        label: 'Extension ID',
        type: 'text',
        placeholder: 'abc...xyz',
        description: 'Chrome Extension ID (find it at chrome://extensions with Developer mode enabled)',
        required: true,
        defaultValue: 'kikdgalghgdmaabcjbbkdbjchmnonlhb',
      },
    ]
  }
}
