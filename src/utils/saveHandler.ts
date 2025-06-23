import { FlowData, ChangedSegmentsData } from '../types'

export function saveChangedSegments(
  flowData: FlowData,
  originalTexts: Record<string, string>
): void {
  const changedSegmentsData: ChangedSegmentsData = {
    flowName: flowData.flowName,
    savedAt: new Date().toISOString(),
    pages: []
  }

  let hasChanges = false

  flowData.pages.forEach((page) => {
    const pageChanges = {
      pageId: page.pageId,
      originalUrl: page.originalUrl,
      imageFile: page.imageFile,
      changedSegments: [] as any[]
    }

    let pageHasChanges = false

    page.segments.forEach((segment, index) => {
      const originalText = originalTexts[`${page.pageId}_${index}`]
      const currentText = segment.text

      if (originalText !== currentText) {
        pageHasChanges = true
        hasChanges = true

        const { x, y, width, height, text, ...otherMetadata } = segment
        pageChanges.changedSegments.push({
          segmentIndex: index,
          originalText,
          currentText,
          ...otherMetadata
        })
      }
    })

    if (pageHasChanges) {
      changedSegmentsData.pages.push(pageChanges)
    }
  })

  if (!hasChanges) {
    alert('No changes were made.')
    return
  }

  // Create and download the JSON file
  const jsonString = JSON.stringify(changedSegmentsData, null, 2)
  const filename = `${(flowData.flowName || 'flow').replace(/[^a-z0-9_.-]/gi, '_')}_edited_segments.json`
  const blob = new Blob([jsonString], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)

  console.log('Edited segments JSON download initiated.')
} 