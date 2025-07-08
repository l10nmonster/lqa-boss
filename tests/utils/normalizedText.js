/**
 * Test utility version of normalizedText functions
 * JavaScript implementation for Node.js testing
 */

/**
 * Converts a normalized array to a user-friendly display string
 */
export function normalizedToString(items) {
  if (!items || !Array.isArray(items)) return ''
  
  return items.map(item => {
    if (typeof item === 'string') {
      return item
    }
    
    const placeholder = item
    
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
export function extractEditableText(items) {
  if (!items || !Array.isArray(items)) return []
  
  return items
    .filter(item => typeof item === 'string')
    .map(item => item)
}

/**
 * Creates a display-friendly representation showing placeholders distinctly
 */
export function normalizedToDisplayString(items) {
  if (!items || !Array.isArray(items)) return ''
  
  return items.map(item => {
    if (typeof item === 'string') {
      return item
    }
    
    const placeholder = item
    
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
export function normalizedToDisplayStringForTarget(items) {
  if (!items || !Array.isArray(items)) return ''
  
  return items.map(item => {
    if (typeof item === 'string') {
      return item
    }
    
    const placeholder = item
    
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