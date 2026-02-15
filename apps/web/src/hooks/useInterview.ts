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

  // Find active section and question
  const activeSection = state?.sections.find((s) => s.status === 'active') || null
  const activeQuestion = activeSection?.questions.find((q) => q.status === 'active') || null

  // Collect all messages across all sections/questions for continuous display
  const allMessages = (() => {
    if (!state) return []
    const msgs: Array<{ role: string; content: string; id?: string }> = []
    for (const section of state.sections) {
      for (const question of section.questions) {
        for (const msg of question.messages) {
          msgs.push({ role: msg.role, content: msg.content, id: msg.id })
        }
      }
    }
    return msgs
  })()

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
            queryClient.invalidateQueries({ queryKey: ['interview', forgeId] })
            break
          case 'extraction':
            setLiveExtractions((prev) => [
              ...prev,
              ...event.items.map((item) => ({
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
            queryClient.invalidateQueries({ queryKey: ['interview', forgeId] })
            break
          case 'advance':
            queryClient.invalidateQueries({ queryKey: ['interview', forgeId] })
            break
          case 'interview_complete':
            setInterviewComplete(true)
            queryClient.invalidateQueries({ queryKey: ['interview', forgeId] })
            break
          case 'validation':
            // Validation handled implicitly through advance/complete events
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
  }, [forgeId, isStreaming, queryClient])

  const handleGenerateOpening = useCallback(async () => {
    await generateOpening(forgeId)
    queryClient.invalidateQueries({ queryKey: ['interview', forgeId] })
  }, [forgeId, queryClient])

  const handleComplete = useCallback(async () => {
    await completeInterview(forgeId)
    setInterviewComplete(true)
    queryClient.invalidateQueries({ queryKey: ['interview', forgeId] })
  }, [forgeId, queryClient])

  const addLiveExtractions = useCallback((items: Array<{ id: string; type: string; content: string; confidence: number; tags: string[] | null }>) => {
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
        tags: item.tags,
        createdAt: new Date().toISOString(),
      })),
    ])
    // Refetch interview state to update progress tracker
    queryClient.invalidateQueries({ queryKey: ['interview', forgeId] })
  }, [forgeId, queryClient])

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
  }
}
