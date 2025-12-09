import { useMemo } from 'react'
import { FlowData } from '../types'

/**
 * Calculates the optimal left pane width based on screenshot dimensions
 * from flow metadata. Uses page width/height properties to determine
 * a split that balances screenshot visibility with editor usability.
 */
export function useOptimalPaneSplit(
  flowData: FlowData | null
): { optimalLeftWidth: number } {
  const optimalLeftWidth = useMemo(() => {
    if (!flowData?.pages?.length) {
      return 50 // Default 50% split
    }

    const dpr = window.devicePixelRatio || 1

    // Find maximum display width across all pages
    let maxDisplayWidth = 0
    for (const page of flowData.pages) {
      if (page.captureInfo?.screenshotPixelWidth) {
        // Display width is natural size / dpr (same as ScreenshotViewer)
        const displayWidth = page.captureInfo.screenshotPixelWidth / dpr
        maxDisplayWidth = Math.max(maxDisplayWidth, displayWidth)
      }
    }

    if (maxDisplayWidth === 0) {
      return 50 // No dimensions available, use default
    }

    // Get container width (viewport minus padding)
    const containerWidth = window.innerWidth - 64 // 32px padding on each side

    // Calculate what percentage the screenshot needs
    // Add padding for the screenshot container (24px padding in GlassBox)
    const screenshotPaddingPx = 48 // p={6} = 24px * 2
    const neededWidth = maxDisplayWidth + screenshotPaddingPx
    const neededPercentage = (neededWidth / containerWidth) * 100

    // Clamp to reasonable bounds:
    // - Minimum 25% for very narrow screenshots (still shows context)
    // - Maximum 60% to keep editor usable (at least 40% for editor)
    return Math.max(25, Math.min(60, neededPercentage))
  }, [flowData])

  return { optimalLeftWidth }
}
