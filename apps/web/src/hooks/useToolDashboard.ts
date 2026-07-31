import { useState, useMemo, useRef, useEffect, useCallback } from 'react'
import { useQuery } from '@tanstack/react-query'
import { getToolConfig, getWorkspace, getPlanningNodes, generateToolStream, planTool, getDocuments, getExtractions, suggestFollowUps, type GenerateEvent, type ToolPlan, type Forge } from '../lib/api'

export type ActivePanel =
  | { type: 'overview' }
  | { type: 'profile' }
  | { type: 'component'; index: number }
  | { type: 'documents' }
  | { type: 'knowledge' }
  | { type: 'chat'; chatId: string }
  | { type: 'interview'; forgeId?: string }

export interface ChatInfo {
  id: string
  title: string
  createdAt: number
}

export interface GenerationProgress {
  step: 'planning' | 'reviewing' | 'generating' | 'complete' | 'error'
  title?: string
  current: number
  total: number
  components: Array<{ type: string; title: string; done: boolean }>
  errorMessage?: string
  plan?: ToolPlan
}

function loadCompletionMap(workspaceId: string): Record<string, boolean> {
  try {
    const raw = localStorage.getItem(`completion-${workspaceId}`)
    return raw ? JSON.parse(raw) : {}
  } catch { return {} }
}

function loadChatList(workspaceId: string): ChatInfo[] {
  try {
    const raw = localStorage.getItem(`chats-${workspaceId}`)
    return raw ? JSON.parse(raw) : []
  } catch { return [] }
}

function errorProgress(message: string): GenerationProgress {
  return { step: 'error', current: 0, total: 0, components: [], errorMessage: message }
}

function planToComponents(components: Array<{ type: string; title?: string; focus?: string }>): GenerationProgress['components'] {
  return components.map((c) => ({ type: c.type, title: c.title ?? c.focus ?? '', done: false }))
}

const EMPTY_LAYOUT: Array<Record<string, unknown>> = []

