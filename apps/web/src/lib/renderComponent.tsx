import { useState } from 'react'
import ReactMarkdown from 'react-markdown'
import { Loader2, Sparkles, ChevronDown, ChevronRight } from 'lucide-react'
import type {
  DecisionTreeConfig,
  ChecklistConfig,
  CalculatorConfig,
  InfoCardConfig,
  StepByStepConfig,
  QuestionFlowConfig,
  CustomConfig,
  QuizConfig,
} from '@forge/shared'
import type { AdviceSection } from './api'
import DecisionTree from '../components/toolkit/DecisionTree'
import Checklist from '../components/toolkit/Checklist'
import Calculator from '../components/toolkit/Calculator'
import InfoCard from '../components/toolkit/InfoCard'
import StepByStep from '../components/toolkit/StepByStep'
import QuestionFlow from '../components/toolkit/QuestionFlow'
import Custom from '../components/toolkit/Custom'
import Quiz from '../components/toolkit/Quiz'

export interface RenderTabComponentProps {
  config: Record<string, unknown>
  id: string
  type: string
  title: string
  forgeId: string
  userContext: Record<string, unknown>
  expertAnswers: Record<string, AdviceSection[]>
  loadingFlows: Record<string, boolean>
  editMode: boolean
  onConfigChange: (config: Record<string, unknown>) => void
  onContextChange: (context: Record<string, unknown>) => void
  onComplete: (done: boolean) => void
  onQuestionFlowComplete: (id: string, data: { answers: Record<string, unknown>; question: string }, title: string) => void
}

export function renderTabComponent(props: RenderTabComponentProps) {
  const { config, id, type, title, expertAnswers, loadingFlows, editMode, onConfigChange, onComplete, onQuestionFlowComplete } = props
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
      )
    case 'quiz':
      return <Quiz config={config as unknown as QuizConfig} onComplete={onComplete} {...editProps} />
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

export const COMPONENT_TYPE_LABELS: Record<string, string> = {
  decision_tree: 'Decision Tree',
  checklist: 'Checklist',
  step_by_step: 'Step by Step',
  calculator: 'Calculator',
  question_flow: 'Question Flow',
  quiz: 'Quiz',
  custom: 'Custom',
  info_card: 'Info Card',
}
