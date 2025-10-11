import { IPersistencePlugin, FileIdentifier, PluginMetadata, PluginCapabilities } from './types'
import { JobData } from '../types'
import { saveChangedTus } from '../utils/saveHandler'

/**
 * Local file plugin for uploading and downloading .lqaboss files
 * This is the default plugin that works without any authentication
 */
export class LocalFilePlugin implements IPersistencePlugin {
  readonly metadata: PluginMetadata = {
    id: 'local',
    name: 'Local Files',
    description: 'Upload and download files from your device',
    icon: 'upload',
    version: '1.0.0'
  }

  readonly capabilities: PluginCapabilities = {
    canLoad: true,
    canSave: true,
    canList: false,
    requiresAuth: false
  }

  /**
   * Load a file from local device
   * If identifier.file is provided, use it directly
   * Otherwise, trigger file picker dialog
   */
  async loadFile(identifier: FileIdentifier): Promise<File> {
    // If we have a File object already (e.g., from PWA launch), use it
    if (identifier.file instanceof File) {
      return identifier.file
    }

    // Otherwise, trigger file picker
    return new Promise((resolve, reject) => {
      const input = document.createElement('input')
      input.type = 'file'
      input.accept = '.lqaboss'
      input.onchange = (e) => {
        const file = (e.target as HTMLInputElement).files?.[0]
        if (file) {
          resolve(file)
        } else {
          reject(new Error('No file selected'))
        }
      }
      input.click()
    })
  }

  /**
   * Save file to local device (download)
   * Downloads changed translations as .json
   * If zipFile is present, also downloads the original .lqaboss file
   */
  async saveFile(identifier: FileIdentifier, data: JobData): Promise<void> {
    const { fileName, originalJobData, zipFile } = identifier

    if (!fileName || !originalJobData) {
      throw new Error('fileName and originalJobData are required for local save')
    }

    // Save the .json file with changed translations
    saveChangedTus(data, originalJobData, fileName)

    // If we have the original ZIP file, also download the .lqaboss file
    if (zipFile) {
      const baseFilename = fileName.replace('.lqaboss', '')
      const lqabossFilename = baseFilename.endsWith('.lqaboss') ? baseFilename : `${baseFilename}.lqaboss`

      // Convert JSZip to blob
      const zipBlob = await zipFile.generateAsync({ type: 'blob' })

      // Trigger download for .lqaboss file
      const url = URL.createObjectURL(zipBlob)
      const link = document.createElement('a')
      link.href = url
      link.download = lqabossFilename
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      URL.revokeObjectURL(url)

      console.log(`Downloaded both ${lqabossFilename} and ${baseFilename}.json`)
    }
  }

  /**
   * Build URL for local file (not used, but included for consistency)
   */
  buildUrl(_identifier: FileIdentifier): string {
    return '?plugin=local'
  }

  /**
   * Parse URL for local plugin
   */
  parseUrl(params: URLSearchParams): FileIdentifier | null {
    if (params.get('plugin') === 'local') {
      return {}
    }
    return null
  }

  /**
   * Parse path URL (not used for local plugin)
   */
  parsePathUrl(_pathSegments: string[]): FileIdentifier | null {
    return null
  }

  /**
   * Local plugin doesn't need setup
   */
  needsSetup(): boolean {
    return false
  }

  /**
   * Local plugin always has valid identifier (file picker handles it)
   */
  validateIdentifier(_identifier: FileIdentifier, _operation: 'load' | 'save'): { valid: boolean } {
    return { valid: true }
  }
}
