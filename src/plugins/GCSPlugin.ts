import {
  IPersistencePlugin,
  FileIdentifier,
  FileInfo,
  AuthState,
  PluginMetadata,
  PluginCapabilities,
  LocationPromptProps
} from './types'
import { JobData, TranslationUnit } from '../types'
import { GCSOperations, GCSFile } from '../utils/gcsOperations'
import { isEqual } from 'lodash'
import React from 'react'
import { GCSLocationPrompt } from '../components/prompts/GCSLocationPrompt'

/**
 * Google Cloud Storage plugin for loading and saving files from GCS buckets
 */
export class GCSPlugin implements IPersistencePlugin {
  private gcsOps: GCSOperations
  private authState: AuthState = { isAuthenticated: false }
  private accessToken: string = ''
  private clientId: string = ''

  readonly metadata: PluginMetadata = {
    id: 'gcs',
    name: 'Google Cloud Storage',
    description: 'Load and save files from GCS buckets',
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
    this.gcsOps = new GCSOperations({
      onTokenExpired: () => this.handleTokenExpiry()
    })

    // Restore saved credentials from localStorage
    this.loadSavedCredentials()
  }

  private loadSavedCredentials(): void {
    const savedClientId = localStorage.getItem('gcs-client-id')
    const savedAccessToken = localStorage.getItem('gcs-access-token')
    const tokenExpiry = localStorage.getItem('gcs-token-expiry')

    if (savedClientId) {
      this.clientId = savedClientId
    }

    // Check if saved token is still valid
    if (savedAccessToken && tokenExpiry) {
      const expiryTime = parseInt(tokenExpiry)
      const now = Date.now()

      if (now < expiryTime) {
        this.accessToken = savedAccessToken
        this.authState = {
          isAuthenticated: true,
          expiresAt: new Date(expiryTime)
        }
        console.log('Using saved GCS access token')
      } else {
        // Token expired, clean up
        this.clearStoredCredentials()
        console.log('Saved GCS token expired, removed from storage')
      }
    }
  }

  private clearStoredCredentials(): void {
    localStorage.removeItem('gcs-access-token')
    localStorage.removeItem('gcs-token-expiry')
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
    localStorage.setItem('gcs-client-id', clientId)
  }

  /**
   * Get current client ID
   */
  getClientId(): string {
    return this.clientId
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
          scope: 'https://www.googleapis.com/auth/devstorage.read_write',
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
              localStorage.setItem('gcs-access-token', response.access_token)
              localStorage.setItem('gcs-token-expiry', expiryTime.toString())

              console.log('GCS OAuth2 authentication successful')
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
    console.log('Signed out from GCS')
  }

  /**
   * Load a file from GCS
   * Identifier must contain: { bucket, prefix, filename }
   */
  async loadFile(identifier: FileIdentifier): Promise<File> {
    const { bucket, prefix, filename } = identifier

    if (!bucket || !prefix || !filename) {
      throw new Error('bucket, prefix, and filename are required for GCS load')
    }

    if (!this.accessToken) {
      throw new Error('Not authenticated. Please sign in to GCS.')
    }

    return await this.gcsOps.loadFile(bucket, prefix, filename, this.accessToken)
  }

