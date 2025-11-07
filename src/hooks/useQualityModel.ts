import { useState } from 'react'
import { QualityModel } from '../types/qualityModel'
import { toaster } from '../components/ui/toaster'

export function useQualityModel() {
  const [qualityModel, setQualityModel] = useState<QualityModel | null>(null)
  const [showModelEditor, setShowModelEditor] = useState(false)
  const [editingModel, setEditingModel] = useState<QualityModel | null>(null)
  const [showQASummary, setShowQASummary] = useState(false)

  /**
   * Create a new quality model with empty structure
   */
  const handleNewModel = () => {
    const newModel: QualityModel = {
      id: '',
      name: '',
      version: '',
      description: '',
      severities: [],
      errorCategories: []
    }
    setEditingModel(newModel)
    setShowModelEditor(true)
  }

  /**
   * Load a quality model from a local file and make it current
   */
  const handleLoadModel = async () => {
    try {
      const input = document.createElement('input')
      input.type = 'file'
      input.accept = '.json'
      input.onchange = async (e) => {
        const file = (e.target as HTMLInputElement).files?.[0]
        if (!file) return

        const text = await file.text()
        const loadedModel = JSON.parse(text) as QualityModel
        setQualityModel(loadedModel)
        toaster.create({
          title: 'Model loaded',
          description: `Quality model "${loadedModel.name}" is now active`,
          type: 'success',
          duration: 4000,
        })
      }
      input.click()
    } catch (error) {
      console.error('Error loading model:', error)
      toaster.create({
        title: 'Failed to load model',
        description: 'Invalid model file format',
        type: 'error',
        duration: 6000,
      })
    }
  }

  /**
   * Edit the current quality model
   */
  const handleEditModel = () => {
    if (qualityModel) {
      setEditingModel(qualityModel)
      setShowModelEditor(true)
    }
  }

  /**
   * Unload the current quality model
   */
  const handleUnloadModel = () => {
    setQualityModel(null)
    toaster.create({
      title: 'Model unloaded',
      description: 'Quality model has been unloaded',
      type: 'info',
      duration: 3000,
    })
  }

  /**
   * Save the quality model and close the editor
   */
  const handleSaveModel = (model: QualityModel) => {
    setQualityModel(model)
    toaster.create({
      title: 'Model saved',
      description: `Quality model "${model.name}" is now active`,
      type: 'success',
      duration: 4000,
    })
  }

  /**
   * Show the QA summary modal
   */
  const handleShowSummary = () => {
    setShowQASummary(true)
  }

  /**
   * Close the model editor
   */
  const handleCloseModelEditor = () => {
    setShowModelEditor(false)
    setEditingModel(null)
  }

  /**
   * Close the QA summary modal
   */
  const handleCloseQASummary = () => {
    setShowQASummary(false)
  }

  return {
    // State
    qualityModel,
    showModelEditor,
    editingModel,
    showQASummary,

    // Actions
    handleNewModel,
    handleLoadModel,
    handleEditModel,
    handleUnloadModel,
    handleSaveModel,
    handleShowSummary,
    handleCloseModelEditor,
    handleCloseQASummary,

    // Setters for external control
    setQualityModel,
  }
}
