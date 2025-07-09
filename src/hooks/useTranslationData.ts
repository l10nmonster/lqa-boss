import { useState } from 'react'
import { JobData, TranslationUnit } from '../types'
import { isEqual } from 'lodash'

export interface TranslationDataState {
  jobData: JobData | null
  originalJobData: JobData | null
  savedJobData: JobData | null
}

export const useTranslationData = () => {
  const [jobData, setJobData] = useState<JobData | null>(null)
  const [originalJobData, setOriginalJobData] = useState<JobData | null>(null)
  const [savedJobData, setSavedJobData] = useState<JobData | null>(null)
  
  const updateTranslationUnit = (tu: TranslationUnit) => {
    if (!jobData) return
    const newTus = jobData.tus.map(t => t.guid === tu.guid ? tu : t)
    setJobData({ ...jobData, tus: newTus })
  }
  
  const setupTwoStateSystem = (currentJobData: JobData) => {
    // Two-state system: original = saved = current
    setJobData(currentJobData)
    setOriginalJobData(JSON.parse(JSON.stringify(currentJobData)))
    setSavedJobData(JSON.parse(JSON.stringify(currentJobData)))
  }
  
  const setupThreeStateSystem = (currentJobData: JobData, loadedSavedData: JobData) => {
    // Three-state system:
    // originalJobData = source text (for "Original" button - green state)
    const originalTus = currentJobData.tus.map(tu => ({
      ...tu,
      ntgt: tu.nsrc ? JSON.parse(JSON.stringify(tu.nsrc)) : []
    }))
    setOriginalJobData({ ...currentJobData, tus: originalTus })
    
    // savedJobData = saved translations (for "Undo" button - yellow state)
    setSavedJobData(JSON.parse(JSON.stringify(loadedSavedData)))
    
    // current job data
    setJobData(loadedSavedData)
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
        // Check if the saved translation is different from the original source
        const originalNtgt = tu.nsrc ? JSON.parse(JSON.stringify(tu.nsrc)) : []
        if (!isEqual(savedTu.ntgt, originalNtgt)) {
          editedCount++
        }
        return { ...tu, ntgt: savedTu.ntgt }
      }
      return tu
    })
    
    return {
      jobData: { ...baseJobData, tus: updatedTus },
      editedCount
    }
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
  
  const reset = () => {
    setJobData(null)
    setOriginalJobData(null)
    setSavedJobData(null)
  }
  
  return {
    jobData,
    originalJobData,
    savedJobData,
    updateTranslationUnit,
    setupTwoStateSystem,
    setupThreeStateSystem,
    applyLoadedTranslations,
    getChangedTus,
    reset,
  }
} 