import { useState, useEffect, useRef, useCallback } from 'react'
import { useConversation } from '@elevenlabs/react'
import { Mic, PhoneOff, Volume2, Loader2, RefreshCw, ArrowRight } from 'lucide-react'
import { extractVoiceMessage, saveVoiceMessage, getVoiceProgress } from '../../lib/api'

interface VoicePanelProps {
  agentId: string
  sessionConfig: {
    prompt: string
    firstMessage: string
    progress: string
  }
  forgeId: string
  expertName: string
  resumeContext: {
    completedSections: string[]
    currentSection: string | null
    currentQuestion: string | null
    extractionCount: number
  } | null
  onMessage: (message: { role: string; content: string }) => void
  previousMessages?: Array<{ role: string; content: string }>
  onExtraction: (items: Array<{ id: string; type: string; content: string; confidence: number; tags: string[] }>) => void
  onEnd: () => void
  allQuestionsAnswered?: boolean
}

function statusDotColor(status: string): string {
  if (status === 'connected') return 'bg-green-500 animate-pulse'
  if (status === 'connecting') return 'bg-amber-500 animate-pulse'
  return 'bg-slate-500'
}

function statusText(status: string, isDisconnected: boolean): string {
  if (status === 'connecting') return 'Connecting...'
  if (status === 'connected') return 'Voice interview active'
  if (isDisconnected) return 'Session ended — continue or finish?'
  return 'Starting...'
}

function buildSessionConfig(agentId: string, prompt: string, firstMessage: string, progress: string) {
  return {
    agentId,
    connectionType: "websocket" as const,
    dynamicVariables: {
      interview_progress: progress,
    },
    overrides: {
      agent: {
        prompt: { prompt },
        firstMessage,
        language: "en",
      },
    },
  } as any
}

