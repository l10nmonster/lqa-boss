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

// New types for job.json structure
export type NormalizedItem = string | NormalizedPlaceholder

export interface NormalizedPlaceholder {
  t: 'bx' | 'ex' | 'x'  // bx: start tag, ex: end tag, x: standalone variable
  v: string             // placeholder value/code
  v1?: string          // optional alternate value
  s?: string           // optional sample value (for 'x' type)
}

export interface TranslationUnit {
  jobGuid: string
  guid: string       // matches 'g' property in flow_metadata segments
  rid: string        // reference ID
  sid: string        // segment ID
  nsrc: NormalizedItem[]  // normalized source
  ntgt: NormalizedItem[]  // normalized target
  q: number
  ts: number
  notes?: string     // optional notes
}

export interface JobData {
  sourceLang: string
  targetLang: string
  tus: TranslationUnit[]
} 