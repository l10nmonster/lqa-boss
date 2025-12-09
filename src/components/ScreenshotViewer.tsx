import React, { useState, useEffect, useRef } from 'react'
import { Box, Image, IconButton, Text, Stack, Tooltip, Portal } from '@chakra-ui/react'
import { FiChevronLeft, FiChevronRight, FiCheckCircle } from 'react-icons/fi'
import JSZip from 'jszip'
import { Page } from '../types'

interface ScreenshotViewerProps {
  page: Page
  zipFile: JSZip
  activeSegmentGuid: string | null
  onSegmentClick: (guid: string) => void
  currentPageIndex: number
  totalPages: number
  onNavigatePage: (direction: number) => void
  onMarkAllVisibleAsReviewed: () => void
  getSegmentColor: (guid: string) => string
}

const ScreenshotViewer: React.FC<ScreenshotViewerProps> = ({
  page,
  zipFile,
  activeSegmentGuid,
  onSegmentClick,
  currentPageIndex,
  totalPages,
  onNavigatePage,
  onMarkAllVisibleAsReviewed,
  getSegmentColor,
}) => {
  const [imageUrl, setImageUrl] = useState<string | null>(null)
  const [imageLoaded, setImageLoaded] = useState(false)
  const [displayDimensions, setDisplayDimensions] = useState({ width: 0, height: 0 })
  const imageRef = useRef<HTMLImageElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const segmentRefs = useRef<{ [key: string]: HTMLDivElement | null }>({})

  useEffect(() => {
    const loadImage = async () => {
      try {
        const imageFile = zipFile.file(page.imageFile)
        if (!imageFile) {
          throw new Error(`Image file "${page.imageFile}" not found`)
        }
        
        const imageBase64 = await imageFile.async('base64')
        setImageUrl(`data:image/png;base64,${imageBase64}`)
      } catch (error) {
        console.error('Error loading image:', error)
      }
    }

    loadImage()
  }, [page.imageFile, zipFile])

  const handleImageLoad = () => {
    if (imageRef.current) {
      const naturalWidth = imageRef.current.naturalWidth
      const naturalHeight = imageRef.current.naturalHeight

      // Use the capture's screenshotScale (DPR at capture time), not the viewer's DPR
      // This ensures images display at their logical size regardless of viewer's display
      const captureScale = page.captureInfo?.screenshotScale || 1

      // Display at logical pixel size (natural size / capture scale)
      setDisplayDimensions({
        width: naturalWidth / captureScale,
        height: naturalHeight / captureScale
      })
      setImageLoaded(true)

      console.log('Image loaded:', {
        natural: { width: naturalWidth, height: naturalHeight },
        captureScale,
        display: { width: naturalWidth / captureScale, height: naturalHeight / captureScale }
      })
    }
  }

  // Scroll to active segment when it changes
  useEffect(() => {
    if (!activeSegmentGuid || !imageLoaded) return

    const segmentEl = segmentRefs.current[activeSegmentGuid]
    const container = containerRef.current

    if (segmentEl && container) {
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
      }
    }
  }, [activeSegmentGuid, imageLoaded])

  const calculateHighlightPosition = (segment: any) => {
    if (!imageLoaded) return null

    // Detect coordinate format: normalized (0-1) vs legacy pixels
    // If any coordinate > 1, assume legacy pixel format
    const isNormalized = segment.x <= 1 && segment.y <= 1 &&
                         segment.width <= 1 && segment.height <= 1

    if (isNormalized) {
      // New format: multiply by display dimensions
      return {
        left: segment.x * displayDimensions.width,
        top: segment.y * displayDimensions.height,
        width: segment.width * displayDimensions.width,
        height: segment.height * displayDimensions.height,
      }
    } else {
      // Legacy format: use coordinates directly
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
              display="block"
              m={0}
              p={0}
              borderRadius="lg"
              // Display at logical size
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
            const segmentColor = getSegmentColor(segment.g)

            return (
              <Box
                key={index}
                ref={(el: HTMLDivElement | null) => {
                  segmentRefs.current[segment.g] = el
                }}
                position="absolute"
                left={`${position.left}px`}
                top={`${position.top}px`}
                width={`${position.width}px`}
                height={`${position.height}px`}
                border="3px solid"
                borderColor={segmentColor}
                borderRadius="md"
                cursor="pointer"
                transition="transform 0.2s ease-in-out, box-shadow 0.2s ease-in-out"
                _hover={{
                  transform: 'scale(1.02)',
                  boxShadow: `0 0 8px ${segmentColor}`,
                }}
                bg={isActive ? `${segmentColor}` : 'transparent'}
                opacity={isActive ? 0.3 : 0.7}
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