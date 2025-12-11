import { useEffect } from 'react'

interface UseKeyboardNavigationProps {
  currentPageIndex: number
  totalPages: number
  activeSegmentGuid: string | null
  segmentGuids: string[]  // Ordered list of guids for navigation
  navigatePage: (direction: number) => void
  setActiveSegmentGuid: (guid: string | null, source?: 'screenshot' | 'editor' | null) => void
  onBeforeNavigate?: () => void
}

export const useKeyboardNavigation = ({
  currentPageIndex,
  totalPages,
  activeSegmentGuid,
  segmentGuids,
  navigatePage,
  setActiveSegmentGuid,
  onBeforeNavigate,
}: UseKeyboardNavigationProps) => {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // CMD+Enter (or Ctrl+Enter on Windows): Go to next segment
      if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault()

        if (segmentGuids.length === 0) return

        // Call onBeforeNavigate to mark current segment as reviewed
        if (onBeforeNavigate && activeSegmentGuid) {
          onBeforeNavigate()
        }

        // Find current index in the list
        const currentIndex = activeSegmentGuid ? segmentGuids.indexOf(activeSegmentGuid) : -1

        // Move to next segment or page
        if (currentIndex >= segmentGuids.length - 1) {
          if (currentPageIndex < totalPages - 1) {
            navigatePage(1)
            // Will set to first segment on next page
          }
        } else {
          const nextIndex = currentIndex === -1 ? 0 : currentIndex + 1
          setActiveSegmentGuid(segmentGuids[nextIndex], 'editor')
        }
      }

      // Arrow key navigation for pages
      if (e.key === 'ArrowLeft' && e.ctrlKey) {
        if (currentPageIndex > 0) navigatePage(-1)
      }
      if (e.key === 'ArrowRight' && e.ctrlKey) {
        if (currentPageIndex < totalPages - 1) navigatePage(1)
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [
    currentPageIndex,
    totalPages,
    activeSegmentGuid,
    segmentGuids,
    navigatePage,
    setActiveSegmentGuid,
  ])
} 