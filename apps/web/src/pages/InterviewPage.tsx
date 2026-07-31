import { useCallback, useEffect, useRef, useState } from 'react'
import { useParams, Link, useNavigate, useSearchParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ArrowLeft, Flame, Loader2, CheckCircle2, Mic, MessageSquare, Sparkles, ArrowRight } from 'lucide-react'
import { useInterview } from '../hooks/useInterview'
import { useIntro } from '../hooks/useIntro'
import type { PlanningState } from '../hooks/usePlanningAnimation'
import { getVoiceSession, getIntroVoiceSession, saveIntroVoiceMessage, extractIntroVoiceMessage, seedExtractions, startFollowUpStream, getWorkspace, type PlanInterviewEvent } from '../lib/api'
import { countCaptured } from '../lib/profileFields'
import { useRegisterInteraction } from '../lib/InteractionContext'
import { INTERVIEW_PAGE_INTRO, INTERVIEW_PAGE_ACTIVE } from '../lib/pageInteractions'
import ChatPanel from '../components/interview/ChatPanel'
import VoicePanel from '../components/interview/VoicePanel'
import ExtractionPanel from '../components/interview/ExtractionPanel'
import AgendaTracker from '../components/interview/AgendaTracker'
import ProfileCard from '../components/interview/ProfileCard'
import InterviewPlanningAnimation from '../components/InterviewPlanningAnimation'
import DevTools from '../components/DevTools'

const noop = () => {}

const EMPTY_PLANNING_STATE: PlanningState = {
  stage: 'analysing',
  domainContext: null,
  extractionPriorities: [],
  estimatedDuration: null,
  sections: [],
  forgeId: null,
  errorMessage: null,
  sectionsWithQuestions: 0,
  formContext: null,
  constellationNodes: [],
}

