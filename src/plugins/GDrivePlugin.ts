import {
  IPersistencePlugin,
  FileIdentifier,
  FileInfo,
  AuthState,
  PluginMetadata,
  PluginCapabilities,
  LocationPromptProps,
  PluginSetting,
  SourceDisplayInfo
} from './types'
import { JobData, TranslationUnit } from '../types'
import { GDriveOperations, GDriveFile } from '../utils/gdriveOperations'
import { isEqual } from 'lodash'
import React from 'react'
import { GDriveLocationPrompt } from '../components/prompts/GDriveLocationPrompt'

/**
 * Google Drive plugin for loading and saving files from Google Drive
 */
export class GDrivePlugin implements IPersistencePlugin {
  private gdriveOps: GDriveOperations
  private authState: AuthState = { isAuthenticated: false }
  private accessToken: string = ''
  private clientId: string = ''

  readonly metadata: PluginMetadata = {
    id: 'gdrive',
    name: 'Google Drive',
    description: 'Load and save files from Google Drive',
    icon: 'cloud',
    version: '1.0.0'
  }

  readonly capabilities: PluginCapabilities = {
    canLoad: true,
    canSave: true,
    canList: true,
    requiresAuth: true
  }

  constructor() {
    this.gdriveOps = new GDriveOperations({
      onTokenExpired: () => this.handleTokenExpiry()
    })

    // Restore saved credentials from localStorage
    this.loadSavedCredentials()
  }

  private loadSavedCredentials(): void {
    // Load from settings system keys
    const savedClientId = localStorage.getItem('plugin-gdrive-clientId')
    const savedAccessToken = localStorage.getItem('gdrive-access-token')
    const tokenExpiry = localStorage.getItem('gdrive-token-expiry')

    if (savedClientId) {
      this.clientId = savedClientId
    }

    // Check if saved OAuth token is still valid
    if (savedAccessToken && tokenExpiry) {
      const expiryTime = parseInt(tokenExpiry)
      const now = Date.now()

      if (now < expiryTime) {
        this.accessToken = savedAccessToken
        this.authState = {
          isAuthenticated: true,
          expiresAt: new Date(expiryTime)
        }
        console.log('Using saved Google Drive access token')
      } else {
        // Token expired, clean up
        this.clearStoredCredentials()
        console.log('Saved Google Drive token expired, removed from storage')
      }
    }
  }

  private clearStoredCredentials(): void {
    localStorage.removeItem('gdrive-access-token')
    localStorage.removeItem('gdrive-token-expiry')
  }

  private handleTokenExpiry(): void {
    this.clearStoredCredentials()
    this.accessToken = ''
    this.authState = { isAuthenticated: false }
  }

  /**
   * Get current authentication state
   */
  getAuthState(): AuthState {
    return this.authState
  }

  /**
   * Set client ID (required before authentication)
   */
  setClientId(clientId: string): void {
    this.clientId = clientId
    localStorage.setItem('plugin-gdrive-clientId', clientId)
  }

  /**
   * Get current client ID
   */
  getClientId(): string {
    return this.clientId
  }

  /**
   * Get access token (for location prompt and operations)
   */
  getAccessToken(): string {
    return this.accessToken
  }

