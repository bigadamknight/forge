import { Loader2, Sparkles } from 'lucide-react'
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
  expertAnswers: Record<string, string>
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
