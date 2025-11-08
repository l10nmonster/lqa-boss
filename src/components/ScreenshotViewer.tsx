import React, { useState, useEffect, useRef } from 'react'
import { Box, Image, IconButton, Text, Stack } from '@chakra-ui/react'
import { FiChevronLeft, FiChevronRight, FiCheckCircle } from 'react-icons/fi'
import JSZip from 'jszip'
import { Page } from '../types'

interface ScreenshotViewerProps {
  page: Page
  zipFile: JSZip
  activeSegmentIndex: number
  onSegmentClick: (index: number) => void
  currentPageIndex: number
  totalPages: number
  onNavigatePage: (direction: number) => void
  onMarkAllVisibleAsReviewed: () => void
}

const ScreenshotViewer: React.FC<ScreenshotViewerProps> = ({
  page,
  zipFile,
  activeSegmentIndex,
  onSegmentClick,
  currentPageIndex,
  totalPages,
  onNavigatePage,
  onMarkAllVisibleAsReviewed,
}) => {
  const [imageUrl, setImageUrl] = useState<string | null>(null)
  const [imageLoaded, setImageLoaded] = useState(false)
  const [displayDimensions, setDisplayDimensions] = useState({ width: 0, height: 0 })
  const imageRef = useRef<HTMLImageElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)

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
      
      // Assume images might be captured at device pixel ratio
      // If on a retina display, the image is likely 2x the logical size
      const dpr = window.devicePixelRatio || 1
      
      // Display at logical pixel size (natural size / dpr)
      setDisplayDimensions({
        width: naturalWidth / dpr,
        height: naturalHeight / dpr
      })
      setImageLoaded(true)
      
      console.log('Image loaded:', {
        natural: { width: naturalWidth, height: naturalHeight },
        dpr,
        display: { width: naturalWidth / dpr, height: naturalHeight / dpr }
      })
    }
  }

  const calculateHighlightPosition = (segment: any) => {
    if (!imageLoaded) return null

    // Segments coordinates are in logical pixels, matching our display size
    return {
      left: segment.x,
      top: segment.y,
      width: segment.width,
      height: segment.height,
    }
  }

  return (
    <Box position="relative" height="100%" display="flex" flexDirection="column" p={6}>
      {/* Navigation Controls */}
      <Stack
        direction="row"
        position="absolute"
        top={10}
        left="50%"
        transform="translateX(-50%)"
        zIndex={10}
        bg="rgba(255, 255, 255, 0.3)"
        borderRadius="full"
        px={3}
        py={1}
        gap={2}
        align="center"
        border="1px solid"
        borderColor="rgba(255, 255, 255, 0.4)"
        backdropFilter="blur(20px)"
        boxShadow="0 4px 16px 0 rgba(59, 130, 246, 0.1)"
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
      </Stack>

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

            return (
              <Box
                key={index}
                position="absolute"
                left={`${position.left}px`}
                top={`${position.top}px`}
                width={`${position.width}px`}
                height={`${position.height}px`}
                border="3px dashed"
                borderColor={index === activeSegmentIndex ? 'blue.500' : 'orange.500'}
                borderRadius="md"
                cursor="pointer"
                transition="all 0.4s ease-in-out"
                _hover={{
                  bg: index === activeSegmentIndex ? 'blue.100' : 'orange.100',
                  transform: 'scale(1.05)',
                }}
                bg={index === activeSegmentIndex ? 'blue.100' : 'transparent'}
                opacity={index === activeSegmentIndex ? 0.4 : 0.6}
                onClick={() => onSegmentClick(index)}
              />
            )
          })}
        </Box>
      </Box>
    </Box>
  )
}

export default ScreenshotViewer 