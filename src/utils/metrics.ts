import { JobData, TranslationUnit } from '../types'
import { countWords } from './normalizedText'
import { isEqual } from 'lodash'

export interface EPTStatistics {
  totalSegments: number
  totalWords: number
  changedSegments: number
  changedWords: number
  ept: number
}

/**
 * Calculates detailed EPT statistics
 */
export function calculateEPTStatistics(
  currentJobData: JobData | null,
  originalJobData: JobData | null
): EPTStatistics | null {
  if (!currentJobData || !originalJobData) return null

  // Create a map of original TUs for quick lookup
  const originalTusMap = new Map<string, TranslationUnit>(
    originalJobData.tus.map(tu => [tu.guid, tu])
  )

  let totalSegments = 0
  let totalWords = 0
  let changedSegments = 0
  let changedWords = 0

  // Iterate through current TUs
  for (const currentTu of currentJobData.tus) {
    totalSegments++

    // Count words in source (this contributes to total)
    const tuWords = countWords(currentTu.nsrc)
    totalWords += tuWords

    // Check if this TU has been changed
    const originalTu = originalTusMap.get(currentTu.guid)
    if (originalTu) {
      // Compare ntgt arrays to see if changed
      const hasChanged = !isEqual(currentTu.ntgt, originalTu.ntgt)
      if (hasChanged) {
        changedSegments++
        changedWords += tuWords
      }
    }
  }

  const ept = totalWords === 0 ? 0 : (changedWords / totalWords) * 1000

  return {
    totalSegments,
    totalWords,
    changedSegments,
    changedWords,
    ept
  }
}

/**
 * Calculates Errors Per Thousand (EPT) metric
 * EPT = (words in changed segments / total words in all segments) * 1000
 */
export function calculateEPT(
  currentJobData: JobData | null,
  originalJobData: JobData | null
): number | null {
  const stats = calculateEPTStatistics(currentJobData, originalJobData)
  return stats ? stats.ept : null
}
