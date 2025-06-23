import React from 'react'
import { Box, BoxProps } from '@chakra-ui/react'

interface GlassBoxProps extends BoxProps {}

const GlassBox: React.FC<GlassBoxProps> = ({ children, ...props }) => {
  return (
    <Box
      bg="rgba(255, 255, 255, 0.1)"
      backdropFilter="blur(20px)"
      borderRadius="2xl"
      border="1px solid"
      borderColor="rgba(255, 255, 255, 0.3)"
      boxShadow="0 8px 32px 0 rgba(31, 38, 135, 0.37)"
      position="relative"
      overflow="hidden"
      _before={{
        content: '""',
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: 'linear-gradient(135deg, rgba(255, 255, 255, 0.1) 0%, rgba(255, 255, 255, 0) 100%)',
        pointerEvents: 'none',
      }}
      transition="all 0.3s ease"
      _hover={{
        transform: 'translateY(-2px)',
        boxShadow: '0 12px 40px 0 rgba(31, 38, 135, 0.45)',
        borderColor: 'rgba(255, 255, 255, 0.4)',
      }}
      {...props}
    >
      {children}
    </Box>
  )
}

export default GlassBox 