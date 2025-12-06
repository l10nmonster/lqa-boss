export interface GDriveFile {
  id: string
  name: string
  mimeType: string
  size?: string
  modifiedTime?: string
  parents?: string[]
}

export interface GDriveFolder {
  id: string
  name: string
  path?: string
}

export interface GDriveOperationsOptions {
  onTokenExpired?: () => void
}

const DRIVE_API_BASE = 'https://www.googleapis.com/drive/v3'
const DRIVE_UPLOAD_BASE = 'https://www.googleapis.com/upload/drive/v3'
const FOLDER_MIME_TYPE = 'application/vnd.google-apps.folder'

export class GDriveOperations {
  constructor(private options: GDriveOperationsOptions = {}) {}

  private handleTokenExpiry(error: any): void {
    if (error.message?.includes('401') || error.message?.includes('Authentication expired')) {
      console.log('Google Drive token expired, clearing stored credentials')
      localStorage.removeItem('gdrive-access-token')
      localStorage.removeItem('gdrive-token-expiry')
      this.options.onTokenExpired?.()
    }
  }

  /**
   * Load a file from Google Drive by file ID
   */
  async loadFile(fileId: string, token: string): Promise<File> {
    try {
      // First get file metadata to know the filename
      const metadataResponse = await fetch(
        `${DRIVE_API_BASE}/files/${fileId}?fields=name,mimeType,size`,
        {
          headers: { 'Authorization': `Bearer ${token}` }
        }
      )

      if (!metadataResponse.ok) {
        if (metadataResponse.status === 401) {
          throw new Error('Authentication expired. Please sign in again.')
        }
        if (metadataResponse.status === 404) {
          throw new Error(`File not found: 404`)
        }
        throw new Error(`Failed to get file metadata: ${metadataResponse.status} ${metadataResponse.statusText}`)
      }

      const metadata = await metadataResponse.json()

      // Download the file content
      const response = await fetch(
        `${DRIVE_API_BASE}/files/${fileId}?alt=media`,
        {
          headers: { 'Authorization': `Bearer ${token}` }
        }
      )

      if (!response.ok) {
        if (response.status === 401) {
          throw new Error('Authentication expired. Please sign in again.')
        }
        throw new Error(`Failed to download file: ${response.status} ${response.statusText}`)
      }

      const arrayBuffer = await response.arrayBuffer()
      const file = new File([arrayBuffer], metadata.name, { type: metadata.mimeType || 'application/octet-stream' })

      console.log(`Successfully loaded ${metadata.name} from Google Drive`)
      return file
    } catch (error: any) {
      if (!error.message?.includes('404')) {
        console.error('Error loading file from Google Drive:', error)
      }
      this.handleTokenExpiry(error)
      throw error
    }
  }

  /**
   * Save JSON data to Google Drive
   * If fileId is provided, updates existing file; otherwise creates new file in folderId
   */
  async saveFile(
    folderId: string,
    filename: string,
    data: any,
    token: string,
    existingFileId?: string
  ): Promise<string> {
    try {
      const jsonString = JSON.stringify(data, null, 2)
      const blob = new Blob([jsonString], { type: 'application/json' })

      if (existingFileId) {
        // Update existing file
        const response = await fetch(
          `${DRIVE_UPLOAD_BASE}/files/${existingFileId}?uploadType=media`,
          {
            method: 'PATCH',
            headers: {
              'Authorization': `Bearer ${token}`,
              'Content-Type': 'application/json'
            },
            body: blob
          }
        )

        if (!response.ok) {
          if (response.status === 401) {
            throw new Error('Authentication expired. Please sign in again.')
          }
          throw new Error(`Failed to update file: ${response.status} ${response.statusText}`)
        }

        const result = await response.json()
        console.log(`Successfully updated ${filename} in Google Drive`)
        return result.id
      } else {
        // Create new file using multipart upload
        const metadata = {
          name: filename,
          parents: [folderId],
          mimeType: 'application/json'
        }

        const form = new FormData()
        form.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }))
        form.append('file', blob)

