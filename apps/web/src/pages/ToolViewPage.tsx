import { useState, useEffect, useRef } from 'react'
import { useParams, Link } from 'react-router-dom'
import { ArrowLeft, Flame, Loader2, Sparkles, Wrench, Check, RefreshCw, Pencil, Save, X, LayoutDashboard, ChevronRight, Circle, CheckCircle, Trash2, ArrowUp, ArrowDown } from 'lucide-react'
import ScatteredText from '../components/ScatteredText'
import { askExpert, type ToolPlan, type ToolPlanComponent } from '../lib/api'
import type {
  DecisionTreeConfig,
  ChecklistConfig,
  CalculatorConfig,
  InfoCardConfig,
  StepByStepConfig,
  QuestionFlowConfig,
  CustomConfig,
} from '@forge/shared'
import { useToolDashboard } from '../hooks/useToolDashboard'
import { useToolEditor } from '../hooks/useToolEditor'
import DecisionTree from '../components/toolkit/DecisionTree'
import Checklist from '../components/toolkit/Checklist'
import Calculator from '../components/toolkit/Calculator'
import InfoCard from '../components/toolkit/InfoCard'
import StepByStep from '../components/toolkit/StepByStep'
import QuestionFlow from '../components/toolkit/QuestionFlow'
import Custom from '../components/toolkit/Custom'
import ChatSidebar from '../components/toolkit/ChatSidebar'
import WorkspaceSidebar from '../components/workspace/WorkspaceSidebar'
import DocumentsPanel from '../components/workspace/DocumentsPanel'
import InterviewSummaryPanel from '../components/workspace/InterviewSummaryPanel'

