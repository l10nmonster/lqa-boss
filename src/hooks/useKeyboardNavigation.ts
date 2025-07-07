import { useEffect } from 'react'

interface UseKeyboardNavigationProps {
  currentPageIndex: number
  totalPages: number
  activeSegmentIndex: number
  totalSegments: number
  navigatePage: (direction: number) => void
  setActiveSegmentIndex: (index: number) => void
}

export const useKeyboardNavigation = ({
  currentPageIndex,
  totalPages,
  activeSegmentIndex,
  totalSegments,
  navigatePage,
  setActiveSegmentIndex,
}: UseKeyboardNavigationProps) => {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Tab navigation through segments
      if (e.key === 'Tab') {
        e.preventDefault()
        
        if (totalSegments === 0) {
          // No segments, navigate between pages
          if (e.shiftKey) {
            if (currentPageIndex > 0) navigatePage(-1)
          } else {
            if (currentPageIndex < totalPages - 1) navigatePage(1)
          }
          return
        }

        if (e.shiftKey) {
          // Shift+Tab: Go to previous segment or page
          if (activeSegmentIndex <= 0) {
            if (currentPageIndex > 0) {
              navigatePage(-1)
              // Will set to last segment on previous page in the component
            }
          } else {
            setActiveSegmentIndex(activeSegmentIndex - 1)
          }
        } else {
          // Tab: Go to next segment or page
          if (activeSegmentIndex >= totalSegments - 1) {
            if (currentPageIndex < totalPages - 1) {
              navigatePage(1)
              // Will set to first segment on next page
            }
          } else {
            setActiveSegmentIndex(activeSegmentIndex === -1 ? 0 : activeSegmentIndex + 1)
          }
        }
      }

      // CMD+Enter (or Ctrl+Enter on Windows): Go to next segment
      if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault()
        
        if (totalSegments === 0) return
        
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