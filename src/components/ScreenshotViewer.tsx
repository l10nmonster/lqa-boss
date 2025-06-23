import React, { useState, useEffect, useRef } from 'react'
import { Box, Image } from '@chakra-ui/react'
import JSZip from 'jszip'
import { Page } from '../types'

interface ScreenshotViewerProps {
  page: Page
  zipFile: JSZip
  activeSegmentIndex: number
  onSegmentClick: (index: number) => void
}

const ScreenshotViewer: React.FC<ScreenshotViewerProps> = ({
  page,
  zipFile,
  activeSegmentIndex,
  onSegmentClick,
}) => {
  const [imageUrl, setImageUrl] = useState<string>('')
  const [imageLoaded, setImageLoaded] = useState(false)
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
    setImageLoaded(true)
  }

  const calculateHighlightPosition = (segment: any) => {
    if (!imageRef.current || !imageLoaded) return null

    const dpr = window.devicePixelRatio || 1
    const displayedWidth = imageRef.current.offsetWidth
    const displayedHeight = imageRef.current.offsetHeight
    const naturalWidth = imageRef.current.naturalWidth
    const naturalHeight = imageRef.current.naturalHeight

    if (displayedWidth === 0 || naturalWidth === 0) return null

    const intendedLogicalWidth = naturalWidth / dpr
    const intendedLogicalHeight = naturalHeight / dpr
    const scaleX = displayedWidth / intendedLogicalWidth
    const scaleY = displayedHeight / intendedLogicalHeight

    return {
      left: segment.x * scaleX,
      top: segment.y * scaleY,
      width: segment.width * scaleX,
      height: segment.height * scaleY,
    }
  }

  return (
    <Box position="relative" ref={containerRef}>
      <Image
        ref={imageRef}
        src={imageUrl}
        onLoad={handleImageLoad}
        border="1px solid"
        borderColor="whiteAlpha.300"
        borderRadius="lg"
        maxW="100%"
        height="auto"
      />
      
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
            borderColor={index === activeSegmentIndex ? 'blue.400' : 'red.400'}
            borderRadius="md"
            cursor="pointer"
            transition="all 0.2s"
            _hover={{
              bg: 'whiteAlpha.200',
              transform: 'scale(1.05)',
            }}
            bg={index === activeSegmentIndex ? 'blue.200' : 'transparent'}
            opacity={index === activeSegmentIndex ? 0.3 : 0.7}
            onClick={() => onSegmentClick(index)}
          />
        )
      })}
    </Box>
  )
}

export default ScreenshotViewer 