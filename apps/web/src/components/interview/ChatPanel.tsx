import { useState, useRef, useEffect } from 'react'
import { Send, MessageSquare, Mic, MicOff } from 'lucide-react'
import { useVoice } from '../../hooks/useVoice'

interface Message {
  id?: string
  role: string
  content: string
}

interface ChatPanelProps {
  messages: Message[]
  streamingContent: string
  isStreaming: boolean
  currentQuestion: string | null
  expertName: string
  onSendMessage: (content: string) => void
  inputPlaceholder?: string
}

export default function ChatPanel({
  messages,
  streamingContent,
  isStreaming,
  currentQuestion,
  expertName,
  onSendMessage,
  inputPlaceholder,
}: ChatPanelProps) {
  const [input, setInput] = useState('')
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  const handleVoiceTranscript = (text: string) => {
    if (!isStreaming && text.trim()) {
      onSendMessage(text.trim())
    }
  }

  const { isListening, transcript, isSupported, toggleListening } = useVoice(handleVoiceTranscript)

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, streamingContent])

  const handleSubmit = () => {
    const trimmed = input.trim()
    if (!trimmed || isStreaming) return
    onSendMessage(trimmed)
    setInput('')
    inputRef.current?.focus()
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSubmit()
    }
  }

  return (
    <div className="flex flex-col h-full">
      {/* Current question context */}
      {currentQuestion && (
        <div className="px-6 py-3 bg-slate-800/80 border-b border-slate-700/50">
          <div className="flex items-center gap-2 text-xs text-slate-500 mb-1">
            <MessageSquare className="w-3 h-3" />
            Current Question
          </div>
          <p className="text-sm text-slate-300">{currentQuestion}</p>
        </div>
      )}

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
        {messages.length === 0 && !streamingContent && (
          <div className="text-center py-12 text-slate-500">
            <MessageSquare className="w-10 h-10 mx-auto mb-3 opacity-50" />
            <p>Starting conversation...</p>
          </div>
        )}

        {messages.map((msg, i) => (
          <MessageBubble
            key={msg.id || i}
            role={msg.role}
            content={msg.content}
            expertName={expertName}
          />
        ))}

        {streamingContent && (
          <MessageBubble
            role="assistant"
            content={streamingContent}
            expertName={expertName}
            isStreaming
          />
        )}

        {isStreaming && !streamingContent && (
          <div className="flex gap-3">
            <div className="w-8 h-8 flex items-center justify-center shrink-0 text-xs font-bold bg-blue-500/20 text-blue-400">
              F
            </div>
            <div className="px-4 py-3 bg-slate-800 flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-slate-400 animate-bounce [animation-delay:0ms]" />
              <span className="w-2 h-2 rounded-full bg-slate-400 animate-bounce [animation-delay:150ms]" />
              <span className="w-2 h-2 rounded-full bg-slate-400 animate-bounce [animation-delay:300ms]" />
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Voice transcript indicator */}
      {isListening && (
        <div className="px-6 py-2 border-t border-slate-700/30">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2  bg-red-500 animate-pulse" />
            <span className="text-xs text-slate-400">
              {transcript || 'Listening...'}
            </span>
          </div>
        </div>
      )}

      {/* Input */}
      <div className="px-6 py-4 border-t border-slate-700/50">
        <div className="flex items-end gap-2">
          {isSupported && (
            <button
              onClick={toggleListening}
              disabled={isStreaming}
              className={`p-3  transition-colors shrink-0 ${
                isListening
                  ? 'bg-red-600 hover:bg-red-700 text-white'
                  : 'bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white border border-slate-700'
              } disabled:opacity-30 disabled:cursor-not-allowed`}
              title={isListening ? 'Stop recording' : 'Start voice input'}
            >
              {isListening ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
            </button>
          )}
          <div className="flex-1 relative">
            <textarea
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={isStreaming ? 'Waiting for response...' : isListening ? 'Or type here...' : (inputPlaceholder || 'Share your knowledge...')}
              disabled={isStreaming}
              rows={1}
              className="w-full px-4 py-3 bg-slate-800  border border-slate-700 focus:border-orange-500 focus:outline-none transition-colors resize-none disabled:opacity-50"
              style={{ minHeight: '48px', maxHeight: '120px' }}
            />
          </div>
          <button
            onClick={handleSubmit}
            disabled={!input.trim() || isStreaming}
            className="p-3 bg-orange-600 hover:bg-orange-700 disabled:opacity-30 disabled:cursor-not-allowed  transition-colors shrink-0"
          >
            <Send className="w-5 h-5" />
          </button>
        </div>
      </div>
    </div>
  )
}

function MessageBubble({
  role,
  content,
  expertName,
  isStreaming = false,
}: {
  role: string
  content: string
  expertName: string
  isStreaming?: boolean
}) {
  const isUser = role === 'user'

  return (
    <div className={`flex gap-3 ${isUser ? 'flex-row-reverse' : ''}`}>
      <div className={`w-8 h-8  flex items-center justify-center shrink-0 text-xs font-bold ${
        isUser
          ? 'bg-orange-500/20 text-orange-400'
          : 'bg-blue-500/20 text-blue-400'
      }`}>
        {isUser ? expertName.charAt(0).toUpperCase() : 'F'}
      </div>
      <div
        className={`max-w-[80%] px-4 py-3  text-sm leading-relaxed whitespace-pre-wrap ${
          isUser
            ? 'bg-orange-600/20 text-white '
            : 'bg-slate-800 text-slate-200 '
        } ${isStreaming ? 'animate-pulse-subtle' : ''}`}
      >
        {content}
        {isStreaming && (
          <span className="inline-block w-1.5 h-4 bg-blue-400 ml-0.5 animate-blink" />
        )}
      </div>
    </div>
  )
}
