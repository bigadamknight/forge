import { useState } from 'react'
import { useParams } from 'react-router-dom'
import { Flame, Loader2, ChevronRight, Circle, CheckCircle } from 'lucide-react'
import { streamAdvice, type AdviceSection } from '../lib/api'
import { useToolUser } from '../hooks/useToolUser'
import { renderTabComponent } from '../lib/renderComponent'
import ChatSidebar from '../components/toolkit/ChatSidebar'
import WorkspaceSidebar from '../components/workspace/WorkspaceSidebar'

function loadSavedAdvice(forgeId: string): Record<string, AdviceSection[]> {
  try {
    const raw = localStorage.getItem(`advice-${forgeId}`)
    return raw ? JSON.parse(raw) : {}
  } catch { return {} }
}

function saveAdvice(forgeId: string, answers: Record<string, AdviceSection[]>) {
  localStorage.setItem(`advice-${forgeId}`, JSON.stringify(answers))
}

export default function ToolUserPage() {
  const { forgeId } = useParams<{ forgeId: string }>()
  const [userContext, setUserContext] = useState<Record<string, unknown>>({})
  const [expertAnswers, setExpertAnswers] = useState<Record<string, AdviceSection[]>>(() => loadSavedAdvice(forgeId!))
  const [loadingFlows, setLoadingFlows] = useState<Record<string, boolean>>({})

  const {
    data,
    isLoading,
    error,
    layout,
    tabs,
    activePanel,
    setActivePanel,
    overallProgress,
    completionMap,
    extractions,
    chats,
    createChat,
    deleteChat,
    handleCompletionChange,
    handleTabChange,
  } = useToolUser(forgeId!)

  const handleQuestionFlowComplete = async (
    componentId: string,
    flowData: { answers: Record<string, unknown>; question: string },
    componentTitle: string
  ) => {
    setLoadingFlows((prev) => ({ ...prev, [componentId]: true }))
    setExpertAnswers((prev) => ({ ...prev, [componentId]: [] }))

    streamAdvice(
      forgeId!,
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
          saveAdvice(forgeId!, prev)
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

  const handleChatNavigate = (componentId: string) => {
    const idx = tabs.findIndex((t) => t.id === componentId)
    if (idx !== -1) handleTabChange(idx)
  }

  if (isLoading) {
    return (
      <div className="h-screen flex items-center justify-center">
        <div className="flex items-center gap-3 text-slate-400">
          <Loader2 className="w-6 h-6 animate-spin" />
          Loading...
        </div>
      </div>
    )
  }

  if (error || !data) {
    return (
      <div className="h-screen flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-xl font-bold text-white mb-2">Tool Not Available</h2>
          <p className="text-slate-400 text-sm">This tool hasn't been generated yet.</p>
        </div>
      </div>
    )
  }

  const { forge, toolConfig } = data
  const activeTab = activePanel.type === 'component' ? tabs[activePanel.index] : null

  return (
    <div className="h-screen flex flex-col">
      {/* Header */}
      <header className="sticky top-0 z-10 bg-slate-900/90 backdrop-blur-sm border-b border-slate-700/50 shrink-0">
        <div className="px-6 py-3 flex items-center gap-4">
          <div className="flex items-center gap-2">
            <Flame className="w-5 h-5 text-orange-400" />
            <span className="font-medium">{toolConfig.title}</span>
          </div>
          <span className="text-slate-500 text-sm hidden sm:inline">
            Built from {forge.expertName}'s expertise
          </span>
          <div className="ml-auto flex items-center gap-3">
            <div className="flex items-center gap-2 text-sm text-slate-400">
              <span>{overallProgress}%</span>
              <div className="w-24 h-1.5 bg-slate-700 overflow-hidden">
                <div
                  className="h-full bg-orange-500 transition-all duration-500"
                  style={{ width: `${overallProgress}%` }}
                />
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Main workspace: sidebar + content */}
      <div className="flex-1 flex overflow-hidden">
        <WorkspaceSidebar
          tabs={tabs}
          documents={[]}
          extractionCount={0}
          chats={chats}
          overallProgress={overallProgress}
          activePanel={activePanel}
          creatorMode={false}
          onPanelChange={setActivePanel}
          onNewChat={createChat}
          onDeleteChat={deleteChat}
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
              <div className="bg-slate-800/50 border border-slate-700/50 p-6 mb-6">
                <div className="flex items-center justify-between mb-4">
                  <span className="text-sm text-slate-400">Overall Progress</span>
                  <span className="text-sm font-medium text-white">{overallProgress}%</span>
                </div>
                <div className="h-2 bg-slate-700 overflow-hidden">
                  <div
                    className="h-full bg-orange-500 transition-all duration-500"
                    style={{ width: `${overallProgress}%` }}
                  />
                </div>
                <p className="text-xs text-slate-500 mt-2">
                  {tabs.filter((t) => t.complete).length} of {tabs.length} sections completed
                </p>
              </div>

              {/* Section list */}
              <div className="space-y-2">
                {tabs.map((tab, idx) => (
                  <button
                    key={`dash-${tab.id}-${idx}`}
                    onClick={() => handleTabChange(idx)}
                    className="w-full flex items-center gap-4 px-4 py-3.5 bg-slate-800/50 hover:bg-slate-800 border border-slate-700/50 hover:border-slate-600/50 transition-colors text-left group"
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

            {/* Component panels */}
            {layout.map((config, idx) => {
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

                  <div className="bg-slate-800/50 border border-slate-700/50 p-6">
                    {renderTabComponent({
                      config,
                      id,
                      type,
                      title: title || 'Section',
                      forgeId: forgeId!,
                      userContext,
                      expertAnswers,
                      loadingFlows,
                      editMode: false,
                      onConfigChange: () => {},
                      onContextChange: setUserContext,
                      onComplete: (done) => handleComponentComplete(id, done),
                      onQuestionFlowComplete: handleQuestionFlowComplete,
                    })}
                  </div>
                </div>
              )
            })}

            {/* Chat panel */}
            {activePanel.type === 'chat' && (
              <div className="h-[calc(100vh-8rem)]">
                <ChatSidebar
                  forgeId={forgeId!}
                  chatId={activePanel.chatId}
                  activeComponentId={null}
                  layout={layout}
                  userContext={userContext}
                  variant="panel"
                  onNavigate={handleChatNavigate}
                />
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Floating expert chat - hidden when chat panel is active */}
      <ChatSidebar
        forgeId={forgeId!}
        activeComponentId={activeTab?.id || null}
        activeComponentTitle={activeTab?.title}
        layout={layout}
        userContext={userContext}
        hidden={activePanel.type === 'chat'}
        onNavigate={handleChatNavigate}
      />
    </div>
  )
}
