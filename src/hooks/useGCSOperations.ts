import { useState, useCallback, useMemo } from 'react'
import { useGCSAuth } from './useGCSAuth'
import { GCSOperations, GCSFile } from '../utils/gcsOperations'
import { GCSModeConfig } from '../utils/gcsUrlParser'

interface UseGCSOperationsReturn {
  // Auth state
  isAuthenticated: boolean
  accessToken: string
  clientId: string
  
  // Operations
  initializeAuth: (onSuccess?: (token: string) => Promise<void>) => Promise<void>
  signOut: () => void
  loadFile: (bucket: string, prefix: string, filename: string) => Promise<File>
  saveFile: (bucket: string, prefix: string, filename: string, data: any) => Promise<string>
  listFiles: (bucket: string, prefix: string) => Promise<GCSFile[]>
  
  // File picker state
  showFilePicker: boolean
  files: GCSFile[]
  setShowFilePicker: (show: boolean) => void
  setFiles: (files: GCSFile[]) => void
  
  // Convenience methods
  loadFileFromMode: (mode: GCSModeConfig) => Promise<File | null>
  saveFileToMode: (mode: GCSModeConfig, filename: string, data: any) => Promise<string | null>
  loadFileListForMode: (mode: GCSModeConfig) => Promise<void>
}

export const useGCSOperations = (): UseGCSOperationsReturn => {
  const auth = useGCSAuth()
  const [showFilePicker, setShowFilePicker] = useState(false)
  const [files, setFiles] = useState<GCSFile[]>([])

  // Create GCS operations instance with token expiry handler
  const gcsOps = useMemo(() => new GCSOperations({
    onTokenExpired: () => {
      auth.setAccessToken('')
      auth.setIsAuthenticated(false)
    }
  }), [auth])

  const loadFile = useCallback(async (bucket: string, prefix: string, filename: string): Promise<File> => {
    if (!auth.accessToken) {
      throw new Error('No access token available for GCS operation')
    }
    return await gcsOps.loadFile(bucket, prefix, filename, auth.accessToken)
  }, [auth.accessToken, gcsOps])

  const saveFile = useCallback(async (bucket: string, prefix: string, filename: string, data: any): Promise<string> => {
    if (!auth.accessToken) {
      throw new Error('No access token available for GCS operation')
    }
    return await gcsOps.saveFile(bucket, prefix, filename, data, auth.accessToken)
  }, [auth.accessToken, gcsOps])

  const listFiles = useCallback(async (bucket: string, prefix: string): Promise<GCSFile[]> => {
    if (!auth.accessToken) {
      throw new Error('No access token available for GCS operation')
    }
    return await gcsOps.listFiles(bucket, prefix, auth.accessToken)
  }, [auth.accessToken, gcsOps])

  // Convenience methods that work with GCSModeConfig
  const loadFileFromMode = useCallback(async (mode: GCSModeConfig): Promise<File | null> => {
    if (!mode.filename) return null
    try {
      return await loadFile(mode.bucket, mode.prefix, mode.filename)
    } catch (error) {
      console.error('Error loading file from GCS mode:', error)
      return null
    }
  }, [loadFile])

  const saveFileToMode = useCallback(async (mode: GCSModeConfig, filename: string, data: any): Promise<string | null> => {
    try {
      return await saveFile(mode.bucket, mode.prefix, filename, data)
    } catch (error) {
      console.error('Error saving file to GCS mode:', error)
      return null
    }
  }, [saveFile])

  const loadFileListForMode = useCallback(async (mode: GCSModeConfig): Promise<void> => {
    try {
      const fileList = await listFiles(mode.bucket, mode.prefix)
      setFiles(fileList)
      setShowFilePicker(true)
    } catch (error) {
      console.error('Error loading file list for GCS mode:', error)
      setFiles([])
    }
  }, [listFiles])

  return {
    // Auth state
    isAuthenticated: auth.isAuthenticated,
    accessToken: auth.accessToken,
    clientId: auth.clientId,
    
    // Operations
    initializeAuth: auth.initializeAuth,
    signOut: auth.signOut,
    loadFile,
    saveFile,
    listFiles,
    
    // File picker state
    showFilePicker,
    files,
    setShowFilePicker,
    setFiles,
    
    // Convenience methods
    loadFileFromMode,
    saveFileToMode,
    loadFileListForMode
  }
}