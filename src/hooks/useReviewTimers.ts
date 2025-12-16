import { useRef, useCallback } from 'react'

interface SegmentTimerState {
  startTime: number | null
  hasEdits: boolean
}

interface PageTimerState {
  startTime: number
  pageIndex: number
}

export interface UseReviewTimersReturn {
  // STTR functions
  startSegmentTimer: (guid: string) => void
  stopSegmentTimer: (guid: string, wasApproved: boolean) => number | null
  markSegmentEdited: (guid: string) => void

  // ATTR functions
  startPageTimer: (pageIndex: number) => void
  stopPageTimer: () => { pageIndex: number; elapsed: number } | null
}

export const useReviewTimers = (): UseReviewTimersReturn => {
  // Per-segment timer state: Map<guid, SegmentTimerState>
  const segmentTimers = useRef<Map<string, SegmentTimerState>>(new Map())

  // Page-level timer for ATTR
  const pageTimer = useRef<PageTimerState | null>(null)

  // STTR: Start timer when segment receives focus (resets if already running)
  const startSegmentTimer = useCallback((guid: string) => {
    segmentTimers.current.set(guid, {
      startTime: Date.now(),
      hasEdits: false
    })
  }, [])

  // STTR: Mark that segment was edited (for focus-lost condition)
  const markSegmentEdited = useCallback((guid: string) => {
    const state = segmentTimers.current.get(guid)
    if (state) {
      state.hasEdits = true
    }
  }, [])

  // STTR: Stop timer and return elapsed time (or null if should be ignored)
  const stopSegmentTimer = useCallback((guid: string, wasApproved: boolean): number | null => {
    const state = segmentTimers.current.get(guid)
    if (!state || !state.startTime) {
      return null
    }

    const elapsed = Date.now() - state.startTime

    // Ignore if: focus lost without edits AND not approved
    if (!wasApproved && !state.hasEdits) {
      // Reset timer state but don't record time
      segmentTimers.current.delete(guid)
      return null
    }

    // Clear timer state
    segmentTimers.current.delete(guid)
    return elapsed
  }, [])

  // ATTR: Start page timer when page is shown
  const startPageTimer = useCallback((pageIndex: number) => {
    pageTimer.current = {
      startTime: Date.now(),
      pageIndex
    }
  }, [])

  // ATTR: Stop page timer and return elapsed time
  const stopPageTimer = useCallback(() => {
    if (!pageTimer.current) {
      return null
    }

    const result = {
      pageIndex: pageTimer.current.pageIndex,
      elapsed: Date.now() - pageTimer.current.startTime
    }

    pageTimer.current = null
    return result
  }, [])

  return {
    startSegmentTimer,
    stopSegmentTimer,
    markSegmentEdited,
    startPageTimer,
    stopPageTimer
  }
}
