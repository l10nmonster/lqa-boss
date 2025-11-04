import React, { useState, useEffect } from 'react'
import {
  Box,
  Text,
  Button,
  Portal,
  Input,
  Stack,
  Textarea,
  Separator,
  IconButton,
  Field,
  Grid,
} from '@chakra-ui/react'
import { FiX, FiPlus, FiTrash2 } from 'react-icons/fi'
import { QualityModel, Severity, ErrorCategory, ErrorSubcategory } from '../types/qualityModel'

interface ModelEditorProps {
  isOpen: boolean
  onClose: () => void
  model: QualityModel | null
  onSave: (model: QualityModel) => void
}

export const ModelEditor: React.FC<ModelEditorProps> = ({
  isOpen,
  onClose,
  model,
  onSave,
}) => {
  const [editedModel, setEditedModel] = useState<QualityModel | null>(null)

  useEffect(() => {
    if (isOpen) {
      if (model) {
        // Deep copy when opening
        setEditedModel(JSON.parse(JSON.stringify(model)))
      }
    } else {
      // Reset when closing
      setEditedModel(null)
    }
  }, [isOpen, model])

  if (!isOpen) return null
  if (!model) return null
  if (!editedModel) return null

  const validateModel = (): string[] => {
    const errors: string[] = []

    // Validate basic info
    if (!editedModel.id.trim()) errors.push('Model ID is required')
    if (!editedModel.name.trim()) errors.push('Model name is required')
    if (!editedModel.version.trim()) errors.push('Version is required')
    if (!editedModel.description.trim()) errors.push('Description is required')

    // Validate severities
    if (editedModel.severities.length === 0) {
      errors.push('At least one severity is required')
    } else {
      editedModel.severities.forEach((severity, idx) => {
        if (!severity.id.trim()) errors.push(`Severity ${idx + 1}: ID is required`)
        if (!severity.label.trim()) errors.push(`Severity ${idx + 1}: Label is required`)
        if (!severity.description.trim()) errors.push(`Severity ${idx + 1}: Description is required`)
        if (isNaN(severity.weight) || severity.weight < 0) errors.push(`Severity ${idx + 1}: Weight must be a non-negative number`)
      })
    }

    // Validate error categories
    if (editedModel.errorCategories.length === 0) {
      errors.push('At least one error category is required')
    } else {
      editedModel.errorCategories.forEach((category, catIdx) => {
        if (!category.id.trim()) errors.push(`Category ${catIdx + 1}: ID is required`)
        if (!category.label.trim()) errors.push(`Category ${catIdx + 1}: Label is required`)
        if (!category.description.trim()) errors.push(`Category ${catIdx + 1}: Description is required`)

        if (category.subcategories.length === 0) {
          errors.push(`Category ${catIdx + 1}: At least one subcategory is required`)
        } else {
          category.subcategories.forEach((sub, subIdx) => {
            if (!sub.id.trim()) errors.push(`Category ${catIdx + 1}, Subcategory ${subIdx + 1}: ID is required`)
            if (!sub.label.trim()) errors.push(`Category ${catIdx + 1}, Subcategory ${subIdx + 1}: Label is required`)
            if (!sub.description.trim()) errors.push(`Category ${catIdx + 1}, Subcategory ${subIdx + 1}: Description is required`)
          })
        }
      })
    }

    return errors
  }

  const handleSave = async () => {
    // Validate the model
    const errors = validateModel()
    if (errors.length > 0) {
      alert('Please fix the following errors:\n\n' + errors.join('\n'))
      return
    }

    // Create file picker to save locally
    try {
      const blob = new Blob([JSON.stringify(editedModel, null, 2)], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `${editedModel.id}-${editedModel.version}.json`
      a.click()
      URL.revokeObjectURL(url)

      // Also save to app state
      onSave(editedModel)
      onClose()
    } catch (error) {
      console.error('Error saving model:', error)
    }
  }

  const addSeverity = () => {
    setEditedModel({
      ...editedModel,
      severities: [
        ...editedModel.severities,
        { id: '', label: '', weight: 1, description: '' }
      ]
    })
  }

  const removeSeverity = (index: number) => {
    setEditedModel({
      ...editedModel,
      severities: editedModel.severities.filter((_, i) => i !== index)
    })
  }

  const updateSeverity = (index: number, field: keyof Severity, value: string | number) => {
    const newSeverities = [...editedModel.severities]
    newSeverities[index] = { ...newSeverities[index], [field]: value }
    setEditedModel({ ...editedModel, severities: newSeverities })
  }

  const addCategory = () => {
    setEditedModel({
      ...editedModel,
      errorCategories: [
        ...editedModel.errorCategories,
        { id: '', label: '', description: '', subcategories: [] }
      ]
    })
  }

  const removeCategory = (index: number) => {
    setEditedModel({
      ...editedModel,
      errorCategories: editedModel.errorCategories.filter((_, i) => i !== index)
    })
  }

  const updateCategory = (index: number, field: keyof ErrorCategory, value: string) => {
    const newCategories = [...editedModel.errorCategories]
    if (field !== 'subcategories') {
      newCategories[index] = { ...newCategories[index], [field]: value }
      setEditedModel({ ...editedModel, errorCategories: newCategories })
    }
  }

  const addSubcategory = (categoryIndex: number) => {
    const newCategories = [...editedModel.errorCategories]
    newCategories[categoryIndex].subcategories.push({ id: '', label: '', description: '' })
    setEditedModel({ ...editedModel, errorCategories: newCategories })
  }

  const removeSubcategory = (categoryIndex: number, subIndex: number) => {
    const newCategories = [...editedModel.errorCategories]
    newCategories[categoryIndex].subcategories = newCategories[categoryIndex].subcategories.filter((_, i) => i !== subIndex)
    setEditedModel({ ...editedModel, errorCategories: newCategories })
  }

  const updateSubcategory = (categoryIndex: number, subIndex: number, field: keyof ErrorSubcategory, value: string) => {
    const newCategories = [...editedModel.errorCategories]
    newCategories[categoryIndex].subcategories[subIndex] = {
      ...newCategories[categoryIndex].subcategories[subIndex],
      [field]: value
    }
    setEditedModel({ ...editedModel, errorCategories: newCategories })
  }

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
        maxW="4xl"
        w="90%"
        maxH="90vh"
        bg="white"
        backdropFilter="blur(20px)"
        border="1px solid"
        borderColor="gray.200"
        boxShadow="xl"
        borderRadius="xl"
        overflow="hidden"
        display="flex"
        flexDirection="column"
      >
        {/* Header */}
        <Box
          p={4}
          borderBottom="1px solid"
          borderColor="gray.100"
          display="flex"
          alignItems="center"
          justifyContent="space-between"
          flexShrink={0}
        >
          <Text fontSize="xl" fontWeight="bold" color="gray.700">
            Quality Model Editor
          </Text>
          <IconButton
            variant="ghost"
            size="sm"
            onClick={onClose}
            color="gray.500"
            _hover={{ color: "gray.700" }}
            aria-label="close modal"
          >
            <FiX size={20} />
          </IconButton>
        </Box>

        {/* Body */}
        <Box p={6} overflow="auto" flex="1">
          <Stack gap={6}>
            {/* Basic Information */}
            <Box>
              <Text fontSize="lg" fontWeight="semibold" color="gray.700" mb={3}>
                Basic Information
              </Text>
              <Stack gap={3}>
                <Grid templateColumns="repeat(3, 1fr)" gap={3}>
                  <Field.Root>
                    <Field.Label fontSize="sm" color="gray.600">Model ID</Field.Label>
                    <Input
                      size="sm"
                      value={editedModel.id}
                      onChange={(e) => setEditedModel({ ...editedModel, id: e.target.value })}
                      placeholder="e.g., mqm-standard-v1"
                      fontWeight="medium"
                      color="gray.900"
                    />
                  </Field.Root>
                  <Field.Root>
                    <Field.Label fontSize="sm" color="gray.600">Name</Field.Label>
                    <Input
                      size="sm"
                      value={editedModel.name}
                      onChange={(e) => setEditedModel({ ...editedModel, name: e.target.value })}
                      placeholder="e.g., MQM Standard"
                      fontWeight="medium"
                      color="gray.900"
                    />
                  </Field.Root>
                  <Field.Root>
                    <Field.Label fontSize="sm" color="gray.600">Version</Field.Label>
                    <Input
                      size="sm"
                      value={editedModel.version}
                      onChange={(e) => setEditedModel({ ...editedModel, version: e.target.value })}
                      placeholder="e.g., 1.0"
                      fontWeight="medium"
                      color="gray.900"
                    />
                  </Field.Root>
                </Grid>
                <Field.Root>
                  <Field.Label fontSize="sm" color="gray.600">Description</Field.Label>
                  <Textarea
                    size="sm"
                    value={editedModel.description}
                    onChange={(e) => setEditedModel({ ...editedModel, description: e.target.value })}
                    placeholder="Model description"
                    rows={2}
                    fontWeight="medium"
                    color="gray.900"
                  />
                </Field.Root>
              </Stack>
            </Box>

            <Separator />

            {/* Severities */}
            <Box>
              <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
                <Text fontSize="lg" fontWeight="semibold" color="gray.700">
                  Severities
                </Text>
                <Button size="sm" onClick={addSeverity}>
                  <FiPlus /> Add Severity
                </Button>
              </Box>
              <Stack gap={3}>
                {editedModel.severities.map((severity, idx) => (
                  <Box key={idx} p={3} bg="gray.50" borderRadius="md" border="1px solid" borderColor="gray.200">
                    <Stack gap={2}>
                      <Grid templateColumns="2fr 2fr 1fr auto" gap={2} alignItems="end">
                        <Field.Root>
                          <Field.Label fontSize="xs" color="gray.600">ID</Field.Label>
                          <Input
                            size="xs"
                            value={severity.id}
                            onChange={(e) => updateSeverity(idx, 'id', e.target.value)}
                            fontWeight="medium"
                            color="gray.900"
                          />
                        </Field.Root>
                        <Field.Root>
                          <Field.Label fontSize="xs" color="gray.600">Label</Field.Label>
                          <Input
                            size="xs"
                            value={severity.label}
                            onChange={(e) => updateSeverity(idx, 'label', e.target.value)}
                            fontWeight="medium"
                            color="gray.900"
                          />
                        </Field.Root>
                        <Field.Root>
                          <Field.Label fontSize="xs" color="gray.600">Weight</Field.Label>
                          <Input
                            size="xs"
                            type="number"
                            value={severity.weight}
                            onChange={(e) => updateSeverity(idx, 'weight', parseFloat(e.target.value))}
                            fontWeight="medium"
                            color="gray.900"
                          />
                        </Field.Root>
                        <IconButton
                          size="xs"
                          variant="ghost"
                          colorPalette="red"
                          onClick={() => removeSeverity(idx)}
                          aria-label="Remove severity"
                        >
                          <FiTrash2 />
                        </IconButton>
                      </Grid>
                      <Field.Root>
                        <Field.Label fontSize="xs" color="gray.600">Description</Field.Label>
                        <Textarea
                          size="xs"
                          value={severity.description}
                          onChange={(e) => updateSeverity(idx, 'description', e.target.value)}
                          rows={2}
                          fontWeight="medium"
                          color="gray.900"
                        />
                      </Field.Root>
                    </Stack>
                  </Box>
                ))}
              </Stack>
            </Box>

            <Separator />

            {/* Error Categories */}
            <Box>
              <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
                <Text fontSize="lg" fontWeight="semibold" color="gray.700">
                  Error Categories
                </Text>
                <Button size="sm" onClick={addCategory}>
                  <FiPlus /> Add Category
                </Button>
              </Box>
              <Stack gap={3}>
                {editedModel.errorCategories.map((category, catIdx) => (
                  <Box key={catIdx} p={3} bg="gray.50" borderRadius="md" border="1px solid" borderColor="gray.200">
                    <Stack gap={3}>
                      <Grid templateColumns="1fr 1fr auto" gap={2} alignItems="end">
                        <Field.Root>
                          <Field.Label fontSize="xs" color="gray.600">ID</Field.Label>
                          <Input
                            size="xs"
                            value={category.id}
                            onChange={(e) => updateCategory(catIdx, 'id', e.target.value)}
                            fontWeight="medium"
                            color="gray.900"
                          />
                        </Field.Root>
                        <Field.Root>
                          <Field.Label fontSize="xs" color="gray.600">Label</Field.Label>
                          <Input
                            size="xs"
                            value={category.label}
                            onChange={(e) => updateCategory(catIdx, 'label', e.target.value)}
                            fontWeight="medium"
                            color="gray.900"
                          />
                        </Field.Root>
                        <IconButton
                          size="xs"
                          variant="ghost"
                          colorPalette="red"
                          onClick={() => removeCategory(catIdx)}
                          aria-label="Remove category"
                        >
                          <FiTrash2 />
                        </IconButton>
                      </Grid>
                      <Field.Root>
                        <Field.Label fontSize="xs" color="gray.600">Description</Field.Label>
                        <Textarea
                          size="xs"
                          value={category.description}
                          onChange={(e) => updateCategory(catIdx, 'description', e.target.value)}
                          rows={2}
                          fontWeight="medium"
                          color="gray.900"
                        />
                      </Field.Root>

                      <Separator />

                      <Box pl={4}>
                        <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
                          <Text fontSize="sm" fontWeight="semibold" color="gray.700">
                            Subcategories
                          </Text>
                          <Button size="xs" onClick={() => addSubcategory(catIdx)}>
                            <FiPlus /> Add
                          </Button>
                        </Box>
                        <Stack gap={2}>
                          {category.subcategories.map((sub, subIdx) => (
                            <Box key={subIdx} p={2} bg="white" borderRadius="md" border="1px solid" borderColor="gray.200">
                              <Stack gap={2}>
                                <Grid templateColumns="1fr 1fr auto" gap={2} alignItems="end">
                                  <Field.Root>
                                    <Field.Label fontSize="xs" color="gray.600">ID</Field.Label>
                                    <Input
                                      size="xs"
                                      value={sub.id}
                                      onChange={(e) => updateSubcategory(catIdx, subIdx, 'id', e.target.value)}
                                      fontWeight="medium"
                                      color="gray.900"
                                    />
                                  </Field.Root>
                                  <Field.Root>
                                    <Field.Label fontSize="xs" color="gray.600">Label</Field.Label>
                                    <Input
                                      size="xs"
                                      value={sub.label}
                                      onChange={(e) => updateSubcategory(catIdx, subIdx, 'label', e.target.value)}
                                      fontWeight="medium"
                                      color="gray.900"
                                    />
                                  </Field.Root>
                                  <IconButton
                                    size="xs"
                                    variant="ghost"
                                    colorPalette="red"
                                    onClick={() => removeSubcategory(catIdx, subIdx)}
                                    aria-label="Remove subcategory"
                                  >
                                    <FiTrash2 />
                                  </IconButton>
                                </Grid>
                                <Field.Root>
                                  <Field.Label fontSize="xs" color="gray.600">Description</Field.Label>
                                  <Textarea
                                    size="xs"
                                    value={sub.description}
                                    onChange={(e) => updateSubcategory(catIdx, subIdx, 'description', e.target.value)}
                                    rows={2}
                                    fontWeight="medium"
                                    color="gray.900"
                                  />
                                </Field.Root>
                              </Stack>
                            </Box>
                          ))}
                        </Stack>
                      </Box>
                    </Stack>
                  </Box>
                ))}
              </Stack>
            </Box>
          </Stack>
        </Box>

        {/* Footer */}
        <Box
          p={4}
          borderTop="1px solid"
          borderColor="gray.100"
          display="flex"
          justifyContent="flex-end"
          gap={2}
          flexShrink={0}
        >
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button colorPalette="blue" onClick={handleSave}>
            Save Model
          </Button>
        </Box>
      </Box>
    </Portal>
  )
}
