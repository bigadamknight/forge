import { useState, useCallback, useRef } from 'react'
import { useQuery, useQueryClient, keepPreviousData } from '@tanstack/react-query'
import {
  getInterviewState,
  generateOpening,
  sendInterviewMessage,
  completeInterview,
  type InterviewState,
  type Extraction,
  type SSEEvent,
} from '../lib/api'

export interface UseInterviewReturn {
  state: InterviewState | undefined
  isLoading: boolean
  error: Error | null
  streamingContent: string
  isStreaming: boolean
  liveExtractions: Extraction[]
  activeSection: InterviewState['sections'][0] | null
  activeQuestion: InterviewState['sections'][0]['questions'][0] | null
  allMessages: Array<{ role: string; content: string; id?: string }>
  handleSendMessage: (content: string) => void
  handleGenerateOpening: () => Promise<void>
  handleComplete: () => Promise<void>
  addLiveExtractions: (items: Array<{ id: string; type: string; content: string; confidence: number; tags: string[] | null }>) => void
  interviewComplete: boolean
  currentRound: number
}

export function useInterview(forgeId: string): UseInterviewReturn {
  const queryClient = useQueryClient()
  const [streamingContent, setStreamingContent] = useState('')
  const [isStreaming, setIsStreaming] = useState(false)
  const [liveExtractions, setLiveExtractions] = useState<Extraction[]>([])
  const [interviewComplete, setInterviewComplete] = useState(false)
  const abortRef = useRef<AbortController | null>(null)

  const { data: state, isLoading, error } = useQuery({
    queryKey: ['interview', forgeId],
    queryFn: () => getInterviewState(forgeId),
    refetchInterval: false,
    placeholderData: keepPreviousData,
  })

  const currentRound = state?.currentRound ?? 1

  // Find active section and question (filtered to current round)
  const activeSection = state?.sections.filter((s) => (s.round ?? 1) === currentRound).find((s) => s.status === 'active') || null
  const activeQuestion = activeSection?.questions.find((q) => q.status === 'active') || null

  // Collect messages from current round for display
  const allMessages = (() => {
    if (!state) return []
    const msgs: Array<{ role: string; content: string; id?: string }> = []
    const roundSections = state.sections.filter((s) => (s.round ?? 1) === currentRound)
    for (const section of roundSections) {
      for (const question of section.questions) {
        for (const msg of question.messages) {
          msgs.push({ role: msg.role, content: msg.content, id: msg.id })
        }
      }
    }
    return msgs
  })()

  const invalidateInterview = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ['interview', forgeId] })
  }, [forgeId, queryClient])

  const appendExtractions = useCallback((items: Array<{ id: string; type: string; content: string; confidence: number; tags?: string[] | null }>) => {
    setLiveExtractions((prev) => [
      ...prev,
      ...items.map((item) => ({
        id: item.id,
        forgeId,
        sectionId: null,
        questionId: null,
        type: item.type,
        content: item.content,
        confidence: item.confidence,
        tags: item.tags || null,
        createdAt: new Date().toISOString(),
      })),
    ])
    invalidateInterview()
  }, [forgeId, invalidateInterview])

  const handleSendMessage = useCallback((content: string) => {
    if (isStreaming || !forgeId) return

    setIsStreaming(true)
    setStreamingContent('')

    abortRef.current = sendInterviewMessage(
      forgeId,
      content,
      (event: SSEEvent) => {
        switch (event.type) {
          case 'chunk':
            setStreamingContent((prev) => prev + event.content)
            break
          case 'done':
            setStreamingContent('')
            setIsStreaming(false)
            invalidateInterview()
            break
          case 'extraction':
            appendExtractions(event.items)
            break
          case 'advance':
            invalidateInterview()
            break
          case 'interview_complete':
            setInterviewComplete(true)
            invalidateInterview()
            break
          case 'validation':
            break
          case 'error':
            console.error('SSE error:', event.message)
            setIsStreaming(false)
            break
        }
      },
      () => {
        setIsStreaming(false)
      },
      (error) => {
        console.error('Stream error:', error)
        setIsStreaming(false)
      }
    )
  }, [forgeId, isStreaming, invalidateInterview, appendExtractions])

  const handleGenerateOpening = useCallback(async () => {
    await generateOpening(forgeId)
    invalidateInterview()
  }, [forgeId, invalidateInterview])

  const handleComplete = useCallback(async () => {
    await completeInterview(forgeId)
    setInterviewComplete(true)
    invalidateInterview()
  }, [forgeId, invalidateInterview])

  const addLiveExtractions = useCallback((items: Array<{ id: string; type: string; content: string; confidence: number; tags: string[] | null }>) => {
    appendExtractions(items)
  }, [appendExtractions])

  return {
    state,
    isLoading,
    error,
    streamingContent,
    isStreaming,
    liveExtractions,
    activeSection,
    activeQuestion,
    allMessages,
    handleSendMessage,
    handleGenerateOpening,
    handleComplete,
    addLiveExtractions,
    interviewComplete,
    currentRound,
  }
}
