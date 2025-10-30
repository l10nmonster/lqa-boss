import { NormalizedItem, NormalizedPlaceholder } from '../types'

/**
 * Converts a normalized array to a user-friendly display string
 */
export function normalizedToString(items: NormalizedItem[]): string {
  if (!items || !Array.isArray(items)) return ''
  
  return items.map(item => {
    if (typeof item === 'string') {
      return item
    }
    
    const placeholder = item as NormalizedPlaceholder
    
    if (placeholder.t === 'x' && placeholder.s) {
      // For standalone variables, show the sample value if available
      return placeholder.s
    }
    
    // For bx/ex tags, show a simplified representation
    if (placeholder.t === 'bx' || placeholder.t === 'ex') {
      // Extract tag name from the value (e.g., "<a>" -> "a")
      const match = placeholder.v.match(/<\/?([a-zA-Z]+)/)
      const tagName = match ? match[1] : 'tag'
      return placeholder.t === 'bx' ? `<${tagName}>` : `</${tagName}>`
    }
    
    // Fallback: show the raw value
    return placeholder.v
  }).join('')
}

/**
 * Extracts only the editable text portions from a normalized array
 */
export function extractEditableText(items: NormalizedItem[]): string[] {
  if (!items || !Array.isArray(items)) return []
  
  return items
    .filter(item => typeof item === 'string')
    .map(item => item as string)
}

/**
 * Creates a display-friendly representation showing placeholders distinctly
 */
export function normalizedToDisplayString(items: NormalizedItem[]): string {
  if (!items || !Array.isArray(items)) return ''
  
  return items.map(item => {
    if (typeof item === 'string') {
      return item
    }
    
    const placeholder = item as NormalizedPlaceholder
    
    if (placeholder.t === 'x') {
      // Show variable placeholders with curly braces
      return `{${placeholder.s || placeholder.v}}`
    }
    
    if (placeholder.t === 'bx' || placeholder.t === 'ex') {
      // Show tags in a simplified form
      const match = placeholder.v.match(/<\/?([a-zA-Z]+)[^>]*>/)
      if (match) {
        const tagName = match[1]
        return placeholder.t === 'bx' ? `<${tagName}>` : `</${tagName}>`
      }
    }
    
    return `[${placeholder.v}]`
  }).join('')
}

/**
 * Creates a display-friendly representation for target text, without brackets on placeholders.
 */
export function normalizedToDisplayStringForTarget(items: NormalizedItem[]): string {
  if (!items || !Array.isArray(items)) return ''

  return items.map(item => {
    if (typeof item === 'string') {
      return item
    }

    const placeholder = item as NormalizedPlaceholder

    if (placeholder.t === 'x') {
      return `{${placeholder.s || placeholder.v}}`
    }

    if (placeholder.t === 'bx' || placeholder.t === 'ex') {
      const match = placeholder.v.match(/<\/?([a-zA-Z]+)[^>]*>/)
      if (match) {
        const tagName = match[1]
        return placeholder.t === 'bx' ? `<${tagName}>` : `</${tagName}>`
      }
    }

    return placeholder.v // No brackets
  }).join('')
}

/**
 * Counts words in a normalized array (only counts actual text, not placeholders)
 */
export function countWords(items: NormalizedItem[]): number {
  if (!items || !Array.isArray(items)) return 0

  // Extract only string items (actual text, not placeholders)
  const text = items
    .filter(item => typeof item === 'string')
    .join(' ')
    .trim()

  if (!text) return 0

  // Split by whitespace and count non-empty tokens
  return text.split(/\s+/).filter(word => word.length > 0).length
} 