export default function InterviewPage() {
  const { workspaceId, forgeId } = useParams<{ workspaceId: string; forgeId: string }>()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [searchParams] = useSearchParams()
  const followUpTopic = searchParams.get('topic')
  const lastOpeningQuestionId = useRef<string | null>(null)
  const [mode, setMode] = useState<'choosing' | 'voice' | 'text'>('choosing')
  const [followUpPlanning, setFollowUpPlanning] = useState(!!followUpTopic)
  const followUpStartedRef = useRef(false)
  const [voiceSession, setVoiceSession] = useState<{
    agentId: string
    prompt: string
    firstMessage: string
    progress: string
  } | null>(null)

  const [followUpPlanState, setFollowUpPlanState] = useState<PlanningState>(EMPTY_PLANNING_STATE)

  // Start follow-up stream on mount when topic is present
  useEffect(() => {
    if (!followUpTopic || !forgeId || followUpStartedRef.current) return
    followUpStartedRef.current = true

    setFollowUpPlanState(EMPTY_PLANNING_STATE)

    startFollowUpStream(
      forgeId,
      followUpTopic,
      (event: PlanInterviewEvent) => {
        switch (event.type) {
          case 'analysing':
            setFollowUpPlanState((s) => ({ ...s, stage: 'analysing' }))
            break
          case 'skeleton':
            setFollowUpPlanState((s) => ({
              ...s,
              stage: 'sections',
              domainContext: event.domainContext,
              extractionPriorities: event.extractionPriorities,
              estimatedDuration: event.estimatedDurationMinutes,
              sections: event.sections.map((sec) => ({
                index: sec.index,
                title: sec.title,
                goal: sec.goal,
                questions: [],
                questionsReady: false,
              })),
            }))
            break
          case 'questions':
            setFollowUpPlanState((s) => {
              const sections = s.sections.map((sec) =>
                sec.index === event.sectionIndex
                  ? { ...sec, questions: event.questions, questionsReady: true }
                  : sec
              )
              const readyCount = sections.filter((sec) => sec.questionsReady).length
              const allReady = readyCount === sections.length
              return {
                ...s,
                stage: allReady ? 'saving' : 'questions',
                sections,
                sectionsWithQuestions: readyCount,
              }
            })
            break
          case 'complete':
            setFollowUpPlanState((s) => ({ ...s, stage: 'complete', forgeId: event.forgeId }))
            setTimeout(() => {
              setFollowUpPlanning(false)
              queryClient.invalidateQueries({ queryKey: ['interview', forgeId] })
            }, 1200)
            break
          case 'error':
            setFollowUpPlanState((s) => ({ ...s, stage: 'error', errorMessage: event.message }))
            break
        }
      },
      () => {},
      (error) => {
        setFollowUpPlanState((s) => ({ ...s, stage: 'error', errorMessage: error }))
      }
    )
  }, [followUpTopic, forgeId])

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
    currentRound,
  } = useInterview(forgeId!)

  const intro = useIntro(forgeId!, state)
  const isIntroPhase = state?.forge?.status === 'draft'

  const { data: wsData } = useQuery({
    queryKey: ['workspace', workspaceId],
    queryFn: () => getWorkspace(workspaceId!),
    enabled: !!workspaceId,
  })
  const customExtractionTypes = ((wsData?.metadata as Record<string, unknown>)?.customExtractionTypes ?? []) as import('../lib/extractionTypes').CustomExtractionType[]

  // Register page interaction context
  const interactionDescriptor = isIntroPhase ? INTERVIEW_PAGE_INTRO : INTERVIEW_PAGE_ACTIVE
  const { updateState: updatePageState } = useRegisterInteraction(
    `page:interview:${forgeId}`,
    interactionDescriptor,
    { mode: 'choosing' },
  )
  const modeParam = searchParams.get('mode')
  const [introMode, setIntroMode] = useState<'choosing' | 'voice' | 'text'>(
    modeParam === 'voice' ? 'voice' : modeParam === 'text' ? 'text' : 'choosing'
  )
  const [introVoiceSession, setIntroVoiceSession] = useState<{
    agentId: string
    prompt: string
    firstMessage: string
    progress: string
  } | null>(null)

  const introVoiceMutation = useMutation({
    mutationFn: () => getIntroVoiceSession(forgeId!),
    onSuccess: (data) => {
      setIntroVoiceSession(data)
      setIntroMode('voice')
    },
  })

  // Auto-start voice session when mode=voice from query param
  const introVoiceAutoRef = useRef(false)
  useEffect(() => {
    if (modeParam === 'voice' && isIntroPhase && !introVoiceSession && !introVoiceAutoRef.current) {
      introVoiceAutoRef.current = true
      introVoiceMutation.mutate()
    }
  }, [modeParam, isIntroPhase])

  // Refresh intro extracted fields from server after voice messages
  const refreshIntroFields = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ['interview', forgeId] })
  }, [forgeId, queryClient])

  // Sync intro profile from server state (for voice mode)
  useEffect(() => {
    if (!isIntroPhase) return
    const metadata = (state?.forge?.metadata as any) || {}
    const serverProfile = metadata.introProfile
    if (serverProfile && (serverProfile.expertName || serverProfile.domain || serverProfile.targetAudience)) {
      intro.syncProfile(serverProfile)
    }
  }, [state?.forge?.updatedAt])


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

  // Sync interaction context state
  useEffect(() => {
    if (isIntroPhase) {
      updatePageState({
        mode: introMode,
        expertName: intro.profile.expertName,
        profileFieldCount: countCaptured(intro.profile),
        profileReady: intro.profileReady,
      })
    } else {
      updatePageState({
        mode: effectiveMode,
        expertName: state?.forge?.expertName,
        currentSection: activeSection?.title,
        currentQuestion: activeQuestion?.text,
        extractionCount: totalExtractions,
        interviewComplete,
      })
    }
  }, [introMode, effectiveMode, intro.profileReady, activeSection?.title, activeQuestion?.text, totalExtractions, interviewComplete])

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

  // Show follow-up planning animation
  if (followUpPlanning && followUpTopic) {
    return (
      <div className="max-w-2xl mx-auto p-8">
        <Link to={`/workspace/${workspaceId}`} className="flex items-center gap-2 text-slate-400 hover:text-white mb-8 transition-colors">
          <ArrowLeft className="w-4 h-4" />
          Back to Tool
        </Link>
        <div className="mb-6">
          <h2 className="text-lg font-semibold text-white mb-1">Follow-up Interview</h2>
          <p className="text-slate-400 text-sm">{followUpTopic}</p>
        </div>
        <InterviewPlanningAnimation state={followUpPlanState} onRetry={() => {
          followUpStartedRef.current = false
          setFollowUpPlanState(EMPTY_PLANNING_STATE)
        }} />
      </div>
    )
  }

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
          <Link to="/workspaces" className="text-orange-400 hover:text-orange-300">
            Back to Home
          </Link>
        </div>
      </div>
    )
  }

  if (!state) return null

  // ============ Intro Phase ============
  if (isIntroPhase) {
    // Intro mode selection
    if (introMode === 'choosing') {
      return (
        <div className="h-screen flex items-center justify-center">
          <div className="text-center max-w-lg">
            <div className="flex items-center gap-3 justify-center mb-6">
              <Flame className="w-8 h-8 text-orange-400" />
              <h1 className="text-2xl font-bold">New Forge</h1>
            </div>
            <p className="text-slate-400 mb-8">
              Let's start by getting to know you and your expertise. How would you like to chat?
            </p>
            <div className="flex gap-4 justify-center">
              <button
                onClick={() => introVoiceMutation.mutate()}
                disabled={introVoiceMutation.isPending}
                className="flex flex-col items-center gap-3 px-8 py-6 bg-orange-600 hover:bg-orange-700 disabled:opacity-50 transition-colors"
              >
                {introVoiceMutation.isPending ? (
                  <Loader2 className="w-8 h-8 animate-spin" />
                ) : (
                  <Mic className="w-8 h-8" />
                )}
                <span className="font-medium">Voice Conversation</span>
                <span className="text-xs text-orange-200">Speak naturally</span>
              </button>
              <button
                onClick={() => setIntroMode('text')}
                className="flex flex-col items-center gap-3 px-8 py-6 bg-slate-800 hover:bg-slate-700 border border-slate-600 transition-colors"
              >
                <MessageSquare className="w-8 h-8" />
                <span className="font-medium">Text Chat</span>
                <span className="text-xs text-slate-400">Type your answers</span>
              </button>
            </div>
            {introVoiceMutation.isError && (
              <p className="text-red-400 text-sm mt-4">
                Voice setup failed. Try text mode instead.
              </p>
            )}
            <div className="mt-6">
              <Link to={`/workspace/${workspaceId}`} className="text-slate-500 hover:text-slate-300 text-sm">
                Back to Workspace
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
          <Link to={`/workspace/${workspaceId}`} className="text-slate-400 hover:text-white transition-colors">
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div className="flex items-center gap-2">
            <Flame className="w-5 h-5 text-orange-400" />
            <span className="font-medium">Expert Profile</span>
          </div>
          {introMode === 'voice' && (
            <div className="ml-auto flex items-center gap-1.5 text-xs text-green-400">
              <Mic className="w-3.5 h-3.5" />
              Voice Mode
            </div>
          )}
        </header>

        {/* Split screen */}
        <div className="flex-1 flex overflow-hidden">
          {/* Left panel (60%) */}
          <div className="w-[60%] border-r border-slate-700/50 flex flex-col">
            {introMode === 'voice' && introVoiceSession ? (
              <VoicePanel
                agentId={introVoiceSession.agentId}
                sessionConfig={{
                  prompt: introVoiceSession.prompt,
                  firstMessage: introVoiceSession.firstMessage,
                  progress: introVoiceSession.progress,
                }}
                forgeId={forgeId!}
                expertName={intro.profile.expertName || 'You'}
                resumeContext={null}
                onMessage={() => { refreshIntroFields() }}
                onExtraction={() => {}}
                onEnd={() => {}}
                saveMessage={saveIntroVoiceMessage}
                extractMessage={extractIntroVoiceMessage}
              />
            ) : (
              <ChatPanel
                messages={intro.messages}
                streamingContent={intro.streamingContent}
                isStreaming={intro.isStreaming}
                currentQuestion={null}
                expertName={intro.profile.expertName || 'You'}
                onSendMessage={intro.handleSendMessage}
                inputPlaceholder="Tell me about yourself..."
              />
            )}
          </div>

          {/* Right panel (40%) - Intro Agenda */}
          <div className="w-[40%] flex flex-col bg-slate-850">
            <div className="p-4 border-b border-slate-700/50 shrink-0">
              <ProfileCard profile={intro.profile} />
            </div>
            <div className="flex-1" />
            {intro.profileReady && (
              <div className="p-4 border-t border-slate-700/50 space-y-3">
                <div className="flex items-center gap-2 text-green-400">
                  <CheckCircle2 className="w-5 h-5" />
                  <span className="text-sm font-medium">Profile Complete</span>
                </div>
                <p className="text-xs text-slate-400">
                  {intro.profile.expertName} — {intro.profile.domain} — {intro.profile.targetAudience}
                  {countCaptured(intro.profile) > 3 && (
                    <span className="text-slate-500"> + {countCaptured(intro.profile) - 3} additional details captured</span>
                  )}
                </p>
                <button
                  onClick={() => navigate(`/workspace/${workspaceId}`)}
                  className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-orange-600 hover:bg-orange-700 text-white font-medium transition-colors text-sm"
                >
                  <ArrowLeft className="w-4 h-4" />
                  Back to Workspace
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    )
  }

  const devActions = [
    {
      label: 'Seed Knowledge',
      fn: async () => {
        const result = await seedExtractions(forgeId!)
        queryClient.invalidateQueries({ queryKey: ['interview', forgeId] })
        console.log(`Seeded ${result.seeded} knowledge items`)
      },
    },
    {
      label: 'Seed + Skip to Tool',
      fn: async () => {
        await seedExtractions(forgeId!)
        navigate(`/workspace/${workspaceId}`)
      },
    },
    {
      label: 'Skip to Tool (no seed)',
      fn: () => navigate(`/workspace/${workspaceId}`),
    },
  ]

  if (interviewComplete) {
    const isFollowUp = !!followUpTopic || currentRound > 1
    return (
      <div className="h-screen flex items-center justify-center">
        <div className="text-center max-w-md">
          <CheckCircle2 className="w-16 h-16 mx-auto mb-4 text-green-400" />
          <h2 className="text-2xl font-bold mb-2">
            {isFollowUp ? 'Follow-up Complete' : 'Interview Complete'}
          </h2>
          <p className="text-slate-400 mb-6">
            We've distilled {totalExtractions} pieces of knowledge from {state.forge.expertName!}.
          </p>
          <button
            onClick={() => navigate(`/workspace/${workspaceId}`)}
            className="px-6 py-3 bg-orange-600 hover:bg-orange-700  transition-colors font-medium inline-flex items-center gap-2"
          >
            <ArrowRight className="w-5 h-5" />
            Back to Workspace
          </button>
          <div className="mt-4">
            <Link to="/workspaces" className="text-slate-500 hover:text-slate-300 text-sm">
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
        <DevTools actions={devActions} />
        <div className="text-center max-w-lg">
          <div className="flex items-center gap-3 justify-center mb-6">
            <Flame className="w-8 h-8 text-orange-400" />
            <h1 className="text-2xl font-bold">Ready to begin</h1>
          </div>
          <p className="text-slate-400 mb-8">
            How would you like to share your knowledge, {state.forge.expertName!}?
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
            <Link to="/workspaces" className="text-slate-500 hover:text-slate-300 text-sm">
              Back to Home
            </Link>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="h-screen flex flex-col">
      <DevTools actions={devActions} />
      {/* Header */}
      <header className="flex items-center gap-4 px-6 py-3 border-b border-slate-700/50 bg-slate-900/80 backdrop-blur-sm shrink-0">
        <Link to="/workspaces" className="text-slate-400 hover:text-white transition-colors">
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div className="flex items-center gap-2">
          <Flame className="w-5 h-5 text-orange-400" />
          <span className="font-medium">{state.forge.expertName!}</span>
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
              expertName={state.forge.expertName!}
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
              expertName={state.forge.expertName!}
              onSendMessage={handleSendMessage}
            />
          )}
        </div>

        {/* Right panel - Knowledge + Agenda (40%) */}
        <div className="w-[40%] flex flex-col bg-slate-850">
          <div className="p-4 border-b border-slate-700/50 shrink-0 max-h-[40%] overflow-y-auto">
            <AgendaTracker sections={state.sections.filter((s) => (s.round ?? 1) === currentRound)} />
          </div>
          <div className="flex-1 overflow-hidden">
            <ExtractionPanel
              extractions={state.extractions}
              liveExtractions={liveExtractions}
              customExtractionTypes={customExtractionTypes}
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
