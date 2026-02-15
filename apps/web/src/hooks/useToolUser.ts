import { useState, useMemo, useEffect, useCallback } from 'react'
import { useQuery } from '@tanstack/react-query'
import { getToolConfig, getExtractions } from '../lib/api'
import type { ActivePanel, ChatInfo } from './useToolDashboard'

function loadCompletionMap(forgeId: string): Record<string, boolean> {
  try {
    const raw = localStorage.getItem(`completion-${forgeId}`)
    return raw ? JSON.parse(raw) : {}
  } catch { return {} }
}

function loadChats(forgeId: string): ChatInfo[] {
  try {
    const raw = localStorage.getItem(`user-chats-${forgeId}`)
    return raw ? JSON.parse(raw) : [{ id: 'default', title: 'Expert Chat', createdAt: Date.now() }]
  } catch { return [{ id: 'default', title: 'Expert Chat', createdAt: Date.now() }] }
}

function saveChats(forgeId: string, chats: ChatInfo[]) {
  try { localStorage.setItem(`user-chats-${forgeId}`, JSON.stringify(chats)) } catch {}
}

export function useToolUser(forgeId: string) {
  const [activePanel, setActivePanel] = useState<ActivePanel>({ type: 'overview' })
  const [completionMap, setCompletionMap] = useState<Record<string, boolean>>(() => loadCompletionMap(forgeId))
  const [chats, setChats] = useState<ChatInfo[]>(() => loadChats(forgeId))

  const { data, isLoading, error } = useQuery({
    queryKey: ['tool', forgeId],
    queryFn: () => getToolConfig(forgeId),
    retry: false,
  })

  const { data: extractions } = useQuery({
    queryKey: ['extractions', forgeId],
    queryFn: () => getExtractions(forgeId),
    enabled: !!data,
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

  const createChat = useCallback(() => {
    const id = `chat-${Date.now()}`
    const num = chats.length + 1
    const next = [...chats, { id, title: `Chat ${num}`, createdAt: Date.now() }]
    setChats(next)
    saveChats(forgeId, next)
    setActivePanel({ type: 'chat', chatId: id })
  }, [chats, forgeId])

  const deleteChat = useCallback((chatId: string) => {
    const next = chats.filter((c) => c.id !== chatId)
    setChats(next)
    saveChats(forgeId, next)
    localStorage.removeItem(`chat-${forgeId}-${chatId}`)
    if (activePanel.type === 'chat' && activePanel.chatId === chatId) {
      setActivePanel({ type: 'overview' })
    }
  }, [chats, forgeId, activePanel])

  const handleTabChange = useCallback((idx: number) => {
    if (idx === -1) setActivePanel({ type: 'overview' })
    else setActivePanel({ type: 'component', index: idx })
  }, [])

  return {
    data,
    isLoading,
    error,
    layout,
    tabs,
    activePanel,
    setActivePanel,
    overallProgress,
    completionMap,
    extractions: extractions ?? [],
    chats,
    createChat,
    deleteChat,
    handleCompletionChange: setCompletionMap,
    handleTabChange,
  }
}
