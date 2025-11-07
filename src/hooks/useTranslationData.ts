import { useState } from 'react'
import { JobData, TranslationUnit } from '../types'
import { isEqual } from 'lodash'
import { FileStatus } from '../components/StatusBadge'

export interface TranslationDataState {
  jobData: JobData | null
  originalJobData: JobData | null
  savedJobData: JobData | null
}

export const useTranslationData = () => {
  const [jobData, setJobData] = useState<JobData | null>(null)
  const [originalJobData, setOriginalJobData] = useState<JobData | null>(null)
  const [savedJobData, setSavedJobData] = useState<JobData | null>(null)
  const [fileStatus, setFileStatus] = useState<FileStatus>('NEW')
  
  const updateTranslationUnit = (tu: TranslationUnit) => {
    if (!jobData || !originalJobData) return

    // Find the current TU to compare
    const currentTu = jobData.tus.find(t => t.guid === tu.guid)
    if (!currentTu) return

    // Only update if the content or QA actually changed
    if (!isEqual(currentTu.ntgt, tu.ntgt) || !isEqual(currentTu.qa, tu.qa)) {
      // If ntgt changed, clear candidateSelected flag (user is now manually editing)
      const updatedTu = !isEqual(currentTu.ntgt, tu.ntgt)
        ? { ...tu, candidateSelected: undefined }
        : tu

      const newTus = jobData.tus.map(t => t.guid === tu.guid ? updatedTu : t)
      setJobData({ ...jobData, tus: newTus })

      // Determine the correct status based on current state
      if (fileStatus === 'LOADED' && savedJobData) {
        // In LOADED state, compare against saved data
        const hasChangesFromSaved = newTus.some(newTu => {
          const savedTu = savedJobData.tus.find(t => t.guid === newTu.guid)
          return savedTu && (!isEqual(newTu.ntgt, savedTu.ntgt) || !isEqual(newTu.qa, savedTu.qa))
        })
        setFileStatus(hasChangesFromSaved ? 'CHANGED' : 'LOADED')
      } else {
        // In NEW state, compare against original data
        const hasChangesFromOriginal = newTus.some(newTu => {
          const origTu = originalJobData.tus.find(t => t.guid === newTu.guid)
          return origTu && (!isEqual(newTu.ntgt, origTu.ntgt) || !isEqual(newTu.qa, origTu.qa))
        })
        setFileStatus(hasChangesFromOriginal ? 'CHANGED' : 'NEW')
      }
    }
  }
  
  const setupTwoStateSystem = (currentJobData: JobData) => {
    // Two-state system: original = saved = current
    // IMPORTANT: Create deep copies of ALL three to ensure independence
    const currentCopy = JSON.parse(JSON.stringify(currentJobData))
    const originalCopy = JSON.parse(JSON.stringify(currentJobData))
    const savedCopy = JSON.parse(JSON.stringify(currentJobData))

    setJobData(currentCopy)
    setOriginalJobData(originalCopy)
    setSavedJobData(savedCopy)
    setFileStatus('NEW')
  }
  
  const setupThreeStateSystem = (currentJobData: JobData, loadedSavedData: JobData) => {
    // Three-state system:
    // originalJobData = original translation from the loaded file (for "Original" button - green state)
    // IMPORTANT: Preserve the original ntgt (translation), do NOT replace with nsrc (source)!
    setOriginalJobData(JSON.parse(JSON.stringify(currentJobData)))

    // savedJobData = saved translations (for "Undo" button - yellow state)
    setSavedJobData(JSON.parse(JSON.stringify(loadedSavedData)))

    // current job data
    setJobData(loadedSavedData)
    setFileStatus('LOADED')
  }
  
  const applyLoadedTranslations = (
    baseJobData: JobData,
    savedTranslations: JobData
  ): { jobData: JobData; editedCount: number } => {
    let editedCount = 0

    // Create a map for quick lookup of saved translations
    const savedTuMap = new Map(savedTranslations.tus.map((tu: any) => [tu.guid, tu]))

    // Update job data with saved translations and count edited ones
    const updatedTus = baseJobData.tus.map(tu => {
      const savedTu = savedTuMap.get(tu.guid) as any
      if (savedTu && savedTu.ntgt) {
        // Check if the saved translation is different from the original translation
        // IMPORTANT: Compare to tu.ntgt (original translation), NOT tu.nsrc (source)!
        if (!isEqual(savedTu.ntgt, tu.ntgt)) {
          editedCount++
        }
        return { ...tu, ntgt: savedTu.ntgt }
      }
      return tu
    })

    const resultJobData = {
      ...baseJobData,
      tus: updatedTus,
      // updatedAt comes from the companion file (savedTranslations)
      updatedAt: savedTranslations.updatedAt || baseJobData.updatedAt,
      // translationProvider always comes from baseJobData (the original .lqaboss file)
      translationProvider: baseJobData.translationProvider
    }

    return {
      jobData: resultJobData,
      editedCount
    }
  }
  
  const selectCandidate = (guid: string, candidateIndex: number) => {
    if (!jobData || !originalJobData || !savedJobData) return

    // Find the selected candidate
    const selectedTu = jobData.tus.find(tu => tu.guid === guid)
    if (!selectedTu || !selectedTu.candidates || candidateIndex >= selectedTu.candidates.length) {
      return
    }
    const selectedCandidate = selectedTu.candidates[candidateIndex]

    // Update current job data with candidateSelected flag
    const newTus = jobData.tus.map(tu => {
      if (tu.guid !== guid) return tu
      return {
        ...tu,
        ntgt: selectedCandidate,
        candidates: undefined, // Clear candidates once one is selected
        candidateSelected: true // Mark as selected candidate (not manually edited)
      }
    })

    // Update savedJobData to match the selected candidate
    // This makes the segment show as "saved" (yellow) initially
    const newSavedTus = savedJobData.tus.map(tu => {
      if (tu.guid !== guid) return tu
      return {
        ...tu,
        ntgt: JSON.parse(JSON.stringify(selectedCandidate)),
        candidates: undefined,
        candidateSelected: true
      }
    })

    // Keep originalJobData unchanged - it represents the original translation from the file
    // This is important for TER calculation
    const newOriginalTus = originalJobData.tus.map(tu => {
      if (tu.guid !== guid) return tu
      return {
        ...tu,
        candidates: undefined // Clear candidates from original too
      }
    })

    setJobData({ ...jobData, tus: newTus })
    setOriginalJobData({ ...originalJobData, tus: newOriginalTus })
    setSavedJobData({ ...savedJobData, tus: newSavedTus })

    // Mark file as CHANGED - candidate selection should be saved
    setFileStatus('CHANGED')
  }

  const getChangedTus = (): TranslationUnit[] => {
    if (!jobData || !originalJobData) return []

    const originalTus = new Map(originalJobData.tus.map(tu => [tu.guid, tu]))
    return jobData.tus.filter(currentTu => {
      const originalTu = originalTus.get(currentTu.guid)
      if (!originalTu) return true
      return !isEqual(currentTu.ntgt, originalTu.ntgt)
    })
  }
  
  const markAsSaved = () => {
    setFileStatus('SAVED')
  }

  const reset = () => {
    setJobData(null)
    setOriginalJobData(null)
    setSavedJobData(null)
    setFileStatus('NEW')
  }
  
  return {
    jobData,
    originalJobData,
    savedJobData,
    fileStatus,
    updateTranslationUnit,
    selectCandidate,
    setupTwoStateSystem,
    setupThreeStateSystem,
    applyLoadedTranslations,
    getChangedTus,
    markAsSaved,
    reset,
  }
} 