import { useState } from 'react'
import ReactMarkdown from 'react-markdown'
import { Wrench, Loader2, MessageSquare, Sparkles, ChevronDown, ChevronRight } from 'lucide-react'
import type {
  DecisionTreeConfig,
  ChecklistConfig,
  CalculatorConfig,
  InfoCardConfig,
  StepByStepConfig,
  QuestionFlowConfig,
  TaskBoardConfig,
} from '@forge/shared'
import { streamAdvice, type AdviceSection } from '../../lib/api'
import DecisionTree from './DecisionTree'
import Checklist from './Checklist'
import Calculator from './Calculator'
import InfoCard from './InfoCard'
import StepByStep from './StepByStep'
import QuestionFlow from './QuestionFlow'
import TaskBoard from './TaskBoard'
import { text, card } from './theme'

interface ToolRendererProps {
  layout: Array<Record<string, unknown>>
  forgeId: string
  onContextChange: (context: Record<string, unknown>) => void
  onCompletionChange?: (completionMap: Record<string, boolean>) => void
}

function renderComponent(
  config: Record<string, unknown>,
  forgeId: string,
  onContextChange: (context: Record<string, unknown>) => void,
  onComplete?: (complete: boolean) => void,
) {
  const type = config.type as string

  switch (type) {
    case 'decision_tree':
      return <DecisionTree config={config as unknown as DecisionTreeConfig} onComplete={onComplete} />
    case 'checklist':
      return <Checklist config={config as unknown as ChecklistConfig} onComplete={onComplete} />
    case 'calculator':
      return <Calculator config={config as unknown as CalculatorConfig} onComplete={onComplete} />
    case 'info_card':
      return <InfoCard config={config as unknown as InfoCardConfig} onComplete={onComplete} />
    case 'step_by_step':
      return <StepByStep config={config as unknown as StepByStepConfig} onComplete={onComplete} />
    case 'question_flow':
      return (
        <QuestionFlow
          config={config as unknown as QuestionFlowConfig}
          onComplete={(data) => {
            console.log(`[QuestionFlow:${forgeId}]`, data)
          }}
        />
      )
    case 'task_board':
      return <TaskBoard config={config as unknown as TaskBoardConfig} forgeId={forgeId} />
    default:
      return (
        <div className="text-sm text-slate-500 italic">
          Unknown component type: {type}
        </div>
      )
  }
}

function loadSavedAdvice(forgeId: string): Record<string, AdviceSection[]> {
  try {
    const raw = localStorage.getItem(`advice-${forgeId}`)
    return raw ? JSON.parse(raw) : {}
  } catch { return {} }
}

function saveAdvice(forgeId: string, answers: Record<string, AdviceSection[]>) {
  localStorage.setItem(`advice-${forgeId}`, JSON.stringify(answers))
}

