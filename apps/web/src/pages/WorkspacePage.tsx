import { useState, useEffect, useRef, useCallback } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import { ArrowLeft, Flame, Loader2, Sparkles, Wrench, Check, RefreshCw, Pencil, Save, X, ChevronRight, Circle, CheckCircle, Trash2, ArrowUp, ArrowDown, Share2, Copy, Mic, MessageSquare, ArrowRight } from 'lucide-react'
import { useRegisterInteraction } from '../lib/InteractionContext'
import { WORKSPACE_PAGE_EARLY, WORKSPACE_PAGE_TOOL } from '../lib/pageInteractions'
import KnowledgeConstellation from '../components/KnowledgeConstellation'
import { streamAdvice, updateToolConfig, completeIntro, planInterviewStream, type ToolPlan, type ToolPlanComponent, type AdviceSection, type ExpertProfile, type PlanInterviewEvent } from '../lib/api'
import { useToolDashboard } from '../hooks/useToolDashboard'
import { useToolEditor } from '../hooks/useToolEditor'
import { renderTabComponent, COMPONENT_TYPE_LABELS } from '../lib/renderComponent'
import { isCaptured } from '../lib/profileFields'
import type { CustomExtractionType } from '../lib/extractionTypes'
import ChatSidebar from '../components/toolkit/ChatSidebar'
import WorkspaceSidebar from '../components/workspace/WorkspaceSidebar'
import DocumentsPanel from '../components/workspace/DocumentsPanel'
import KnowledgePanel from '../components/workspace/KnowledgePanel'
import InterviewSummaryPanel from '../components/workspace/InterviewSummaryPanel'
import ProfileSummaryCard from '../components/workspace/ProfileSummaryCard'
import ComponentCreator from '../components/workspace/ComponentCreator'
import InterviewPlanningAnimation from '../components/InterviewPlanningAnimation'
import type { PlanningState } from '../hooks/usePlanningAnimation'

function loadSavedAdvice(workspaceId: string): Record<string, AdviceSection[]> {
  try {
    const raw = localStorage.getItem(`advice-${workspaceId}`)
    return raw ? JSON.parse(raw) : {}
  } catch { return {} }
}

function saveAdvice(workspaceId: string, answers: Record<string, AdviceSection[]>) {
  localStorage.setItem(`advice-${workspaceId}`, JSON.stringify(answers))
}

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

function getIntroProfile(metadata: Record<string, unknown> | undefined): ExpertProfile | null {
  if (!metadata) return null
  return (metadata.introProfile as ExpertProfile | undefined) ?? null
}

function getProfileStatus(profile: ExpertProfile | null): 'not_started' | 'in_progress' | 'complete' {
  if (!profile) return 'not_started'
  if (profile.expertName && profile.domain && profile.targetAudience) return 'complete'
  const hasAny = Object.values(profile).some((v) => isCaptured(v))
  return hasAny ? 'in_progress' : 'not_started'
}

