import { useState, useEffect } from 'react'
import { CheckCircle, XCircle, ChevronLeft, ChevronRight, RotateCcw, Trophy, AlertTriangle } from 'lucide-react'
import type { QuizConfig } from '@forge/shared'
import EditableText from './EditableText'

interface QuizProps {
  config: QuizConfig
  onComplete?: (complete: boolean) => void
  editMode?: boolean
  onConfigChange?: (config: QuizConfig) => void
}

function loadQuizState(configId: string): { answers: Record<string, string[]>; revealed: string[] } {
  try {
    const raw = localStorage.getItem(`quiz-${configId}`)
    return raw ? JSON.parse(raw) : { answers: {}, revealed: [] }
  } catch { return { answers: {}, revealed: [] } }
}

export default function Quiz({ config, onComplete, editMode, onConfigChange }: QuizProps) {
  const [currentIndex, setCurrentIndex] = useState(0)
  const [answers, setAnswers] = useState<Record<string, string[]>>(() => loadQuizState(config.id).answers)
  const [revealed, setRevealed] = useState<Set<string>>(() => new Set(loadQuizState(config.id).revealed))
  const [showResults, setShowResults] = useState(false)

  useEffect(() => {
    const voiceAnswers = (config as any)._quizAnswers as Record<string, string[]> | undefined
    if (!voiceAnswers) return
    setAnswers((prev) => {
      const next = { ...prev }
      let changed = false
      for (const [qId, optionIds] of Object.entries(voiceAnswers)) {
        if (JSON.stringify(next[qId]) !== JSON.stringify(optionIds)) {
          next[qId] = optionIds
          changed = true
        }
      }
      return changed ? next : prev
    })
  }, [JSON.stringify((config as any)._quizAnswers)])

  useEffect(() => {
    try {
      localStorage.setItem(`quiz-${config.id}`, JSON.stringify({
        answers,
        revealed: [...revealed],
      }))
    } catch {}
  }, [answers, revealed, config.id])

  useEffect(() => {
    const allAnswered = config.questions.every((q) => answers[q.id]?.length > 0)
    onComplete?.(allAnswered)
  }, [answers, config.questions])

  const question = config.questions[currentIndex]
  if (!question && !showResults && !editMode) return null

  const selectOption = (questionId: string, optionId: string, multipleCorrect?: boolean) => {
    if (editMode) return
    if (multipleCorrect) {
      setAnswers((prev) => {
        const current = prev[questionId] || []
        const next = current.includes(optionId)
          ? current.filter((id) => id !== optionId)
          : [...current, optionId]
        return { ...prev, [questionId]: next }
      })
    } else {
      setAnswers((prev) => ({ ...prev, [questionId]: [optionId] }))
      // Auto-reveal for single-select when immediate feedback is on
      if (config.showImmediateFeedback) {
        setRevealed((prev) => new Set([...prev, questionId]))
      }
    }
  }

  const confirmMultiSelect = (questionId: string) => {
    setRevealed((prev) => new Set([...prev, questionId]))
  }

  const calculateScore = () => {
    let correct = 0
    for (const q of config.questions) {
      const selected = new Set(answers[q.id] || [])
      const correctIds = new Set(q.options.filter((o) => o.correct).map((o) => o.id))
      if (selected.size === correctIds.size && [...selected].every((id) => correctIds.has(id))) {
        correct++
      }
    }
    return { correct, total: config.questions.length, percent: Math.round((correct / config.questions.length) * 100) }
  }

  const handleReset = () => {
    setAnswers({})
    setRevealed(new Set())
    setCurrentIndex(0)
    setShowResults(false)
    try { localStorage.removeItem(`quiz-${config.id}`) } catch {}
    onComplete?.(false)
  }

  const updateQuestion = (qIdx: number, patch: Partial<QuizConfig['questions'][number]>) => {
    const questions = [...config.questions]
    questions[qIdx] = { ...questions[qIdx], ...patch }
    onConfigChange?.({ ...config, questions })
  }

  const updateOption = (qIdx: number, oIdx: number, patch: Partial<QuizConfig['questions'][number]['options'][number]>) => {
    const questions = [...config.questions]
    const options = [...questions[qIdx].options]
    options[oIdx] = { ...options[oIdx], ...patch }
    questions[qIdx] = { ...questions[qIdx], options }
    onConfigChange?.({ ...config, questions })
  }

  const addQuestion = () => {
    const id = crypto.randomUUID()
    onConfigChange?.({
      ...config,
      questions: [...config.questions, {
        id,
        text: 'New question',
        options: [
          { id: crypto.randomUUID(), text: 'Option A', correct: true },
          { id: crypto.randomUUID(), text: 'Option B', correct: false },
        ],
      }],
    })
  }

  const removeQuestion = (qIdx: number) => {
    const questions = config.questions.filter((_, i) => i !== qIdx)
    onConfigChange?.({ ...config, questions })
    if (currentIndex >= questions.length) setCurrentIndex(Math.max(0, questions.length - 1))
  }

  const addOption = (qIdx: number) => {
    const questions = [...config.questions]
    questions[qIdx] = {
      ...questions[qIdx],
      options: [...questions[qIdx].options, { id: crypto.randomUUID(), text: 'New option', correct: false }],
    }
    onConfigChange?.({ ...config, questions })
  }

  const removeOption = (qIdx: number, oIdx: number) => {
    const questions = [...config.questions]
    questions[qIdx] = {
      ...questions[qIdx],
      options: questions[qIdx].options.filter((_, i) => i !== oIdx),
    }
    onConfigChange?.({ ...config, questions })
  }

  if (showResults && !editMode) {
    const score = calculateScore()
    const passed = config.passingScore ? score.percent >= config.passingScore : true

    return (
      <div className="space-y-6">
        {/* Score summary */}
        <div className="text-center py-8">
          <Trophy className={`w-12 h-12 mx-auto mb-4 ${passed ? 'text-orange-400' : 'text-slate-500'}`} />
          <h3 className="text-2xl font-bold text-white mb-2">
            {score.correct} / {score.total}
          </h3>
          <p className="text-slate-400 text-sm">
            {score.percent}% correct
          </p>
          {config.passingScore && (
            <div className={`mt-3 inline-flex items-center gap-2 px-3 py-1.5 text-sm ${
              passed ? 'bg-green-500/10 text-green-400' : 'bg-red-500/10 text-red-400'
            }`}>
              {passed ? <CheckCircle className="w-4 h-4" /> : <AlertTriangle className="w-4 h-4" />}
              {passed ? 'Passed' : `Need ${config.passingScore}% to pass`}
            </div>
          )}
        </div>

        {/* Per-question breakdown */}
        <div className="space-y-3">
          {config.questions.map((q, idx) => {
            const selected = new Set(answers[q.id] || [])
            const correctIds = new Set(q.options.filter((o) => o.correct).map((o) => o.id))
            const isCorrect = selected.size === correctIds.size && [...selected].every((id) => correctIds.has(id))

            return (
              <button
                key={q.id}
                onClick={() => { setShowResults(false); setCurrentIndex(idx) }}
                className="w-full flex items-center gap-3 px-4 py-3 bg-slate-800/50 border border-slate-700/50 hover:border-slate-600/50 transition-colors text-left"
              >
                {isCorrect ? (
                  <CheckCircle className="w-5 h-5 text-green-400 shrink-0" />
                ) : (
                  <XCircle className="w-5 h-5 text-red-400 shrink-0" />
                )}
                <span className="text-sm text-slate-200 flex-1">{q.text}</span>
                <ChevronRight className="w-4 h-4 text-slate-600 shrink-0" />
              </button>
            )
          })}
        </div>

        <div className="flex justify-center">
          <button
            onClick={handleReset}
            className="flex items-center gap-2 px-4 py-2 text-sm text-slate-400 hover:text-white bg-slate-800 hover:bg-slate-700 border border-slate-700/50 transition-colors"
          >
            <RotateCcw className="w-4 h-4" />
            Try Again
          </button>
        </div>
      </div>
    )
  }

  // Edit mode: show all questions
  if (editMode) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <span className="text-xs text-slate-500">
            Mode: <button onClick={() => onConfigChange?.({ ...config, mode: config.mode === 'knowledge_check' ? 'scenario' : 'knowledge_check' })} className="text-orange-400 hover:text-orange-300">{config.mode}</button>
          </span>
        </div>
        {config.questions.map((q, qIdx) => (
          <div key={q.id} className="p-4 bg-slate-800/30 border border-slate-700/50 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs text-slate-500">Question {qIdx + 1}</span>
              <button onClick={() => removeQuestion(qIdx)} className="text-xs text-red-400 hover:text-red-300">Remove</button>
            </div>
            <EditableText
              value={q.text}
              editMode
              onChange={(v) => updateQuestion(qIdx, { text: v })}
              className="text-sm text-slate-200"
            />
            {q.scenario && (
              <EditableText
                value={q.scenario}
                editMode
                onChange={(v) => updateQuestion(qIdx, { scenario: v })}
                className="text-xs text-slate-400"
                multiline
              />
            )}
            <div className="space-y-2 ml-4">
              {q.options.map((opt, oIdx) => (
                <div key={opt.id} className="flex items-center gap-2">
                  <button
                    onClick={() => updateOption(qIdx, oIdx, { correct: !opt.correct })}
                    className={`w-5 h-5 shrink-0 flex items-center justify-center border ${opt.correct ? 'border-green-500 bg-green-500/20 text-green-400' : 'border-slate-600'}`}
                  >
                    {opt.correct && <CheckCircle className="w-3 h-3" />}
                  </button>
                  <EditableText
                    value={opt.text}
                    editMode
                    onChange={(v) => updateOption(qIdx, oIdx, { text: v })}
                    className="text-sm text-slate-300 flex-1"
                  />
                  <button onClick={() => removeOption(qIdx, oIdx)} className="text-xs text-slate-600 hover:text-red-400">x</button>
                </div>
              ))}
              <button onClick={() => addOption(qIdx)} className="text-xs text-slate-500 hover:text-slate-300">+ Add option</button>
            </div>
          </div>
        ))}
        <button onClick={addQuestion} className="text-sm text-orange-400 hover:text-orange-300">+ Add question</button>
      </div>
    )
  }

  // Question view
  const isAnswered = (answers[question.id]?.length || 0) > 0
  const isRevealed = revealed.has(question.id)
  const selectedSet = new Set(answers[question.id] || [])
  const allAnswered = config.questions.every((q) => answers[q.id]?.length > 0)

  return (
    <div className="space-y-6">
      {/* Progress */}
      <div className="flex items-center justify-between text-sm text-slate-400">
        <span>Question {currentIndex + 1} of {config.questions.length}</span>
        <span>{config.questions.filter((q) => answers[q.id]?.length > 0).length} answered</span>
      </div>
      <div className="h-1.5 bg-slate-700 overflow-hidden">
        <div
          className="h-full bg-orange-500 transition-all duration-300"
          style={{ width: `${((currentIndex + 1) / config.questions.length) * 100}%` }}
        />
      </div>

      {/* Scenario description */}
      {config.mode === 'scenario' && question.scenario && (
        <div className="p-4 bg-slate-700/30 border border-slate-600/50">
          <p className="text-sm text-slate-300 leading-relaxed italic">{question.scenario}</p>
        </div>
      )}

      {/* Question text */}
      <h3 className="text-lg font-medium text-white">{question.text}</h3>

      {/* Options */}
      <div className="space-y-2">
        {question.options.map((option) => {
          const isSelected = selectedSet.has(option.id)
          const showFeedback = config.showImmediateFeedback && isRevealed

          let optionStyle = 'border-slate-700/50 hover:border-slate-600/50'
          if (isSelected && !showFeedback) {
            optionStyle = 'border-orange-500/50 bg-orange-500/10'
          }
          if (showFeedback && option.correct) {
            optionStyle = 'border-green-500/50 bg-green-500/10'
          }
          if (showFeedback && isSelected && !option.correct) {
            optionStyle = 'border-red-500/50 bg-red-500/10'
          }

          return (
            <div key={option.id}>
              <button
                onClick={() => {
                  if (showFeedback) return
                  selectOption(question.id, option.id, question.multipleCorrect)
                }}
                disabled={showFeedback}
                className={`w-full flex items-center gap-3 px-4 py-3 bg-slate-800/50 border transition-colors text-left ${optionStyle} disabled:cursor-default`}
              >
                <div className={`w-5 h-5 shrink-0 border flex items-center justify-center ${
                  isSelected ? 'border-orange-400' : 'border-slate-600'
                } ${question.multipleCorrect ? '' : 'rounded-full'}`}>
                  {isSelected && <div className={`w-2.5 h-2.5 bg-orange-400 ${question.multipleCorrect ? '' : 'rounded-full'}`} />}
                </div>
                <span className="text-sm text-slate-200 flex-1">{option.text}</span>
                {showFeedback && option.correct && <CheckCircle className="w-4 h-4 text-green-400 shrink-0" />}
                {showFeedback && isSelected && !option.correct && <XCircle className="w-4 h-4 text-red-400 shrink-0" />}
              </button>
              {showFeedback && option.explanation && (isSelected || option.correct) && (
                <div className="ml-8 mt-1 px-3 py-2 text-xs text-slate-400 bg-slate-700/30">
                  {option.explanation}
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* Actions */}
      <div className="flex items-center justify-between pt-2">
        <button
          onClick={() => setCurrentIndex((i) => Math.max(0, i - 1))}
          disabled={currentIndex === 0}
          className="flex items-center gap-1.5 px-3 py-2 text-sm text-slate-400 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
        >
          <ChevronLeft className="w-4 h-4" />
          Back
        </button>

        <div className="flex items-center gap-2">
          {config.showImmediateFeedback && question.multipleCorrect && isAnswered && !isRevealed && (
            <button
              onClick={() => confirmMultiSelect(question.id)}
              className="px-4 py-2 text-sm bg-orange-600 hover:bg-orange-700 text-white transition-colors"
            >
              Confirm
            </button>
          )}

          {currentIndex < config.questions.length - 1 && (isRevealed || !config.showImmediateFeedback) && (
            <button
              onClick={() => setCurrentIndex((i) => i + 1)}
              className="flex items-center gap-1.5 px-4 py-2 text-sm text-white bg-slate-700 hover:bg-slate-600 transition-colors"
            >
              Next
              <ChevronRight className="w-4 h-4" />
            </button>
          )}
          {currentIndex === config.questions.length - 1 && allAnswered && config.showScoreAtEnd && (isRevealed || !config.showImmediateFeedback) && (
            <button
              onClick={() => setShowResults(true)}
              className="px-4 py-2 text-sm bg-orange-600 hover:bg-orange-700 text-white transition-colors"
            >
              See Results
            </button>
          )}
        </div>
      </div>

      {/* Reset */}
      {Object.keys(answers).length > 0 && (
        <div className="flex justify-center pt-2">
          <button
            onClick={handleReset}
            className="flex items-center gap-1.5 text-xs text-slate-600 hover:text-slate-400 transition-colors"
          >
            <RotateCcw className="w-3 h-3" />
            Reset quiz
          </button>
        </div>
      )}
    </div>
  )
}