  /**
   * Save a file to GCS
   * Saves only changed translation units as .json
   * If zipFile is present, also saves the original .lqaboss file
   * Identifier must contain: { bucket, prefix, filename, originalJobData }
   * Identifier may contain: { zipFile } for saving the complete .lqaboss archive
   */
  async saveFile(identifier: FileIdentifier, data: JobData): Promise<void> {
    const { bucket, prefix, filename, originalJobData, zipFile } = identifier

    if (!bucket || !prefix || !filename) {
      throw new Error('bucket, prefix, and filename are required for GCS save')
    }

    if (!this.accessToken) {
      throw new Error('Not authenticated. Please sign in to GCS.')
    }

    if (!originalJobData) {
      throw new Error('originalJobData is required for GCS save')
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
      tus: changedTus,
    }

    // Ensure filename has .json extension (strip .lqaboss if present)
    // This ensures we save companion .json files for .lqaboss archives
    const baseFilename = filename.replace('.lqaboss', '')
    const jsonFilename = baseFilename.endsWith('.json') ? baseFilename : `${baseFilename}.json`

    // Save the .json file with changed translations
    await this.gcsOps.saveFile(bucket, prefix, jsonFilename, outputData, this.accessToken)

    // If we have the original ZIP file, also save the .lqaboss file
    if (zipFile) {
      const lqabossFilename = baseFilename.endsWith('.lqaboss') ? baseFilename : `${baseFilename}.lqaboss`

      // Convert JSZip to blob
      const zipBlob = await zipFile.generateAsync({ type: 'blob' })

      // Save the .lqaboss file
      await this.gcsOps.saveBlobFile(bucket, prefix, lqabossFilename, zipBlob, this.accessToken)

      console.log(`Saved both ${lqabossFilename} and ${jsonFilename} to GCS`)
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

    const { bucket, prefix } = identifier

    if (!bucket || !prefix) {
      console.log('GCS auto-save: Missing bucket or prefix in identifier')
      return null
    }

    if (!this.accessToken) {
      console.log('GCS auto-save: No access token available')
      return null
    }

    const jobId = filename.replace('.lqaboss', '')
    const jsonFilename = `${jobId}.json`

    try {
      // Ensure all required fields are present in the identifier
      const jsonFileId: FileIdentifier = {
        bucket,
        prefix,
        filename: jsonFilename
      }

      const jsonFile = await this.loadFile(jsonFileId)

      const jsonContent = await jsonFile.text()
      const savedJobData = JSON.parse(jsonContent)

      console.log(`Loaded saved translations from ${jsonFilename}`)
      return savedJobData
    } catch (error: any) {
      // 404 errors are expected when there are no saved translations
      if (error.message?.includes('404') || error.message?.includes('not found')) {
        console.log(`No saved translations found for ${filename} (this is normal for new files)`)
      } else {
        console.error(`Error loading saved translations: ${error.message || error}`)
      }
      return null
    }
  }

  /**
   * List files in a GCS bucket/prefix
   * Location format: "bucket/prefix" or just provide bucket and prefix separately
   */
  async listFiles(location?: string): Promise<FileInfo[]> {
    if (!this.accessToken) {
      throw new Error('Not authenticated. Please sign in to GCS.')
    }

    let bucket: string
    let prefix: string

    if (location) {
      const parts = location.split('/')
      bucket = parts[0]
      prefix = parts.slice(1).join('/')
    } else {
      throw new Error('Location (bucket/prefix) is required for listing GCS files')
    }

    const files = await this.gcsOps.listFiles(bucket, prefix, this.accessToken)

    return files.map((f: GCSFile) => ({
      name: f.name,
      displayName: f.name,
      identifier: { bucket, prefix, filename: f.name },
      size: f.size,
      updated: f.updated
    }))
  }

  /**
   * Parse URL parameters to extract GCS file identifier
   * Supports both old format (/gcs/:bucket/:prefix/:filename) and new format (?plugin=gcs&bucket=...&prefix=...&file=...)
   */
  parseUrl(params: URLSearchParams): FileIdentifier | null {
    // New query param format
    const bucket = params.get('bucket')
    const prefix = params.get('prefix')
    // Support both 'filename' and 'file' parameters for compatibility
    const filename = params.get('filename') || params.get('file')

    if (bucket && prefix) {
      return {
        bucket: decodeURIComponent(bucket),
        prefix: decodeURIComponent(prefix),
        filename: filename ? decodeURIComponent(filename) : undefined
      }
    }

    return null
  }

  /**
   * Build a shareable URL for a GCS file
   * Uses query parameter format for consistency
   */
  buildUrl(identifier: FileIdentifier): string {
    const params = new URLSearchParams()
    params.set('plugin', 'gcs')

    if (identifier.bucket) {
      params.set('bucket', identifier.bucket)
    }
    if (identifier.prefix) {
      params.set('prefix', identifier.prefix)
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
      clientId: this.clientId
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

    if (!identifier.bucket) missing.push('bucket')
    if (!identifier.prefix) missing.push('prefix')

    if (operation === 'save' && !identifier.filename) {
      missing.push('filename')
    }

    return {
      valid: missing.length === 0,
      missing: missing.length > 0 ? missing : undefined
    }
  }

  /**
   * Parse path-based URL segments
   * Format: /gcs/bucket/prefix/filename
   */
  parsePathUrl(pathSegments: string[]): FileIdentifier | null {
    if (pathSegments.length < 3) {
      return null
    }

    const bucket = decodeURIComponent(pathSegments[1])
    const prefix = decodeURIComponent(pathSegments[2])
    const filename = pathSegments[3] ? decodeURIComponent(pathSegments[3]) : undefined

    return {
      bucket,
      prefix,
      filename
    }
  }

  /**
   * Location prompt component for collecting GCS parameters
   */
  LocationPromptComponent: React.FC<LocationPromptProps> = ({ currentIdentifier, fileName, operation, onSubmit, onCancel }) => {
    // Load last used bucket/prefix from localStorage if not provided
    const bucket = currentIdentifier?.bucket || localStorage.getItem('gcs-last-bucket') || ''
    const prefix = currentIdentifier?.prefix || localStorage.getItem('gcs-last-prefix') || ''

    return React.createElement(GCSLocationPrompt, {
      currentBucket: bucket,
      currentPrefix: prefix,
      currentFilename: fileName,
      operation,
      onSubmit: (bucket: string, prefix: string, filename?: string) => {
        onSubmit({ bucket, prefix, filename })
      },
      onCancel
    })
  }
}
