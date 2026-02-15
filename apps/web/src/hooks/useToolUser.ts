import { useState, useMemo, useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { getToolConfig } from '../lib/api'

function loadCompletionMap(forgeId: string): Record<string, boolean> {
  try {
    const raw = localStorage.getItem(`completion-${forgeId}`)
    return raw ? JSON.parse(raw) : {}
  } catch { return {} }
}

export function useToolUser(forgeId: string) {
  const [activeTabIndex, setActiveTabIndex] = useState(-1) // -1 = overview
  const [completionMap, setCompletionMap] = useState<Record<string, boolean>>(() => loadCompletionMap(forgeId))

  const { data, isLoading, error } = useQuery({
    queryKey: ['tool', forgeId],
    queryFn: () => getToolConfig(forgeId),
    retry: false,
  })

  const layout = data?.toolConfig?.layout ?? []

  const tabs = useMemo(() => {
    return layout.map((config, idx) => ({
      id: (config.id as string) ?? `tab-${idx}`,
      title: (config.title as string) ?? `Section ${idx + 1}`,
      type: config.type as string,
      complete: completionMap[(config.id as string) ?? `tab-${idx}`] ?? false,
    }))
  }, [layout, completionMap])

  const overallProgress = useMemo(() => {
    if (tabs.length === 0) return 0
    const completed = tabs.filter((t) => t.complete).length
    return Math.round((completed / tabs.length) * 100)
  }, [tabs])

  // Persist completionMap
  useEffect(() => {
    try {
      localStorage.setItem(`completion-${forgeId}`, JSON.stringify(completionMap))
    } catch {}
  }, [completionMap, forgeId])

  return {
    data,
    isLoading,
    error,
    layout,
    tabs,
    activeTabIndex,
    overallProgress,
    completionMap,
    handleCompletionChange: setCompletionMap,
    handleTabChange: setActiveTabIndex,
  }
}
