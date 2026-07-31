import { useState, useCallback, useRef, useEffect } from 'react'
import {
  generateIntroOpening,
  sendIntroMessage,
  EMPTY_EXPERT_PROFILE,
  type ExpertProfile,
  type IntroSSEEvent,
  type InterviewState,
} from '../lib/api'

export interface UseIntroReturn {
  messages: Array<{ role: string; content: string }>
  streamingContent: string
  isStreaming: boolean
  profile: ExpertProfile
  profileReady: boolean
  profileCompleteness: number
  handleSendMessage: (content: string) => void
  openingGenerated: boolean
  syncProfile: (profile: ExpertProfile) => void
}

const TOTAL_PROFILE_FIELDS = 11

function countNonNull(profile: ExpertProfile): number {
  let count = 0
  for (const val of Object.values(profile)) {
    if (val !== null && val !== undefined) {
      if (Array.isArray(val) && val.length === 0) continue
      count++
    }
  }
  return count
}

function profileFromMetadata(metadata: any): ExpertProfile {
  if (metadata?.introProfile) return metadata.introProfile
  // Backward compat: build from old introExtracted
  if (metadata?.introExtracted) {
    const e = metadata.introExtracted
    return {
      ...EMPTY_EXPERT_PROFILE,
      expertName: e.expertName || null,
      domain: e.domain || null,
      targetAudience: e.targetAudience || null,
    }
  }
  return EMPTY_EXPERT_PROFILE
}

export function useIntro(forgeId: string, state: InterviewState | undefined): UseIntroReturn {
  const metadata = (state?.forge?.metadata as any) || {}
  const initialMessages = metadata.introMessages || []
  const initialProfile = profileFromMetadata(metadata)

  const [messages, setMessages] = useState<Array<{ role: string; content: string }>>(initialMessages)
  const [streamingContent, setStreamingContent] = useState('')
  const [isStreaming, setIsStreaming] = useState(false)
  const [profile, setProfile] = useState<ExpertProfile>(initialProfile)
  const [openingGenerated, setOpeningGenerated] = useState(initialMessages.length > 0)
  const abortRef = useRef<AbortController | null>(null)
  const openingRequestedRef = useRef(false)

  // Sync from server state on refetch (e.g. after page reload)
  useEffect(() => {
    if (initialMessages.length > 0 && messages.length === 0) {
      setMessages(initialMessages)
      setOpeningGenerated(true)
    }
    const serverProfile = profileFromMetadata(metadata)
    if (serverProfile.expertName || serverProfile.domain || serverProfile.targetAudience) {
      setProfile(serverProfile)
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
          case 'profile_updated':
            setProfile(event.profile)
            break
          case 'intro_extracted':
            // Backward compat: ignored when profile_updated is present
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

  const profileReady = !!(profile.expertName && profile.domain && profile.targetAudience)
  const profileCompleteness = countNonNull(profile) / TOTAL_PROFILE_FIELDS

  const syncProfile = useCallback((p: ExpertProfile) => {
    setProfile(p)
  }, [])

  return {
    messages,
    streamingContent,
    isStreaming,
    profile,
    profileReady,
    profileCompleteness,
    handleSendMessage,
    openingGenerated,
    syncProfile,
  }
}
