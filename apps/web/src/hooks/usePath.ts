import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { getPath, getFocusAreas, updatePathLevers, type PathResponse } from '../lib/api'
import { loadLearnState } from './useLearnerProfile'
import type { LearnerGoal } from '@forge/shared'

export function usePath(workspaceId: string) {
  const navigate = useNavigate()
  const [data, setData] = useState<PathResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Lever editing
  const [editingLevers, setEditingLevers] = useState(false)
  const [focusOptions, setFocusOptions] = useState<string[]>([])
  const [draftGoal, setDraftGoal] = useState<LearnerGoal>('basics')
  const [draftMinutes, setDraftMinutes] = useState(15)
  const [draftFocus, setDraftFocus] = useState<string[]>([])
  const [savingLevers, setSavingLevers] = useState(false)

  const stored = loadLearnState(workspaceId)

  const loadPath = async () => {
    if (!stored) return
    const res = await getPath(stored.pathId)
    setData(res)
    return res
  }

  useEffect(() => {
    if (!stored) {
      navigate(`/learn/${workspaceId}/onboard`, { replace: true })
      return
    }
    let cancelled = false
    setLoading(true)
    getPath(stored.pathId)
      .then((res) => {
        if (!cancelled) setData(res)
      })
      .catch((err) => {
        if (cancelled) return
        // Stale local state (path deleted server-side) → restart onboarding
        if (err instanceof Error && err.message.includes('not found')) {
          localStorage.removeItem(`learn-${workspaceId}`)
          navigate(`/learn/${workspaceId}/onboard`, { replace: true })
        } else {
          setError(err instanceof Error ? err.message : 'Failed to load path')
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workspaceId])

  const handleStartSession = () => {
    navigate(`/learn/${workspaceId}/session`)
  }

  const handleOpenLevers = async () => {
    if (!data) return
    setDraftGoal(data.path.goal)
    setDraftMinutes(data.path.dailyMinutes)
    setDraftFocus(data.path.focusAreas ?? [])
    setEditingLevers(true)
    if (focusOptions.length === 0) {
      try {
        const res = await getFocusAreas(workspaceId)
        setFocusOptions(res.focusAreas)
      } catch (err) {
        console.error('Failed to load focus areas:', err)
      }
    }
  }

  const handleCloseLevers = () => {
    if (!savingLevers) setEditingLevers(false)
  }

  const handleToggleFocus = (area: string) => {
    setDraftFocus((prev) =>
      prev.includes(area) ? prev.filter((a) => a !== area) : [...prev, area]
    )
  }

  const replanNeeded = data
    ? draftGoal !== data.path.goal ||
      JSON.stringify([...draftFocus].sort()) !== JSON.stringify([...(data.path.focusAreas ?? [])].sort())
    : false

  const handleSaveLevers = async () => {
    if (!data || savingLevers) return
    setSavingLevers(true)
    try {
      await updatePathLevers(data.path.id, {
        goal: draftGoal,
        dailyMinutes: draftMinutes,
        focusAreas: draftFocus,
      })
      await loadPath()
      setEditingLevers(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update path')
    } finally {
      setSavingLevers(false)
    }
  }

  return {
    data,
    loading,
    error,
    handleStartSession,
    // levers
    editingLevers,
    focusOptions,
    draftGoal,
    draftMinutes,
    draftFocus,
    savingLevers,
    replanNeeded,
    handleOpenLevers,
    handleCloseLevers,
    handleToggleFocus,
    setDraftGoal,
    setDraftMinutes,
    handleSaveLevers,
  }
}
