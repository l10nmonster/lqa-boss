import { useState, useEffect } from 'react'

interface GCSAuthState {
  accessToken: string
  isAuthenticated: boolean
  clientId: string
}

interface UseGCSAuthReturn extends GCSAuthState {
  initializeAuth: (onSuccess?: (token: string) => Promise<void>, overrideClientId?: string) => Promise<void>
  signOut: () => void
  setClientId: (clientId: string) => void
  setAccessToken: (token: string) => void
  setIsAuthenticated: (authenticated: boolean) => void
}

export const useGCSAuth = (): UseGCSAuthReturn => {
  const [accessToken, setAccessToken] = useState<string>('')
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [clientId, setClientId] = useState<string>('')

  // Load saved credentials on mount
  useEffect(() => {
    const savedClientId = localStorage.getItem('gcs-client-id')
    const savedAccessToken = localStorage.getItem('gcs-access-token')
    const tokenExpiry = localStorage.getItem('gcs-token-expiry')
    
    if (savedClientId) {
      setClientId(savedClientId)
    }
    
    // Check if saved token is still valid
    if (savedAccessToken && tokenExpiry) {
      const expiryTime = parseInt(tokenExpiry)
      const now = Date.now()
      
      if (now < expiryTime) {
        setAccessToken(savedAccessToken)
        setIsAuthenticated(true)
        console.log('Using saved GCS access token')
      } else {
        // Token expired, clean up
        localStorage.removeItem('gcs-access-token')
        localStorage.removeItem('gcs-token-expiry')
        console.log('Saved GCS token expired, removed from storage')
      }
    }
  }, [])

  const initializeAuth = async (onSuccess?: (token: string) => Promise<void>, overrideClientId?: string): Promise<void> => {
    if (!(window as any).google) {
      throw new Error('Google Identity Services not loaded. Please refresh the page.')
    }

    const effectiveClientId = overrideClientId || clientId
    if (!effectiveClientId) {
      throw new Error('Client ID required. Please set client ID first.')
    }

    return new Promise((resolve, reject) => {
      try {
        const tokenClient = (window as any).google.accounts.oauth2.initTokenClient({
          client_id: effectiveClientId,
          scope: 'https://www.googleapis.com/auth/devstorage.read_write',
          callback: async (response: any) => {
            if (response.access_token) {
              setAccessToken(response.access_token)
              setIsAuthenticated(true)
              
              // Save token to localStorage with expiry
              localStorage.setItem('gcs-access-token', response.access_token)
              const expiryTime = Date.now() + (response.expires_in || 3600) * 1000 // Default 1 hour
              localStorage.setItem('gcs-token-expiry', expiryTime.toString())
              
              console.log('OAuth2 authentication successful, token saved')
              
              // Call success callback if provided
              if (onSuccess) {
                try {
                  await onSuccess(response.access_token)
                } catch (error) {
                  console.error('Error in auth success callback:', error)
                }
              }
              
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

  const signOut = (): void => {
    if (accessToken && (window as any).google?.accounts?.oauth2) {
      (window as any).google.accounts.oauth2.revoke(accessToken)
    }
    
    // Clear all GCS-related localStorage
    localStorage.removeItem('gcs-access-token')
    localStorage.removeItem('gcs-token-expiry')
    
    setAccessToken('')
    setIsAuthenticated(false)
    console.log('Signed out from GCS, cleared stored credentials')
  }

  const clearExpiredToken = (): void => {
    localStorage.removeItem('gcs-access-token')
    localStorage.removeItem('gcs-token-expiry')
    setAccessToken('')
    setIsAuthenticated(false)
  }

  return {
    accessToken,
    isAuthenticated,
    clientId,
    initializeAuth,
    signOut,
    setClientId,
    setAccessToken,
    setIsAuthenticated,
    clearExpiredToken
  } as UseGCSAuthReturn & { clearExpiredToken: () => void }
}