  /**
   * Authenticate with Google OAuth2
   */
  async authenticate(): Promise<void> {
    if (!(window as any).google?.accounts?.oauth2) {
      throw new Error('Google Identity Services not loaded. Please refresh the page.')
    }

    if (!this.clientId) {
      throw new Error('Client ID required. Please set client ID first.')
    }

    return new Promise((resolve, reject) => {
      try {
        const tokenClient = (window as any).google.accounts.oauth2.initTokenClient({
          client_id: this.clientId,
          // Use full drive scope to access shared folders and files
          scope: 'https://www.googleapis.com/auth/drive',
          callback: (response: any) => {
            if (response.access_token) {
              this.accessToken = response.access_token

              // Calculate expiry time
              const expiryTime = Date.now() + (response.expires_in || 3600) * 1000
              this.authState = {
                isAuthenticated: true,
                expiresAt: new Date(expiryTime)
              }

              // Save token to localStorage
              localStorage.setItem('gdrive-access-token', response.access_token)
              localStorage.setItem('gdrive-token-expiry', expiryTime.toString())

              console.log('Google Drive OAuth2 authentication successful')
              resolve()
            } else {
              reject(new Error(`Authentication failed: ${response.error || 'Unknown error'}`))
            }
          }
        })

        tokenClient.requestAccessToken()
      } catch (error: any) {
        reject(new Error(`OAuth2 Error: ${error.message}`))
      }
    })
  }

  /**
   * Sign out and clear stored credentials
   */
  async signOut(): Promise<void> {
    if (this.accessToken && (window as any).google?.accounts?.oauth2) {
      (window as any).google.accounts.oauth2.revoke(this.accessToken)
    }

    this.clearStoredCredentials()
    this.accessToken = ''
    this.authState = { isAuthenticated: false }
    console.log('Signed out from Google Drive')
  }

  /**
   * Load a file from Google Drive
   * Identifier must contain: { fileId } or { folderId, filename }
   */
  async loadFile(identifier: FileIdentifier): Promise<File> {
    const { fileId, folderId, filename } = identifier

    if (!this.accessToken) {
      throw new Error('Not authenticated. Please sign in to Google Drive.')
    }

    // If we have a fileId, load directly
    if (fileId) {
      return await this.gdriveOps.loadFile(fileId, this.accessToken)
    }

    // If we have folderId and filename, find the file first
    if (folderId && filename) {
      const file = await this.gdriveOps.findFileByName(folderId, filename, this.accessToken)
      if (!file) {
        throw new Error(`File not found: ${filename}`)
      }
      return await this.gdriveOps.loadFile(file.id, this.accessToken)
    }

    throw new Error('fileId or (folderId and filename) are required for Google Drive load')
  }

  /**
   * Save a file to Google Drive
   * Saves only changed translation units as .json
   * If zipFile is present, also saves the original .lqaboss file
   */
  async saveFile(identifier: FileIdentifier, data: JobData): Promise<void> {
    const { folderId, filename, originalJobData, zipFile, jsonFileId, lqabossFileId, fileId } = identifier

    if (!folderId || !filename) {
      throw new Error('folderId and filename are required for Google Drive save')
    }

    // Use the original file ID for .lqaboss updates if lqabossFileId isn't set
    // This happens when the file was loaded directly (fileId is the loaded file's ID)
    const effectiveLqabossFileId = lqabossFileId || (filename.endsWith('.lqaboss') ? fileId : undefined)

    if (!this.accessToken) {
      throw new Error('Not authenticated. Please sign in to Google Drive.')
    }

    if (!originalJobData) {
      throw new Error('originalJobData is required for Google Drive save')
    }

    // Extract only changed TUs
    const originalTus = new Map<string, TranslationUnit>(originalJobData.tus.map((tu: TranslationUnit) => [tu.guid, tu]))
    const changedTus = data.tus.filter(currentTu => {
      const originalTu = originalTus.get(currentTu.guid)
      if (!originalTu) return true
      return !isEqual(currentTu.ntgt, originalTu.ntgt)
    })

    const outputData = {
      ...data,
      tus: changedTus.map(tu => {
        // If providerData.quality exists, use it to populate q
        if (data.providerData?.quality !== undefined) {
          return {
            ...tu,
            q: data.providerData.quality
          }
        }
        return tu
      }),
      updatedAt: new Date().toISOString(),
    }

    // Ensure filename has .json extension
    const baseFilename = filename.replace('.lqaboss', '').replace('.json', '')
    const jsonFilename = `${baseFilename}.json`

    // Save the .json file with changed translations
    const newJsonFileId = await this.gdriveOps.saveFile(
      folderId,
      jsonFilename,
      outputData,
      this.accessToken,
      jsonFileId
    )

    // Store the file ID for future saves
    if (!jsonFileId) {
      identifier.jsonFileId = newJsonFileId
    }

    // If we have the original ZIP file and no .lqaboss exists yet, save it
    // The .lqaboss file is immutable - only create it once, never update
    if (zipFile && !effectiveLqabossFileId) {
      const lqabossFilename = `${baseFilename}.lqaboss`

      // Convert JSZip to blob
      const zipBlob = await zipFile.generateAsync({ type: 'blob' })

      // Save the .lqaboss file (create new only)
      const newLqabossFileId = await this.gdriveOps.saveBlobFile(
        folderId,
        lqabossFilename,
        zipBlob,
        this.accessToken,
        undefined // Always create new, never update
      )

      // Store the file ID for future reference
      identifier.lqabossFileId = newLqabossFileId

      console.log(`Saved both ${lqabossFilename} and ${jsonFilename} to Google Drive`)
    } else {
      console.log(`Saved ${jsonFilename} to Google Drive`)
    }
  }

