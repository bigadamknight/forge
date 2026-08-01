import { useState, useMemo } from 'react'
import { TextCursorInput } from 'lucide-react'
import type { ExerciseFillContent } from '@forge/shared'
import FeedbackPanel from './FeedbackPanel'

interface ExerciseClickFillProps {
  content: ExerciseFillContent
  onAnswer: (answer: unknown, correct: boolean) => void
  onNext: () => void
}

// Deterministic shuffle keyed to the content so re-renders don't reshuffle
function shuffled(words: string[], seed: string): string[] {
  const arr = [...words]
  let h = 0
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) | 0
  for (let i = arr.length - 1; i > 0; i--) {
    h = (h * 1103515245 + 12345) | 0
    const j = Math.abs(h) % (i + 1)
    ;[arr[i], arr[j]] = [arr[j], arr[i]]
  }
  return arr
}

export default function ExerciseClickFill({ content, onAnswer, onNext }: ExerciseClickFillProps) {
  // Picked word-bank indices, in blank order (blank 0 filled first)
  const [picked, setPicked] = useState<number[]>([])
  const [checked, setChecked] = useState(false)

  const wordBank = useMemo(
    () => shuffled(content.wordBank, content.sentence),
    [content.wordBank, content.sentence]
  )

  const blankCount = content.blanks.length
  const fills = picked.map((i) => wordBank[i])
  const allFilled = picked.length === blankCount
  const correct = checked && fills.every((f, i) => f === content.blanks[i])

  const handlePickWord = (bankIndex: number) => {
    if (checked || picked.length >= blankCount || picked.includes(bankIndex)) return
    setPicked((prev) => [...prev, bankIndex])
  }

  const handleClearBlank = (blankIndex: number) => {
    if (checked) return
    setPicked((prev) => prev.filter((_, i) => i !== blankIndex))
  }

  const handleCheck = () => {
    if (!allFilled || checked) return
    const isCorrect = fills.every((f, i) => f === content.blanks[i])
    setChecked(true)
    onAnswer({ fills }, isCorrect)
  }

  // Render sentence with {{N}} placeholders replaced by filled/empty slots
  const parts = content.sentence.split(/(\{\{\d+\}\})/g)

  return (
    <div className="bg-slate-800 border border-slate-700 p-6">
      <div className="flex items-center gap-2 mb-4">
        <TextCursorInput className="w-5 h-5 text-orange-400" />
        <span className="text-xs uppercase tracking-wide text-slate-500">Click &amp; fill</span>
      </div>

      <p className="text-white leading-loose mb-5">
        {parts.map((part, i) => {
          const match = part.match(/^\{\{(\d+)\}\}$/)
          if (!match) return <span key={i}>{part}</span>
          const blankIndex = parseInt(match[1], 10)
          const fill = fills[blankIndex]
          const isCorrectFill = checked && fill === content.blanks[blankIndex]
          return (
            <button
              key={i}
              onClick={() => handleClearBlank(blankIndex)}
              disabled={checked || fill === undefined}
              className={`inline-block min-w-[80px] mx-1 px-2 py-0.5 border-b-2 text-sm align-baseline transition-colors ${
                fill === undefined
                  ? 'border-slate-500 text-slate-600'
                  : checked
                    ? isCorrectFill
                      ? 'border-emerald-500 text-emerald-300'
                      : 'border-red-500 text-red-300 line-through'
                    : 'border-orange-500 text-orange-300'
              }`}
            >
              {fill ?? ' '}
            </button>
          )
        })}
      </p>

      <div className="mb-4">
        <div className="text-xs text-slate-500 mb-2">Click an option to fill the blanks in order:</div>
        <div className="flex flex-wrap gap-2">
          {wordBank.map((word, bankIndex) => {
            const used = picked.includes(bankIndex)
            return (
              <button
                key={bankIndex}
                onClick={() => handlePickWord(bankIndex)}
                disabled={checked || used}
                className={`px-3 py-1.5 text-sm border transition-colors ${
                  used
                    ? 'border-slate-700 bg-slate-900 text-slate-600'
                    : 'border-slate-600 bg-slate-900 text-slate-200 hover:border-orange-500'
                }`}
              >
                {word}
              </button>
            )
          })}
        </div>
      </div>

      {!checked && (
        <button
          onClick={handleCheck}
          disabled={!allFilled}
          className="w-full px-6 py-2.5 bg-orange-600 hover:bg-orange-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors font-medium text-white text-sm"
        >
          Check
        </button>
      )}

      {checked && (
        <FeedbackPanel correct={correct} explanation={content.explanation} onNext={onNext} />
      )}
    </div>
  )
}
