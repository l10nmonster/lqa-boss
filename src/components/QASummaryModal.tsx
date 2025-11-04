import React from 'react'
import {
  Box,
  Text,
  Button,
  Portal,
  Separator,
} from '@chakra-ui/react'
import { FiX } from 'react-icons/fi'
import { QualityModel } from '../types/qualityModel'
import { QASummary, TERStatistics } from '../utils/metrics'

interface QASummaryModalProps {
  isOpen: boolean
  onClose: () => void
  qualityModel: QualityModel | null
  qaSummary: QASummary
  terStats: TERStatistics | null
  ter: number | null
  ept: number | null
}

const QASummaryModal: React.FC<QASummaryModalProps> = ({
  isOpen,
  onClose,
  qualityModel,
  qaSummary,
  terStats,
  ter,
  ept,
}) => {
  if (!isOpen) return null

  return (
    <Portal>
      {/* Overlay */}
      <Box
        position="fixed"
        top="0"
        left="0"
        right="0"
        bottom="0"
        bg="blackAlpha.600"
        backdropFilter="blur(10px)"
        zIndex="overlay"
        onClick={onClose}
      />

      {/* Modal Content */}
      <Box
        position="fixed"
        top="50%"
        left="50%"
        transform="translate(-50%, -50%)"
        zIndex="modal"
        maxW="2xl"
        w="90%"
        maxH="80vh"
        bg="white"
        backdropFilter="blur(20px)"
        border="1px solid"
        borderColor="gray.200"
        boxShadow="xl"
        borderRadius="xl"
        overflow="hidden"
        data-testid="qa-summary-modal"
      >
        {/* Header */}
        <Box
          p={6}
          borderBottom="1px solid"
          borderColor="gray.100"
          display="flex"
          alignItems="center"
          justifyContent="space-between"
        >
          <Text
            fontSize="xl"
            fontWeight="bold"
            color="gray.700"
          >
            📊 Quality Summary
          </Text>
          <Button
            variant="ghost"
            size="sm"
            onClick={onClose}
            color="gray.500"
            _hover={{ color: "gray.700" }}
            aria-label="close modal"
          >
            <FiX size={20} />
          </Button>
        </Box>

        {/* Body */}
        <Box p={6} overflow="auto" maxH="60vh">
          {/* QA Errors Summary */}
          {qualityModel && (
            <>
              <Box mb={4}>
                <Text
                  fontSize="lg"
                  fontWeight="semibold"
                  color="gray.700"
                  mb={3}
                >
                  Quality Assessment Errors
                </Text>
                <Box
                  bg="gray.50"
                  p={3}
                  borderRadius="md"
                  border="1px solid"
                  borderColor="gray.200"
                  mb={3}
                >
                  <Text fontSize="sm" color="gray.700" mb={1}>
                    Total Errors: <Text as="span" fontWeight="bold" color="blue.600">{qaSummary.totalErrors}</Text>
                  </Text>
                  <Text fontSize="sm" color="gray.700" mb={1}>
                    Total Weight: <Text as="span" fontWeight="bold" color="blue.600">{qaSummary.totalWeight}</Text>
                  </Text>
                  <Text fontSize="sm" color="gray.700">
                    EPT (Errors Per Thousand words): <Text as="span" fontWeight="bold" color="blue.600">{typeof ept === 'number' ? `${ept.toFixed(1)}` : 'N/A'}</Text>
                  </Text>
                </Box>

                {/* Severity Breakdown - show when there are errors OR unassessed items */}
                {(qaSummary.totalErrors > 0 || qaSummary.unassessedSeverity > 0) && (
                  <Box mb={3}>
                    <Text fontSize="md" fontWeight="semibold" color="gray.700" mb={2}>
                      By Severity
                    </Text>
                    <Box
                      bg="gray.50"
                      p={3}
                      borderRadius="md"
                      border="1px solid"
                      borderColor="gray.200"
                    >
                      {qualityModel.severities.map(severity => {
                        const count = qaSummary.severityBreakdown[severity.id] || 0
                        if (count === 0) return null
                        return (
                          <Text key={severity.id} fontSize="sm" color="gray.700" mb={1}>
                            {severity.label}: <Text as="span" fontWeight="bold" color="blue.600">{count}</Text> {qaSummary.totalErrors > 0 && `(${((count / qaSummary.totalErrors) * 100).toFixed(1)}%)`}
                          </Text>
                        )
                      })}
                      {qaSummary.unassessedSeverity > 0 && (
                        <Text fontSize="sm" color="gray.700" mb={1}>
                          Unassessed: <Text as="span" fontWeight="bold" color="red.600">{qaSummary.unassessedSeverity}</Text>
                        </Text>
                      )}
                    </Box>
                  </Box>
                )}

                {/* Category Breakdown - show when there are errors OR unassessed items */}
                {(qaSummary.totalErrors > 0 || qaSummary.unassessedCategory > 0) && (
                  <Box>
                    <Text fontSize="md" fontWeight="semibold" color="gray.700" mb={2}>
                      By Category
                    </Text>
                    <Box
                      bg="gray.50"
                      p={3}
                      borderRadius="md"
                      border="1px solid"
                      borderColor="gray.200"
                    >
                      {qualityModel.errorCategories.map(category => {
                        return category.subcategories.map(sub => {
                          const key = `${category.id}.${sub.id}`
                          const count = qaSummary.categoryBreakdown[key] || 0
                          if (count === 0) return null
                          return (
                            <Text key={key} fontSize="sm" color="gray.700" mb={1}>
                              {category.label} → {sub.label}: <Text as="span" fontWeight="bold" color="blue.600">{count}</Text> {qaSummary.totalErrors > 0 && `(${((count / qaSummary.totalErrors) * 100).toFixed(1)}%)`}
                            </Text>
                          )
                        })
                      })}
                      {qaSummary.unassessedCategory > 0 && (
                        <Text fontSize="sm" color="gray.700" mb={1}>
                          Unassessed: <Text as="span" fontWeight="bold" color="red.600">{qaSummary.unassessedCategory}</Text>
                        </Text>
                      )}
                    </Box>
                  </Box>
                )}
              </Box>
            </>
          )}

          {/* TER Statistics */}
          {terStats && (
            <>
              {qualityModel && <Separator my={4} />}
              <Box mb={4}>
                <Text fontSize="lg" fontWeight="semibold" color="gray.700" mb={2}>
                  Translation Edit Rate
                </Text>
                <Box
                  bg="gray.50"
                  p={3}
                  borderRadius="md"
                  border="1px solid"
                  borderColor="gray.200"
                >
                  <Text fontSize="sm" color="gray.700" mb={1}>
                    TER: <Text as="span" fontWeight="bold" color="blue.600">{typeof ter === 'number' ? `${(ter * 100).toFixed(0)}%` : 'N/A'}</Text>
                  </Text>
                  <Text fontSize="sm" color="gray.700" mb={1}>
                    Input: <Text as="span" fontWeight="bold" color="blue.600">{terStats.totalSegments}</Text> segments, <Text as="span" fontWeight="bold" color="blue.600">{terStats.totalWords}</Text> words
                  </Text>
                  <Text fontSize="sm" color="gray.700" mb={1}>
                    Corrected: <Text as="span" fontWeight="bold" color="blue.600">{terStats.changedSegments}</Text> segments, Edit distance: <Text as="span" fontWeight="bold" color="blue.600">{terStats.editDistance}</Text>
                  </Text>
                </Box>
              </Box>
            </>
          )}

          {/* No data message */}
          {!qualityModel && !terStats && (
            <Text color="gray.600" textAlign="center">
              No quality data available yet. Start by loading a quality model and assessing segments.
            </Text>
          )}
        </Box>
      </Box>
    </Portal>
  )
}

export default QASummaryModal
