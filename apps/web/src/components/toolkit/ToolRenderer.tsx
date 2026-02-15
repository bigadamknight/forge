import { useState } from 'react'
import { Wrench, Loader2, MessageSquare } from 'lucide-react'
import type {
  DecisionTreeConfig,
  ChecklistConfig,
  CalculatorConfig,
  InfoCardConfig,
  StepByStepConfig,
  QuestionFlowConfig,
  TaskBoardConfig,
} from '@forge/shared'
import { askExpert } from '../../lib/api'
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

export default function ToolRenderer({ layout, forgeId, onContextChange, onCompletionChange }: ToolRendererProps) {
  const [expertAnswers, setExpertAnswers] = useState<Record<string, string>>({})
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
    try {
      const result = await askExpert(
        forgeId,
        data.question,
        { ...userContextRef.current, flowAnswers: data.answers },
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
                  {loadingFlows[id] && (
                    <div className="mt-4 flex items-center gap-2 text-orange-400 text-sm">
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Getting personalized advice...
                    </div>
                  )}
                  {expertAnswers[id] && !loadingFlows[id] && (
                    <div className="mt-4 p-4 bg-slate-700/30 border border-orange-500/20">
                      <div className="flex items-center gap-2 text-orange-400 text-xs font-medium mb-2">
                        <MessageSquare className="w-3.5 h-3.5" />
                        Expert Advice
                      </div>
                      <p className="text-sm text-slate-200 leading-relaxed whitespace-pre-wrap">
                        {expertAnswers[id]}
                      </p>
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
