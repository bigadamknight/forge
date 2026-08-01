import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { getFocusAreas, onboardLearner } from '../lib/api'
import type { LearnerGoal } from '@forge/shared'

export interface StoredLearnState {
  learnerId: string
  pathId: string
}

export function loadLearnState(workspaceId: string): StoredLearnState | null {
  try {
    const raw = localStorage.getItem(`learn-${workspaceId}`)
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

function saveLearnState(workspaceId: string, state: StoredLearnState) {
  try {
    localStorage.setItem(`learn-${workspaceId}`, JSON.stringify(state))
  } catch { /* quota exceeded */ }
}

export function useLearnerProfile(workspaceId: string) {
  const navigate = useNavigate()
  const [goal, setGoal] = useState<LearnerGoal>('basics')
  const [dailyMinutes, setDailyMinutes] = useState(15)
  const [focusAreas, setFocusAreas] = useState<string[]>([])
  const [preferenceText, setPreferenceText] = useState('')
  const [availableFocusAreas, setAvailableFocusAreas] = useState<string[]>([])
  const [knowledgeCount, setKnowledgeCount] = useState<number | null>(null)
  const [planning, setPlanning] = useState(false)
  const [planStatus, setPlanStatus] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const abortRef = useRef<AbortController | null>(null)

  useEffect(() => {
    let cancelled = false
    getFocusAreas(workspaceId)
      .then((res) => {
        if (cancelled) return
        setAvailableFocusAreas(res.focusAreas)
        setKnowledgeCount(res.knowledgeCount)
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Failed to load focus areas')
      })
    return () => { cancelled = true }
  }, [workspaceId])

  useEffect(() => {
    return () => abortRef.current?.abort()
  }, [])

  const handleToggleFocusArea = (area: string) => {
    setFocusAreas((prev) =>
      prev.includes(area) ? prev.filter((a) => a !== area) : [...prev, area]
    )
  }

  const handleStart = () => {
    if (planning) return
    setPlanning(true)
    setError(null)
    setPlanStatus('Designing your path...')

    const preferences = preferenceText.trim()
      ? { instructions: [preferenceText.trim()] }
      : undefined

    abortRef.current = onboardLearner(
      workspaceId,
      { goal, dailyMinutes, focusAreas, preferences },
      (event) => {
        if (event.type === 'plan') {
          saveLearnState(workspaceId, { learnerId: event.learnerId, pathId: event.pathId })
          setPlanStatus(`Path planned — ~${event.estimatedDays} days at your pace. Preparing your first units...`)
        } else if (event.type === 'unit') {
          setPlanStatus(`Preparing your first units... (${event.orderIndex + 1})`)
        } else if (event.type === 'complete') {
          navigate(`/learn/${workspaceId}`, { replace: true })
        } else if (event.type === 'error') {
          setError(event.message)
          setPlanning(false)
          setPlanStatus(null)
        }
      },
      () => {
        // Stream closed; if we saved state, the plan event already navigated
        setPlanning(false)
      },
      (err) => {
        setError(err)
        setPlanning(false)
        setPlanStatus(null)
      }
    )
  }

  return {
    goal, setGoal,
    dailyMinutes, setDailyMinutes,
    focusAreas, handleToggleFocusArea,
    preferenceText, setPreferenceText,
    availableFocusAreas, knowledgeCount,
    planning, planStatus, error,
    handleStart,
  }
}
