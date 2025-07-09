import { useState } from 'react'
import JSZip from 'jszip'
import { FlowData, JobData } from '../types'

export interface LoadResult {
  flowData: FlowData | null
  jobData: JobData
  zipFile: JSZip
}

export const useFileLoader = () => {
  const [flowData, setFlowData] = useState<FlowData | null>(null)
  const [zipFile, setZipFile] = useState<JSZip | null>(null)
  const [fileName, setFileName] = useState<string>('')
  
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

    // Populate missing ntgt with nsrc content
    parsedJobData.tus = parsedJobData.tus.map(tu => {
      if (!tu.ntgt || (Array.isArray(tu.ntgt) && tu.ntgt.length === 0)) {
        // Create a deep copy of nsrc to avoid reference issues
        const nsrcCopy = tu.nsrc ? JSON.parse(JSON.stringify(tu.nsrc)) : []
        return { ...tu, ntgt: nsrcCopy }
      }
      return tu
    })
    
    // Update state
    setZipFile(zip)
    setFlowData(parsedFlowData)
    setFileName(file.name)
    
    return {
      flowData: parsedFlowData,
      jobData: parsedJobData,
      zipFile: zip
    }
  }
  
  const reset = () => {
    setFlowData(null)
    setZipFile(null)
    setFileName('')
  }
  
  return {
    flowData,
    zipFile,
    fileName,
    loadLqaBossFile,
    reset,
  }
} 