export function useToolDashboard(workspaceId: string) {
  const [activePanel, setActivePanel] = useState<ActivePanel>({ type: 'overview' })
  const [completionMap, setCompletionMap] = useState<Record<string, boolean>>(() => loadCompletionMap(workspaceId))
  const [chats, setChats] = useState<ChatInfo[]>(() => loadChatList(workspaceId))
  const [generationProgress, setGenerationProgress] = useState<GenerationProgress | null>(null)
  const [constellationNodes, setConstellationNodes] = useState<string[]>([])
  const abortRef = useRef<AbortController | null>(null)

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['tool', workspaceId],
    queryFn: () => getToolConfig(workspaceId),
    retry: false,
  })

  const { data: documents = [] } = useQuery({
    queryKey: ['documents', workspaceId],
    queryFn: () => getDocuments(workspaceId),
  })

  // Fetch workspace detail (includes interviews list)
  const { data: workspaceDetail } = useQuery({
    queryKey: ['workspace', workspaceId],
    queryFn: () => getWorkspace(workspaceId),
  })

  const interviews: Forge[] = workspaceDetail?.interviews ?? []

  // Aggregate extractions across all interviews
  const allForgeIds = interviews.map((f) => f.id)
  const { data: extractions = [] } = useQuery({
    queryKey: ['extractions', workspaceId, allForgeIds],
    queryFn: async () => {
      if (allForgeIds.length === 0) return []
      const results = await Promise.all(allForgeIds.map((id) => getExtractions(id)))
      return results.flat()
    },
    enabled: allForgeIds.length > 0,
  })


  // Derive activeTabIndex from activePanel for backward compat
  const activeTabIndex = activePanel.type === 'component' ? activePanel.index : -1

  // Step 1: Plan the tool (shows review screen)
  const startPlanning = useCallback(async () => {
    setConstellationNodes([])
    setGenerationProgress({
      step: 'planning',
      current: 0,
      total: 0,
      components: [],
    })

    // Fire constellation nodes in parallel (non-blocking)
    if (workspaceDetail) {
      const expertName = workspaceDetail.expertName || interviews[0]?.expertName
      const domain = workspaceDetail.domain || interviews[0]?.domain
      const targetAudience = interviews[0]?.targetAudience
      if (expertName && domain) {
        getPlanningNodes({
          expertName,
          domain,
          targetAudience: targetAudience || undefined,
        }).then((result) => setConstellationNodes(result.nodes)).catch(() => {})
      }
    }

    try {
      const plan = await planTool(workspaceId)
      setGenerationProgress({
        step: 'reviewing',
        title: plan.title,
        current: 0,
        total: plan.components.length,
        components: planToComponents(plan.components),
        plan,
      })
    } catch (err) {
      setGenerationProgress(errorProgress(err instanceof Error ? err.message : 'Planning failed'))
    }
  }, [workspaceId, workspaceDetail, interviews])

  const handleGenerateEvent = useCallback((event: GenerateEvent) => {
    switch (event.type) {
      case 'plan':
        setGenerationProgress((prev) => prev ? {
          ...prev,
          step: 'generating',
          title: event.title,
          total: event.componentCount,
          components: planToComponents(event.components),
        } : prev)
        break
      case 'component':
        setGenerationProgress((prev) => {
          if (!prev) return prev
          const components = prev.components.map((c, i) =>
            i === event.index - 1 ? { ...c, done: true } : c
          )
          return { ...prev, current: event.index, components }
        })
        break
      case 'complete':
        setGenerationProgress(null)
        refetch()
        break
      case 'error':
        setGenerationProgress(errorProgress(event.message))
        break
    }
  }, [refetch])

  const startGeneration = useCallback((plan?: ToolPlan) => {
    abortRef.current?.abort()

    const initialProgress: GenerationProgress = plan
      ? { step: 'generating', title: plan.title, current: 0, total: plan.components.length, components: planToComponents(plan.components) }
      : { step: 'planning', current: 0, total: 0, components: [] }

    setGenerationProgress(initialProgress)

    abortRef.current = generateToolStream(
      workspaceId,
      handleGenerateEvent,
      () => {},
      (err) => setGenerationProgress(errorProgress(err)),
      plan
    )
  }, [workspaceId, handleGenerateEvent])

  // Step 2: Confirm plan and generate (called after user reviews)
  const confirmPlan = useCallback((plan: ToolPlan) => {
    startGeneration(plan)
  }, [startGeneration])

  // Legacy: generate without review (skips plan review)
  const generateStreaming = useCallback(() => {
    startGeneration()
  }, [startGeneration])

  const layout = data?.toolConfig?.layout ?? EMPTY_LAYOUT

  // Clean stale completion entries when layout changes
  const layoutIds = useMemo(() => new Set(layout.map((c, i) => (c.id as string) ?? `tab-${i}`)), [layout])
  useEffect(() => {
    if (layoutIds.size === 0) return
    const staleKeys = Object.keys(completionMap).filter((k) => !layoutIds.has(k))
    if (staleKeys.length > 0) {
      setCompletionMap((prev) => {
        const next = { ...prev }
        for (const k of staleKeys) delete next[k]
        return next
      })
    }
  }, [layoutIds])

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

  // Persist completionMap to localStorage
  useEffect(() => {
    try {
      localStorage.setItem(`completion-${workspaceId}`, JSON.stringify(completionMap))
    } catch { /* ignore */ }
  }, [completionMap, workspaceId])

  const handleTabChange = (index: number) => {
    setActivePanel(index === -1 ? { type: 'overview' } : { type: 'component', index })
  }

  // Persist chat list
  useEffect(() => {
    try {
      localStorage.setItem(`chats-${workspaceId}`, JSON.stringify(chats))
    } catch { /* ignore */ }
  }, [chats, workspaceId])

  const createChat = useCallback(() => {
    const id = crypto.randomUUID()
    setChats((prev) => {
      const chat: ChatInfo = { id, title: `Chat ${prev.length + 1}`, createdAt: Date.now() }
      return [...prev, chat]
    })
    setActivePanel({ type: 'chat', chatId: id })
  }, [])

  const deleteChat = useCallback((chatId: string) => {
    setChats((prev) => prev.filter((c) => c.id !== chatId))
    try { localStorage.removeItem(`chat-${workspaceId}-${chatId}`) } catch {}
    if (activePanel.type === 'chat' && activePanel.chatId === chatId) {
      setActivePanel({ type: 'overview' })
    }
  }, [workspaceId, activePanel])

  return {
    data,
    isLoading,
    error,
    generateStreaming,
    startPlanning,
    confirmPlan,
    generationProgress,
    layout,
    tabs,
    activeTabIndex,
    activePanel,
    setActivePanel,
    overallProgress,
    completionMap,
    handleCompletionChange: setCompletionMap,
    handleTabChange,
    documents,
    extractions,
    workspace: workspaceDetail,
    constellationNodes,
    chats,
    createChat,
    deleteChat,
    interviews,
  }
}