export default function VoicePanel({ agentId, sessionConfig, forgeId, expertName, resumeContext, previousMessages, onMessage, onExtraction, onEnd, allQuestionsAnswered }: VoicePanelProps) {
  const [messages, setMessages] = useState<Array<{ role: string; content: string }>>(previousMessages || [])
  const [isEnding, setIsEnding] = useState(false)
  const [isDisconnected, setIsDisconnected] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const startedRef = useRef(false)
  const endingRef = useRef(false)
  const wasConnectedRef = useRef(false)
  const messageCountRef = useRef(0)
  const conversationRef = useRef<ReturnType<typeof useConversation> | null>(null)
  const pendingProgressUpdate = useRef(false)

  const sendProgressUpdate = useCallback(() => {
    getVoiceProgress(forgeId)
      .then(({ progress }) => {
        if (progress && conversationRef.current) {
          try {
            conversationRef.current.sendContextualUpdate(`Interview progress has been updated:\n${progress}\n\nFollow the instructions in the progress update.`)
          } catch (err) {
            console.error('[VoicePanel] sendContextualUpdate failed:', err)
          }
        }
      })
      .catch((err: unknown) => console.error('[VoicePanel] Failed to fetch progress:', err))
  }, [forgeId])

  const conversation = useConversation({
    onMessage: useCallback(({ message, role }: { message: string; role: string }) => {
      const msg = { role: role === 'agent' ? 'assistant' : 'user', content: message }
      messageCountRef.current++
      setMessages((prev) => [...prev, msg])
      onMessage(msg)

      saveVoiceMessage(forgeId, msg.role, msg.content)
        .catch((err) => console.error('Failed to save voice message:', err))

      // When the user speaks, send any queued progress update
      if (msg.role === 'user' && pendingProgressUpdate.current && conversationRef.current) {
        pendingProgressUpdate.current = false
        sendProgressUpdate()
      }

      // Extract knowledge from expert messages in real-time
      if (msg.role === 'user' && msg.content.length > 20) {
        extractVoiceMessage(forgeId, msg.content)
          .then((result) => {
            if (result.extractions.length > 0) {
              onExtraction(result.extractions)
              // Send progress update immediately - important for completion detection
              sendProgressUpdate()
            }
          })
          .catch((err) => console.error('Voice extraction failed:', err))
      }
    }, [onMessage, onExtraction, forgeId]),
    onDisconnect: useCallback((details: unknown) => {
      console.log('[VoicePanel] onDisconnect details:', JSON.stringify(details))
    }, []),
    onError: useCallback((error: unknown) => {
      console.error('ElevenLabs error:', error)
    }, []),
  })

  conversationRef.current = conversation

  // Detect agent-initiated disconnect - show reconnect option instead of auto-completing
  useEffect(() => {
    if (conversation.status === 'connected') {
      wasConnectedRef.current = true
      setIsDisconnected(false)
    }
    if (conversation.status === 'disconnected' && wasConnectedRef.current && !endingRef.current) {
      wasConnectedRef.current = false
      if (messageCountRef.current >= 4) {
        setIsDisconnected(true)
      } else {
        console.log('[VoicePanel] Connection dropped early, only', messageCountRef.current, 'messages - not ending interview')
      }
    }
  }, [conversation.status])

  // Build first message - use resume context if available
  const firstMessageRef = useRef((() => {
    if (resumeContext && resumeContext.completedSections.length > 0) {
      const sectionsText = `We've already covered: ${resumeContext.completedSections.join(", ")}.`
      const nextText = resumeContext.currentSection
        ? `Let's continue with ${resumeContext.currentSection}${resumeContext.currentQuestion ? ` — specifically: ${resumeContext.currentQuestion}` : ""}.`
        : ""
      return `Welcome back ${expertName}! ${sectionsText} ${nextText} So where were we?`.trim()
    }
    return sessionConfig.firstMessage
  })())

  // Auto-start session (SDK handles cleanup on unmount internally)
  useEffect(() => {
    if (startedRef.current) return
    startedRef.current = true

    conversation.startSession(
      buildSessionConfig(agentId, sessionConfig.prompt, firstMessageRef.current, sessionConfig.progress)
    ).catch((err: unknown) => {
      console.error('[VoicePanel] Failed to start voice session:', err)
    })
  }, [agentId])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const handleReconnect = () => {
    setIsDisconnected(false)
    startedRef.current = false
    endingRef.current = false

    conversation.startSession(
      buildSessionConfig(agentId, sessionConfig.prompt, `Welcome back! Let's continue where we left off.`, sessionConfig.progress)
    ).catch((err: unknown) => {
      console.error('[VoicePanel] Failed to reconnect:', err)
    })
  }

  const handleEnd = async () => {
    endingRef.current = true
    setIsEnding(true)
    await conversation.endSession()
    // Don't call onEnd here — just show the reconnect/finish UI
    // so the user can choose to continue or explicitly finish
    setIsEnding(false)
    setIsDisconnected(true)
    endingRef.current = false
  }

  const isConnected = conversation.status === 'connected'

  return (
    <div className="flex flex-col h-full">
      {/* Voice status bar */}
      <div className={`px-6 py-3 border-b border-slate-700/50 flex items-center justify-between ${
        isConnected ? 'bg-green-500/5' : 'bg-slate-800/80'
      }`}>
        <div className="flex items-center gap-3">
          <div className={`w-3 h-3  ${statusDotColor(conversation.status)}`} />
          <span className="text-sm text-slate-300">
            {statusText(conversation.status, isDisconnected)}
          </span>
        </div>
        {conversation.isSpeaking && (
          <div className="flex items-center gap-2 text-orange-400 text-xs">
            <Volume2 className="w-3.5 h-3.5 animate-pulse" />
            Speaking
          </div>
        )}
      </div>

      {/* Transcript */}
      <div className="flex-1 overflow-y-auto px-6 py-4 space-y-3">
        {messages.length === 0 && !isConnected && (
          <div className="text-center py-12 text-slate-500">
            <Mic className="w-10 h-10 mx-auto mb-3 opacity-50 animate-pulse" />
            <p>{resumeContext?.completedSections.length ? 'Resuming voice interview...' : 'Starting voice interview...'}</p>
          </div>
        )}

        {messages.map((msg, i) => {
          const prevCount = previousMessages?.length || 0
          const showSeparator = prevCount > 0 && i === prevCount
          const isUser = msg.role === 'user'
          return (
            <div key={i}>
            {showSeparator && (
              <div className="flex items-center gap-3 py-3 text-slate-600 text-xs">
                <div className="flex-1 border-t border-slate-700/50" />
                <span>Resumed session</span>
                <div className="flex-1 border-t border-slate-700/50" />
              </div>
            )}
            <div className={`flex gap-3 ${isUser ? 'flex-row-reverse' : ''}`}>
              <div className={`w-8 h-8  flex items-center justify-center shrink-0 text-xs font-bold ${
                isUser
                  ? 'bg-orange-500/20 text-orange-400'
                  : 'bg-blue-500/20 text-blue-400'
              }`}>
                {isUser ? expertName.charAt(0).toUpperCase() : 'F'}
              </div>
              <div className={`max-w-[80%] px-4 py-3  text-sm leading-relaxed ${
                isUser
                  ? 'bg-orange-600/20 text-white '
                  : 'bg-slate-800 text-slate-200 '
              }`}>
                {msg.content}
              </div>
            </div>
            </div>
          )
        })}
        <div ref={messagesEndRef} />
      </div>

      {/* Voice controls */}
      <div className="px-6 py-4 border-t border-slate-700/50">
        <div className="flex items-center justify-center gap-4">
          {isDisconnected && (
            <>
              <button
                onClick={handleReconnect}
                className="flex items-center gap-2 px-6 py-3 bg-orange-600 hover:bg-orange-700 transition-colors"
              >
                <RefreshCw className="w-5 h-5" />
                Continue Interview
              </button>
              <button
                onClick={onEnd}
                className={`flex items-center gap-2 px-6 py-3 transition-colors ${
                  allQuestionsAnswered
                    ? 'bg-orange-600 hover:bg-orange-700'
                    : 'bg-slate-700 hover:bg-slate-600'
                }`}
              >
                {allQuestionsAnswered ? (
                  <ArrowRight className="w-5 h-5" />
                ) : (
                  <PhoneOff className="w-5 h-5" />
                )}
                {allQuestionsAnswered ? 'Continue to Next Step' : 'End Interview'}
              </button>
            </>
          )}
          {isConnected && (
            <button
              onClick={handleEnd}
              disabled={isEnding}
              className={`flex items-center gap-2 px-6 py-3 disabled:opacity-50 transition-colors ${
                allQuestionsAnswered
                  ? 'bg-orange-600 hover:bg-orange-700'
                  : 'bg-red-600 hover:bg-red-700'
              }`}
            >
              <EndButtonContent isEnding={isEnding} allQuestionsAnswered={allQuestionsAnswered} />
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

function EndButtonContent({ isEnding, allQuestionsAnswered }: { isEnding: boolean; allQuestionsAnswered?: boolean }) {
  if (isEnding) {
    return <><Loader2 className="w-5 h-5 animate-spin" />Ending...</>
  }
  if (allQuestionsAnswered) {
    return <><ArrowRight className="w-5 h-5" />Continue to Next Step</>
  }
  return <><PhoneOff className="w-5 h-5" />End Interview</>
}
