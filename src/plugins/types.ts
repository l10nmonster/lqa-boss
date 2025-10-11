import { JobData } from '../types'

/**
 * Generic file identifier that plugins can use to reference files
 * Each plugin defines what properties it needs
 */
export interface FileIdentifier {
  [key: string]: any
}

/**
 * Standardized file information returned by plugins
 */
export interface FileInfo {
  name: string
  displayName: string
  identifier: FileIdentifier
  size?: string
  updated?: string
  metadata?: Record<string, any>
}

/**
 * Plugin capabilities - what operations the plugin supports
 */
export interface PluginCapabilities {
  canLoad: boolean       // Can load files
  canSave: boolean       // Can save changes
  canList: boolean       // Can list available files
  canDelete?: boolean    // Can delete files
  requiresAuth: boolean  // Needs authentication
}

/**
 * Plugin metadata for display and identification
 */
export interface PluginMetadata {
  id: string            // Unique ID (e.g., 'local', 'gcs', 'extension')
  name: string          // Display name (e.g., 'Local Files')
  description: string   // Short description
  icon?: string         // Icon identifier
  version: string       // Plugin version
}

/**
 * Authentication state for plugins that require auth
 */
export interface AuthState {
  isAuthenticated: boolean
  userId?: string
  expiresAt?: Date
}

/**
 * Props for plugin file selector components
 */
export interface FileSelectorProps {
  onFileSelect: (identifier: FileIdentifier) => void
  onCancel: () => void
}

/**
 * Props for plugin header action components
 */
export interface HeaderActionsProps {
  hasData: boolean
  onAction?: (action: string, data?: any) => void
}

/**
 * Props for plugin configuration components
 */
export interface ConfigProps {
  currentConfig?: Record<string, any>
  onSave: (config: Record<string, any>) => void
  onCancel: () => void
}

/**
 * Props for plugin location prompt components
 */
export interface LocationPromptProps {
  currentIdentifier?: FileIdentifier
  fileName?: string
  operation: 'load' | 'save'
  onSubmit: (identifier: FileIdentifier) => void
  onCancel: () => void
}

/**
 * Main plugin interface that all persistence plugins must implement
 */
export interface IPersistencePlugin {
  // Plugin information
  readonly metadata: PluginMetadata
  readonly capabilities: PluginCapabilities

  // Lifecycle hooks
  initialize?: () => Promise<void>
  dispose?: () => Promise<void>

  // Availability check (e.g., for extension plugins to check if extension is installed)
  isAvailable?: () => Promise<boolean>

  // Authentication (required if capabilities.requiresAuth = true)
  getAuthState?: () => AuthState
  authenticate?: () => Promise<void>
  signOut?: () => Promise<void>

  // Core file operations
  loadFile: (identifier: FileIdentifier) => Promise<File>
  saveFile: (identifier: FileIdentifier, data: JobData) => Promise<void>
  listFiles?: (location?: string) => Promise<FileInfo[]>
  deleteFile?: (identifier: FileIdentifier) => Promise<void>

  // Auto-save support (e.g., loading saved translations from a companion file)
  loadAutoSaveData?: (identifier: FileIdentifier, filename: string) => Promise<JobData | null>

  // Optional React components for custom UI
  FileSelectorComponent?: React.ComponentType<FileSelectorProps>
  ConfigComponent?: React.ComponentType<ConfigProps>
  HeaderActionsComponent?: React.ComponentType<HeaderActionsProps>
  LocationPromptComponent?: React.ComponentType<LocationPromptProps>

  // Configuration management
  getConfig?: () => Record<string, any>
  setConfig?: (config: Record<string, any>) => Promise<void>
  needsSetup?: () => boolean

  // File identifier validation
  validateIdentifier?: (identifier: FileIdentifier, operation: 'load' | 'save') => { valid: boolean, missing?: string[] }

  // URL handling for deep links
  parseUrl?: (params: URLSearchParams) => FileIdentifier | null
  parsePathUrl?: (pathSegments: string[]) => FileIdentifier | null
  buildUrl?: (identifier: FileIdentifier) => string
}