  /**
   * Load auto-save data for a .lqaboss file
   * Looks for a companion .json file with saved translations
   */
  async loadAutoSaveData(identifier: FileIdentifier, filename: string): Promise<JobData | null> {
    // Only applies to .lqaboss files
    if (!filename.endsWith('.lqaboss')) {
      return null
    }

    const { folderId } = identifier

    if (!folderId) {
      console.log('Google Drive auto-save: Missing folderId in identifier')
      return null
    }

    if (!this.accessToken) {
      console.log('Google Drive auto-save: No access token available')
      return null
    }

    const jobId = filename.replace('.lqaboss', '')
    const jsonFilename = `${jobId}.json`

    try {
      const jsonFile = await this.gdriveOps.findFileByName(folderId, jsonFilename, this.accessToken)

      if (!jsonFile) {
        console.log(`No saved translations found for ${filename} (this is normal for new files)`)
        return null
      }

      // Store the file ID for future updates
      identifier.jsonFileId = jsonFile.id

      const file = await this.gdriveOps.loadFile(jsonFile.id, this.accessToken)
      const jsonContent = await file.text()
      const savedJobData = JSON.parse(jsonContent)

      console.log(`Loaded saved translations from ${jsonFilename}`)
      return savedJobData
    } catch (error: any) {
      if (error.message?.includes('404') || error.message?.includes('not found')) {
        console.log(`No saved translations found for ${filename} (this is normal for new files)`)
      } else {
        console.error(`Error loading saved translations: ${error.message || error}`)
      }
      return null
    }
  }

  /**
   * List files in a Google Drive folder
   */
  async listFiles(location?: string): Promise<FileInfo[]> {
    if (!this.accessToken) {
      throw new Error('Not authenticated. Please sign in to Google Drive.')
    }

    const folderId = location || 'root'
    const files = await this.gdriveOps.listFiles(folderId, this.accessToken)

    return files
      .filter((f: GDriveFile) => f.name.endsWith('.lqaboss') || f.name.endsWith('.json'))
      .map((f: GDriveFile) => ({
        name: f.name,
        displayName: f.name,
        identifier: { fileId: f.id, folderId, filename: f.name },
        size: f.size,
        updated: f.modifiedTime
      }))
  }

  /**
   * Parse URL parameters to extract Google Drive file identifier
   */
  parseUrl(params: URLSearchParams): FileIdentifier | null {
    const fileId = params.get('fileId')
    const folderId = params.get('folderId')
    const filename = params.get('filename') || params.get('file')

    if (fileId) {
      return {
        fileId: decodeURIComponent(fileId),
        folderId: folderId ? decodeURIComponent(folderId) : undefined,
        filename: filename ? decodeURIComponent(filename) : undefined
      }
    }

    // Support folder-only URLs (will show file picker after auth)
    if (folderId) {
      return {
        folderId: decodeURIComponent(folderId),
        filename: filename ? decodeURIComponent(filename) : undefined
      }
    }

    return null
  }

