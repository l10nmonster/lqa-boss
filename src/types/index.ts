export interface Segment {
  x: number
  y: number
  width: number
  height: number
  text: string
  [key: string]: any
}

export interface Page {
  pageId: string
  originalUrl?: string
  imageFile: string
  segments: Segment[]
}

export interface FlowData {
  flowName: string
  pages: Page[]
  [key: string]: any
}

export interface ChangedSegment {
  segmentIndex: number
  originalText: string
  currentText: string
  [key: string]: any
}

export interface ChangedPage {
  pageId: string
  originalUrl?: string
  imageFile: string
  changedSegments: ChangedSegment[]
}

export interface ChangedSegmentsData {
  flowName: string
  savedAt: string
  pages: ChangedPage[]
} 