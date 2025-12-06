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
  const changedGuids: string[] = []

  // Iterate through current TUs (only reviewed ones)
  for (const currentTu of currentJobData.tus) {
    // Only consider reviewed segments
    if (!currentTu.ts) {
      continue
    }

    totalSegments++

    // Skip TUs with unresolved candidates (no original to compare to)
    if (currentTu.candidates && currentTu.candidates.length > 0) {
      continue
    }

    // Skip TUs where a candidate was selected (not manually edited)
    // Candidate selection is not an "error" and shouldn't count against TER
    if (currentTu.candidateSelected) {
      continue
    }

    const originalTu = originalTusMap.get(currentTu.guid)
    if (!originalTu) continue

    // Also skip if original has candidates
    if (originalTu.candidates && originalTu.candidates.length > 0) {
      continue
    }

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
      changedGuids.push(currentTu.guid)
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

/**
 * Calculates Error Per Thousand words (EPT)
 * EPT = (Sum of all QA weights) / (Total word count) * 1000
 */
export function calculateEPT(
  currentJobData: JobData | null
): number | null {
  if (!currentJobData) return null

  let totalWeight = 0
  let totalWords = 0

  for (const tu of currentJobData.tus) {
    // Only consider reviewed segments
    if (!tu.ts) {
      continue
    }

    // Add QA weight if present
    if (tu.qa && tu.qa.w) {
      totalWeight += tu.qa.w
    }

    // Count words in target
    const targetWords = getWords(tu.ntgt)
    totalWords += targetWords.length
  }

  // EPT = (total weight / total words) * 1000
  return totalWords === 0 ? 0 : (totalWeight / totalWords) * 1000
}

export interface QASummary {
  severityBreakdown: { [sevId: string]: number }
  categoryBreakdown: { [catId: string]: number }
  totalErrors: number
  totalWeight: number
  unassessedSeverity: number
  unassessedCategory: number
}

export interface SegmentWordCounts {
  totalSegments: number
  totalWords: number
  reviewedSegments: number
  reviewedWords: number
}

/**
 * Calculates total and reviewed segment/word counts
 */
export function calculateSegmentWordCounts(
  jobData: JobData | null
): SegmentWordCounts {
  if (!jobData) {
    return { totalSegments: 0, totalWords: 0, reviewedSegments: 0, reviewedWords: 0 }
  }

  let totalSegments = 0
  let totalWords = 0
  let reviewedSegments = 0
  let reviewedWords = 0

  for (const tu of jobData.tus) {
    totalSegments++
    const words = getWords(tu.ntgt)
    totalWords += words.length

    if (tu.ts) {
      reviewedSegments++
      reviewedWords += words.length
    }
  }

  return { totalSegments, totalWords, reviewedSegments, reviewedWords }
}

/**
 * Calculates QA error breakdown by severity and category
 */
export function calculateQASummary(
  currentJobData: JobData | null,
  originalJobData: JobData | null
): QASummary {
  const severityBreakdown: { [sevId: string]: number } = {}
  const categoryBreakdown: { [catId: string]: number } = {}
  let totalErrors = 0
  let totalWeight = 0
  let unassessedSeverity = 0
  let unassessedCategory = 0

  if (!currentJobData) {
    return { severityBreakdown, categoryBreakdown, totalErrors, totalWeight, unassessedSeverity, unassessedCategory }
  }

  // Create a map of original TUs for quick lookup
  const originalTusMap = originalJobData ? new Map<string, TranslationUnit>(
    originalJobData.tus.map(tu => [tu.guid, tu])
  ) : null

  for (const tu of currentJobData.tus) {
    // Skip selected candidates - they don't count as corrections/errors
    if (tu.candidateSelected) continue

    // Check if this segment has been corrected
    const originalTu = originalTusMap?.get(tu.guid)
    const isCorrected = originalTu && !isEqual(tu.ntgt, originalTu.ntgt)

    if (tu.qa) {
      totalErrors++
      totalWeight += tu.qa.w || 0

      // Count by severity
      if (tu.qa.sev) {
        severityBreakdown[tu.qa.sev] = (severityBreakdown[tu.qa.sev] || 0) + 1
      } else if (isCorrected) {
        // Corrected but no severity assigned
        unassessedSeverity++
      }

      // Count by category
      if (tu.qa.cat) {
        categoryBreakdown[tu.qa.cat] = (categoryBreakdown[tu.qa.cat] || 0) + 1
      } else if (isCorrected) {
        // Corrected but no category assigned
        unassessedCategory++
      }
    } else if (isCorrected) {
      // Corrected but no QA assessment at all
      unassessedSeverity++
      unassessedCategory++
    }
  }

  return { severityBreakdown, categoryBreakdown, totalErrors, totalWeight, unassessedSeverity, unassessedCategory }
}
