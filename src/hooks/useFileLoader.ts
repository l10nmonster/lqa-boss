import { useState } from 'react'
import JSZip from 'jszip'
import { FlowData, JobData, TranslationUnit, NormalizedItem } from '../types'
import { QualityModel } from '../types/qualityModel'
import { isEqual } from 'lodash'

export interface LoadResult {
  flowData: FlowData | null
  jobData: JobData
  zipFile: JSZip
  qualityModel: QualityModel | null
  pageImages: Map<string, string> | null  // Pre-extracted blob URLs for images
}

export interface LoadProgress {
  current: number
  total: number
}

export const useFileLoader = () => {
  const [flowData, setFlowData] = useState<FlowData | null>(null)
  const [zipFile, setZipFile] = useState<JSZip | null>(null)
  const [fileName, setFileName] = useState<string>('')
  const [pageImages, setPageImages] = useState<Map<string, string> | null>(null)
  const [loadingProgress, setLoadingProgress] = useState<LoadProgress | null>(null)

  const loadLqaBossFile = async (file: File): Promise<LoadResult> => {
    const arrayBuffer = await file.arrayBuffer()
    const zip = await JSZip.loadAsync(arrayBuffer)

    // Try to load flow_metadata.json, but don't fail if it's missing
    const metadataFile = zip.file("flow_metadata.json")
    let parsedFlowData: FlowData | null = null
    
    if (metadataFile) {
      const metadataContent = await metadataFile.async("string")
      parsedFlowData = JSON.parse(metadataContent)
      
      if (!parsedFlowData?.pages || parsedFlowData?.pages.length === 0) {
        console.warn('Warning: No valid pages data found in flow_metadata.json')
        parsedFlowData = null
      }
    }

    const jobFile = zip.file("job.json")
    if (!jobFile) {
      throw new Error('Invalid .lqaboss file: "job.json" not found.')
    }
    const jobContent = await jobFile.async("string")
    const parsedJobData: JobData = JSON.parse(jobContent)

    // Detect and consolidate duplicate GUIDs as candidates
    const tusByGuid = new Map<string, TranslationUnit>()
    const duplicateCount = new Map<string, number>()

    for (const tu of parsedJobData.tus) {
      const existing = tusByGuid.get(tu.guid)

      if (existing) {
        // Duplicate GUID found - add as candidate
        if (!existing.candidates) {
          existing.candidates = [existing.ntgt] // First candidate is the original ntgt
        }
        existing.candidates.push(tu.ntgt)

        // Track duplicate count
        duplicateCount.set(tu.guid, (duplicateCount.get(tu.guid) || 1) + 1)
      } else {
        tusByGuid.set(tu.guid, { ...tu })
      }
    }

    // De-duplicate identical candidates
    for (const [, tu] of tusByGuid.entries()) {
      if (tu.candidates) {
        // Remove duplicate candidates using deep equality
        const uniqueCandidates: NormalizedItem[][] = []
        for (const candidate of tu.candidates) {
          const isDuplicate = uniqueCandidates.some(unique => isEqual(unique, candidate))
          if (!isDuplicate) {
            uniqueCandidates.push(candidate)
          }
        }

        // If only 1 unique candidate remains, use it as ntgt and clear candidates
        if (uniqueCandidates.length === 1) {
          tu.ntgt = uniqueCandidates[0]
          tu.candidates = undefined
        } else {
          tu.candidates = uniqueCandidates
        }
      }
    }

    // Convert back to array
    parsedJobData.tus = Array.from(tusByGuid.values())

    // Populate missing ntgt with nsrc content (only for TUs without candidates)
    parsedJobData.tus = parsedJobData.tus.map(tu => {
      if (tu.candidates) {
        // Has candidates - set ntgt to empty, user must pick
        return { ...tu, ntgt: [] }
      }

      if (!tu.ntgt || (Array.isArray(tu.ntgt) && tu.ntgt.length === 0)) {
        // Create a deep copy of nsrc to avoid reference issues
        const nsrcCopy = tu.nsrc ? JSON.parse(JSON.stringify(tu.nsrc)) : []
        return { ...tu, ntgt: nsrcCopy }
      }
      return tu
    })

    // Try to load quality.json, but don't fail if it's missing
    const qualityFile = zip.file("quality.json")
    let parsedQualityModel: QualityModel | null = null

    if (qualityFile) {
      try {
        const qualityContent = await qualityFile.async("string")
        parsedQualityModel = JSON.parse(qualityContent)
      } catch (error) {
        console.warn('Warning: Failed to parse quality.json:', error)
        parsedQualityModel = null
      }
    }

    // Extract all page images upfront (if flow data exists)
    let extractedPageImages: Map<string, string> | null = null

    if (parsedFlowData?.pages && parsedFlowData.pages.length > 0) {
      extractedPageImages = new Map()
      const totalPages = parsedFlowData.pages.length

      // Set initial progress
      setLoadingProgress({ current: 0, total: totalPages })

      for (let i = 0; i < totalPages; i++) {
        const page = parsedFlowData.pages[i]
        const imageFile = zip.file(page.imageFile)

        if (imageFile) {
          const blob = await imageFile.async('blob')
          const blobUrl = URL.createObjectURL(blob)
          extractedPageImages.set(page.imageFile, blobUrl)
        }

        // Update progress state
        setLoadingProgress({ current: i + 1, total: totalPages })
      }

      // Clear progress when done
      setLoadingProgress(null)
    }

    // Update state
    setZipFile(zip)
    setFlowData(parsedFlowData)
    setFileName(file.name)
    setPageImages(extractedPageImages)

    return {
      flowData: parsedFlowData,
      jobData: parsedJobData,
      zipFile: zip,
      qualityModel: parsedQualityModel,
      pageImages: extractedPageImages
    }
  }
  
  const reset = () => {
    // Revoke old blob URLs to free memory
    if (pageImages) {
      for (const url of pageImages.values()) {
        URL.revokeObjectURL(url)
      }
    }
    setFlowData(null)
    setZipFile(null)
    setFileName('')
    setPageImages(null)
  }

  return {
    flowData,
    zipFile,
    fileName,
    pageImages,
    loadingProgress,
    loadLqaBossFile,
    reset,
  }
} 