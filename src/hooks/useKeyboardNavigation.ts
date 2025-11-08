import { useEffect } from 'react'

interface UseKeyboardNavigationProps {
  currentPageIndex: number
  totalPages: number
  activeSegmentIndex: number
  totalSegments: number
  navigatePage: (direction: number) => void
  setActiveSegmentIndex: (index: number) => void
  onBeforeNavigate?: () => void
}

export const useKeyboardNavigation = ({
  currentPageIndex,
  totalPages,
  activeSegmentIndex,
  totalSegments,
  navigatePage,
  setActiveSegmentIndex,
  onBeforeNavigate,
}: UseKeyboardNavigationProps) => {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // CMD+Enter (or Ctrl+Enter on Windows): Go to next segment
      if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault()

        if (totalSegments === 0) return

        // Call onBeforeNavigate to mark current segment as reviewed
        if (onBeforeNavigate && activeSegmentIndex >= 0) {
          onBeforeNavigate()
        }

        // Move to next segment or page
        if (activeSegmentIndex >= totalSegments - 1) {
          if (currentPageIndex < totalPages - 1) {
            navigatePage(1)
            // Will set to first segment on next page
          }
        } else {
          setActiveSegmentIndex(activeSegmentIndex === -1 ? 0 : activeSegmentIndex + 1)
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
    activeSegmentIndex,
    totalSegments,
    navigatePage,
    setActiveSegmentIndex,
  ])
} 