export default function ToolViewPage() {
  const { forgeId } = useParams<{ forgeId: string }>()
  const autoGenerateRef = useRef(false)
  const [userContext, setUserContext] = useState<Record<string, unknown>>({})
  const [expertAnswers, setExpertAnswers] = useState<Record<string, string>>({})
  const [loadingFlows, setLoadingFlows] = useState<Record<string, boolean>>({})
  const [devMode, setDevMode] = useState(false)

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setDevMode((v) => !v)
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [])
  const [showRegenModal, setShowRegenModal] = useState(false)
  const [regenConfirmText, setRegenConfirmText] = useState('')

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
    chats,
    createChat,
  } = useToolDashboard(forgeId!)

  const {
    editMode,
    editableLayout,
    isDirty,
    isSaving,
    updateComponent,
    handleSave,
    handleCancel,
    handleToggleEdit,
  } = useToolEditor(forgeId!, layout)

  // Auto-plan tool if not yet created
  useEffect(() => {
    if (autoGenerateRef.current) return
    if (isLoading) return
    if (data) return
    autoGenerateRef.current = true
    startPlanning()
  }, [isLoading, data])

  const handleQuestionFlowComplete = async (
    componentId: string,
    flowData: { answers: Record<string, unknown>; question: string },
    componentTitle: string
  ) => {
    setLoadingFlows((prev) => ({ ...prev, [componentId]: true }))
    try {
      const result = await askExpert(
        forgeId!,
        flowData.question,
        { ...userContext, flowAnswers: flowData.answers },
        componentTitle
      )
      setExpertAnswers((prev) => ({ ...prev, [componentId]: result.answer }))
    } catch (err) {
      setExpertAnswers((prev) => ({
        ...prev,
        [componentId]: `Error: ${err instanceof Error ? err.message : 'Failed to get response'}`,
      }))
    } finally {
      setLoadingFlows((prev) => ({ ...prev, [componentId]: false }))
    }
  }

  const handleComponentComplete = (componentId: string, complete: boolean) => {
    handleCompletionChange({ ...completionMap, [componentId]: complete })
  }

  const handleChatComponentUpdate = (componentId: string, config: Record<string, unknown>) => {
    const idx = editableLayout.findIndex((c) => c.id === componentId)
    if (idx !== -1) updateComponent(idx, config)
  }

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

  if (isLoading) {
    return (
      <div className="h-screen flex items-center justify-center">
        <div className="flex items-center gap-3 text-slate-400">
          <Loader2 className="w-6 h-6 animate-spin" />
          Loading tool...
        </div>
      </div>
    )
  }

  // Tool not generated yet - show planning/review/generating state
  if (error || !data) {
    // Plan review screen
    if (generationProgress?.step === 'reviewing' && generationProgress.plan) {
      return (
        <PlanReview
          plan={generationProgress.plan}
          onConfirm={confirmPlan}
          onReplan={startPlanning}
        />
      )
    }

    return (
      <GenerationStateView
        generationProgress={generationProgress}
        onStartPlanning={startPlanning}
      />
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

  const { forge, toolConfig } = data
  const activeTab = tabs[activeTabIndex]

  return (
    <div className="h-screen flex flex-col">
      {/* Header */}
      <header className="sticky top-0 z-10 bg-slate-900/90 backdrop-blur-sm border-b border-slate-700/50 shrink-0">
        <div className="px-6 py-3 flex items-center gap-4">
          <Link to="/" className="text-slate-400 hover:text-white transition-colors">
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div className="flex items-center gap-2">
            <Flame className="w-5 h-5 text-orange-400" />
            <span className="font-medium">{toolConfig.title}</span>
          </div>
          <div className="ml-auto flex items-center gap-4">
            <span className="text-slate-500 text-sm hidden sm:inline">
              Built from {forge.expertName}'s expertise
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
        <div className="bg-slate-900/95 border-b border-slate-700/50">
          <div className="px-6 py-6">
            {generationProgress.step === 'planning' && (
              <div className="flex items-center gap-3 text-slate-400">
                <Loader2 className="w-5 h-5 animate-spin text-orange-400 shrink-0" />
                <span className="text-sm">Planning new tool structure...</span>
              </div>
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
          chats={chats}
          overallProgress={overallProgress}
          activePanel={activePanel}
          onPanelChange={setActivePanel}
          onAddDocument={() => setActivePanel({ type: 'documents' })}
          onNewChat={createChat}
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
                  {/* Tab header */}
                  {title && (
                    <div className="mb-6">
                      <h2 className="text-xl font-bold text-white">{title}</h2>
                      {description && (
                        <p className="text-slate-400 mt-1">{description}</p>
                      )}
                    </div>
                  )}

                  {/* Component */}
                  <div className="bg-slate-800/50 border border-slate-700/50  p-6">
                    {renderTabComponent({
                      config,
                      id,
                      type,
                      title: title || 'Section',
                      forgeId: forgeId!,
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
              <DocumentsPanel forgeId={forgeId!} />
            )}

            {/* Chat panel */}
            {activePanel.type === 'chat' && (
              <div className="h-[calc(100vh-8rem)]">
                <ChatSidebar
                  forgeId={forgeId!}
                  chatId={activePanel.chatId}
                  activeComponentId={activeTab?.id || null}
                  activeComponentTitle={activeTab?.title}
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
              <InterviewSummaryPanel forgeId={forgeId!} />
            )}
          </div>
        </div>
      </div>

      {/* Regenerate confirmation modal */}
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
        forgeId={forgeId!}
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
}: {
  generationProgress: ReturnType<typeof useToolDashboard>['generationProgress']
  onStartPlanning: () => void
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
              <Link to="/" className="text-slate-500 hover:text-slate-300 text-sm">
                Back to Home
              </Link>
            </div>
          </>
        )}

        {step === 'generating' && (
          <>
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
          </>
        )}

        {step === 'planning' && (
          <>
            <ScatteredText
              phrases={[
                'Analysing expert knowledge',
                'Designing interactive guide',
                'Structuring components',
                'Planning the experience',
              ]}
              className="text-5xl md:text-7xl font-semibold text-orange-400 mb-6 min-h-[4rem] whitespace-nowrap"
            />
            <p className="text-slate-500 text-sm">This takes a moment</p>
          </>
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
              <Link to="/" className="text-slate-500 hover:text-slate-300 text-sm">
                Back to Home
              </Link>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

const COMPONENT_TYPE_LABELS: Record<string, string> = {
  decision_tree: 'Decision Tree',
  checklist: 'Checklist',
  step_by_step: 'Step by Step',
  calculator: 'Calculator',
  question_flow: 'Question Flow',
  custom: 'Custom',
  info_card: 'Info Card',
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
          <Link to="/" className="text-slate-400 hover:text-white transition-colors">
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
                  {/* Reorder controls */}
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

                  {/* Content */}
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

                    {/* Outline bullets */}
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

                  {/* Remove button */}
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

          {/* Action buttons */}
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

function renderTabComponent({
  config,
  id,
  type,
  title,
  forgeId,
  userContext,
  expertAnswers,
  loadingFlows,
  editMode,
  onConfigChange,
  onContextChange,
  onComplete,
  onQuestionFlowComplete,
}: {
  config: Record<string, unknown>
  id: string
  type: string
  title: string
  forgeId: string
  userContext: Record<string, unknown>
  expertAnswers: Record<string, string>
  loadingFlows: Record<string, boolean>
  editMode: boolean
  onConfigChange: (config: Record<string, unknown>) => void
  onContextChange: (context: Record<string, unknown>) => void
  onComplete: (done: boolean) => void
  onQuestionFlowComplete: (id: string, data: { answers: Record<string, unknown>; question: string }, title: string) => void
}) {
  const editProps = { editMode, onConfigChange: onConfigChange as any }

  switch (type) {
    case 'decision_tree':
      return <DecisionTree config={config as unknown as DecisionTreeConfig} onComplete={onComplete} {...editProps} />
    case 'checklist':
      return <Checklist config={config as unknown as ChecklistConfig} onComplete={onComplete} {...editProps} />
    case 'calculator':
      return <Calculator config={config as unknown as CalculatorConfig} onComplete={onComplete} {...editProps} />
    case 'info_card':
      return <InfoCard config={config as unknown as InfoCardConfig} onComplete={onComplete} {...editProps} />
    case 'step_by_step':
      return <StepByStep config={config as unknown as StepByStepConfig} onComplete={onComplete} {...editProps} />
    case 'question_flow':
      return (
        <>
          <QuestionFlow
            config={config as unknown as QuestionFlowConfig}
            onAnswered={onComplete}
            onComplete={(data) => onQuestionFlowComplete(id, data, title)}
            {...editProps}
          />
          {loadingFlows[id] && (
            <div className="mt-4 flex items-center gap-2 text-orange-400 text-sm">
              <Loader2 className="w-4 h-4 animate-spin" />
              Getting personalized advice...
            </div>
          )}
          {expertAnswers[id] && !loadingFlows[id] && (
            <div className="mt-4 p-4 bg-slate-700/30 border border-orange-500/20 ">
              <div className="flex items-center gap-2 text-orange-400 text-xs font-medium mb-2">
                <Sparkles className="w-3.5 h-3.5" />
                Expert Advice
              </div>
              <p className="text-sm text-slate-200 leading-relaxed whitespace-pre-wrap">
                {expertAnswers[id]}
              </p>
            </div>
          )}
        </>
      )
    case 'custom':
      return <Custom config={config as unknown as CustomConfig} onComplete={onComplete} {...editProps} />
    default:
      return (
        <div className="text-sm text-slate-500 italic">
          Unknown component type: {type}
        </div>
      )
  }
}
