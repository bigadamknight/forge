import { useState, useEffect } from 'react'
import {
  CheckCircle,
  Circle,
  Clock,
  Lightbulb,
  AlertTriangle,
  ChevronDown,
  ChevronRight,
} from 'lucide-react'
import type { StepByStepConfig } from '@forge/shared'
import CopyButton from './CopyButton'
import EditableText from './EditableText'
import EditableList from './EditableList'

interface StepByStepProps {
  config: StepByStepConfig
  onComplete?: (complete: boolean) => void
  editMode?: boolean
  onConfigChange?: (config: StepByStepConfig) => void
}

export default function StepByStep({ config, onComplete, editMode, onConfigChange }: StepByStepProps) {
  const [completedSteps, setCompletedSteps] = useState<Set<string>>(() => new Set(config.completedSteps || []))

  useEffect(() => {
    if (config.completedSteps) setCompletedSteps(new Set(config.completedSteps))
  }, [JSON.stringify(config.completedSteps)])

  const [expandedStep, setExpandedStep] = useState<string | null>(
    config.steps[0]?.id ?? null
  )

  const toggleComplete = (id: string) => {
    const next = new Set(completedSteps)
    if (next.has(id)) {
      next.delete(id)
    } else {
      next.add(id)
    }
    setCompletedSteps(next)
    onComplete?.(next.size === config.steps.length)
    onConfigChange?.({ ...config, completedSteps: [...next] })
  }

  const toggleExpand = (id: string) => {
    setExpandedStep((prev) => (prev === id ? null : id))
  }

  const updateStep = (index: number, patch: Partial<StepByStepConfig['steps'][number]>) => {
    const steps = [...config.steps]
    steps[index] = { ...steps[index], ...patch }
    onConfigChange?.({ ...config, steps })
  }

  const updateTip = (stepIndex: number, tipIndex: number, value: string) => {
    const steps = [...config.steps]
    const tips = [...(steps[stepIndex].tips ?? [])]
    tips[tipIndex] = value
    steps[stepIndex] = { ...steps[stepIndex], tips }
    onConfigChange?.({ ...config, steps })
  }

  const updateWarning = (stepIndex: number, warningIndex: number, value: string) => {
    const steps = [...config.steps]
    const warnings = [...(steps[stepIndex].warnings ?? [])]
    warnings[warningIndex] = value
    steps[stepIndex] = { ...steps[stepIndex], warnings }
    onConfigChange?.({ ...config, steps })
  }

  const completedCount = completedSteps.size
  const totalCount = config.steps.length

  return (
    <div className="space-y-4">
      {/* Progress */}
      <div className="flex items-center justify-between text-sm text-slate-400">
        <span>
          {completedCount} of {totalCount} steps completed
        </span>
        <div className="flex items-center gap-2">
          <span>{Math.round((completedCount / totalCount) * 100)}%</span>
          <CopyButton getText={() =>
            config.steps.map((s, i) => `${i + 1}. ${s.title}\n${s.content}${s.tips?.length ? `\nTips: ${s.tips.join('; ')}` : ''}${s.warnings?.length ? `\nWarnings: ${s.warnings.join('; ')}` : ''}`).join('\n\n')
          } />
        </div>
      </div>

      {/* Steps */}
      <div className="space-y-1">
        <EditableList
          items={config.steps}
          onChange={(steps) => onConfigChange?.({ ...config, steps })}
          editMode={editMode}
          itemLabel="step"
          createItem={() => ({ id: crypto.randomUUID(), title: 'New Step', content: '', tips: [], warnings: [] })}
          renderItem={(step, idx) => {
            const isCompleted = completedSteps.has(step.id)
            const isExpanded = expandedStep === step.id

            return (
              <div key={step.id} className="relative">
                {/* Connector line */}
                {idx < config.steps.length - 1 && (
                  <div
                    className={`absolute left-[15px] top-[36px] w-0.5 bottom-0 ${
                      isCompleted ? 'bg-orange-500/50' : 'bg-slate-700'
                    }`}
                  />
                )}

                <div className="relative">
                  {/* Step header */}
                  <div
                    className={`flex items-start gap-3 px-4 py-3  cursor-pointer transition-colors hover:bg-slate-700/30 ${
                      isExpanded ? 'bg-slate-700/20' : ''
                    }`}
                    onClick={() => toggleExpand(step.id)}
                  >
                    {/* Step indicator */}
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        toggleComplete(step.id)
                      }}
                      className="shrink-0 mt-0.5"
                    >
                      {isCompleted ? (
                        <CheckCircle className="w-5 h-5 text-orange-400" />
                      ) : (
                        <Circle className="w-5 h-5 text-slate-500" />
                      )}
                    </button>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-slate-500 font-mono">
                          {String(idx + 1).padStart(2, '0')}
                        </span>
                        <EditableText
                          value={step.title}
                          onChange={(v) => updateStep(idx, { title: v })}
                          editMode={editMode}
                          as="span"
                          className={`text-base font-medium ${
                            isCompleted
                              ? 'text-slate-400 line-through'
                              : 'text-slate-200'
                          }`}
                        />
                      </div>
                      {step.estimatedTime && (
                        <div className="flex items-center gap-1 mt-0.5 text-xs text-slate-500">
                          <Clock className="w-3 h-3" />
                          {step.estimatedTime}
                        </div>
                      )}
                    </div>

                    {isExpanded ? (
                      <ChevronDown className="w-4 h-4 text-slate-500 shrink-0" />
                    ) : (
                      <ChevronRight className="w-4 h-4 text-slate-500 shrink-0" />
                    )}
                  </div>

                  {/* Expanded content */}
                  {isExpanded && (
                    <div className="ml-11 mr-3 mb-3 space-y-3">
                      <EditableText
                        value={step.content}
                        onChange={(v) => updateStep(idx, { content: v })}
                        editMode={editMode}
                        as="p"
                        className="text-base text-slate-300 leading-relaxed whitespace-pre-wrap"
                        multiline
                      />

                      {step.tips && step.tips.length > 0 && (
                        <div className="space-y-1.5">
                          {step.tips.map((tip, i) => (
                            <div
                              key={i}
                              className="flex items-start gap-2 px-4 py-3 bg-emerald-500/10 border border-emerald-500/20 "
                            >
                              <Lightbulb className="w-3.5 h-3.5 text-emerald-400 shrink-0 mt-0.5" />
                              <EditableText
                                value={tip}
                                onChange={(v) => updateTip(idx, i, v)}
                                editMode={editMode}
                                as="span"
                                className="text-[15px] text-emerald-300 leading-relaxed"
                              />
                            </div>
                          ))}
                        </div>
                      )}

                      {step.warnings && step.warnings.length > 0 && (
                        <div className="space-y-1.5">
                          {step.warnings.map((warning, i) => (
                            <div
                              key={i}
                              className="flex items-start gap-2 px-4 py-3 bg-red-500/10 border border-red-500/20 "
                            >
                              <AlertTriangle className="w-3.5 h-3.5 text-red-400 shrink-0 mt-0.5" />
                              <EditableText
                                value={warning}
                                onChange={(v) => updateWarning(idx, i, v)}
                                editMode={editMode}
                                as="span"
                                className="text-[15px] text-red-300 leading-relaxed"
                              />
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            )
          }}
        />
      </div>
    </div>
  )
}
