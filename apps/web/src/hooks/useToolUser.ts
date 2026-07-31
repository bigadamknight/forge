import { useState, useMemo, useEffect, useCallback } from 'react'
import { useQuery } from '@tanstack/react-query'
import { getToolConfig, getExtractions } from '../lib/api'
import type { ActivePanel, ChatInfo } from './useToolDashboard'

function loadCompletionMap(workspaceId: string): Record<string, boolean> {
  try {
    const raw = localStorage.getItem(`completion-${workspaceId}`)
    return raw ? JSON.parse(raw) : {}
  } catch { return {} }
}

function loadChats(workspaceId: string): ChatInfo[] {
  try {
    const raw = localStorage.getItem(`user-chats-${workspaceId}`)
    return raw ? JSON.parse(raw) : [{ id: 'default', title: 'Expert Chat', createdAt: Date.now() }]
  } catch { return [{ id: 'default', title: 'Expert Chat', createdAt: Date.now() }] }
}

function saveChats(workspaceId: string, chats: ChatInfo[]) {
  try { localStorage.setItem(`user-chats-${workspaceId}`, JSON.stringify(chats)) } catch {}
}

export function useToolUser(workspaceId: string) {
  const [activePanel, setActivePanel] = useState<ActivePanel>({ type: 'overview' })
  const [completionMap, setCompletionMap] = useState<Record<string, boolean>>(() => loadCompletionMap(workspaceId))
  const [chats, setChats] = useState<ChatInfo[]>(() => loadChats(workspaceId))

  const { data, isLoading, error } = useQuery({
    queryKey: ['tool', workspaceId],
    queryFn: () => getToolConfig(workspaceId),
    retry: false,
  })

  // For the user-facing tool page, extractions aren't critical
  // but we keep the query for potential future use
  const { data: extractions } = useQuery({
    queryKey: ['extractions-user', workspaceId],
    queryFn: async () => [] as any[],
    enabled: false,
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
      localStorage.setItem(`completion-${workspaceId}`, JSON.stringify(completionMap))
    } catch {}
  }, [completionMap, workspaceId])

  const createChat = useCallback(() => {
    const id = `chat-${Date.now()}`
    const num = chats.length + 1
    const next = [...chats, { id, title: `Chat ${num}`, createdAt: Date.now() }]
    setChats(next)
    saveChats(workspaceId, next)
    setActivePanel({ type: 'chat', chatId: id })
  }, [chats, workspaceId])

  const deleteChat = useCallback((chatId: string) => {
    const next = chats.filter((c) => c.id !== chatId)
    setChats(next)
    saveChats(workspaceId, next)
    localStorage.removeItem(`chat-${workspaceId}-${chatId}`)
    if (activePanel.type === 'chat' && activePanel.chatId === chatId) {
      setActivePanel({ type: 'overview' })
    }
  }, [chats, workspaceId, activePanel])

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
