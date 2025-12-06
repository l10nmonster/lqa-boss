import { IPersistencePlugin, FileIdentifier, PluginMetadata, PluginCapabilities, SourceDisplayInfo } from './types'
import { JobData } from '../types'
import { saveChangedTus } from '../utils/saveHandler'

/**
 * Local file plugin for uploading and downloading .lqaboss files
 * This is the default plugin that works without any authentication
 *
 * Supports loading companion .json files with saved changes:
 * - Select both .lqaboss and .json files with matching names
 * - The .json file will be loaded as auto-save data
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

  // Store companion .json file for auto-save data
  private companionJsonFile: File | null = null

  /**
   * Load a file from local device
   * If identifier.file is provided, use it directly
   * Otherwise, trigger file picker dialog
   * Supports selecting both .lqaboss and .json files
   */
  async loadFile(identifier: FileIdentifier): Promise<File> {
    // If we have a File object already (e.g., from PWA launch), use it
    if (identifier.file instanceof File) {
      return identifier.file
    }

    // Otherwise, trigger file picker (allow multiple files)
    return new Promise((resolve, reject) => {
      const input = document.createElement('input')
      input.type = 'file'
      input.accept = '.lqaboss,.json'
      input.multiple = true // Allow selecting both files
      input.onchange = async (e) => {
        const files = (e.target as HTMLInputElement).files
        if (!files || files.length === 0) {
          reject(new Error('No file selected'))
          return
        }

        // Find .lqaboss and .json files
        let lqabossFile: File | null = null
        let jsonFile: File | null = null

        for (let i = 0; i < files.length; i++) {
          const file = files[i]
          if (file.name.endsWith('.lqaboss')) {
            lqabossFile = file
          } else if (file.name.endsWith('.json')) {
            jsonFile = file
          }
        }

        if (!lqabossFile) {
          reject(new Error('No .lqaboss file selected'))
          return
        }

        // Store companion .json file if jobGuids match
        if (jsonFile) {
          try {
            // Extract jobGuid from .lqaboss file
            const JSZip = (await import('jszip')).default
            const lqabossBuffer = await lqabossFile.arrayBuffer()
            const zip = await JSZip.loadAsync(lqabossBuffer)
            const jobFile = zip.file('job.json')

            if (jobFile) {
              const jobContent = await jobFile.async('string')
              const jobData = JSON.parse(jobContent)
              const lqabossGuid = jobData.jobGuid

              // Extract jobGuid from .json file
              const jsonContent = await jsonFile.text()
              const jsonData = JSON.parse(jsonContent)
              const jsonGuid = jsonData.jobGuid

              if (lqabossGuid && jsonGuid && lqabossGuid === jsonGuid) {
                this.companionJsonFile = jsonFile
                console.log(`Loaded companion .json file: ${jsonFile.name} (jobGuid: ${jsonGuid})`)
              } else {
                console.warn(`JSON file jobGuid "${jsonGuid}" doesn't match .lqaboss jobGuid "${lqabossGuid}"`)
              }
            }
          } catch (error) {
            console.error('Error validating companion .json file:', error)
          }
        }

        resolve(lqabossFile)
      }
      input.click()
    })
  }

  /**
   * Load auto-save data from companion .json file
   */
  async loadAutoSaveData(_identifier: FileIdentifier, _filename: string): Promise<JobData | null> {
    if (!this.companionJsonFile) {
      return null
    }

    try {
      const content = await this.companionJsonFile.text()
      const data = JSON.parse(content) as JobData

      // Clear the companion file after loading
      this.companionJsonFile = null

      return data
    } catch (error) {
      console.error('Error loading companion .json file:', error)
      this.companionJsonFile = null
      return null
    }
  }

  /**
   * Save file to local device (download)
   * Downloads changed translations as .json
   * The .lqaboss file is immutable - only download if it doesn't exist locally
   */
  async saveFile(identifier: FileIdentifier, data: JobData): Promise<void> {
    const { fileName, originalJobData, zipFile } = identifier

    if (!fileName || !originalJobData) {
      throw new Error('fileName and originalJobData are required for local save')
    }

    // Save the .json file with changed translations
    saveChangedTus(data, originalJobData, fileName)

    // The .lqaboss file is immutable - if user loaded from a .lqaboss file,
    // they already have it locally, so don't download again
    const lqabossExists = fileName.endsWith('.lqaboss')

    if (zipFile && !lqabossExists) {
      const baseFilename = fileName.replace('.json', '')
      const lqabossFilename = `${baseFilename}.lqaboss`

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

  /**
   * Get source display info for InfoModal
   */
  getSourceDisplayInfo(identifier: FileIdentifier): SourceDisplayInfo | null {
    const filename = identifier.fileName || identifier.filename
    if (!filename) return null

    return {
      pluginName: this.metadata.name,
      locationLabel: 'Local Device',
      filename
    }
  }
}
