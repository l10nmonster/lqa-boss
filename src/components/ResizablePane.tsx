import React, { useState, useRef, useEffect } from 'react'
import { Box, Flex } from '@chakra-ui/react'

interface ResizablePaneProps {
  children: [React.ReactNode, React.ReactNode]
  defaultLeftWidth?: number // percentage
  minLeftWidth?: number // percentage
  maxLeftWidth?: number // percentage
}

const ResizablePane: React.FC<ResizablePaneProps> = ({
  children,
  defaultLeftWidth = 50,
  minLeftWidth = 20,
  maxLeftWidth = 80,
}) => {
  const [leftWidth, setLeftWidth] = useState(defaultLeftWidth)
  const [isDragging, setIsDragging] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isDragging || !containerRef.current) return

      const containerRect = containerRef.current.getBoundingClientRect()
      const containerWidth = containerRect.width
      const relativeX = e.clientX - containerRect.left
      const percentage = (relativeX / containerWidth) * 100

      const clampedPercentage = Math.max(minLeftWidth, Math.min(maxLeftWidth, percentage))
      setLeftWidth(clampedPercentage)
    }

    const handleMouseUp = () => {
      setIsDragging(false)
    }

    if (isDragging) {
      document.addEventListener('mousemove', handleMouseMove)
      document.addEventListener('mouseup', handleMouseUp)
      
      // Prevent text selection while dragging
      document.body.style.userSelect = 'none'
      document.body.style.cursor = 'col-resize'
    }

    return () => {
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
      document.body.style.userSelect = ''
      document.body.style.cursor = ''
    }
  }, [isDragging, minLeftWidth, maxLeftWidth])

  return (
    <Flex
      ref={containerRef}
      position="relative"
      width="100%"
      height="100%"
      overflow="hidden"
    >
      {/* Left Pane */}
      <Box
        width={`${leftWidth}%`}
        height="100%"
        overflow="hidden"
        position="relative"
        minWidth={0}
      >
        {children[0]}
      </Box>

      {/* Divider */}
      <Box
        position="relative"
        width="12px"
        height="100%"
        cursor="col-resize"
        flexShrink={0}
        _hover={{
          '&::after': {
            opacity: 1,
          }
        }}
        onMouseDown={() => setIsDragging(true)}
      >
        <Box
          position="absolute"
          left="50%"
          transform="translateX(-50%)"
          width="1px"
          height="100%"
          bg="whiteAlpha.300"
        />
        <Box
          position="absolute"
          left="50%"
          top="50%"
          transform="translate(-50%, -50%)"
          width="4px"
          height="40px"
          bg="whiteAlpha.500"
          borderRadius="full"
          opacity={isDragging ? 1 : 0.5}
          transition="opacity 0.2s"
          _after={{
            content: '""',
            position: 'absolute',
            left: '50%',
            top: '50%',
            transform: 'translate(-50%, -50%)',
            width: '40px',
            height: '100px',
            opacity: 0,
            transition: 'opacity 0.2s',
          }}
        />
      </Box>

      {/* Right Pane */}
      <Box
        flex="1"
        height="100%"
        overflow="hidden"
        position="relative"
        minWidth={0}
      >
        {children[1]}
      </Box>
    </Flex>
  )
}

export default ResizablePane 