export default function ToolRenderer({ layout, forgeId, onContextChange, onCompletionChange }: ToolRendererProps) {
  const [expertAnswers, setExpertAnswers] = useState<Record<string, AdviceSection[]>>(() => loadSavedAdvice(forgeId))
  const [loadingFlows, setLoadingFlows] = useState<Record<string, boolean>>({})
  const [userContextRef] = useState<{ current: Record<string, unknown> }>({ current: {} })
  const [completionMap, setCompletionMap] = useState<Record<string, boolean>>({})

  const handleComponentComplete = (componentId: string, complete: boolean) => {
    setCompletionMap((prev) => {
      const next = { ...prev, [componentId]: complete }
      onCompletionChange?.(next)
      return next
    })
  }

  const handleContextChangeWrapped = (context: Record<string, unknown>) => {
    userContextRef.current = context
    onContextChange(context)
  }

  const handleQuestionFlowComplete = async (
    componentId: string,
    data: { answers: Record<string, unknown>; question: string },
    componentTitle: string
  ) => {
    setLoadingFlows((prev) => ({ ...prev, [componentId]: true }))
    setExpertAnswers((prev) => ({ ...prev, [componentId]: [] }))

    streamAdvice(
      forgeId,
      data.question,
      { ...userContextRef.current, flowAnswers: data.answers },
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
          saveAdvice(forgeId, prev)
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

  if (!layout || layout.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-slate-500">
        <Wrench className="w-8 h-8 mb-3 opacity-50" />
        <p className="text-sm">No tools configured</p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {layout.map((config) => {
        const id = (config.id as string) ?? Math.random().toString(36).slice(2)
        const title = config.title as string | undefined
        const description = config.description as string | undefined
        const type = config.type as string

        const handleComplete = (done: boolean) => handleComponentComplete(id, done)

        // InfoCards render without the outer card wrapper for cleaner look
        if (type === 'info_card') {
          return (
            <div key={id}>
              {renderComponent(config, forgeId, handleContextChangeWrapped, handleComplete)}
            </div>
          )
        }

        return (
          <div
            key={id}
            className="bg-slate-800/50 border border-slate-700/50 overflow-hidden"
          >
            {/* Card header */}
            {title && (
              <div className={card.header}>
                <h3 className={`${text.heading} font-semibold text-white`}>{title}</h3>
                {description && (
                  <p className={`${text.secondary} text-slate-400 mt-1 leading-relaxed`}>
                    {description}
                  </p>
                )}
              </div>
            )}

            {/* Card body */}
            <div className={card.body}>
              {type === 'question_flow' ? (
                <>
                  <QuestionFlow
                    config={config as unknown as QuestionFlowConfig}
                    onComplete={(data) => {
                      handleComplete(true)
                      handleQuestionFlowComplete(id, data, (title || 'Ask the Expert'))
                    }}
                  />
                  {loadingFlows[id] && (!expertAnswers[id] || expertAnswers[id].length === 0) && (
                    <div className="mt-4 flex items-center gap-2 text-orange-400 text-sm">
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Getting personalized advice...
                    </div>
                  )}
                  {expertAnswers[id] && expertAnswers[id].length > 0 && (
                    <div className="mt-4 space-y-2">
                      <div className="flex items-center gap-2 text-orange-400 text-xs font-medium">
                        <Sparkles className="w-3.5 h-3.5" />
                        Expert Advice
                        {loadingFlows[id] && <Loader2 className="w-3 h-3 animate-spin" />}
                      </div>
                      {expertAnswers[id].map((section, i) => (
                        <AdviceSectionCard key={i} section={section} loading={loadingFlows[id] && !section.content} />
                      ))}
                    </div>
                  )}
                </>
              ) : (
                renderComponent(config, forgeId, handleContextChangeWrapped, handleComplete)
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}

const markdownComponents = {
  p: ({ children }: any) => <p className="mb-2 last:mb-0">{children}</p>,
  strong: ({ children }: any) => <strong className="font-semibold text-white">{children}</strong>,
  ul: ({ children }: any) => <ul className="list-disc list-inside mb-2 space-y-1">{children}</ul>,
  ol: ({ children }: any) => <ol className="list-decimal list-inside mb-2 space-y-1">{children}</ol>,
  li: ({ children }: any) => <li className="text-slate-300">{children}</li>,
  h3: ({ children }: any) => <h3 className="font-semibold text-white mt-3 mb-1">{children}</h3>,
  code: ({ children, className }: any) => {
    const isBlock = className?.includes('language-')
    if (isBlock) {
      return <code className="block bg-slate-900 px-2 py-1.5 text-xs text-orange-300 overflow-x-auto mb-2">{children}</code>
    }
    return <code className="bg-slate-900 px-1 py-0.5 text-xs text-orange-300">{children}</code>
  },
}

function AdviceSectionCard({ section, loading }: { section: AdviceSection; loading: boolean }) {
  const [expanded, setExpanded] = useState(true)

  return (
    <div className="bg-slate-700/30 border border-orange-500/20">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center gap-2 px-4 py-2.5 text-left hover:bg-slate-700/50 transition-colors"
      >
        {expanded ? (
          <ChevronDown className="w-3.5 h-3.5 text-slate-400 shrink-0" />
        ) : (
          <ChevronRight className="w-3.5 h-3.5 text-slate-400 shrink-0" />
        )}
        <span className="text-sm font-medium text-white flex-1">{section.title}</span>
        {loading && <Loader2 className="w-3.5 h-3.5 text-orange-400 animate-spin shrink-0" />}
      </button>
      {expanded && (
        <div className="px-4 pb-3">
          {section.description && (
            <p className="text-xs text-slate-400 mb-2">{section.description}</p>
          )}
          {section.content ? (
            <div className="text-sm text-slate-200 leading-relaxed">
              <ReactMarkdown components={markdownComponents}>
                {section.content}
              </ReactMarkdown>
            </div>
          ) : loading ? (
            <div className="flex items-center gap-2 text-slate-500 text-xs py-2">
              <Loader2 className="w-3 h-3 animate-spin" />
              Generating...
            </div>
          ) : null}
        </div>
      )}
    </div>
  )
}
