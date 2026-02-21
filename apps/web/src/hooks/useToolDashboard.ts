import { useState, useMemo, useRef, useEffect, useCallback } from 'react'
import { useQuery, useMutation } from '@tanstack/react-query'
import { getToolConfig, getForge, getPlanningNodes, generateTool, generateToolStream, planTool, getDocuments, getExtractions, suggestFollowUps, type GenerateEvent, type ToolPlan } from '../lib/api'

export type ActivePanel =
  | { type: 'overview' }
  | { type: 'component'; index: number }
  | { type: 'documents' }
  | { type: 'knowledge' }
  | { type: 'chat'; chatId: string }
  | { type: 'interview'; round?: number }

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

function loadCompletionMap(forgeId: string): Record<string, boolean> {
  try {
    const raw = localStorage.getItem(`completion-${forgeId}`)
    return raw ? JSON.parse(raw) : {}
  } catch { return {} }
}

function loadChatList(forgeId: string): ChatInfo[] {
  try {
    const raw = localStorage.getItem(`chats-${forgeId}`)
    return raw ? JSON.parse(raw) : []
  } catch { return [] }
}

function errorProgress(message: string): GenerationProgress {
  return { step: 'error', current: 0, total: 0, components: [], errorMessage: message }
}

function planToComponents(components: Array<{ type: string; title?: string; focus?: string }>): GenerationProgress['components'] {
  return components.map((c) => ({ type: c.type, title: c.title ?? c.focus ?? '', done: false }))
}

export function useToolDashboard(forgeId: string) {
  const [activePanel, setActivePanel] = useState<ActivePanel>({ type: 'overview' })
  const [completionMap, setCompletionMap] = useState<Record<string, boolean>>(() => loadCompletionMap(forgeId))
  const [chats, setChats] = useState<ChatInfo[]>(() => loadChatList(forgeId))
  const [generationProgress, setGenerationProgress] = useState<GenerationProgress | null>(null)
  const [constellationNodes, setConstellationNodes] = useState<string[]>([])
  const abortRef = useRef<AbortController | null>(null)

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['tool', forgeId],
    queryFn: () => getToolConfig(forgeId),
    retry: false,
  })

  const { data: documents = [] } = useQuery({
    queryKey: ['documents', forgeId],
    queryFn: () => getDocuments(forgeId),
  })

  const { data: extractions = [] } = useQuery({
    queryKey: ['extractions', forgeId],
    queryFn: () => getExtractions(forgeId),
  })

  const { data: forge } = useQuery({
    queryKey: ['forge', forgeId],
    queryFn: () => getForge(forgeId),
  })

  const interviewRounds = ((forge?.metadata as any)?.interviewRounds ?? [{ round: 1, topic: 'Initial interview', status: forge?.status === 'complete' ? 'completed' : 'interviewing' }]) as Array<{ round: number; topic: string; status: string; startedAt?: string; completedAt?: string }>

  const { data: followUpSuggestions } = useQuery({
    queryKey: ['follow-up-suggestions', forgeId],
    queryFn: () => suggestFollowUps(forgeId),
    enabled: forge?.status === 'complete',
  })

  const generateMutation = useMutation({
    mutationFn: () => generateTool(forgeId),
    onSuccess: () => refetch(),
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
    if (forge) {
      getPlanningNodes({
        expertName: forge.expertName!,
        domain: forge.domain!,
        targetAudience: forge.targetAudience || undefined,
      }).then((result) => setConstellationNodes(result.nodes)).catch(() => {})
    }

    try {
      const plan = await planTool(forgeId)
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
  }, [forgeId, forge])

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
      forgeId,
      handleGenerateEvent,
      () => {},
      (err) => setGenerationProgress(errorProgress(err)),
      plan
    )
  }, [forgeId, handleGenerateEvent])

  // Step 2: Confirm plan and generate (called after user reviews)
  const confirmPlan = useCallback((plan: ToolPlan) => {
    startGeneration(plan)
  }, [startGeneration])

  // Legacy: generate without review (skips plan review)
  const generateStreaming = useCallback(() => {
    startGeneration()
  }, [startGeneration])

  const layout = data?.toolConfig?.layout ?? []

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
      localStorage.setItem(`completion-${forgeId}`, JSON.stringify(completionMap))
    } catch { /* ignore */ }
  }, [completionMap, forgeId])

  const handleTabChange = (index: number) => {
    setActivePanel(index === -1 ? { type: 'overview' } : { type: 'component', index })
  }

  // Persist chat list
  useEffect(() => {
    try {
      localStorage.setItem(`chats-${forgeId}`, JSON.stringify(chats))
    } catch { /* ignore */ }
  }, [chats, forgeId])

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
    try { localStorage.removeItem(`chat-${forgeId}-${chatId}`) } catch {}
    // Navigate away if deleting the active chat
    if (activePanel.type === 'chat' && activePanel.chatId === chatId) {
      setActivePanel({ type: 'overview' })
    }
  }, [forgeId, activePanel])

  return {
    data,
    isLoading,
    error,
    generateMutation,
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
    forge,
    constellationNodes,
    chats,
    createChat,
    deleteChat,
    interviewRounds,
    followUpSuggestions,
  }
}
