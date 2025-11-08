import { NormalizedItem } from '../types'

/**
 * Helper function to convert normalized content to a comparable string
 * This allows comparison of content that may be split differently
 * (e.g., ["Line1\nLine2"] vs ["Line1\n", "Line2"])
 */
export const normalizedToComparable = (items: NormalizedItem[]): string => {
  return items.map(item => {
    if (typeof item === 'string') {
      return item
    } else {
      // Use a unique marker for placeholders
      return `<<PH:${JSON.stringify(item)}>>`
    }
  }).join('')
}

/**
 * Compare two normalized content arrays for equality
 * Handles cases where newlines are split differently
 */
export const normalizedArraysEqual = (a: NormalizedItem[], b: NormalizedItem[]): boolean => {
  // First try exact match for performance
  if (a.length === b.length) {
    const exactMatch = a.every((item, index) => {
      const bItem = b[index]
      if (typeof item === 'string' && typeof bItem === 'string') {
        return item === bItem
      }
      if (typeof item === 'object' && typeof bItem === 'object') {
        return JSON.stringify(item) === JSON.stringify(bItem)
      }
      return false
    })
    if (exactMatch) return true
  }

  // Fall back to content-based comparison to handle newline splitting
  return normalizedToComparable(a) === normalizedToComparable(b)
}
