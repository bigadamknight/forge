import { useState, useRef, useEffect, useCallback } from 'react'
import { MessageCircle, X, Send, Mic, Loader2, Volume2, Sparkles } from 'lucide-react'
import { useConversation } from '@elevenlabs/react'
import ReactMarkdown from 'react-markdown'
import { refineTool, getToolVoiceSession, askExpert, type RefineResult } from '../../lib/api'
import { buildClientTools, getComponentSummary } from '../../lib/componentInteractions'
import { useInteractionContext, buildPageContextSummary } from '../../lib/InteractionContext'

interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
  action?: RefineResult['action']
}

interface ChatSidebarProps {
  workspaceId: string
  chatId?: string
  activeComponentId: string | null
  activeComponentTitle?: string
  layout: Array<Record<string, unknown>>
  userContext?: Record<string, unknown>
  onComponentUpdate?: (componentId: string, config: Record<string, unknown>) => void
  onNavigate?: (componentId: string) => void
  variant?: 'floating' | 'panel'
  hidden?: boolean
}

function chatStorageKey(workspaceId: string, chatId?: string): string {
  return chatId ? `chat-${workspaceId}-${chatId}` : `chat-${workspaceId}`
}

export default function ChatSidebar({
  workspaceId,
  chatId,
  activeComponentId,
  activeComponentTitle,
  layout,
  userContext,
  onComponentUpdate,
  onNavigate,
  variant = 'floating',
  hidden = false,
}: ChatSidebarProps) {
  const [isOpen, setIsOpen] = useState(false)
  const isPanel = variant === 'panel'
  const storageKey = chatStorageKey(workspaceId, chatId)
  const [messages, setMessages] = useState<ChatMessage[]>(() => {
    try {
      const raw = localStorage.getItem(storageKey)
      return raw ? JSON.parse(raw) : []
    } catch { return [] }
  })
  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [voiceMode, setVoiceMode] = useState(false)
  const [voiceLoading, setVoiceLoading] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const layoutRef = useRef(layout)
  layoutRef.current = layout
  const onComponentUpdateRef = useRef(onComponentUpdate)
  onComponentUpdateRef.current = onComponentUpdate
  const onNavigateRef = useRef(onNavigate)
  onNavigateRef.current = onNavigate

  // ---- Client tool handlers (stable via refs) ----

  const findComponent = (id: string) =>
    layoutRef.current.find((c) => (c as any).id === id) as Record<string, any> | undefined

  // Panel chats only get navigate_to_section; widget gets all tools
  const chatOnlyTools = useRef({
    navigate_to_section: (params: any) => {
      onNavigateRef.current?.(params.component_id)
      return 'Navigated'
    },
  }).current

  const widgetTools = useRef(
    buildClientTools(
      findComponent,
      (id, config) => onComponentUpdateRef.current?.(id, config),
      (id) => onNavigateRef.current?.(id),
    )
  ).current

  const clientTools = isPanel ? chatOnlyTools : widgetTools

  // ---- Text refine handler ----

  const handleRefine = useCallback(async (userMessage: string) => {
    try {
      const result = await refineTool(
        workspaceId,
        userMessage,
        activeComponentId,
        layoutRef.current,
        userContext
      )

      if (result.action?.updatedConfig) {
        const targetId = result.action.navigateToComponentId || activeComponentId
        if (targetId) {
          if (result.action.navigateToComponentId && result.action.navigateToComponentId !== activeComponentId) {
            onNavigate?.(result.action.navigateToComponentId)
          }
          onComponentUpdate?.(targetId, result.action.updatedConfig)
        }
      } else if (result.action?.navigateToComponentId) {
        onNavigate?.(result.action.navigateToComponentId)
      }

      return result
    } catch (err) {
      console.error('[refine] Failed:', err)
      return null
    }
  }, [workspaceId, activeComponentId, userContext, onComponentUpdate, onNavigate])

  // ---- Voice conversation ----

  const conversation = useConversation({
    clientTools,
    onMessage: useCallback(({ message, role }: { message: string; role: string }) => {
      const msg: ChatMessage = {
        role: role === 'agent' ? 'assistant' : 'user',
        content: message,
      }
      setMessages((prev) => [...prev, msg])
    }, []),
    onError: useCallback((error: unknown) => {
      console.error('[ChatSidebar] ElevenLabs error:', error)
    }, []),
  })

  // Reload messages when chatId/storageKey changes
  useEffect(() => {
    try {
      const raw = localStorage.getItem(storageKey)
      setMessages(raw ? JSON.parse(raw) : [])
    } catch { setMessages([]) }
  }, [storageKey])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
    if (messages.length > 0) {
      try { localStorage.setItem(storageKey, JSON.stringify(messages)) } catch {}
    }
  }, [messages, storageKey])

  // Read page-level interaction context for richer contextual updates
  const interactions = useInteractionContext()

  // Send contextual update when active tab changes (widget only)
  useEffect(() => {
    if (isPanel || !voiceMode || conversation.status !== 'connected') return

    const pageContext = buildPageContextSummary(interactions)
    const activeConfig = layout.find((c) => (c as any).id === activeComponentId) as Record<string, any> | undefined

    if (!activeConfig) {
      const msg = pageContext
        ? `${pageContext}\nUser is on the Overview page. Suggest they navigate to a specific section using navigate_to_section.`
        : 'User is on the Overview page. Suggest they navigate to a specific section using navigate_to_section.'
      conversation.sendContextualUpdate(msg)
      return
    }

    const detail = getComponentSummary(activeConfig)
    const base = `User is now viewing "${activeConfig.title}" (${activeConfig.type}). Component ID: ${activeConfig.id}. ${detail}. Use client tools to update this component.`
    conversation.sendContextualUpdate(pageContext ? `${pageContext}\n${base}` : base)
  }, [activeComponentTitle, activeComponentId, voiceMode, conversation.status, interactions])

  // ---- Actions ----

  const handleTextSubmit = async () => {
    if (!input.trim() || isLoading) return

    const userMsg = input.trim()
    setInput('')
    setMessages((prev) => [...prev, { role: 'user', content: userMsg }])
    setIsLoading(true)

    try {
      const result = await handleRefine(userMsg)
      if (result) {
        setMessages((prev) => [...prev, {
          role: 'assistant',
          content: result.response,
          action: result.action,
        }])
      } else {
        setMessages((prev) => [...prev, {
          role: 'assistant',
          content: 'Sorry, I couldn\'t process that request.',
        }])
      }
    } finally {
      setIsLoading(false)
    }
  }

  const toggleVoice = async () => {
    if (voiceMode) {
      try { await conversation.endSession() } catch {}
      setVoiceMode(false)
      return
    }

    setVoiceLoading(true)
    try {
      const session = await getToolVoiceSession(workspaceId, isPanel ? 'chat' : 'widget')
      await conversation.startSession({
        agentId: session.agentId,
        connectionType: "websocket" as const,
        overrides: {
          agent: {
            prompt: { prompt: session.prompt },
            firstMessage: session.firstMessage,
            language: "en",
          },
        },
      } as any)
      setVoiceMode(true)
    } catch (err) {
      console.error('Failed to start voice:', err)
    } finally {
      setVoiceLoading(false)
    }
  }

  if (hidden) return null

  if (!isPanel && !isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        className="fixed bottom-6 right-6 w-14 h-14 bg-orange-600 hover:bg-orange-700  shadow-lg shadow-orange-500/20 flex items-center justify-center transition-all hover:scale-105 z-50"
      >
        <MessageCircle className="w-6 h-6" />
      </button>
    )
  }

  return (
    <div className={isPanel
      ? 'flex flex-col h-full'
      : 'fixed bottom-6 right-6 w-96 h-[600px] bg-slate-900 border border-slate-700/50 shadow-2xl flex flex-col z-50 overflow-hidden'
    }>
      <div className="flex items-center justify-between px-4 py-3 border-b border-slate-700/50 shrink-0">
        <div className="flex items-center gap-2">
          <MessageCircle className="w-4 h-4 text-orange-400" />
          <span className="text-sm font-medium">Ask the Expert</span>
          {voiceMode && (
            <span className="flex items-center gap-1 text-xs text-green-400">
              <Volume2 className="w-3 h-3" />
              Voice
            </span>
          )}
        </div>
        {!isPanel && (
          <button
            onClick={() => setIsOpen(false)}
            className="text-slate-400 hover:text-white transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {activeComponentTitle && (
        <div className="px-4 py-2 border-b border-slate-700/30 bg-slate-800/30">
          <span className="text-xs text-slate-500">
            Context: <span className="text-orange-400">{activeComponentTitle}</span>
          </span>
        </div>
      )}

      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
        {messages.length === 0 && (
          <div className="text-center text-slate-500 text-sm py-8">
            <MessageCircle className="w-8 h-8 mx-auto mb-2 opacity-30" />
            {isPanel ? (
              <>
                <p>Ask the expert anything.</p>
                <p className="text-xs mt-1">Get advice, ask questions, explore the topic.</p>
              </>
            ) : (
              <>
                <p>Ask questions or suggest changes.</p>
                <p className="text-xs mt-1">The tool updates as you talk.</p>
              </>
            )}
          </div>
        )}
        {messages.map((msg, idx) => (
          <div key={idx}>
            <div className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div
                className={`max-w-[85%] px-3 py-2  text-sm leading-relaxed ${
                  msg.role === 'user'
                    ? 'bg-orange-600/20 text-orange-100'
                    : 'bg-slate-800 text-slate-200'
                }`}
              >
                {msg.role === 'user' ? (
                  <p className="whitespace-pre-wrap">{msg.content}</p>
                ) : (
                  <ReactMarkdown
                    components={{
                      p: ({ children }) => <p className="mb-2 last:mb-0">{children}</p>,
                      strong: ({ children }) => <strong className="font-semibold text-white">{children}</strong>,
                      ul: ({ children }) => <ul className="list-disc list-inside mb-2 space-y-1">{children}</ul>,
                      ol: ({ children }) => <ol className="list-decimal list-inside mb-2 space-y-1">{children}</ol>,
                      li: ({ children }) => <li className="text-slate-300">{children}</li>,
                      code: ({ children, className }) => {
                        const isBlock = className?.includes('language-')
                        if (isBlock) {
                          return <code className="block bg-slate-900 px-2 py-1.5 text-xs text-orange-300 overflow-x-auto mb-2">{children}</code>
                        }
                        return <code className="bg-slate-900 px-1 py-0.5 text-xs text-orange-300">{children}</code>
                      },
                    }}
                  >
                    {msg.content}
                  </ReactMarkdown>
                )}
              </div>
            </div>
            {msg.action?.changeDescription && (
              <div className="flex justify-start mt-1">
                <div className="flex items-center gap-1.5 px-2.5 py-1 bg-orange-500/10 border border-orange-500/20 text-xs text-orange-400">
                  <Sparkles className="w-3 h-3" />
                  {msg.action.changeDescription}
                </div>
              </div>
            )}
          </div>
        ))}
        {isLoading && (
          <div className="flex justify-start">
            <div className="bg-slate-800 px-3 py-2">
              <Loader2 className="w-4 h-4 animate-spin text-orange-400" />
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {voiceMode && (
        <div className="px-4 py-3 border-t border-slate-700/30 bg-green-500/5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm text-green-400">
              <div className="w-2 h-2  bg-green-400 animate-pulse" />
              {conversation.isSpeaking ? 'Speaking...' : 'Listening...'}
            </div>
            <button
              onClick={toggleVoice}
              className="text-xs text-slate-400 hover:text-red-400 transition-colors"
            >
              End voice
            </button>
          </div>
        </div>
      )}

      {!voiceMode && (
        <div className="px-4 py-3 border-t border-slate-700/50 shrink-0">
          <div className="flex items-center gap-2">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && handleTextSubmit()}
              placeholder={isPanel ? "Ask the expert anything..." : "Ask a question or suggest a change..."}
              disabled={isLoading}
              className="flex-1 px-3 py-2 bg-slate-800 border border-slate-700/50  text-sm text-white placeholder-slate-500 focus:border-orange-500 focus:outline-none transition-colors"
            />
            <button
              onClick={toggleVoice}
              disabled={voiceLoading}
              className="p-2 text-slate-400 hover:text-orange-400 transition-colors"
              title="Switch to voice"
            >
              {voiceLoading ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <Mic className="w-5 h-5" />
              )}
            </button>
            <button
              onClick={handleTextSubmit}
              disabled={!input.trim() || isLoading}
              className="p-2 text-orange-400 hover:text-orange-300 disabled:opacity-30 transition-colors"
            >
              <Send className="w-5 h-5" />
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
