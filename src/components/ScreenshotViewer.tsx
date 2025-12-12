import React, { useState, useEffect, useRef } from 'react'
import { Box, Image, IconButton, Text, Stack, Tooltip, Portal } from '@chakra-ui/react'
import { keyframes } from '@emotion/react'
import { FiChevronLeft, FiChevronRight, FiCheckCircle } from 'react-icons/fi'
import { Page } from '../types'

// Glowing pulse animation for newly focused segments (yellow glow)
const glowPulse = keyframes`
  0%, 100% {
    box-shadow: 0 0 5px 2px #FACC15;
  }
  50% {
    box-shadow: 0 0 25px 10px #FACC15;
  }
`

interface ScreenshotViewerProps {
  page: Page
  imageUrl: string | undefined  // Pre-extracted blob URL
  activeSegmentGuid: string | null
  onSegmentClick: (guid: string) => void
  shouldScrollToSegment: boolean
  currentPageIndex: number
  totalPages: number
  onNavigatePage: (direction: number) => void
  onMarkAllVisibleAsReviewed: () => void
  getSegmentColor: (guid: string) => string
}

const ScreenshotViewer: React.FC<ScreenshotViewerProps> = ({
  page,
  imageUrl,
  activeSegmentGuid,
  onSegmentClick,
  shouldScrollToSegment,
  currentPageIndex,
  totalPages,
  onNavigatePage,
  onMarkAllVisibleAsReviewed,
  getSegmentColor,
}) => {
  const [imageLoaded, setImageLoaded] = useState(false)
  const [displayDimensions, setDisplayDimensions] = useState({ width: 0, height: 0 })
  const [animatingSegmentGuid, setAnimatingSegmentGuid] = useState<string | null>(null)
  const imageRef = useRef<HTMLImageElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  // Store all refs for each GUID (multiple segments can share the same GUID)
  const segmentRefs = useRef<{ [key: string]: HTMLDivElement[] }>({})

  // Clear segment refs when page changes to avoid stale refs
  useEffect(() => {
    segmentRefs.current = {}
  }, [page])

  const handleImageLoad = () => {
    if (imageRef.current) {
      const img = imageRef.current
      const naturalWidth = img.naturalWidth
      const naturalHeight = img.naturalHeight
      const captureScale = page.captureInfo?.screenshotScale || 1

      setDisplayDimensions({
        width: naturalWidth / captureScale,
        height: naturalHeight / captureScale
      })
      setImageLoaded(true)
    }
  }

  // Find the closest segment element to the viewport center (Euclidean distance)
  const findClosestSegmentElement = (guid: string, container: HTMLDivElement): HTMLDivElement | null => {
    const elements = segmentRefs.current[guid]
    if (!elements || elements.length === 0) return null
    if (elements.length === 1) return elements[0]

    const containerRect = container.getBoundingClientRect()
    // Use viewport center as reference point
    const viewportCenterX = containerRect.width / 2
    const viewportCenterY = container.scrollTop + containerRect.height / 2

    let closestElement: HTMLDivElement | null = null
    let minDistance = Infinity

    for (const el of elements) {
      // Calculate element center in container coordinates
      const elCenterX = el.offsetLeft + el.offsetWidth / 2
      const elCenterY = el.offsetTop + el.offsetHeight / 2

      // Euclidean distance from viewport center
      const distance = Math.sqrt(
        Math.pow(elCenterX - viewportCenterX, 2) +
        Math.pow(elCenterY - viewportCenterY, 2)
      )

      if (distance < minDistance) {
        minDistance = distance
        closestElement = el
      }
    }

    return closestElement
  }

  // Scroll to active segment only when click came from editor (not from screenshot)
  // Returns true if scrolling was needed, false otherwise
  useEffect(() => {
    if (!activeSegmentGuid || !imageLoaded || !shouldScrollToSegment) {
      setAnimatingSegmentGuid(null)
      return
    }

    const container = containerRef.current
    if (!container) {
      // No scrolling needed, start animation immediately
      setAnimatingSegmentGuid(activeSegmentGuid)
      const timer = setTimeout(() => setAnimatingSegmentGuid(null), 1000)
      return () => clearTimeout(timer)
    }

    const segmentEl = findClosestSegmentElement(activeSegmentGuid, container)

    if (segmentEl) {
      // Calculate if segment is visible in the container
      const containerRect = container.getBoundingClientRect()
      const segmentRect = segmentEl.getBoundingClientRect()

      const segmentTopRelative = segmentRect.top - containerRect.top
      const segmentBottomRelative = segmentRect.bottom - containerRect.top

      const padding = 20
      const isAboveView = segmentTopRelative < padding
      const isBelowView = segmentBottomRelative > containerRect.height - padding

      if (isAboveView || isBelowView) {
        // Scroll to center the segment in the container
        const segmentCenterY = segmentEl.offsetTop + segmentEl.offsetHeight / 2
        const containerCenterY = container.clientHeight / 2
        const scrollTop = segmentCenterY - containerCenterY

        container.scrollTo({
          top: Math.max(0, scrollTop),
          behavior: 'smooth'
        })

        // Wait for scroll to complete before starting animation
        // Estimate scroll duration based on distance (smooth scroll is ~400-500ms typically)
        const scrollDistance = Math.abs(container.scrollTop - scrollTop)
        const scrollDuration = Math.min(500, Math.max(300, scrollDistance * 0.5))

        const scrollTimer = setTimeout(() => {
          setAnimatingSegmentGuid(activeSegmentGuid)
          setTimeout(() => setAnimatingSegmentGuid(null), 1000)
        }, scrollDuration)

        return () => clearTimeout(scrollTimer)
      }
    }

    // No scrolling needed, start animation immediately
    setAnimatingSegmentGuid(activeSegmentGuid)
    const timer = setTimeout(() => setAnimatingSegmentGuid(null), 1000)
    return () => clearTimeout(timer)
  }, [activeSegmentGuid, imageLoaded, shouldScrollToSegment])

  const calculateHighlightPosition = (segment: any) => {
    if (!imageLoaded) return null

    const { width: displayWidth, height: displayHeight } = displayDimensions

    // Detect coordinate format: normalized (0-1) vs legacy pixels
    // If any coordinate > 1, assume legacy pixel format
    const isNormalized = segment.x <= 1 && segment.y <= 1 &&
                         segment.width <= 1 && segment.height <= 1

    if (isNormalized) {
      // New format: multiply by display dimensions
      return {
        left: segment.x * displayWidth,
        top: segment.y * displayHeight,
        width: segment.width * displayWidth,
        height: segment.height * displayHeight,
      }
    } else {
      // Legacy format: coordinates are already in pixels, use as-is
      return {
        left: segment.x,
        top: segment.y,
        width: segment.width,
        height: segment.height,
      }
    }
  }

  return (
    <Box position="relative" height="100%" display="flex" flexDirection="column" p={4} pt={2}>
      {/* Image Container */}
      <Box
        ref={containerRef}
        width="100%"
        flex="1"
        overflow="auto"
        position="relative"
        minHeight={0}
        p={0}
      >
        <Box
          position="relative"
          width={displayDimensions.width ? `${displayDimensions.width}px` : 'auto'}
          height={displayDimensions.height ? `${displayDimensions.height}px` : 'auto'}
          m={0}
          p={0}
          boxShadow="0 0 0 1px rgba(203, 213, 225, 0.5)"
          borderRadius="lg"
        >
          {imageUrl && (
            <Image
              ref={imageRef}
              src={imageUrl}
              onLoad={handleImageLoad}
              display={imageLoaded ? 'block' : 'none'}
              m={0}
              p={0}
              borderRadius="lg"
              width={displayDimensions.width ? `${displayDimensions.width}px` : 'auto'}
              height={displayDimensions.height ? `${displayDimensions.height}px` : 'auto'}
              maxW="none"
              maxH="none"
            />
          )}

          {imageLoaded && page.segments.map((segment, index) => {
            const position = calculateHighlightPosition(segment)
            if (!position) return null

            // Skip invisible segments (width or height is 0)
            if (position.width === 0 || position.height === 0) return null

            const isActive = segment.g === activeSegmentGuid
            const isAnimating = segment.g === animatingSegmentGuid
            const segmentColor = getSegmentColor(segment.g)

            return (
              <Box
                key={index}
                ref={(el: HTMLDivElement | null) => {
                  if (el) {
                    if (!segmentRefs.current[segment.g]) {
                      segmentRefs.current[segment.g] = []
                    }
                    // Avoid duplicates (refs can be called multiple times)
                    if (!segmentRefs.current[segment.g].includes(el)) {
                      segmentRefs.current[segment.g].push(el)
                    }
                  }
                }}
                position="absolute"
                left={`${position.left - 4}px`}
                top={`${position.top - 4}px`}
                width={`${position.width + 8}px`}
                height={`${position.height + 8}px`}
                border="3px solid"
                borderColor={segmentColor}
                borderRadius="md"
                cursor="pointer"
                transition="transform 0.2s ease-in-out, box-shadow 0.2s ease-in-out, opacity 0.2s ease-in-out"
                css={isAnimating ? { animation: `${glowPulse} 1s ease-in-out 1` } : undefined}
                _hover={{
                  transform: 'scale(1.02)',
                  boxShadow: `0 0 8px ${segmentColor}`,
                }}
                bg={isActive ? `${segmentColor}` : 'transparent'}
                opacity={isActive ? 0.5 : 0.7}
                onClick={() => onSegmentClick(segment.g)}
              />
            )
          })}
        </Box>
      </Box>

      {/* Navigation Controls - Hovering at bottom */}
      <Stack
        direction="row"
        justifyContent="center"
        position="absolute"
        bottom={6}
        left={0}
        right={0}
        zIndex={10}
        pointerEvents="none"
      >
        <Stack
          direction="row"
          bg="rgba(255, 255, 255, 0.85)"
          borderRadius="full"
          px={3}
          py={1}
          gap={2}
          align="center"
          border="1px solid"
          borderColor="rgba(255, 255, 255, 0.4)"
          backdropFilter="blur(20px)"
          boxShadow="0 4px 16px 0 rgba(59, 130, 246, 0.15)"
          pointerEvents="auto"
        >
          <IconButton
            aria-label="Previous page"
            onClick={() => onNavigatePage(-1)}
            disabled={currentPageIndex === 0}
            variant="ghost"
            size="sm"
            color="gray.700"
            _hover={{ bg: 'gray.100' }}
          >
            <FiChevronLeft />
          </IconButton>
          <Text color="gray.700" fontSize="sm" fontWeight="semibold" minW="80px" textAlign="center">
            Page {currentPageIndex + 1} of {totalPages}
          </Text>
          <IconButton
            aria-label="Next page"
            onClick={() => onNavigatePage(1)}
            disabled={currentPageIndex === totalPages - 1}
            variant="ghost"
            size="sm"
            color="gray.700"
            _hover={{ bg: 'gray.100' }}
          >
            <FiChevronRight />
          </IconButton>
          <Tooltip.Root openDelay={300} closeDelay={0}>
            <Tooltip.Trigger asChild>
              <IconButton
                aria-label="Mark all visible segments as reviewed"
                size="sm"
                variant="solid"
                onClick={onMarkAllVisibleAsReviewed}
                colorScheme="blue"
                ml={2}
                borderRadius="full"
              >
                <FiCheckCircle />
              </IconButton>
            </Tooltip.Trigger>
            <Portal>
              <Tooltip.Positioner>
                <Tooltip.Content>
                  <Text fontSize="xs">Mark all as reviewed</Text>
                </Tooltip.Content>
              </Tooltip.Positioner>
            </Portal>
          </Tooltip.Root>
        </Stack>
      </Stack>
    </Box>
  )
}

export default ScreenshotViewer
