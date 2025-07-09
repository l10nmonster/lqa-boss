import React from 'react'
import { Badge } from '@chakra-ui/react'

export type FileStatus = 'NEW' | 'SAVED' | 'CHANGED' | 'LOADED'

interface StatusBadgeProps {
  status: FileStatus
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({ status }) => {
  const getStatusConfig = (status: FileStatus) => {
    switch (status) {
      case 'NEW':
        return { bg: 'blue.500', color: 'white', text: 'NEW' }
      case 'SAVED':
        return { bg: 'green.500', color: 'white', text: 'SAVED' }
      case 'CHANGED':
        return { bg: 'red.500', color: 'white', text: 'CHANGED' }
      case 'LOADED':
        return { bg: 'yellow.500', color: 'black', text: 'LOADED' }
      default:
        return { bg: 'gray.500', color: 'white', text: status }
    }
  }

  const config = getStatusConfig(status)

  return (
    <Badge
      bg={config.bg}
      color={config.color}
      variant="solid"
      size="sm"
      fontWeight="bold"
      px={2}
      py={1}
      borderRadius="md"
    >
      {config.text}
    </Badge>
  )
}