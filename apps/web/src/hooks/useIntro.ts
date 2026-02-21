import { useState, useCallback, useRef, useEffect } from 'react'
import {
  generateIntroOpening,
  sendIntroMessage,
  type IntroFields,
  type IntroSSEEvent,
  type InterviewState,
} from '../lib/api'

export interface UseIntroReturn {
  messages: Array<{ role: string; content: string }>
  streamingContent: string
  isStreaming: boolean
  extractedFields: IntroFields
  allFieldsCaptured: boolean
  handleSendMessage: (content: string) => void
  openingGenerated: boolean
  syncExtractedFields: (fields: IntroFields) => void
}

const EMPTY_FIELDS: IntroFields = {
  expertName: null,
  domain: null,
  targetAudience: null,
}

export function useIntro(forgeId: string, state: InterviewState | undefined): UseIntroReturn {
  const metadata = (state?.forge?.metadata as any) || {}
  const initialMessages = metadata.introMessages || []
  const initialExtracted = metadata.introExtracted || EMPTY_FIELDS

  const [messages, setMessages] = useState<Array<{ role: string; content: string }>>(initialMessages)
  const [streamingContent, setStreamingContent] = useState('')
  const [isStreaming, setIsStreaming] = useState(false)
  const [extractedFields, setExtractedFields] = useState<IntroFields>(initialExtracted)
  const [openingGenerated, setOpeningGenerated] = useState(initialMessages.length > 0)
  const abortRef = useRef<AbortController | null>(null)
  const openingRequestedRef = useRef(false)

  // Sync from server state on refetch (e.g. after page reload)
  useEffect(() => {
    if (initialMessages.length > 0 && messages.length === 0) {
      setMessages(initialMessages)
      setOpeningGenerated(true)
    }
    if (initialExtracted.expertName || initialExtracted.domain || initialExtracted.targetAudience) {
      setExtractedFields(initialExtracted)
    }
  }, [state?.forge?.id])

  // Auto-generate opening on first mount
  useEffect(() => {
    if (!forgeId || openingGenerated || openingRequestedRef.current) return
    if (state?.forge?.status !== 'draft') return
    openingRequestedRef.current = true

    generateIntroOpening(forgeId).then(({ content }) => {
      setMessages([{ role: 'assistant', content }])
      setOpeningGenerated(true)
    }).catch((err) => {
      console.error('Failed to generate intro opening:', err)
      openingRequestedRef.current = false
    })
  }, [forgeId, openingGenerated, state?.forge?.status])

  const handleSendMessage = useCallback((content: string) => {
    if (isStreaming || !forgeId) return

    setMessages((prev) => [...prev, { role: 'user', content }])
    setIsStreaming(true)
    setStreamingContent('')

    abortRef.current = sendIntroMessage(
      forgeId,
      content,
      (event: IntroSSEEvent) => {
        switch (event.type) {
          case 'chunk':
            setStreamingContent((prev) => prev + event.content)
            break
          case 'done':
            setStreamingContent((prev) => {
              if (prev) {
                setMessages((msgs) => [...msgs, { role: 'assistant', content: prev }])
              }
              return ''
            })
            setIsStreaming(false)
            break
          case 'intro_extracted':
            setExtractedFields(event.fields)
            break
          case 'error':
            console.error('Intro SSE error:', event.message)
            setIsStreaming(false)
            break
        }
      },
      () => {
        setIsStreaming(false)
      },
      (error) => {
        console.error('Intro stream error:', error)
        setIsStreaming(false)
      }
    )
  }, [forgeId, isStreaming])

  const allFieldsCaptured = !!(extractedFields.expertName && extractedFields.domain && extractedFields.targetAudience)

  const syncExtractedFields = useCallback((fields: IntroFields) => {
    setExtractedFields(fields)
  }, [])

  return {
    messages,
    streamingContent,
    isStreaming,
    extractedFields,
    allFieldsCaptured,
    handleSendMessage,
    openingGenerated,
    syncExtractedFields,
  }
}
