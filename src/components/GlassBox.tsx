import React from 'react'
import { Box, BoxProps } from '@chakra-ui/react'

interface GlassBoxProps extends BoxProps {}

const GlassBox: React.FC<GlassBoxProps> = ({ children, ...props }) => {
  return (
    <Box
      bg="rgba(255, 255, 255, 0.25)"
      backdropFilter="blur(25px)"
      borderRadius="2xl"
      border="1px solid"
      borderColor="rgba(255, 255, 255, 0.3)"
      boxShadow="0 8px 32px 0 rgba(59, 130, 246, 0.15), 0 2px 16px 0 rgba(59, 130, 246, 0.1)"
      position="relative"
      overflow="hidden"
      _before={{
        content: '""',
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: 'linear-gradient(135deg, rgba(255, 255, 255, 0.4) 0%, rgba(255, 255, 255, 0.1) 50%, rgba(255, 255, 255, 0.2) 100%)',
        pointerEvents: 'none',
      }}
      _after={{
        content: '""',
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        height: '1px',
        background: 'linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.6), transparent)',
        pointerEvents: 'none',
      }}
      transition="all 0.3s ease"
      _hover={{
        transform: 'translateY(-2px)',
        boxShadow: '0 12px 40px 0 rgba(59, 130, 246, 0.2), 0 4px 20px 0 rgba(59, 130, 246, 0.15)',
        borderColor: 'rgba(255, 255, 255, 0.4)',
        bg: 'rgba(255, 255, 255, 0.3)',
      }}
      {...props}
    >
      {children}
    </Box>
  )
}

export default GlassBox 