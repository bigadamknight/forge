import { useState, useEffect, useRef } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { updateToolConfig } from '../lib/api'

export function useToolEditor(forgeId: string, originalLayout: Array<Record<string, unknown>>) {
  const queryClient = useQueryClient()
  const [editMode, setEditMode] = useState(false)
  const [editableLayout, setEditableLayout] = useState(originalLayout)
  const [isSaving, setIsSaving] = useState(false)
  const originalRef = useRef(originalLayout)

  // Sync when original layout changes (e.g. after regeneration) and not editing
  useEffect(() => {
    if (!editMode) {
      setEditableLayout(originalLayout)
      originalRef.current = originalLayout
    }
  }, [originalLayout, editMode])

  const isDirty = JSON.stringify(editableLayout) !== JSON.stringify(originalRef.current)

  const updateComponent = (index: number, updatedConfig: Record<string, unknown>) => {
    setEditableLayout((prev) => {
      const next = [...prev]
      next[index] = updatedConfig
      return next
    })
  }

  const handleSave = async () => {
    setIsSaving(true)
    try {
      await updateToolConfig(forgeId, editableLayout)
      originalRef.current = editableLayout
      queryClient.invalidateQueries({ queryKey: ['tool', forgeId] })
      setEditMode(false)
    } catch (err) {
      console.error('Failed to save tool config:', err)
    } finally {
      setIsSaving(false)
    }
  }

  const handleCancel = () => {
    setEditableLayout(originalRef.current)
    setEditMode(false)
  }

  const handleToggleEdit = () => {
    setEditMode((prev) => !prev)
  }

  return {
    editMode,
    editableLayout,
    isDirty,
    isSaving,
    updateComponent,
    handleSave,
    handleCancel,
    handleToggleEdit,
  }
}
