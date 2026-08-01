import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { getPath, type PathResponse } from '../lib/api'
import { loadLearnState } from './useLearnerProfile'

export function usePath(workspaceId: string) {
  const navigate = useNavigate()
  const [data, setData] = useState<PathResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const stored = loadLearnState(workspaceId)

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

  return { data, loading, error, handleStartSession }
}
