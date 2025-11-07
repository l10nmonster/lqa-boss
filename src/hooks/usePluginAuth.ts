import { useState } from 'react'
import { IPersistencePlugin, FileIdentifier } from '../plugins/types'
import { toaster } from '../components/ui/toaster'

export interface UsePluginAuthOptions {
  onAuthComplete?: (plugin: IPersistencePlugin, fileId: FileIdentifier | null) => Promise<void>
}

export function usePluginAuth(options?: UsePluginAuthOptions) {
  const [showAuthPrompt, setShowAuthPrompt] = useState(false)
  const [showClientIdPrompt, setShowClientIdPrompt] = useState(false)
  const [pendingFileId, setPendingFileId] = useState<FileIdentifier | null>(null)
  const [currentPlugin, setCurrentPlugin] = useState<IPersistencePlugin | null>(null)

  /**
   * Check if plugin needs setup or authentication
   * Returns true if auth flow was initiated, false if ready to proceed
   */
  const checkAuthRequired = async (
    plugin: IPersistencePlugin,
    fileId: FileIdentifier
  ): Promise<boolean> => {
    // Check if plugin needs setup (e.g., client ID for GCS)
    if (plugin.needsSetup?.()) {
      setPendingFileId(fileId)
      setCurrentPlugin(plugin)
      setShowClientIdPrompt(true)
      return true
    }

    // Check if auth is required
    if (plugin.capabilities.requiresAuth && !plugin.getAuthState?.().isAuthenticated) {
      setPendingFileId(fileId)
      setCurrentPlugin(plugin)
      setShowAuthPrompt(true)
      return true
    }

    return false
  }

  /**
   * Handle auth prompt acceptance
   */
  const handleAuthPromptAccept = async () => {
    if (!currentPlugin) return

    // Check if plugin needs setup before authentication
    if (currentPlugin.needsSetup?.()) {
      setShowAuthPrompt(false)
      setShowClientIdPrompt(true)
      return
    }

    setShowAuthPrompt(false)

    try {
      await currentPlugin.authenticate?.()

      // Execute callback with pending file ID
      if (options?.onAuthComplete && pendingFileId) {
        await options.onAuthComplete(currentPlugin, pendingFileId)
        setPendingFileId(null)
      }
    } catch (error: any) {
      console.error('Authentication failed:', error)
      toaster.create({
        title: 'Authentication failed',
        description: error.message,
        type: 'error',
        duration: 6000,
      })
    }
  }

  /**
   * Handle client ID submission (plugin setup)
   */
  const handleClientIdSubmit = async (clientId: string) => {
    if (!currentPlugin) return

    try {
      // Save configuration
      await currentPlugin.setConfig?.({ clientId })

      // Attempt authentication
      await currentPlugin.authenticate?.()

      setShowClientIdPrompt(false)

      // Execute callback with pending file ID
      if (options?.onAuthComplete && pendingFileId) {
        await options.onAuthComplete(currentPlugin, pendingFileId)
        setPendingFileId(null)
      }
    } catch (error: any) {
      console.error('Setup/Authentication failed:', error)
      toaster.create({
        title: 'Setup failed',
        description: error.message,
        type: 'error',
        duration: 6000,
      })
    }
  }

  const handleClientIdCancel = () => {
    setShowClientIdPrompt(false)
    setPendingFileId(null)
  }

  return {
    // State
    showAuthPrompt,
    showClientIdPrompt,
    pendingFileId,

    // Actions
    checkAuthRequired,
    handleAuthPromptAccept,
    handleClientIdSubmit,
    handleClientIdCancel,

    // Setters for external control
    setPendingFileId,
    setShowAuthPrompt,
    setCurrentPlugin,
  }
}