export default function WorkspacePage() {
  const { workspaceId } = useParams<{ workspaceId: string }>()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [userContext, setUserContext] = useState<Record<string, unknown>>({})
  const [expertAnswers, setExpertAnswers] = useState<Record<string, AdviceSection[]>>(() => loadSavedAdvice(workspaceId!))
  const [loadingFlows, setLoadingFlows] = useState<Record<string, boolean>>({})
  const [showRegenModal, setShowRegenModal] = useState(false)
  const [regenConfirmText, setRegenConfirmText] = useState('')
  const [showShareModal, setShowShareModal] = useState(false)
  const [shareCopied, setShareCopied] = useState(false)

  const {
    data,
    isLoading,
    error,
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
    extractions,
    workspace: workspaceData,
    constellationNodes,
    chats,
    createChat,
    deleteChat,
    interviews,
  } = useToolDashboard(workspaceId!)

  const {
    editMode,
    editableLayout,
    isDirty,
    isSaving,
    updateComponent,
    handleSave,
    handleCancel,
    handleToggleEdit,
  } = useToolEditor(workspaceId!, layout)

  const [introDepth, setIntroDepth] = useState<'quick' | 'standard' | 'deep'>('standard')
  const [introPlanning, setIntroPlanning] = useState(false)
  const [introPlanState, setIntroPlanState] = useState<PlanningState>(EMPTY_PLANNING_STATE)

  // Detect early-stage workspace: first interview is draft and no tool data
  // Must wait for workspaceData to load before deciding (interviews come from it)
  const workspaceLoaded = !!workspaceData
  const firstInterview = interviews[0]
  const isEarlyStage = workspaceLoaded && !!firstInterview && firstInterview.status === 'draft' && !data

  const customExtractionTypes = ((workspaceData?.metadata as Record<string, unknown>)?.customExtractionTypes ?? []) as CustomExtractionType[]
  const introProfile = getIntroProfile(firstInterview?.metadata as Record<string, unknown> | undefined)
  const profileHasCore3 = !!(introProfile?.expertName && introProfile?.domain && introProfile?.targetAudience)
  const profileStatus = getProfileStatus(introProfile)

  // For early-stage, treat 'overview' as 'profile'
  const effectivePanel = isEarlyStage && activePanel.type === 'overview'
    ? { type: 'profile' as const }
    : activePanel

  // Register page interaction context
  const wsDescriptor = isEarlyStage ? WORKSPACE_PAGE_EARLY : WORKSPACE_PAGE_TOOL
  const { updateState: updatePageState } = useRegisterInteraction(
    `page:workspace:${workspaceId}`,
    wsDescriptor,
    { activePanel: activePanel.type },
  )

  // Sync page state
  useEffect(() => {
    const activeTab = tabs[activeTabIndex]
    updatePageState({
      activePanel: activePanel.type,
      activeComponentTitle: activePanel.type === 'component' ? activeTab?.title : undefined,
      profileStatus: isEarlyStage ? profileStatus : undefined,
      toolTitle: data ? (data as any).toolConfig?.title : undefined,
      overallProgress,
      tabCount: tabs.length,
      documentCount: documents.length,
      extractionCount: extractions.length,
    })
  }, [activePanel.type, activeTabIndex, overallProgress, documents.length, extractions.length])


  const handlePlanInterview = async () => {
    if (!firstInterview) return
    setIntroPlanning(true)
    setIntroPlanState(EMPTY_PLANNING_STATE)

    await completeIntro(firstInterview.id, introDepth)

    planInterviewStream(
      firstInterview.id,
      (event: PlanInterviewEvent) => {
        switch (event.type) {
          case 'analysing':
            setIntroPlanState((s) => ({ ...s, stage: 'analysing' }))
            break
          case 'skeleton':
            setIntroPlanState((s) => ({
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
            setIntroPlanState((s) => {
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
            setIntroPlanState((s) => ({ ...s, stage: 'complete', forgeId: event.forgeId }))
            setTimeout(() => {
              setIntroPlanning(false)
              navigate(`/workspace/${workspaceId}/interview/${firstInterview.id}`)
            }, 1200)
            break
          case 'error':
            setIntroPlanState((s) => ({ ...s, stage: 'error', errorMessage: event.message }))
            break
        }
      },
      () => {},
      (error) => {
        setIntroPlanState((s) => ({ ...s, stage: 'error', errorMessage: error }))
      }
    )
  }

  const handleNewInterview = () => {
    setActivePanel({ type: 'interview' })
  }

  const handleQuestionFlowComplete = async (
    componentId: string,
    flowData: { answers: Record<string, unknown>; question: string },
    componentTitle: string
  ) => {
    setLoadingFlows((prev) => ({ ...prev, [componentId]: true }))
    setExpertAnswers((prev) => ({ ...prev, [componentId]: [] }))

    streamAdvice(
      workspaceId!,
      flowData.question,
      { ...userContext, flowAnswers: flowData.answers },
      componentTitle,
      (event) => {
        if (event.type === 'outline') {
          setExpertAnswers((prev) => ({
            ...prev,
            [componentId]: event.sections.map((s) => ({ title: s.title, description: s.description, content: '' })),
          }))
        } else if (event.type === 'section') {
          setExpertAnswers((prev) => {
            const sections = [...(prev[componentId] || [])]
            if (sections[event.index]) {
              sections[event.index] = { ...sections[event.index], content: event.content }
            }
            return { ...prev, [componentId]: sections }
          })
        }
      },
      () => {
        setExpertAnswers((prev) => {
          saveAdvice(workspaceId!, prev)
          return prev
        })
        setLoadingFlows((prev) => ({ ...prev, [componentId]: false }))
      },
      (error) => {
        setExpertAnswers((prev) => ({
          ...prev,
          [componentId]: [{ title: 'Error', description: '', content: error }],
        }))
        setLoadingFlows((prev) => ({ ...prev, [componentId]: false }))
      }
    )
  }

  const handleComponentComplete = (componentId: string, complete: boolean) => {
    handleCompletionChange({ ...completionMap, [componentId]: complete })
  }

  const handleChatComponentUpdate = useCallback((componentId: string, config: Record<string, unknown>) => {
    const idx = editableLayout.findIndex((c) => c.id === componentId)
    if (idx === -1) return
    updateComponent(idx, config)
    const updatedLayout = editableLayout.map((c, i) => i === idx ? config : c)
    updateToolConfig(workspaceId!, updatedLayout).then(() => {
      queryClient.invalidateQueries({ queryKey: ['tool', workspaceId] })
    })
  }, [editableLayout, workspaceId, queryClient, updateComponent])

  const handleChatNavigate = (componentId: string) => {
    const idx = tabs.findIndex((t) => t.id === componentId)
    if (idx !== -1) handleTabChange(idx)
  }

  const handleRegenerate = () => {
    setShowRegenModal(false)
    handleCompletionChange({})
    for (const tab of tabs) {
      localStorage.removeItem(`qf-${tab.id}`)
      localStorage.removeItem(`checklist-view-${tab.id}`)
    }
    startPlanning()
  }

  if (isLoading || !workspaceLoaded) {
    return (
      <div className="h-screen flex items-center justify-center">
        <div className="flex items-center gap-3 text-slate-400">
          <Loader2 className="w-6 h-6 animate-spin" />
          Loading...
        </div>
      </div>
    )
  }

  // Early-stage hub view
  if (isEarlyStage) {
    if (introPlanning) {
      return (
        <div className="max-w-2xl mx-auto p-8">
          <Link to="/workspaces" className="flex items-center gap-2 text-slate-400 hover:text-white mb-8 transition-colors">
            <ArrowLeft className="w-4 h-4" />
            Back to Home
          </Link>
          <div className="mb-6">
            <h2 className="text-lg font-semibold text-white mb-1">Planning Your Interview</h2>
            {introProfile && (
              <p className="text-slate-400 text-sm">
                Building a custom interview for {introProfile.expertName} about {introProfile.domain}
              </p>
            )}
          </div>
          <InterviewPlanningAnimation state={introPlanState} onRetry={() => {
            setIntroPlanning(false)
            setIntroPlanState(EMPTY_PLANNING_STATE)
          }} />
        </div>
      )
    }

    return (
      <div className="h-screen flex flex-col">
        <header className="sticky top-0 z-10 bg-slate-900/90 backdrop-blur-sm border-b border-slate-700/50 shrink-0">
          <div className="px-6 py-3 flex items-center gap-4">
            <Link to="/workspaces" className="text-slate-400 hover:text-white transition-colors">
              <ArrowLeft className="w-5 h-5" />
            </Link>
            <div className="flex items-center gap-2">
              <Flame className="w-5 h-5 text-orange-400" />
              <span className="font-medium">{workspaceData?.title || 'Workspace'}</span>
            </div>
          </div>
        </header>

        <div className="flex-1 flex overflow-hidden">
          <WorkspaceSidebar
            tabs={[]}
            documents={documents}
            extractionCount={extractions.length}
            chats={chats}
            overallProgress={0}
            activePanel={effectivePanel}
            interviews={interviews}
            workspaceId={workspaceId!}
            showProfile
            profileStatus={profileStatus}
            onPanelChange={setActivePanel}
            onAddDocument={() => setActivePanel({ type: 'documents' })}
            onNewChat={createChat}
            onDeleteChat={deleteChat}
            onNewInterview={handleNewInterview}
          />

          <div className="flex-1 overflow-y-auto">
            <div className="px-6 py-6">
              {effectivePanel.type === 'profile' && !profileHasCore3 && (
                <div className="flex items-center justify-center min-h-[60vh]">
                  <div className="text-center max-w-lg">
                    <h2 className="text-2xl font-bold text-white mb-3">Build Your Expert Profile</h2>
                    <p className="text-slate-400 mb-8">
                      Have a quick conversation so we can understand your expertise and build a tailored interview.
                    </p>
                    <div className="flex gap-4 justify-center">
                      <button
                        onClick={() => navigate(`/workspace/${workspaceId}/interview/${firstInterview.id}?mode=voice`)}
                        className="flex flex-col items-center gap-3 px-8 py-6 bg-orange-600 hover:bg-orange-700 transition-colors"
                      >
                        <Mic className="w-8 h-8" />
                        <span className="font-medium">Voice Conversation</span>
                        <span className="text-xs text-orange-200">Speak naturally</span>
                      </button>
                      <button
                        onClick={() => navigate(`/workspace/${workspaceId}/interview/${firstInterview.id}?mode=text`)}
                        className="flex flex-col items-center gap-3 px-8 py-6 bg-slate-800 hover:bg-slate-700 border border-slate-600 transition-colors"
                      >
                        <MessageSquare className="w-8 h-8" />
                        <span className="font-medium">Text Chat</span>
                        <span className="text-xs text-slate-400">Type your answers</span>
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {effectivePanel.type === 'profile' && profileHasCore3 && introProfile && (
                <div>
                  <ProfileSummaryCard
                    profile={introProfile}
                    onEdit={() => navigate(`/workspace/${workspaceId}/interview/${firstInterview.id}?mode=text`)}
                  />

                  <div className="mt-8 bg-slate-800/50 border border-slate-700/50 p-6">
                    <h3 className="text-lg font-semibold text-white mb-4">Start Your Interview</h3>
                    <p className="text-slate-400 text-sm mb-4">
                      Your profile is ready. Choose interview depth and start the knowledge distillation interview.
                    </p>
                    <div className="flex items-center gap-3 mb-4">
                      <label className="text-sm text-slate-400">Depth:</label>
                      <div className="flex gap-1">
                        {(['quick', 'standard', 'deep'] as const).map((d) => (
                          <button
                            key={d}
                            onClick={() => setIntroDepth(d)}
                            className={`px-4 py-1.5 text-sm transition-colors ${
                              introDepth === d
                                ? 'bg-orange-600 text-white'
                                : 'bg-slate-800 text-slate-400 hover:text-white border border-slate-700'
                            }`}
                          >
                            {d}
                          </button>
                        ))}
                      </div>
                    </div>
                    <button
                      onClick={handlePlanInterview}
                      className="flex items-center gap-2 px-6 py-3 bg-orange-600 hover:bg-orange-700 text-white font-medium transition-colors"
                    >
                      <ArrowRight className="w-5 h-5" />
                      Start Your Interview
                    </button>
                  </div>
                </div>
              )}

              {effectivePanel.type === 'documents' && (
                <DocumentsPanel workspaceId={workspaceId!} />
              )}

              {effectivePanel.type === 'interview' && (
                <InterviewSummaryPanel
                  workspaceId={workspaceId!}
                  interviews={interviews}
                />
              )}

              {effectivePanel.type !== 'profile' && effectivePanel.type !== 'documents' && effectivePanel.type !== 'interview' && (
                <div className="flex items-center justify-center min-h-[60vh]">
                  <p className="text-slate-500">Complete your expert profile to get started.</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    )
  }

  // Tool not generated yet - show workspace hub with generation CTA
  if (error || !data) {
    if (generationProgress?.step === 'reviewing' && generationProgress.plan) {
      return (
        <PlanReview
          plan={generationProgress.plan}
          onConfirm={confirmPlan}
          onReplan={startPlanning}
        />
      )
    }

    // Active generation (planning/generating/error) — show fullscreen
    if (generationProgress) {
      return (
        <GenerationStateView
          generationProgress={generationProgress}
          onStartPlanning={startPlanning}
          constellationNodes={constellationNodes}
        />
      )
    }

    // No tool yet, no active generation — show workspace hub with sidebar
    return (
      <div className="h-screen flex flex-col">
        <header className="sticky top-0 z-10 bg-slate-900/90 backdrop-blur-sm border-b border-slate-700/50 shrink-0">
          <div className="px-6 py-3 flex items-center gap-4">
            <Link to="/workspaces" className="text-slate-400 hover:text-white transition-colors">
              <ArrowLeft className="w-5 h-5" />
            </Link>
            <div className="flex items-center gap-2">
              <Flame className="w-5 h-5 text-orange-400" />
              <span className="font-medium">{workspaceData?.title || 'Workspace'}</span>
            </div>
          </div>
        </header>

        <div className="flex-1 flex overflow-hidden">
          <WorkspaceSidebar
            tabs={[]}
            documents={documents}
            extractionCount={extractions.length}
            chats={chats}
            overallProgress={0}
            activePanel={activePanel}
            interviews={interviews}
            workspaceId={workspaceId!}
            onPanelChange={setActivePanel}
            onAddDocument={() => setActivePanel({ type: 'documents' })}
            onNewChat={createChat}
            onDeleteChat={deleteChat}
            onNewInterview={handleNewInterview}
          />

          <div className="flex-1 overflow-y-auto">
            <div className="px-6 py-6">
              {activePanel.type === 'documents' && (
                <DocumentsPanel workspaceId={workspaceId!} />
              )}

              {activePanel.type === 'knowledge' && (
                <KnowledgePanel workspaceId={workspaceId!} extractions={extractions} customExtractionTypes={customExtractionTypes} />
              )}

              {activePanel.type === 'interview' && (
                <InterviewSummaryPanel
                  workspaceId={workspaceId!}
                  interviews={interviews}
                />
              )}

              {activePanel.type !== 'documents' && activePanel.type !== 'knowledge' && activePanel.type !== 'interview' && (
                <div className="max-w-2xl mx-auto space-y-8">
                  <ComponentCreator
                    workspaceId={workspaceId!}
                    onCreated={() => {
                      // Switch to the newly created component tab
                      setActivePanel({ type: 'overview' })
                    }}
                  />

                  <div className="border-t border-slate-700/50 pt-6">
                    <h3 className="text-lg font-semibold text-white mb-1">Start a New Interview</h3>
                    <p className="text-sm text-slate-400 mb-3">Capture more expert knowledge on a specific topic.</p>
                    <button
                      onClick={() => setActivePanel({ type: 'interview' })}
                      className="flex items-center gap-2 px-4 py-2 bg-orange-600 hover:bg-orange-700 text-sm font-medium text-white transition-colors"
                    >
                      <Mic className="w-4 h-4" />
                      View Interviews
                    </button>
                  </div>

                  <div className="border-t border-slate-700/50 pt-6">
                    <button
                      onClick={startPlanning}
                      className="inline-flex items-center gap-2 px-4 py-2 text-sm text-slate-400 hover:text-white border border-slate-700/50 hover:border-orange-500/30 transition-colors"
                    >
                      <Sparkles className="w-4 h-4" />
                      Generate all components at once
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    )
  }

  // Plan review during regeneration (tool already exists)
  if (generationProgress?.step === 'reviewing' && generationProgress.plan) {
    return (
      <PlanReview
        plan={generationProgress.plan}
        onConfirm={confirmPlan}
        onReplan={startPlanning}
      />
    )
  }

  const { workspace, toolConfig } = data
  const activeTab = tabs[activeTabIndex]

  return (
    <div className="h-screen flex flex-col">
      {/* Header */}
      <header className="sticky top-0 z-10 bg-slate-900/90 backdrop-blur-sm border-b border-slate-700/50 shrink-0">
        <div className="px-6 py-3 flex items-center gap-4">
          <Link to="/workspaces" className="text-slate-400 hover:text-white transition-colors">
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div className="flex items-center gap-2">
            <Flame className="w-5 h-5 text-orange-400" />
            <span className="font-medium">{toolConfig.title}</span>
          </div>
          <div className="ml-auto flex items-center gap-4">
            <span className="text-slate-500 text-sm hidden sm:inline">
              Built from {workspace.expertName}'s expertise
            </span>
            {editMode ? (
              <div className="flex items-center gap-2">
                <button
                  onClick={handleCancel}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-slate-400 hover:text-white bg-slate-800 hover:bg-slate-700 border border-slate-700/50  transition-colors"
                >
                  <X className="w-3.5 h-3.5" />
                  Cancel
                </button>
                <button
                  onClick={handleSave}
                  disabled={!isDirty || isSaving}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed  transition-colors"
                >
                  {isSaving ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Save className="w-3.5 h-3.5" />
                  )}
                  {isSaving ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            ) : (
              <>
                <button
                  onClick={() => { setShowShareModal(true); setShareCopied(false) }}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-slate-400 hover:text-green-400 bg-slate-800 hover:bg-slate-700 border border-slate-700/50  transition-colors"
                >
                  <Share2 className="w-3.5 h-3.5" />
                  Share
                </button>
                <button
                  onClick={handleToggleEdit}
                  disabled={activePanel.type !== 'component'}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-slate-400 hover:text-blue-400 bg-slate-800 hover:bg-slate-700 border border-slate-700/50  transition-colors disabled:opacity-30 disabled:cursor-not-allowed disabled:hover:text-slate-400"
                >
                  <Pencil className="w-3.5 h-3.5" />
                  Edit
                </button>
                <button
                  onClick={() => { setShowRegenModal(true); setRegenConfirmText('') }}
                  disabled={!!generationProgress}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-slate-400 hover:text-orange-400 bg-slate-800 hover:bg-slate-700 border border-slate-700/50  transition-colors disabled:opacity-50"
                  title="Regenerate tool with latest documents and knowledge"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${generationProgress ? 'animate-spin' : ''}`} />
                  {generationProgress ? 'Regenerating...' : 'Regenerate'}
                </button>
              </>
            )}
          </div>
        </div>
      </header>

      {/* Regeneration progress overlay */}
      {generationProgress && (
        <div className="bg-slate-900/95 border-b border-slate-700/50 relative overflow-hidden">
          {constellationNodes.length > 0 && generationProgress.step === 'planning' && (
            <div className="absolute inset-0 opacity-10 pointer-events-none">
              <KnowledgeConstellation nodes={constellationNodes} />
            </div>
          )}
          <div className="px-6 py-6 relative z-10">
            {generationProgress.step === 'planning' && (
              constellationNodes.length > 0 ? (
                <div className="flex items-center gap-3 text-slate-400">
                  <Loader2 className="w-5 h-5 animate-spin text-orange-400 shrink-0" />
                  <span className="text-sm">Planning your interactive guide...</span>
                </div>
              ) : (
                <div className="flex items-center gap-3 text-slate-400">
                  <Loader2 className="w-5 h-5 animate-spin text-orange-400 shrink-0" />
                  <span className="text-sm">Planning new tool structure...</span>
                </div>
              )
            )}
            {generationProgress.step === 'error' && (
              <div className="flex items-center gap-3">
                <Wrench className="w-5 h-5 text-red-400 shrink-0" />
                <span className="text-sm text-red-400">{generationProgress.errorMessage}</span>
                <button
                  onClick={() => startPlanning()}
                  className="ml-auto text-xs px-3 py-1.5 bg-orange-600 hover:bg-orange-700  transition-colors"
                >
                  Retry
                </button>
              </div>
            )}
            {generationProgress.step === 'generating' && (
              <div className="space-y-3">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-slate-300">
                    {generationProgress.title ? `Rebuilding: ${generationProgress.title}` : 'Generating...'}
                  </span>
                  <span className="text-slate-500">
                    {generationProgress.current} / {generationProgress.total}
                  </span>
                </div>
                <div className="w-full h-1.5 bg-slate-700  overflow-hidden">
                  <div
                    className="h-full bg-orange-500  transition-all duration-700 ease-out"
                    style={{ width: `${progressPercent(generationProgress.current, generationProgress.total)}%` }}
                  />
                </div>
                <div className="flex flex-wrap gap-2">
                  {generationProgress.components.map((comp, i) => (
                    <span
                      key={i}
                      className={`inline-flex items-center gap-1.5 text-xs px-2.5 py-1  ${
                        comp.done
                          ? 'bg-green-500/10 text-green-400'
                          : 'bg-orange-500/10 text-orange-400'
                      }`}
                    >
                      {comp.done ? (
                        <Check className="w-3 h-3" />
                      ) : (
                        <Loader2 className="w-3 h-3 animate-spin" />
                      )}
                      {comp.title}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Main workspace: sidebar + content */}
      <div className="flex-1 flex overflow-hidden">
        <WorkspaceSidebar
          tabs={tabs}
          documents={documents}
          extractionCount={extractions.length}
          chats={chats}
          overallProgress={overallProgress}
          activePanel={activePanel}
          interviews={interviews}
          workspaceId={workspaceId!}
          onPanelChange={setActivePanel}
          onAddDocument={() => setActivePanel({ type: 'documents' })}
          onNewChat={createChat}
          onDeleteChat={deleteChat}
          onNewInterview={handleNewInterview}
        />

        {/* Main panel */}
        <div className="flex-1 overflow-y-auto">
          <div className="px-6 py-6">
            {/* Overview */}
            <div style={{ display: activePanel.type === 'overview' ? 'block' : 'none' }}>
              <div className="mb-6">
                <h2 className="text-xl font-bold text-white">{toolConfig.title}</h2>
                {toolConfig.description && (
                  <p className="text-slate-400 mt-1">{toolConfig.description}</p>
                )}
              </div>

              {/* Progress summary */}
              <div className="bg-slate-800/50 border border-slate-700/50  p-6 mb-6">
                <div className="flex items-center justify-between mb-4">
                  <span className="text-sm text-slate-400">Overall Progress</span>
                  <span className="text-sm font-medium text-white">{overallProgress}%</span>
                </div>
                <div className="h-2 bg-slate-700  overflow-hidden">
                  <div
                    className="h-full bg-orange-500  transition-all duration-500"
                    style={{ width: `${overallProgress}%` }}
                  />
                </div>
                <div className="flex items-center justify-between mt-2">
                  <p className="text-xs text-slate-500">
                    {tabs.filter((t) => t.complete).length} of {tabs.length} sections completed
                  </p>
                  {overallProgress > 0 && (
                    <button
                      onClick={() => {
                        handleCompletionChange({})
                        for (const tab of tabs) {
                          localStorage.removeItem(`qf-${tab.id}`)
                          localStorage.removeItem(`checklist-view-${tab.id}`)
                        }
                      }}
                      className="text-xs text-slate-600 hover:text-slate-400 transition-colors"
                    >
                      Reset progress
                    </button>
                  )}
                </div>
              </div>

              {/* Section list */}
              <div className="space-y-2">
                {tabs.map((tab, idx) => (
                  <button
                    key={`dash-${tab.id}-${idx}`}
                    onClick={() => handleTabChange(idx)}
                    className="w-full flex items-center gap-4 px-4 py-3.5 bg-slate-800/50 hover:bg-slate-800 border border-slate-700/50 hover:border-slate-600/50  transition-colors text-left group"
                  >
                    {tab.complete ? (
                      <CheckCircle className="w-5 h-5 text-green-400 shrink-0" />
                    ) : (
                      <Circle className="w-5 h-5 text-slate-600 shrink-0" />
                    )}
                    <div className="flex-1 min-w-0">
                      <div className={`text-sm font-medium ${tab.complete ? 'text-green-300' : 'text-slate-200'}`}>
                        {tab.title}
                      </div>
                      <div className="text-xs text-slate-500 mt-0.5">
                        {tab.type.replace(/_/g, ' ')}
                      </div>
                    </div>
                    <ChevronRight className="w-4 h-4 text-slate-600 group-hover:text-slate-400 shrink-0 transition-colors" />
                  </button>
                ))}
              </div>

              {/* Add component */}
              <div className="mt-8 border-t border-slate-700/50 pt-6">
                <ComponentCreator
                  workspaceId={workspaceId!}
                  onCreated={() => {
                    // Refetch tool data to pick up the new component
                    setActivePanel({ type: 'overview' })
                  }}
                />
              </div>
            </div>

            {/* Component panels - display:none/block to preserve state */}
            {editableLayout.map((config, idx) => {
              const id = (config.id as string) ?? `tab-${idx}`
              const title = config.title as string | undefined
              const description = config.description as string | undefined
              const type = config.type as string
              const isActive = activePanel.type === 'component' && activePanel.index === idx

              return (
                <div key={`${id}-${idx}`} style={{ display: isActive ? 'block' : 'none' }}>
                  {title && (
                    <div className="mb-6">
                      <h2 className="text-xl font-bold text-white">{title}</h2>
                      {description && (
                        <p className="text-slate-400 mt-1">{description}</p>
                      )}
                    </div>
                  )}

                  <div className="bg-slate-800/50 border border-slate-700/50  p-6">
                    {renderTabComponent({
                      config,
                      id,
                      type,
                      title: title || 'Section',
                      workspaceId: workspaceId!,
                      userContext,
                      expertAnswers,
                      loadingFlows,
                      editMode,
                      onConfigChange: (updated) => updateComponent(idx, updated),
                      onContextChange: setUserContext,
                      onComplete: (done) => handleComponentComplete(id, done),
                      onQuestionFlowComplete: handleQuestionFlowComplete,
                    })}
                  </div>
                </div>
              )
            })}

            {/* Documents panel */}
            {activePanel.type === 'documents' && (
              <DocumentsPanel workspaceId={workspaceId!} />
            )}

            {/* Knowledge panel */}
            {activePanel.type === 'knowledge' && (
              <KnowledgePanel workspaceId={workspaceId!} extractions={extractions} customExtractionTypes={customExtractionTypes} />
            )}

            {/* Chat panel */}
            {activePanel.type === 'chat' && (
              <div className="h-[calc(100vh-8rem)]">
                <ChatSidebar
                  workspaceId={workspaceId!}
                  chatId={activePanel.chatId}
                  activeComponentId={null}
                  layout={editableLayout}
                  userContext={userContext}
                  variant="panel"
                  onComponentUpdate={handleChatComponentUpdate}
                  onNavigate={handleChatNavigate}
                />
              </div>
            )}

            {/* Interview summary panel */}
            {activePanel.type === 'interview' && (
              <InterviewSummaryPanel
                workspaceId={workspaceId!}
                interviews={interviews}
              />
            )}
          </div>
        </div>
      </div>

      {/* Share modal */}
      {showShareModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={() => setShowShareModal(false)}>
          <div className="bg-slate-800 border border-slate-700 p-6 max-w-md w-full mx-4 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-green-500/10 flex items-center justify-center shrink-0">
                  <Share2 className="w-5 h-5 text-green-400" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-white">Share Tool</h3>
                  <p className="text-sm text-slate-400">Anyone with this link can use the tool</p>
                </div>
              </div>
              <button onClick={() => setShowShareModal(false)} className="p-1 text-slate-400 hover:text-white transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="flex items-center gap-2">
              <input
                type="text"
                readOnly
                value={`${window.location.origin}/tool/${workspaceId}`}
                className="flex-1 px-3 py-2 bg-slate-900 border border-slate-600 text-sm text-white focus:outline-none font-mono"
              />
              <button
                onClick={() => {
                  navigator.clipboard.writeText(`${window.location.origin}/tool/${workspaceId}`)
                  setShareCopied(true)
                  setTimeout(() => setShareCopied(false), 2000)
                }}
                className={`flex items-center gap-1.5 px-4 py-2 text-sm transition-colors shrink-0 ${
                  shareCopied
                    ? 'bg-green-600 text-white'
                    : 'bg-orange-600 hover:bg-orange-700 text-white'
                }`}
              >
                {shareCopied ? (
                  <><Check className="w-4 h-4" /> Copied</>
                ) : (
                  <><Copy className="w-4 h-4" /> Copy</>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {showRegenModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="bg-slate-800 border border-slate-700  p-6 max-w-md w-full mx-4 shadow-2xl">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10  bg-red-500/10 flex items-center justify-center shrink-0">
                <RefreshCw className="w-5 h-5 text-red-400" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-white">Regenerate Tool</h3>
                <p className="text-sm text-slate-400">This action cannot be undone</p>
              </div>
            </div>
            <p className="text-sm text-slate-300 mb-4">
              This will regenerate all components from scratch. You will lose your current configuration, any edits you've made, and all saved progress.
            </p>
            <div className="mb-4">
              <label className="text-xs text-slate-500 block mb-1.5">
                Type <span className="text-red-400 font-mono font-medium">regenerate</span> to confirm
              </label>
              <input
                type="text"
                value={regenConfirmText}
                onChange={(e) => setRegenConfirmText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && regenConfirmText.toLowerCase() === 'regenerate') {
                    handleRegenerate()
                  }
                }}
                placeholder="regenerate"
                autoFocus
                className="w-full px-3 py-2 bg-slate-900 border border-slate-600  text-sm text-white placeholder-slate-600 focus:border-red-500/50 focus:outline-none transition-colors font-mono"
              />
            </div>
            <div className="flex items-center gap-2 justify-end">
              <button
                onClick={() => setShowRegenModal(false)}
                className="px-4 py-2 text-sm text-slate-400 hover:text-white bg-slate-700/50 hover:bg-slate-700  transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleRegenerate}
                disabled={regenConfirmText.toLowerCase() !== 'regenerate'}
                className="px-4 py-2 text-sm text-white bg-red-600 hover:bg-red-700 disabled:opacity-30 disabled:cursor-not-allowed  transition-colors"
              >
                Regenerate
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Floating chat sidebar - hidden when chat panel is active */}
      <ChatSidebar
        workspaceId={workspaceId!}
        activeComponentId={activeTab?.id || null}
        activeComponentTitle={activeTab?.title}
        layout={editableLayout}
        userContext={userContext}
        hidden={activePanel.type === 'chat'}
        onComponentUpdate={handleChatComponentUpdate}
        onNavigate={handleChatNavigate}
      />
    </div>
  )
}

function progressPercent(current: number, total: number): number {
  return total > 0 ? (current / total) * 100 : 0
}

function GenerationStateView({
  generationProgress,
  onStartPlanning,
  constellationNodes,
}: {
  generationProgress: ReturnType<typeof useToolDashboard>['generationProgress']
  onStartPlanning: () => void
  constellationNodes: string[]
}) {
  const step = generationProgress?.step

  return (
    <div className="h-screen flex items-center justify-center overflow-hidden">
      <div className="text-center w-full px-6 overflow-visible">
        {step === 'error' && (
          <>
            <Wrench className="w-16 h-16 mx-auto mb-4 text-slate-600" />
            <h2 className="text-2xl font-bold mb-2">Generation Failed</h2>
            <p className="text-red-400 text-sm mb-4">{generationProgress!.errorMessage}</p>
            <button
              onClick={onStartPlanning}
              className="inline-flex items-center gap-2 px-6 py-3 bg-orange-600 hover:bg-orange-700  transition-colors font-medium"
            >
              <Sparkles className="w-5 h-5" />
              Try Again
            </button>
            <div className="mt-4">
              <Link to="/workspaces" className="text-slate-500 hover:text-slate-300 text-sm">
                Back to Home
              </Link>
            </div>
          </>
        )}

        {step === 'generating' && (
          <>
            <div className="relative z-10">
              <Sparkles className="w-12 h-12 mx-auto mb-4 text-orange-400" />
              {generationProgress!.title && (
                <h2 className="text-xl font-bold mb-1">{generationProgress!.title}</h2>
              )}
              <p className="text-slate-400 text-sm mb-6">
                Building all components in parallel... {generationProgress!.current} of {generationProgress!.total} complete
              </p>

              <div className="w-full h-2 bg-slate-700  overflow-hidden mb-6">
                <div
                  className="h-full bg-orange-500  transition-all duration-700 ease-out"
                  style={{ width: `${progressPercent(generationProgress!.current, generationProgress!.total)}%` }}
                />
              </div>

              <div className="text-left space-y-2">
                {generationProgress!.components.map((comp, i) => (
                  <div
                    key={i}
                    className={`flex items-center gap-3 px-3 py-2  transition-colors ${
                      comp.done ? 'bg-green-500/10' : 'bg-orange-500/10'
                    }`}
                  >
                    {comp.done ? (
                      <div className="w-5 h-5  bg-green-500/20 flex items-center justify-center shrink-0">
                        <Check className="w-3.5 h-3.5 text-green-400" />
                      </div>
                    ) : (
                      <Loader2 className="w-5 h-5 text-orange-400 animate-spin shrink-0" />
                    )}
                    <span className={`text-sm flex-1 text-left ${comp.done ? 'text-green-300' : 'text-orange-300'}`}>
                      {comp.title}
                    </span>
                    <span className={`text-xs text-right min-w-[100px] shrink-0 ${comp.done ? 'text-green-500/60' : 'text-slate-600'}`}>
                      {comp.type.replace(/_/g, ' ')}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}

        {step === 'planning' && (
          constellationNodes.length > 0 ? (
            <KnowledgeConstellation
              nodes={constellationNodes}
              subtitle="Planning your interactive guide..."
            />
          ) : (
            <div className="text-slate-500 text-sm animate-pulse">
              Planning your interactive guide...
            </div>
          )
        )}

        {!step && (
          <>
            <Wrench className="w-16 h-16 mx-auto mb-4 text-slate-600" />
            <h2 className="text-2xl font-bold mb-2">Generate Your Tool</h2>
            <p className="text-slate-400 mb-6">
              Ready to transform your expert knowledge into an interactive guide.
            </p>
            <button
              onClick={onStartPlanning}
              className="inline-flex items-center gap-2 px-6 py-3 bg-orange-600 hover:bg-orange-700 transition-colors font-medium"
            >
              <Sparkles className="w-5 h-5" />
              Start Generation
            </button>
            <div className="mt-4">
              <Link to="/workspaces" className="text-slate-500 hover:text-slate-300 text-sm">
                Back to Home
              </Link>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

function PlanReview({
  plan,
  onConfirm,
  onReplan,
}: {
  plan: ToolPlan
  onConfirm: (plan: ToolPlan) => void
  onReplan: () => void
}) {
  const [components, setComponents] = useState<ToolPlanComponent[]>(plan.components)
  const [editingIndex, setEditingIndex] = useState<number | null>(null)
  const [editFocus, setEditFocus] = useState('')

  const handleRemove = (index: number) => {
    setComponents((prev) => prev.filter((_, i) => i !== index))
    if (editingIndex === index) setEditingIndex(null)
  }

  const handleMoveUp = (index: number) => {
    if (index === 0) return
    setComponents((prev) => {
      const next = [...prev]
      ;[next[index - 1], next[index]] = [next[index], next[index - 1]]
      return next
    })
  }

  const handleMoveDown = (index: number) => {
    if (index >= components.length - 1) return
    setComponents((prev) => {
      const next = [...prev]
      ;[next[index], next[index + 1]] = [next[index + 1], next[index]]
      return next
    })
  }

  const handleStartEdit = (index: number) => {
    setEditingIndex(index)
    setEditFocus(components[index].focus)
  }

  const handleSaveEdit = () => {
    if (editingIndex === null) return
    setComponents((prev) =>
      prev.map((c, i) => i === editingIndex ? { ...c, focus: editFocus } : c)
    )
    setEditingIndex(null)
  }

  const handleConfirm = () => {
    onConfirm({ ...plan, components })
  }

  return (
    <div className="h-screen flex flex-col">
      <header className="sticky top-0 z-10 bg-slate-900/90 backdrop-blur-sm border-b border-slate-700/50 shrink-0">
        <div className="px-6 py-3 flex items-center gap-4">
          <Link to="/workspaces" className="text-slate-400 hover:text-white transition-colors">
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div className="flex items-center gap-2">
            <Flame className="w-5 h-5 text-orange-400" />
            <span className="font-medium">Review Tool Plan</span>
          </div>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto">
        <div className="max-w-3xl mx-auto px-6 py-8">
          <div className="mb-8">
            <h2 className="text-2xl font-bold text-white mb-2">{plan.title}</h2>
            <p className="text-slate-400">
              Review the proposed components below. Remove, reorder, or edit the focus of each section before generating.
            </p>
          </div>

          <div className="space-y-3 mb-8">
            {components.map((comp, index) => (
              <div
                key={`${comp.type}-${index}`}
                className="bg-slate-800/50 border border-slate-700/50 p-4 group"
              >
                <div className="flex items-start gap-3">
                  <div className="flex flex-col gap-0.5 pt-0.5 shrink-0">
                    <button
                      onClick={() => handleMoveUp(index)}
                      disabled={index === 0}
                      className="p-0.5 text-slate-600 hover:text-slate-300 disabled:opacity-20 disabled:cursor-not-allowed transition-colors"
                    >
                      <ArrowUp className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => handleMoveDown(index)}
                      disabled={index >= components.length - 1}
                      className="p-0.5 text-slate-600 hover:text-slate-300 disabled:opacity-20 disabled:cursor-not-allowed transition-colors"
                    >
                      <ArrowDown className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xs px-2 py-0.5 bg-slate-700 text-slate-300">
                        {COMPONENT_TYPE_LABELS[comp.type] || comp.type}
                      </span>
                      <span className="text-xs text-slate-600">#{index + 1}</span>
                    </div>

                    {editingIndex === index ? (
                      <div className="mt-2">
                        <textarea
                          value={editFocus}
                          onChange={(e) => setEditFocus(e.target.value)}
                          rows={2}
                          className="w-full px-3 py-2 bg-slate-900 border border-slate-600 text-sm text-white placeholder-slate-600 focus:border-orange-500/50 focus:outline-none transition-colors resize-none"
                          autoFocus
                        />
                        <div className="flex gap-2 mt-2">
                          <button
                            onClick={handleSaveEdit}
                            className="text-xs px-3 py-1 bg-orange-600 hover:bg-orange-700 text-white transition-colors"
                          >
                            Save
                          </button>
                          <button
                            onClick={() => setEditingIndex(null)}
                            className="text-xs px-3 py-1 text-slate-400 hover:text-white transition-colors"
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    ) : (
                      <button
                        onClick={() => handleStartEdit(index)}
                        className="text-left w-full group/edit"
                      >
                        <p className="text-sm text-slate-200 group-hover/edit:text-white transition-colors">
                          {comp.focus}
                          <Pencil className="w-3 h-3 text-slate-600 group-hover/edit:text-slate-400 inline ml-2 transition-colors" />
                        </p>
                      </button>
                    )}

                    {comp.outline && comp.outline.length > 0 && editingIndex !== index && (
                      <ul className="mt-2 space-y-0.5">
                        {comp.outline.map((item, bulletIdx) => (
                          <li key={bulletIdx} className="text-xs text-slate-500 flex items-start gap-1.5">
                            <span className="text-slate-600 mt-0.5 shrink-0">-</span>
                            {item}
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>

                  <button
                    onClick={() => handleRemove(index)}
                    className="p-1.5 text-slate-600 hover:text-red-400 transition-colors shrink-0"
                    title="Remove component"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>

          {components.length === 0 && (
            <div className="text-center py-12 text-slate-500">
              <p>All components removed.</p>
            </div>
          )}

          <div className="flex items-center gap-3">
            <button
              onClick={handleConfirm}
              disabled={components.length === 0}
              className="inline-flex items-center gap-2 px-6 py-3 bg-orange-600 hover:bg-orange-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors font-medium text-white"
            >
              <Sparkles className="w-5 h-5" />
              Generate {components.length} Component{components.length !== 1 ? 's' : ''}
            </button>
            <button
              onClick={onReplan}
              className="inline-flex items-center gap-2 px-4 py-3 text-slate-400 hover:text-white bg-slate-800 hover:bg-slate-700 border border-slate-700/50 transition-colors text-sm"
            >
              <RefreshCw className="w-4 h-4" />
              Re-plan
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
