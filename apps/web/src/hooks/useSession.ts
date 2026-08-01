import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { getNextUnits, submitAttempt, completeUnit, type PathUnitFull } from '../lib/api'
import { loadLearnState } from './useLearnerProfile'

export function useSession(workspaceId: string) {
  const navigate = useNavigate()
  const [units, setUnits] = useState<PathUnitFull[]>([])
  const [currentIndex, setCurrentIndex] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [sessionDone, setSessionDone] = useState(false)
  const unitStartRef = useRef(Date.now())

  const stored = loadLearnState(workspaceId)

  useEffect(() => {
    if (!stored) {
      navigate(`/learn/${workspaceId}/onboard`, { replace: true })
      return
    }
    let cancelled = false
    getNextUnits(stored.pathId, 5)
      .then((res) => {
        if (cancelled) return
        setUnits(res.units)
        if (res.units.length === 0) setSessionDone(true)
        unitStartRef.current = Date.now()
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Failed to load session')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workspaceId])

  const currentUnit = units[currentIndex] ?? null

  const advance = () => {
    if (currentIndex + 1 >= units.length) {
      setSessionDone(true)
    } else {
      setCurrentIndex((i) => i + 1)
      unitStartRef.current = Date.now()
    }
  }

  // Lesson cards and checkpoints: mark complete, move on
  const handleContinue = async () => {
    if (!currentUnit) return
    try {
      await completeUnit(currentUnit.id)
    } catch (err) {
      console.error('Failed to complete unit:', err)
    }
    advance()
  }

  // Exercises: record the attempt, then the component shows feedback before advancing
  const recordAttempt = async (answer: unknown, correct: 'yes' | 'no' | 'partial') => {
    if (!currentUnit || !stored) return
    try {
      await submitAttempt(currentUnit.id, {
        learnerId: stored.learnerId,
        answer,
        correct,
        latencyMs: Date.now() - unitStartRef.current,
      })
    } catch (err) {
      console.error('Failed to record attempt:', err)
    }
  }

  const handleAttempt = async (answer: unknown, correct: boolean) => {
    await recordAttempt(answer, correct ? 'yes' : 'no')
  }

  // Order exercise grades with partial credit
  const handleGradedAttempt = async (answer: unknown, correct: 'yes' | 'no' | 'partial') => {
    await recordAttempt(answer, correct)
  }

  // Checkpoint review: one attempt for the whole review, then advance
  const handleCheckpointFinish = async (result: { rightCount: number; total: number; details: unknown }) => {
    if (!currentUnit || !stored) return
    const correct =
      result.rightCount === result.total ? 'yes' : result.rightCount * 2 >= result.total ? 'partial' : 'no'
    try {
      await submitAttempt(currentUnit.id, {
        learnerId: stored.learnerId,
        answer: result,
        correct,
        latencyMs: Date.now() - unitStartRef.current,
      })
    } catch (err) {
      console.error('Failed to record checkpoint attempt:', err)
    }
    advance()
  }

  const handleNextAfterFeedback = () => {
    advance()
  }

  const handleBackToPath = () => {
    navigate(`/learn/${workspaceId}`)
  }

  return {
    units,
    currentUnit,
    currentIndex,
    loading,
    error,
    sessionDone,
    handleContinue,
    handleAttempt,
    handleGradedAttempt,
    handleCheckpointFinish,
    handleNextAfterFeedback,
    handleBackToPath,
  }
}
