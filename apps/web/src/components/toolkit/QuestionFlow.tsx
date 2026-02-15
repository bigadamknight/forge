import { useState, useEffect } from 'react'
import {
  ChevronRight,
  ChevronLeft,
  Send,
  CheckCircle,
} from 'lucide-react'
import type { QuestionFlowConfig } from '@forge/shared'
import EditableText from './EditableText'
import EditableList from './EditableList'
import { text, input } from './theme'

interface QuestionFlowProps {
  config: QuestionFlowConfig
  onComplete?: (data: { answers: Record<string, unknown>; question: string }) => void
  onAnswered?: (answered: boolean) => void
  editMode?: boolean
  onConfigChange?: (config: QuestionFlowConfig) => void
}

function loadSaved(storageKey: string) {
  try {
    const raw = localStorage.getItem(storageKey)
    if (!raw) return null
    return JSON.parse(raw) as { answers: Record<string, unknown>; currentIndex: number; isCompleted: boolean }
  } catch {
    return null
  }
}

export default function QuestionFlow({ config, onComplete, onAnswered, editMode, onConfigChange }: QuestionFlowProps) {
  const storageKey = `qf-${config.id}`
  const saved = loadSaved(storageKey)

  const [currentIndex, setCurrentIndex] = useState(saved?.currentIndex ?? 0)
  const [answers, setAnswers] = useState<Record<string, unknown>>(saved?.answers ?? {})
  const [isCompleted, setIsCompleted] = useState(saved?.isCompleted ?? false)
  const [followUpQuestion, setFollowUpQuestion] = useState('')

  // Signal saved completion state to parent on mount
  useEffect(() => {
    if (saved?.isCompleted) onAnswered?.(true)
  }, [])

  // Sync voice answers from external updates (voice agent tool calls)
  useEffect(() => {
    const voiceAnswers = (config as any)._voiceAnswers as Record<string, unknown> | undefined
    if (!voiceAnswers) return
    setAnswers((prev) => {
      const merged = { ...prev, ...voiceAnswers }
      const firstUnanswered = config.questions.findIndex((q) => merged[q.id] === undefined)
      if (firstUnanswered >= 0) {
        setCurrentIndex(firstUnanswered)
        persist(merged, firstUnanswered, false)
      } else {
        setCurrentIndex(config.questions.length - 1)
        setIsCompleted(true)
        persist(merged, config.questions.length - 1, true)
        onAnswered?.(true)
      }
      return merged
    })
  }, [JSON.stringify((config as any)._voiceAnswers)])

  const persist = (a: Record<string, unknown>, idx: number, done: boolean) => {
    try {
      localStorage.setItem(storageKey, JSON.stringify({ answers: a, currentIndex: idx, isCompleted: done }))
    } catch { /* quota exceeded, ignore */ }
  }

  const updateQuestion = (index: number, patch: Partial<QuestionFlowConfig['questions'][number]>) => {
    const questions = [...config.questions]
    questions[index] = { ...questions[index], ...patch }
    onConfigChange?.({ ...config, questions })
  }

  const questions = config.questions
  const currentQ = questions[currentIndex]
  const totalQuestions = questions.length
  const progress = (currentIndex / totalQuestions) * 100

  const setAnswer = (value: unknown) => {
    if (!currentQ) return
    setAnswers((prev) => {
      const next = { ...prev, [currentQ.id]: value }
      persist(next, currentIndex, isCompleted)
      return next
    })
  }

  const currentAnswer = currentQ ? answers[currentQ.id] : undefined

  const hasAnswer = currentAnswer !== undefined && currentAnswer !== '' && currentAnswer !== null
    && !(Array.isArray(currentAnswer) && currentAnswer.length === 0)
  const canProceed = currentQ !== undefined && (!currentQ.required || hasAnswer)

  const handleNext = () => {
    if (currentIndex < totalQuestions - 1) {
      const next = currentIndex + 1
      setCurrentIndex(next)
      persist(answers, next, false)
    } else {
      setIsCompleted(true)
      persist(answers, currentIndex, true)
      onAnswered?.(true)
    }
  }

  const handleBack = () => {
    if (currentIndex > 0) {
      const next = currentIndex - 1
      setCurrentIndex(next)
      persist(answers, next, isCompleted)
    }
  }

  // Edit mode: show all questions in a list for editing
  if (editMode) {
    return (
      <div className="space-y-4">
        <EditableList
          items={config.questions}
          onChange={(questions) => onConfigChange?.({ ...config, questions })}
          editMode={editMode}
          itemLabel="question"
          createItem={() => ({ id: crypto.randomUUID(), text: 'New question', inputType: 'text' as const, required: false })}
          renderItem={(q, idx) => (
            <div key={q.id} className="space-y-2 p-3 bg-slate-700/20  border border-slate-600/30">
              <div className="flex items-center gap-2 text-xs text-slate-500">
                <span>Q{idx + 1}</span>
                <span className="text-slate-600">|</span>
                <span>{q.inputType}</span>
                {q.required && <span className="text-orange-400">required</span>}
              </div>
              <EditableText
                value={q.text}
                onChange={(v) => updateQuestion(idx, { text: v })}
                editMode={editMode}
                as="p"
                className="text-sm font-medium text-white"
              />
              {q.placeholder !== undefined && (
                <EditableText
                  value={q.placeholder}
                  onChange={(v) => updateQuestion(idx, { placeholder: v })}
                  editMode={editMode}
                  as="p"
                  className="text-xs text-slate-500 italic"
                />
              )}
              {(q.inputType === 'select' || q.inputType === 'multiselect') && q.options && (
                <div className="mt-1 space-y-1">
                  <span className="text-xs text-slate-600">Options:</span>
                  {q.options.map((opt, oi) => (
                    <div key={oi} className="flex items-center gap-1.5 group/opt">
                      <EditableText
                        value={opt}
                        onChange={(v) => {
                          const options = [...q.options!]
                          options[oi] = v
                          updateQuestion(idx, { options })
                        }}
                        editMode={editMode}
                        as="span"
                        className="text-xs text-slate-300 bg-slate-700/40 px-2 py-0.5"
                      />
                      <button
                        onClick={() => {
                          const options = q.options!.filter((_, i) => i !== oi)
                          updateQuestion(idx, { options })
                        }}
                        className="text-red-400/60 hover:text-red-400 opacity-0 group-hover/opt:opacity-100 transition-opacity"
                      >
                        <span className="text-xs">×</span>
                      </button>
                    </div>
                  ))}
                  <button
                    onClick={() => {
                      const options = [...(q.options || []), 'New option']
                      updateQuestion(idx, { options })
                    }}
                    className="text-xs text-blue-400/60 hover:text-blue-400 transition-colors"
                  >
                    + add option
                  </button>
                </div>
              )}
            </div>
          )}
        />
      </div>
    )
  }

  // Substitute {{variable}} placeholders in completionPrompt with actual answers
  const resolvedPrompt = (() => {
    let prompt = config.completionPrompt || ''
    for (const q of config.questions) {
      const val = answers[q.id]
      const display = Array.isArray(val) ? val.join(', ') : String(val ?? '')
      prompt = prompt.split(`{{${q.id}}}`).join(display)
    }
    return prompt
  })()

  if (isCompleted) {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-2 text-sm text-emerald-400">
          <CheckCircle className="w-4 h-4" />
          <span>All questions answered</span>
        </div>

        {/* Answer summary */}
        <div className="space-y-1  border border-slate-700/50 overflow-hidden">
          {config.questions.map((q, i) => {
            const val = answers[q.id]
            const display = Array.isArray(val) ? val.join(', ') : String(val ?? '-')
            return (
              <div key={q.id} className={`px-3 py-2 ${i % 2 === 0 ? 'bg-slate-800/30' : 'bg-slate-800/10'}`}>
                <div className="text-xs text-slate-500">{q.text}</div>
                <div className="text-[15px] text-slate-200 mt-0.5">{display}</div>
              </div>
            )
          })}
        </div>

        <textarea
          value={followUpQuestion}
          onChange={(e) => setFollowUpQuestion(e.target.value)}
          placeholder="Add any additional context or specific questions (optional)..."
          rows={2}
          className="w-full px-3 py-2 bg-slate-700/50 border border-slate-600/50  text-sm text-white placeholder-slate-500 focus:border-orange-500 focus:outline-none transition-colors resize-none"
        />

        <div className="flex items-center gap-2">
          <button
            onClick={() => { setIsCompleted(false); persist(answers, currentIndex, false); onAnswered?.(false) }}
            className="px-3 py-2 text-xs text-slate-400 hover:text-white bg-slate-700/50 hover:bg-slate-700  transition-colors"
          >
            Edit Answers
          </button>
          <button
            onClick={() => {
              const question = followUpQuestion.trim()
                ? `${resolvedPrompt}\n\nAdditional question: ${followUpQuestion}`
                : resolvedPrompt
              onComplete?.({ answers, question })
            }}
            className="flex items-center gap-1.5 px-4 py-2 text-sm bg-orange-600 hover:bg-orange-700  transition-colors"
          >
            <Send className="w-3.5 h-3.5" />
            Get Personalized Advice
          </button>
        </div>
      </div>
    )
  }

  if (!currentQ) return null

  return (
    <div className="space-y-4">
      {/* Progress */}
      <div className="space-y-2">
        <div className="flex items-center justify-between text-xs text-slate-400">
          <span>
            Question {currentIndex + 1} of {totalQuestions}
          </span>
          <span>{Math.round(progress)}%</span>
        </div>
        <div className="h-1 bg-slate-700  overflow-hidden">
          <div
            className="h-full bg-orange-500  transition-all duration-300"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      {/* Question */}
      <div className="space-y-3">
        <p className={`${text.title} font-medium text-white`}>
          {currentQ.text}
          {currentQ.required && (
            <span className="text-orange-400 ml-1">*</span>
          )}
        </p>

        {/* Text input */}
        {currentQ.inputType === 'text' && (
          <input
            type="text"
            value={(currentAnswer as string) ?? ''}
            onChange={(e) => setAnswer(e.target.value)}
            placeholder={currentQ.placeholder ?? ''}
            className={`w-full ${input.base}`}
          />
        )}

        {/* Number input */}
        {currentQ.inputType === 'number' && (
          <input
            type="number"
            value={(currentAnswer as number) ?? ''}
            onChange={(e) => setAnswer(parseFloat(e.target.value) || '')}
            placeholder={currentQ.placeholder ?? ''}
            className={`w-full ${input.base}`}
          />
        )}

        {/* Select */}
        {currentQ.inputType === 'select' && currentQ.options && (
          <div className="space-y-1.5">
            {currentQ.options.map((opt) => (
              <button
                key={opt}
                onClick={() => setAnswer(opt)}
                className={`${input.option} ${
                  currentAnswer === opt
                    ? input.optionActive
                    : input.optionInactive
                }`}
              >
                {opt}
              </button>
            ))}
          </div>
        )}

        {/* Multiselect */}
        {currentQ.inputType === 'multiselect' && currentQ.options && (
          <div className="space-y-1.5">
            {currentQ.options.map((opt) => {
              const selected = Array.isArray(currentAnswer) && currentAnswer.includes(opt)
              return (
                <button
                  key={opt}
                  onClick={() => {
                    const current = Array.isArray(currentAnswer) ? currentAnswer : []
                    if (selected) {
                      setAnswer(current.filter((v: string) => v !== opt))
                    } else {
                      setAnswer([...current, opt])
                    }
                  }}
                  className={`${input.option} ${
                    selected
                      ? input.optionActive
                      : input.optionInactive
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <div
                      className={`w-4 h-4 border flex items-center justify-center ${
                        selected
                          ? 'bg-orange-500 border-orange-500'
                          : 'border-slate-500'
                      }`}
                    >
                      {selected && (
                        <CheckCircle className="w-3 h-3 text-white" />
                      )}
                    </div>
                    {opt}
                  </div>
                </button>
              )
            })}
          </div>
        )}
      </div>

      {/* Navigation */}
      <div className="flex items-center justify-between pt-2">
        <button
          onClick={handleBack}
          disabled={currentIndex === 0}
          className="flex items-center gap-1 px-3 py-1.5 text-xs text-slate-400 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed bg-slate-700/50 hover:bg-slate-700  transition-colors"
        >
          <ChevronLeft className="w-3 h-3" />
          Back
        </button>
        <button
          onClick={handleNext}
          disabled={!canProceed}
          className="flex items-center gap-1 px-5 py-2 text-sm bg-orange-600 hover:bg-orange-700 disabled:opacity-30 disabled:cursor-not-allowed  transition-colors"
        >
          {currentIndex === totalQuestions - 1 ? 'Finish' : 'Next'}
          <ChevronRight className="w-3 h-3" />
        </button>
      </div>
    </div>
  )
}
