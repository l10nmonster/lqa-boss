import { JobData, TranslationUnit } from '../types'
import { isEqual } from 'lodash'

export interface TERStatistics {
  totalSegments: number
  totalWords: number
  changedSegments: number
  editDistance: number
  ter: number
}

/**
 * Extracts words from a normalized text array
 */
function getWords(items: any[]): string[] {
  if (!items || !Array.isArray(items)) return []

  const text = items
    .filter(item => typeof item === 'string')
    .join(' ')
    .toLowerCase()
    .trim()

  if (!text) return []

  return text.split(/\s+/).filter(word => word.length > 0)
}

/**
 * Calculates the word-level Levenshtein distance (edit distance)
 * between two arrays of words.
 */
function wordLevelLevenshtein(referenceWords: string[], hypothesisWords: string[]): number {
  const n = referenceWords.length
  const m = hypothesisWords.length

  if (n === 0) return m
  if (m === 0) return n

  // Create a 2D array (matrix) to store the distances
  const dp = Array(n + 1).fill(0).map(() => Array(m + 1).fill(0))

  // Initialize the matrix
  for (let i = 0; i <= n; i++) dp[i][0] = i // Deletions
  for (let j = 0; j <= m; j++) dp[0][j] = j // Insertions

  // Fill the matrix
  for (let i = 1; i <= n; i++) {
    for (let j = 1; j <= m; j++) {
      const cost = (referenceWords[i - 1] === hypothesisWords[j - 1]) ? 0 : 1
      dp[i][j] = Math.min(
        dp[i - 1][j] + 1,      // Deletion
        dp[i][j - 1] + 1,      // Insertion
        dp[i - 1][j - 1] + cost // Substitution
      )
    }
  }

  return dp[n][m] // The distance is in the bottom-right corner
}

/**
 * Calculates detailed TER statistics
 */
export function calculateTERStatistics(
  currentJobData: JobData | null,
  originalJobData: JobData | null
): TERStatistics | null {
  if (!currentJobData || !originalJobData) return null

  // Create a map of original TUs for quick lookup
  const originalTusMap = new Map<string, TranslationUnit>(
    originalJobData.tus.map(tu => [tu.guid, tu])
  )

  let totalSegments = 0
  let totalWords = 0
  let changedSegments = 0
  let totalEditDistance = 0

  // Iterate through current TUs
  for (const currentTu of currentJobData.tus) {
    totalSegments++

    const originalTu = originalTusMap.get(currentTu.guid)
    if (!originalTu) continue

    // Get words from reference (original) and hypothesis (current)
    const referenceWords = getWords(originalTu.ntgt)
    const hypothesisWords = getWords(currentTu.ntgt)

    totalWords += referenceWords.length

    // Calculate edit distance for this segment
    const editDistance = wordLevelLevenshtein(referenceWords, hypothesisWords)
    totalEditDistance += editDistance

    // Check if this TU has been changed
    const hasChanged = !isEqual(currentTu.ntgt, originalTu.ntgt)
    if (hasChanged) {
      changedSegments++
    }
  }

  // TER = Total Edit Distance / Total Reference Words
  const ter = totalWords === 0 ? 0 : totalEditDistance / totalWords

  return {
    totalSegments,
    totalWords,
    changedSegments,
    editDistance: totalEditDistance,
    ter
  }
}

/**
 * Calculates Translation Error Rate (TER)
 * TER = Edit Distance / Reference Length (as a decimal, 0 to 1+)
 */
export function calculateTER(
  currentJobData: JobData | null,
  originalJobData: JobData | null
): number | null {
  const stats = calculateTERStatistics(currentJobData, originalJobData)
  return stats ? stats.ter : null
}
