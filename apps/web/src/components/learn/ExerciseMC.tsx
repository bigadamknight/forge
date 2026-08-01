import { useState } from 'react'
import { HelpCircle } from 'lucide-react'
import type { ExerciseMCContent } from '@forge/shared'
import FeedbackPanel from './FeedbackPanel'

interface ExerciseMCProps {
  content: ExerciseMCContent
  onAnswer: (answer: unknown, correct: boolean) => void
  onNext: () => void
}

export default function ExerciseMC({ content, onAnswer, onNext }: ExerciseMCProps) {
  const [selectedId, setSelectedId] = useState<string | null>(null)

  const selected = content.options.find((o) => o.id === selectedId) ?? null
  const answered = selected !== null

  const handleSelect = (optionId: string) => {
    if (answered) return
    const option = content.options.find((o) => o.id === optionId)
    if (!option) return
    setSelectedId(optionId)
    onAnswer({ optionId }, option.correct)
  }

  return (
    <div className="bg-slate-800 border border-slate-700 p-6">
      <div className="flex items-center gap-2 mb-4">
        <HelpCircle className="w-5 h-5 text-orange-400" />
        <span className="text-xs uppercase tracking-wide text-slate-500">Multiple choice</span>
      </div>
      <p className="text-white font-medium mb-4">{content.question}</p>

      <div className="space-y-2">
        {content.options.map((option) => {
          const isSelected = option.id === selectedId
          const showCorrect = answered && option.correct
          const showWrong = answered && isSelected && !option.correct
          return (
            <button
              key={option.id}
              onClick={() => handleSelect(option.id)}
              disabled={answered}
              className={`w-full text-left px-4 py-3 border text-sm transition-colors ${
                showCorrect
                  ? 'border-emerald-500 bg-emerald-500/10 text-emerald-200'
                  : showWrong
                    ? 'border-red-500 bg-red-500/10 text-red-200'
                    : isSelected
                      ? 'border-orange-500 bg-orange-500/10 text-white'
                      : 'border-slate-700 bg-slate-900 text-slate-300 hover:border-slate-500 disabled:hover:border-slate-700'
              }`}
            >
              {option.text}
            </button>
          )
        })}
      </div>

      {answered && selected && (
        <FeedbackPanel correct={selected.correct} explanation={selected.explanation} onNext={onNext} />
      )}
    </div>
  )
}