  /**
   * Build a shareable URL for a Google Drive file
   */
  buildUrl(identifier: FileIdentifier): string {
    const params = new URLSearchParams()
    params.set('plugin', 'gdrive')

    if (identifier.fileId) {
      params.set('fileId', identifier.fileId)
    }
    if (identifier.folderId) {
      params.set('folderId', identifier.folderId)
    }
    if (identifier.filename) {
      params.set('filename', identifier.filename)
    }

    return `/?${params.toString()}`
  }

  /**
   * Get plugin configuration
   */
  getConfig(): Record<string, any> {
    return {
      clientId: this.clientId,
      defaultFolderId: localStorage.getItem('plugin-gdrive-defaultFolderId') || '',
    }
  }

  /**
   * Set plugin configuration
   */
  async setConfig(config: Record<string, any>): Promise<void> {
    if (config.clientId) {
      this.setClientId(config.clientId)
    }
  }

  /**
   * Get plugin settings definition
   */
  getSettings(): PluginSetting[] {
    return [
      {
        key: 'clientId',
        label: 'Client ID',
        type: 'text',
        placeholder: 'your-client-id.apps.googleusercontent.com',
        description: 'Google OAuth 2.0 Client ID for authentication',
        required: true,
      },
      {
        key: 'defaultFolderId',
        label: 'Default Folder ID',
        type: 'text',
        placeholder: 'Leave empty for root folder',
        description: 'Default Google Drive folder ID to open',
        required: false,
      },
    ]
  }

  /**
   * Check if plugin needs initial setup (client ID)
   */
  needsSetup(): boolean {
    return !this.clientId
  }

  /**
   * Validate if identifier has all required fields for an operation
   */
  validateIdentifier(identifier: FileIdentifier, operation: 'load' | 'save'): { valid: boolean, missing?: string[] } {
    const missing: string[] = []

    if (operation === 'load') {
      // For load, we need either:
      // - fileId (direct file access), OR
      // - folderId (to show file picker for that folder), OR
      // - folderId AND filename (to load specific file from folder)
      if (!identifier.fileId && !identifier.folderId) {
        missing.push('fileId or folderId')
      }
    } else {
      if (!identifier.folderId) missing.push('folderId')
      if (!identifier.filename) missing.push('filename')
    }

    return {
      valid: missing.length === 0,
      missing: missing.length > 0 ? missing : undefined
    }
  }

  /**
   * Location prompt component for collecting Google Drive parameters
   */
  LocationPromptComponent: React.FC<LocationPromptProps> = ({ fileName, operation, onSubmit, onCancel }) => {
    const defaultFolderId = localStorage.getItem('plugin-gdrive-defaultFolderId') || 'root'

    return React.createElement(GDriveLocationPrompt, {
      accessToken: this.accessToken,
      currentFolderId: defaultFolderId,
      currentFilename: fileName,
      operation,
      onSubmit: (folderId: string, _folderName: string, filename?: string) => {
        onSubmit({ folderId, filename })
      },
      onCancel
    })
  }

  /**
   * Get source display info for InfoModal
   */
  getSourceDisplayInfo(identifier: FileIdentifier): SourceDisplayInfo | null {
    if (!identifier.folderId) return null

    const folderName = identifier.folderName || identifier.folderId
    const filename = identifier.filename || identifier.fileName

    return {
      pluginName: this.metadata.name,
      locationLabel: folderName === 'root' ? 'My Drive' : folderName,
      locationUrl: `https://drive.google.com/drive/folders/${identifier.folderId}`,
      filename
    }
  }
}
