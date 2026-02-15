import { useEffect, useRef, useState } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import { useMutation } from '@tanstack/react-query'
import { ArrowLeft, Flame, Loader2, CheckCircle2, Mic, MessageSquare, Sparkles, ArrowRight } from 'lucide-react'
import { useInterview } from '../hooks/useInterview'
import { getVoiceSession } from '../lib/api'
import ChatPanel from '../components/interview/ChatPanel'
import VoicePanel from '../components/interview/VoicePanel'
import ExtractionPanel from '../components/interview/ExtractionPanel'
import AgendaTracker from '../components/interview/AgendaTracker'

const noop = () => {}

export default function InterviewPage() {
  const { forgeId } = useParams<{ forgeId: string }>()
  const navigate = useNavigate()
  const lastOpeningQuestionId = useRef<string | null>(null)
  const [mode, setMode] = useState<'choosing' | 'voice' | 'text'>('choosing')
  const [voiceSession, setVoiceSession] = useState<{
    agentId: string
    prompt: string
    firstMessage: string
    progress: string
  } | null>(null)

  const {
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
  } = useInterview(forgeId!)

  // Auto-resume: if there's already a voice transcript, go straight to voice mode
  const hasVoiceTranscript = !!(state?.forge?.metadata as any)?.voiceTranscript?.length
  const effectiveMode = mode === 'choosing' && hasVoiceTranscript ? 'voice' : mode

  const voiceSessionMutation = useMutation({
    mutationFn: () => getVoiceSession(forgeId!),
    onSuccess: (data) => {
      setVoiceSession(data)
      setMode('voice')
    },
  })

  // Auto-fetch voice session for resume
  const autoResumeRef = useRef(false)
  useEffect(() => {
    if (hasVoiceTranscript && !voiceSession && !autoResumeRef.current) {
      autoResumeRef.current = true
      voiceSessionMutation.mutate()
    }
  }, [hasVoiceTranscript])

  // Auto-generate opening message for text mode
  useEffect(() => {
    if (effectiveMode !== 'text') return
    if (!activeQuestion || allMessages.length > 0) return
    if (lastOpeningQuestionId.current === activeQuestion.id) return
    lastOpeningQuestionId.current = activeQuestion.id
    handleGenerateOpening()
  }, [state, activeQuestion, allMessages.length, effectiveMode])

  const totalExtractions = (state?.extractions.length ?? 0) + liveExtractions.length

  // Build resume context for voice mode
  const resumeContext = (() => {
    if (!state) return null
    const completedSections = state.sections
      .filter((s) => s.status === 'completed')
      .map((s) => s.title)
    if (completedSections.length === 0) return null
    return {
      completedSections,
      currentSection: activeSection?.title ?? null,
      currentQuestion: activeQuestion?.text ?? null,
      extractionCount: totalExtractions,
    }
  })()

  const allQuestionsAnswered = !!state
    && state.sections.length > 0
    && state.sections.every((s) => s.questions.every((q) => q.status === 'answered'))

  if (isLoading) {
    return (
      <div className="h-screen flex items-center justify-center">
        <div className="flex items-center gap-3 text-slate-400">
          <Loader2 className="w-6 h-6 animate-spin" />
          Loading interview...
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="h-screen flex items-center justify-center">
        <div className="text-center">
          <p className="text-red-400 mb-4">{error.message}</p>
          <Link to="/" className="text-orange-400 hover:text-orange-300">
            Back to Home
          </Link>
        </div>
      </div>
    )
  }

  if (!state) return null

  if (interviewComplete) {
    return (
      <div className="h-screen flex items-center justify-center">
        <div className="text-center max-w-md">
          <CheckCircle2 className="w-16 h-16 mx-auto mb-4 text-green-400" />
          <h2 className="text-2xl font-bold mb-2">Interview Complete</h2>
          <p className="text-slate-400 mb-6">
            We've captured {totalExtractions} pieces of knowledge from {state.forge.expertName}.
          </p>
          <button
            onClick={() => navigate(`/forge/${forgeId}/tool`)}
            className="px-6 py-3 bg-orange-600 hover:bg-orange-700  transition-colors font-medium inline-flex items-center gap-2"
          >
            <Sparkles className="w-5 h-5" />
            Generate Interactive Tool
          </button>
          <div className="mt-4">
            <Link to="/" className="text-slate-500 hover:text-slate-300 text-sm">
              Back to Home
            </Link>
          </div>
        </div>
      </div>
    )
  }

  // Mode selection screen
  if (effectiveMode === 'choosing') {
    return (
      <div className="h-screen flex items-center justify-center">
        <div className="text-center max-w-lg">
          <div className="flex items-center gap-3 justify-center mb-6">
            <Flame className="w-8 h-8 text-orange-400" />
            <h1 className="text-2xl font-bold">Ready to begin</h1>
          </div>
          <p className="text-slate-400 mb-8">
            How would you like to share your knowledge, {state.forge.expertName}?
          </p>
          <div className="flex gap-4 justify-center">
            <button
              onClick={() => voiceSessionMutation.mutate()}
              disabled={voiceSessionMutation.isPending}
              className="flex flex-col items-center gap-3 px-8 py-6 bg-orange-600 hover:bg-orange-700 disabled:opacity-50  transition-colors"
            >
              {voiceSessionMutation.isPending ? (
                <Loader2 className="w-8 h-8 animate-spin" />
              ) : (
                <Mic className="w-8 h-8" />
              )}
              <span className="font-medium">Voice Conversation</span>
              <span className="text-xs text-orange-200">Speak naturally with an AI interviewer</span>
            </button>
            <button
              onClick={() => setMode('text')}
              className="flex flex-col items-center gap-3 px-8 py-6 bg-slate-800 hover:bg-slate-700 border border-slate-600  transition-colors"
            >
              <MessageSquare className="w-8 h-8" />
              <span className="font-medium">Text Chat</span>
              <span className="text-xs text-slate-400">Type your answers</span>
            </button>
          </div>
          {voiceSessionMutation.isError && (
            <p className="text-red-400 text-sm mt-4">
              Voice setup failed. Try text mode instead.
            </p>
          )}
          <div className="mt-6">
            <Link to="/" className="text-slate-500 hover:text-slate-300 text-sm">
              Back to Home
            </Link>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="h-screen flex flex-col">
      {/* Header */}
      <header className="flex items-center gap-4 px-6 py-3 border-b border-slate-700/50 bg-slate-900/80 backdrop-blur-sm shrink-0">
        <Link to="/" className="text-slate-400 hover:text-white transition-colors">
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div className="flex items-center gap-2">
          <Flame className="w-5 h-5 text-orange-400" />
          <span className="font-medium">{state.forge.expertName}</span>
          <span className="text-slate-500">·</span>
          <span className="text-slate-400 text-sm">{state.forge.domain}</span>
        </div>
        <div className="ml-auto flex items-center gap-3">
          {effectiveMode === 'voice' && (
            <span className="flex items-center gap-1.5 text-xs text-green-400">
              <Mic className="w-3.5 h-3.5" />
              Voice Mode
            </span>
          )}
          {activeSection && (
            <span className="text-sm text-orange-400">{activeSection.title}</span>
          )}
        </div>
      </header>

      {/* Split screen */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left panel (60%) */}
        <div className="w-[60%] border-r border-slate-700/50 flex flex-col">
          {effectiveMode === 'voice' && voiceSession ? (
            <VoicePanel
              agentId={voiceSession.agentId}
              sessionConfig={{
                prompt: voiceSession.prompt,
                firstMessage: voiceSession.firstMessage,
                progress: voiceSession.progress,
              }}
              forgeId={forgeId!}
              expertName={state.forge.expertName}
              resumeContext={resumeContext}
              previousMessages={(state.forge.metadata as any)?.voiceTranscript as Array<{ role: string; content: string }> | undefined}
              onMessage={noop}
              onExtraction={addLiveExtractions}
              onEnd={handleComplete}
              allQuestionsAnswered={allQuestionsAnswered}
            />
          ) : (
            <ChatPanel
              messages={allMessages}
              streamingContent={streamingContent}
              isStreaming={isStreaming}
              currentQuestion={activeQuestion?.text || null}
              expertName={state.forge.expertName}
              onSendMessage={handleSendMessage}
            />
          )}
        </div>

        {/* Right panel - Extractions + Agenda (40%) */}
        <div className="w-[40%] flex flex-col bg-slate-850">
          <div className="p-4 border-b border-slate-700/50">
            <AgendaTracker sections={state.sections} />
          </div>
          <div className="flex-1 overflow-hidden">
            <ExtractionPanel
              extractions={state.extractions}
              liveExtractions={liveExtractions}
            />
          </div>
          <div className="p-4 border-t border-slate-700/50">
            <button
              onClick={handleComplete}
              className={`w-full flex items-center justify-center gap-2 px-4 py-2  transition-colors text-sm ${
                allQuestionsAnswered
                  ? 'bg-orange-600 hover:bg-orange-700 text-white font-medium'
                  : 'bg-slate-800 hover:bg-slate-700 border border-slate-600 text-slate-300 hover:text-white'
              }`}
            >
              {allQuestionsAnswered ? (
                <>
                  <ArrowRight className="w-4 h-4" />
                  Continue to Next Step
                </>
              ) : (
                'End Interview Early'
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