        const response = await fetch(
          `${DRIVE_UPLOAD_BASE}/files?uploadType=multipart&fields=id,name`,
          {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${token}`
            },
            body: form
          }
        )

        if (!response.ok) {
          if (response.status === 401) {
            throw new Error('Authentication expired. Please sign in again.')
          }
          throw new Error(`Failed to create file: ${response.status} ${response.statusText}`)
        }

        const result = await response.json()
        console.log(`Successfully created ${filename} in Google Drive`)
        return result.id
      }
    } catch (error: any) {
      console.error('Error saving file to Google Drive:', error)
      this.handleTokenExpiry(error)
      throw error
    }
  }

  /**
   * Save a blob file to Google Drive (for .lqaboss ZIP files)
   */
  async saveBlobFile(
    folderId: string,
    filename: string,
    blob: Blob,
    token: string,
    existingFileId?: string
  ): Promise<string> {
    try {
      if (existingFileId) {
        // Update existing file
        const response = await fetch(
          `${DRIVE_UPLOAD_BASE}/files/${existingFileId}?uploadType=media`,
          {
            method: 'PATCH',
            headers: {
              'Authorization': `Bearer ${token}`,
              'Content-Type': 'application/octet-stream'
            },
            body: blob
          }
        )

        if (!response.ok) {
          if (response.status === 401) {
            throw new Error('Authentication expired. Please sign in again.')
          }
          throw new Error(`Failed to update blob file: ${response.status} ${response.statusText}`)
        }

        const result = await response.json()
        console.log(`Successfully updated ${filename} in Google Drive`)
        return result.id
      } else {
        // Create new file using multipart upload
        const metadata = {
          name: filename,
          parents: [folderId],
          mimeType: 'application/octet-stream'
        }

        const form = new FormData()
        form.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }))
        form.append('file', blob)

        const response = await fetch(
          `${DRIVE_UPLOAD_BASE}/files?uploadType=multipart&fields=id,name`,
          {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${token}`
            },
            body: form
          }
        )

        if (!response.ok) {
          if (response.status === 401) {
            throw new Error('Authentication expired. Please sign in again.')
          }
          throw new Error(`Failed to create blob file: ${response.status} ${response.statusText}`)
        }

        const result = await response.json()
        console.log(`Successfully created ${filename} in Google Drive`)
        return result.id
      }
    } catch (error: any) {
      console.error('Error saving blob file to Google Drive:', error)
      this.handleTokenExpiry(error)
      throw error
    }
  }

  /**
   * List files in a Google Drive folder
   */
  async listFiles(folderId: string, token: string): Promise<GDriveFile[]> {
    try {
      const query = `'${folderId}' in parents and trashed = false`
      // Include shared drives and items shared with user
      const url = `${DRIVE_API_BASE}/files?q=${encodeURIComponent(query)}&fields=files(id,name,mimeType,size,modifiedTime,parents)&orderBy=modifiedTime desc&supportsAllDrives=true&includeItemsFromAllDrives=true`

      const response = await fetch(url, {
        headers: { 'Authorization': `Bearer ${token}` }
      })

      if (!response.ok) {
        if (response.status === 401) {
          throw new Error('Authentication expired. Please sign in again.')
        }
        throw new Error(`Failed to list files: ${response.status} ${response.statusText}`)
      }

      const result = await response.json()
      return result.files || []
    } catch (error: any) {
      console.error('Error listing Google Drive files:', error)
      this.handleTokenExpiry(error)
      throw error
    }
  }

  /**
   * Find a file by name in a folder
   */
  async findFileByName(folderId: string, filename: string, token: string): Promise<GDriveFile | null> {
    try {
      const query = `'${folderId}' in parents and name = '${filename}' and trashed = false`
      const url = `${DRIVE_API_BASE}/files?q=${encodeURIComponent(query)}&fields=files(id,name,mimeType,size,modifiedTime,parents)`

      const response = await fetch(url, {
        headers: { 'Authorization': `Bearer ${token}` }
      })

      if (!response.ok) {
        if (response.status === 401) {
          throw new Error('Authentication expired. Please sign in again.')
        }
        throw new Error(`Failed to find file: ${response.status} ${response.statusText}`)
      }

      const result = await response.json()
      return result.files?.[0] || null
    } catch (error: any) {
      console.error('Error finding file in Google Drive:', error)
      this.handleTokenExpiry(error)
      throw error
    }
  }

  /**
   * Get folder path (breadcrumb)
   * Note: This may fail for shared folders you don't own - that's okay, we'll return partial path
   */
  async getFolderPath(folderId: string, token: string): Promise<GDriveFolder[]> {
    // For root, return empty path
    if (folderId === 'root') {
      return []
    }

    const path: GDriveFolder[] = []
    let currentId = folderId

    try {
      while (currentId && currentId !== 'root') {
        const response = await fetch(
          `${DRIVE_API_BASE}/files/${currentId}?fields=id,name,parents`,
          {
            headers: { 'Authorization': `Bearer ${token}` }
          }
        )

        if (!response.ok) {
          // Can't access this folder's metadata (e.g., shared folder we don't own)
          // Use the folder ID as a fallback name if we have no path yet
          if (path.length === 0) {
            path.unshift({ id: currentId, name: 'Shared Folder' })
          }
          break
        }

        const folder = await response.json()
        path.unshift({ id: folder.id, name: folder.name })

        // Stop at root or if no parent
        if (!folder.parents || folder.parents.length === 0) {
          break
        }
        currentId = folder.parents[0]
      }
    } catch (error) {
      console.error('Error getting folder path:', error)
      // Return what we have so far
      if (path.length === 0) {
        path.unshift({ id: folderId, name: 'Shared Folder' })
      }
    }

    return path
  }

  /**
   * List folders in a folder (for navigation)
   */
  async listFolders(folderId: string, token: string): Promise<GDriveFolder[]> {
    try {
      const query = `'${folderId}' in parents and mimeType = '${FOLDER_MIME_TYPE}' and trashed = false`
      // Include shared drives and items shared with user
      const url = `${DRIVE_API_BASE}/files?q=${encodeURIComponent(query)}&fields=files(id,name)&orderBy=name&supportsAllDrives=true&includeItemsFromAllDrives=true`

      const response = await fetch(url, {
        headers: { 'Authorization': `Bearer ${token}` }
      })

      if (!response.ok) {
        if (response.status === 401) {
          throw new Error('Authentication expired. Please sign in again.')
        }
        throw new Error(`Failed to list folders: ${response.status} ${response.statusText}`)
      }

      const result = await response.json()
      return result.files || []
    } catch (error: any) {
      console.error('Error listing Google Drive folders:', error)
      this.handleTokenExpiry(error)
      throw error
    }
  }
}
