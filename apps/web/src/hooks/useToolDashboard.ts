import { useState, useMemo, useRef, useEffect, useCallback } from 'react'
import { useQuery, useMutation } from '@tanstack/react-query'
import { getToolConfig, generateTool, generateToolStream, planTool, getDocuments, type GenerateEvent, type ToolPlan, type ToolPlanComponent } from '../lib/api'

export type ActivePanel =
  | { type: 'overview' }
  | { type: 'component'; index: number }
  | { type: 'documents' }
  | { type: 'chat'; chatId: string }
  | { type: 'interview' }

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

export function useToolDashboard(forgeId: string) {
  const [activePanel, setActivePanel] = useState<ActivePanel>({ type: 'overview' })
  const [completionMap, setCompletionMap] = useState<Record<string, boolean>>(() => loadCompletionMap(forgeId))
  const [chats, setChats] = useState<ChatInfo[]>(() => loadChatList(forgeId))
  const [generationProgress, setGenerationProgress] = useState<GenerationProgress | null>(null)
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

  const generateMutation = useMutation({
    mutationFn: () => generateTool(forgeId),
    onSuccess: () => refetch(),
  })

  // Derive activeTabIndex from activePanel for backward compat
  const activeTabIndex = activePanel.type === 'component' ? activePanel.index : -1

  // Step 1: Plan the tool (shows review screen)
  const startPlanning = useCallback(async () => {
    setGenerationProgress({
      step: 'planning',
      current: 0,
      total: 0,
      components: [],
    })

    try {
      const plan = await planTool(forgeId)
      setGenerationProgress({
        step: 'reviewing',
        title: plan.title,
        current: 0,
        total: plan.components.length,
        components: plan.components.map((c) => ({
          type: c.type,
          title: c.focus,
          done: false,
        })),
        plan,
      })
    } catch (err) {
      setGenerationProgress({
        step: 'error',
        current: 0,
        total: 0,
        components: [],
        errorMessage: err instanceof Error ? err.message : 'Planning failed',
      })
    }
  }, [forgeId])

  // Step 2: Confirm plan and generate (called after user reviews)
  const confirmPlan = useCallback((plan: ToolPlan) => {
    abortRef.current?.abort()

    setGenerationProgress({
      step: 'generating',
      title: plan.title,
      current: 0,
      total: plan.components.length,
      components: plan.components.map((c) => ({
        type: c.type,
        title: c.focus,
        done: false,
      })),
    })

    const controller = generateToolStream(
      forgeId,
      (event: GenerateEvent) => {
        if (event.type === 'plan') {
          // Plan already confirmed, just update generating state
          setGenerationProgress((prev) => prev ? {
            ...prev,
            step: 'generating',
            title: event.title,
            total: event.componentCount,
            components: event.components.map((c) => ({
              type: c.type,
              title: c.title,
              done: false,
            })),
          } : prev)
        } else if (event.type === 'component') {
          setGenerationProgress((prev) => {
            if (!prev) return prev
            const components = prev.components.map((c, i) =>
              i === event.index - 1 ? { ...c, done: true } : c
            )
            return {
              ...prev,
              current: event.index,
              components,
            }
          })
        } else if (event.type === 'complete') {
          setGenerationProgress(null)
          refetch()
        } else if (event.type === 'error') {
          setGenerationProgress({
            step: 'error',
            current: 0,
            total: 0,
            components: [],
            errorMessage: event.message,
          })
        }
      },
      () => {},
      (err) => {
        setGenerationProgress({
          step: 'error',
          current: 0,
          total: 0,
          components: [],
          errorMessage: err,
        })
      },
      plan
    )

    abortRef.current = controller
  }, [forgeId, refetch])

  // Legacy: generate without review (skips plan review)
  const generateStreaming = useCallback(() => {
    abortRef.current?.abort()

    setGenerationProgress({
      step: 'planning',
      current: 0,
      total: 0,
      components: [],
    })

    const controller = generateToolStream(
      forgeId,
      (event: GenerateEvent) => {
        if (event.type === 'plan') {
          setGenerationProgress({
            step: 'generating',
            title: event.title,
            current: 0,
            total: event.componentCount,
            components: event.components.map((c) => ({
              type: c.type,
              title: c.title,
              done: false,
            })),
          })
        } else if (event.type === 'component') {
          setGenerationProgress((prev) => {
            if (!prev) return prev
            const components = prev.components.map((c, i) =>
              i === event.index - 1 ? { ...c, done: true } : c
            )
            return {
              ...prev,
              current: event.index,
              components,
            }
          })
        } else if (event.type === 'complete') {
          setGenerationProgress(null)
          refetch()
        } else if (event.type === 'error') {
          setGenerationProgress({
            step: 'error',
            current: 0,
            total: 0,
            components: [],
            errorMessage: event.message,
          })
        }
      },
      () => {},
      (err) => {
        setGenerationProgress({
          step: 'error',
          current: 0,
          total: 0,
          components: [],
          errorMessage: err,
        })
      }
    )

    abortRef.current = controller
  }, [forgeId, refetch])

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

  const handleCompletionChange = (newMap: Record<string, boolean>) => {
    setCompletionMap(newMap)
  }

  const handleTabChange = (index: number) => {
    if (index === -1) {
      setActivePanel({ type: 'overview' })
    } else {
      setActivePanel({ type: 'component', index })
    }
  }

  // Persist chat list
  useEffect(() => {
    try {
      localStorage.setItem(`chats-${forgeId}`, JSON.stringify(chats))
    } catch { /* ignore */ }
  }, [chats, forgeId])

  const createChat = useCallback(() => {
    const id = crypto.randomUUID()
    const title = `Chat ${chats.length + 1}`
    const chat: ChatInfo = { id, title, createdAt: Date.now() }
    setChats((prev) => [...prev, chat])
    setActivePanel({ type: 'chat', chatId: id })
  }, [chats.length])

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
    handleCompletionChange,
    handleTabChange,
    documents,
    chats,
    createChat,
  }
}
