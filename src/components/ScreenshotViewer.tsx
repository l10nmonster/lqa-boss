import React, { useState, useEffect, useRef } from 'react'
import { Box, Image, IconButton, Text, Stack, Tooltip, Portal } from '@chakra-ui/react'
import { FiChevronLeft, FiChevronRight, FiCheckCircle } from 'react-icons/fi'
import JSZip from 'jszip'
import { Page } from '../types'

interface ScreenshotViewerProps {
  page: Page
  pages: Page[]  // All pages for preloading
  zipFile: JSZip
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
  pages,
  zipFile,
  activeSegmentGuid,
  onSegmentClick,
  shouldScrollToSegment,
  currentPageIndex,
  totalPages,
  onNavigatePage,
  onMarkAllVisibleAsReviewed,
  getSegmentColor,
}) => {
  const [imageUrl, setImageUrl] = useState<string | null>(null)
  const [imageLoaded, setImageLoaded] = useState(false)
  const [segmentsVisible, setSegmentsVisible] = useState(false)  // Delayed for perf
  const [displayDimensions, setDisplayDimensions] = useState({ width: 0, height: 0 })
  const [containerWidth, setContainerWidth] = useState(0)
  const imageRef = useRef<HTMLImageElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const segmentRefs = useRef<{ [key: string]: HTMLDivElement | null }>({})

  // Image cache: maps imageFile path to { blobUrl, bitmap }
  // bitmap is pre-decoded for instant GPU display
  const imageCache = useRef<Map<string, { blobUrl: string; bitmap?: ImageBitmap }>>(new Map())

  // LRU tracking for ImageBitmaps to limit memory usage
  // Only keep MAX_BITMAP_CACHE bitmaps in memory (~500MB each for large images)
  const MAX_BITMAP_CACHE = 3
  const bitmapLRU = useRef<string[]>([])  // Oldest first, newest last

  // Track container width for responsive scaling
  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        setContainerWidth(entry.contentRect.width)
      }
    })

    observer.observe(container)
    setContainerWidth(container.clientWidth)

    return () => observer.disconnect()
  }, [])

  // Calculate scale factor: if container is smaller than logical image width, scale down
  const scaleFactor = displayDimensions.width > 0 && containerWidth > 0
    ? Math.min(1, containerWidth / displayDimensions.width)
    : 1

  const scaledWidth = displayDimensions.width * scaleFactor
  const scaledHeight = displayDimensions.height * scaleFactor

  // Helper to load image from ZIP, pre-decode, and cache
  const loadImageToCache = async (imageFilePath: string): Promise<string | null> => {
    // Check cache first
    const cached = imageCache.current.get(imageFilePath)
    if (cached) {
      console.log(`[PERF] Cache HIT for ${imageFilePath} (pre-decoded: ${!!cached.bitmap})`)

      // Update LRU order if this has a bitmap (move to end = most recent)
      if (cached.bitmap) {
        const idx = bitmapLRU.current.indexOf(imageFilePath)
        if (idx > -1) {
          bitmapLRU.current.splice(idx, 1)
          bitmapLRU.current.push(imageFilePath)
        }
      }

      return cached.blobUrl
    }

    console.log(`[PERF] Cache MISS for ${imageFilePath}, loading from ZIP...`)
    const startTotal = performance.now()

    try {
      const imageFile = zipFile.file(imageFilePath)
      if (!imageFile) {
        console.error(`Image file "${imageFilePath}" not found`)
        return null
      }

      // Use blob instead of base64 - much faster for large files
      const startExtract = performance.now()
      const imageBlob = await imageFile.async('blob')
      const extractTime = performance.now() - startExtract
      console.log(`[PERF] ZIP extract: ${extractTime.toFixed(0)}ms (${(imageBlob.size / 1024 / 1024).toFixed(1)}MB)`)

      const startBlobUrl = performance.now()
      const blobUrl = URL.createObjectURL(imageBlob)
      const blobUrlTime = performance.now() - startBlobUrl
      console.log(`[PERF] createObjectURL: ${blobUrlTime.toFixed(0)}ms`)

      // Pre-decode image for instant GPU display
      const startDecode = performance.now()
      let bitmap: ImageBitmap | undefined
      try {
        bitmap = await createImageBitmap(imageBlob)
        const decodeTime = performance.now() - startDecode
        console.log(`[PERF] createImageBitmap (pre-decode): ${decodeTime.toFixed(0)}ms`)

        // LRU eviction: if we have too many bitmaps, evict oldest
        if (bitmap && bitmapLRU.current.length >= MAX_BITMAP_CACHE) {
          const oldest = bitmapLRU.current.shift()
          if (oldest) {
            const oldCached = imageCache.current.get(oldest)
            if (oldCached?.bitmap) {
              console.log(`[PERF] Evicting bitmap for ${oldest} to save memory`)
              oldCached.bitmap.close()  // Release GPU memory
              oldCached.bitmap = undefined
            }
          }
        }

        // Add new bitmap to LRU
        if (bitmap) {
          bitmapLRU.current.push(imageFilePath)
        }
      } catch (e) {
        console.warn(`[PERF] createImageBitmap failed, will decode on display`)
      }

      // Cache the blob URL and bitmap
      imageCache.current.set(imageFilePath, { blobUrl, bitmap })

      const totalTime = performance.now() - startTotal
      console.log(`[PERF] Total load time: ${totalTime.toFixed(0)}ms`)

      return blobUrl
    } catch (error) {
      console.error('Error loading image:', error)
      return null
    }
  }

  // Track when we started loading for measuring browser decode time
  const loadStartTime = useRef<number>(0)

  useEffect(() => {
    // Reset state immediately when page changes to hide old overlays
    setImageLoaded(false)
    setSegmentsVisible(false)
    setDisplayDimensions({ width: 0, height: 0 })
    setImageUrl(null)  // Clear so we can detect canvas vs img path

    console.log(`[PERF] === Page change to: ${page.imageFile} ===`)
    loadStartTime.current = performance.now()

    const loadCurrentImage = async () => {
      const blobUrl = await loadImageToCache(page.imageFile)
      if (blobUrl) {
        const cached = imageCache.current.get(page.imageFile)

        // If we have a pre-decoded bitmap, draw directly to canvas (instant!)
        if (cached?.bitmap && canvasRef.current) {
          const bitmap = cached.bitmap
          const canvas = canvasRef.current
          const ctx = canvas.getContext('2d')

          if (ctx) {
            const drawStart = performance.now()

            // Set canvas size to bitmap size
            canvas.width = bitmap.width
            canvas.height = bitmap.height

            // Draw the pre-decoded bitmap
            ctx.drawImage(bitmap, 0, 0)

            const captureScale = page.captureInfo?.screenshotScale || 1
            setDisplayDimensions({
              width: bitmap.width / captureScale,
              height: bitmap.height / captureScale
            })
            setImageLoaded(true)

            const drawTime = performance.now() - drawStart
            console.log(`[PERF] Canvas draw from bitmap: ${drawTime.toFixed(0)}ms`)
            console.log(`[PERF] Image: ${bitmap.width}x${bitmap.height} → display: ${bitmap.width / captureScale}x${bitmap.height / captureScale}`)
            console.log(`[PERF] Segments: ${page.segments?.length || 0}`)

            // Show image first, then render segments after a frame (two-phase)
            requestAnimationFrame(() => {
              const imageShownTime = performance.now() - loadStartTime.current
              console.log(`[PERF] Image shown: ${imageShownTime.toFixed(0)}ms`)

              // Now render segments
              setSegmentsVisible(true)

              requestAnimationFrame(() => {
                const totalTime = performance.now() - loadStartTime.current
                console.log(`[PERF] === PAINTED with segments: ${totalTime.toFixed(0)}ms ===`)
              })

              // Preload adjacent pages after current is displayed
              preloadAdjacentPages()
            })
            return
          }
        }

        // Fallback: use img element (slower, needs decode)
        console.log(`[PERF] Falling back to img element...`)
        setImageUrl(blobUrl)
      }

      // Preload adjacent pages
      preloadAdjacentPages()
    }

    // Helper to preload adjacent pages
    const preloadAdjacentPages = () => {
      const adjacentIndices = [currentPageIndex - 1, currentPageIndex + 1]
      for (const idx of adjacentIndices) {
        if (idx >= 0 && idx < pages.length) {
          const adjacentPage = pages[idx]
          if (adjacentPage && !imageCache.current.has(adjacentPage.imageFile)) {
            console.log(`[PERF] Preloading adjacent page: ${adjacentPage.imageFile}`)
            loadImageToCache(adjacentPage.imageFile)
          }
        }
      }
    }

    loadCurrentImage()
  }, [page.imageFile, zipFile, currentPageIndex, pages])

  const handleImageLoad = async () => {
    const onLoadTime = performance.now() - loadStartTime.current
    console.log(`[PERF] onLoad fired: ${onLoadTime.toFixed(0)}ms`)

    if (imageRef.current) {
      const img = imageRef.current

      // Call decode() to ensure image is fully GPU-ready before showing
      try {
        const decodeStart = performance.now()
        await img.decode()
        const decodeTime = performance.now() - decodeStart
        console.log(`[PERF] img.decode() after onLoad: ${decodeTime.toFixed(0)}ms`)
      } catch (e) {
        console.log(`[PERF] decode() not needed or failed, continuing...`)
      }

      const naturalWidth = img.naturalWidth
      const naturalHeight = img.naturalHeight
      const captureScale = page.captureInfo?.screenshotScale || 1

      setDisplayDimensions({
        width: naturalWidth / captureScale,
        height: naturalHeight / captureScale
      })
      setImageLoaded(true)

      console.log(`[PERF] Image: ${naturalWidth}x${naturalHeight} → display: ${naturalWidth / captureScale}x${naturalHeight / captureScale}`)
      console.log(`[PERF] Segments: ${page.segments?.length || 0}`)

      // Two-phase: show image first, then segments
      requestAnimationFrame(() => {
        const imageShownTime = performance.now() - loadStartTime.current
        console.log(`[PERF] Image shown (fallback): ${imageShownTime.toFixed(0)}ms`)
        setSegmentsVisible(true)
      })
    }
  }

  // Scroll to active segment only when click came from editor (not from screenshot)
  useEffect(() => {
    if (!activeSegmentGuid || !imageLoaded || !shouldScrollToSegment) return

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
  }, [activeSegmentGuid, imageLoaded, shouldScrollToSegment])

  const calculateHighlightPosition = (segment: any) => {
    if (!segmentsVisible) return null

    // Detect coordinate format: normalized (0-1) vs legacy pixels
    // If any coordinate > 1, assume legacy pixel format
    const isNormalized = segment.x <= 1 && segment.y <= 1 &&
                         segment.width <= 1 && segment.height <= 1

    if (isNormalized) {
      // New format: multiply by scaled dimensions
      return {
        left: segment.x * scaledWidth,
        top: segment.y * scaledHeight,
        width: segment.width * scaledWidth,
        height: segment.height * scaledHeight,
      }
    } else {
      // Legacy format: apply scale factor to pixel coordinates
      return {
        left: segment.x * scaleFactor,
        top: segment.y * scaleFactor,
        width: segment.width * scaleFactor,
        height: segment.height * scaleFactor,
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
          width={scaledWidth ? `${scaledWidth}px` : 'auto'}
          height={scaledHeight ? `${scaledHeight}px` : 'auto'}
          m={0}
          p={0}
          boxShadow="0 0 0 1px rgba(203, 213, 225, 0.5)"
          borderRadius="lg"
        >
          {/* Canvas for pre-decoded bitmap (instant display) */}
          <canvas
            ref={canvasRef}
            style={{
              display: imageLoaded && !imageUrl ? 'block' : 'none',
              width: scaledWidth ? `${scaledWidth}px` : 'auto',
              height: scaledHeight ? `${scaledHeight}px` : 'auto',
              borderRadius: '0.5rem',
            }}
          />
          {/* Fallback img element (slower, needs browser decode) */}
          {imageUrl && (
            <Image
              ref={imageRef}
              src={imageUrl}
              onLoad={handleImageLoad}
              display={imageLoaded && imageUrl ? 'block' : 'none'}
              m={0}
              p={0}
              borderRadius="lg"
              width={scaledWidth ? `${scaledWidth}px` : 'auto'}
              height={scaledHeight ? `${scaledHeight}px` : 'auto'}
              maxW="none"
              maxH="none"
              opacity={imageLoaded ? 1 : 0}
            />
          )}
          
          {segmentsVisible && page.segments.map((segment, index) => {
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