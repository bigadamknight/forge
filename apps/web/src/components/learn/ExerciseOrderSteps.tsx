import { useState, useMemo } from 'react'
import { ListOrdered, ChevronUp, ChevronDown } from 'lucide-react'
import type { ExerciseOrderContent } from '@forge/shared'
import FeedbackPanel from './FeedbackPanel'

export type OrderCorrectness = 'yes' | 'partial' | 'no'

interface ExerciseOrderStepsProps {
  content: ExerciseOrderContent
  onAnswer: (answer: unknown, correct: OrderCorrectness) => void
  onNext: () => void
}

// Deterministic shuffle keyed to the content so re-renders don't reshuffle
function shuffled(items: number[], seed: string): number[] {
  const arr = [...items]
  let h = 0
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) | 0
  for (let i = arr.length - 1; i > 0; i--) {
    h = (h * 1103515245 + 12345) | 0
    const j = Math.abs(h) % (i + 1)
    ;[arr[i], arr[j]] = [arr[j], arr[i]]
  }
  // Ensure the shuffle didn't accidentally produce the correct order
  if (arr.every((v, i) => v === i) && arr.length > 1) {
    ;[arr[0], arr[1]] = [arr[1], arr[0]]
  }
  return arr
}

export default function ExerciseOrderSteps({ content, onAnswer, onNext }: ExerciseOrderStepsProps) {
  // order[i] = index into content.steps shown at position i
  const initial = useMemo(
    () => shuffled(content.steps.map((_, i) => i), content.prompt),
    [content.steps, content.prompt]
  )
  const [order, setOrder] = useState<number[]>(initial)
  const [checked, setChecked] = useState(false)

  const rightCount = order.filter((stepIndex, position) => stepIndex === position).length
  const correctness: OrderCorrectness =
    rightCount === order.length ? 'yes' : rightCount > 0 ? 'partial' : 'no'

  const handleMove = (position: number, delta: -1 | 1) => {
    if (checked) return
    const target = position + delta
    if (target < 0 || target >= order.length) return
    setOrder((prev) => {
      const next = [...prev]
      ;[next[position], next[target]] = [next[target], next[position]]
      return next
    })
  }

  const handleCheck = () => {
    if (checked) return
    setChecked(true)
    const placed = order.map((stepIndex) => content.steps[stepIndex])
    const right = order.filter((stepIndex, position) => stepIndex === position).length
    onAnswer(
      { order: placed },
      right === order.length ? 'yes' : right > 0 ? 'partial' : 'no'
    )
  }

  return (
    <div className="bg-slate-800 border border-slate-700 p-6">
      <div className="flex items-center gap-2 mb-4">
        <ListOrdered className="w-5 h-5 text-orange-400" />
        <span className="text-xs uppercase tracking-wide text-slate-500">Order the steps</span>
      </div>
      <p className="text-white font-medium mb-1">{content.prompt}</p>
      <p className="text-xs text-slate-500 mb-4">Use the arrows to put the steps in the right order</p>

      <div className="space-y-2 mb-4">
        {order.map((stepIndex, position) => {
          const rightPlace = checked && stepIndex === position
          const wrongPlace = checked && stepIndex !== position
          return (
            <div
              key={stepIndex}
              className={`flex items-center gap-3 px-4 py-3 border text-sm transition-colors ${
                rightPlace
                  ? 'border-emerald-500 bg-emerald-500/10 text-emerald-200'
                  : wrongPlace
                    ? 'border-red-500 bg-red-500/10 text-red-200'
                    : 'border-slate-700 bg-slate-900 text-slate-300'
              }`}
            >
              <span className={`w-6 h-6 flex-shrink-0 flex items-center justify-center text-xs border ${
                checked ? 'border-current' : 'border-slate-600 text-slate-400'
              }`}>
                {position + 1}
              </span>
              <span className="flex-1">{content.steps[stepIndex]}</span>
              {!checked && (
                <span className="flex flex-col gap-0.5">
                  <button
                    onClick={() => handleMove(position, -1)}
                    disabled={position === 0}
                    aria-label="Move up"
                    className="text-slate-500 hover:text-orange-400 disabled:opacity-30 disabled:hover:text-slate-500 transition-colors"
                  >
                    <ChevronUp className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => handleMove(position, 1)}
                    disabled={position === order.length - 1}
                    aria-label="Move down"
                    className="text-slate-500 hover:text-orange-400 disabled:opacity-30 disabled:hover:text-slate-500 transition-colors"
                  >
                    <ChevronDown className="w-4 h-4" />
                  </button>
                </span>
              )}
            </div>
          )
        })}
      </div>

      {!checked && (
        <button
          onClick={handleCheck}
          className="w-full px-6 py-2.5 bg-orange-600 hover:bg-orange-700 transition-colors font-medium text-white text-sm"
        >
          Check
        </button>
      )}

      {checked && (
        <FeedbackPanel
          correct={correctness === 'yes'}
          explanation={
            correctness === 'yes'
              ? content.explanation
              : `${rightCount}/${order.length} steps in the right place. ${content.explanation}`
          }
          onNext={onNext}
        />
      )}
    </div>
  )
}
