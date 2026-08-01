import { useState } from 'react'
import { Flag, CheckCircle2, XCircle } from 'lucide-react'
import type { CheckpointReviewContent } from '@forge/shared'
import ExerciseMC from './ExerciseMC'
import ExerciseClickFill from './ExerciseClickFill'
import ExerciseOrderSteps from './ExerciseOrderSteps'

export interface CheckpointResult {
  rightCount: number
  total: number
  details: Array<{ kind: string; correct: 'yes' | 'partial' | 'no' }>
}

interface CheckpointReviewProps {
  content: CheckpointReviewContent
  onFinish: (result: CheckpointResult) => void
}

// Walks the re-served review exercises one at a time, collecting results
// locally; the parent posts a single attempt for the checkpoint unit.
export default function CheckpointReview({ content, onFinish }: CheckpointReviewProps) {
  const [stage, setStage] = useState<'intro' | 'exercise' | 'summary'>('intro')
  const [exerciseIndex, setExerciseIndex] = useState(0)
  const [details, setDetails] = useState<CheckpointResult['details']>([])

  const total = content.exercises.length
  const rightCount = details.filter((d) => d.correct === 'yes').length

  const handleRecord = (kind: string) => (_answer: unknown, correct: boolean | 'yes' | 'partial' | 'no') => {
    const graded = typeof correct === 'boolean' ? (correct ? 'yes' : 'no') : correct
    setDetails((prev) => [...prev, { kind, correct: graded }])
  }

  const handleAdvance = () => {
    if (exerciseIndex + 1 >= total) {
      setStage('summary')
    } else {
      setExerciseIndex((i) => i + 1)
    }
  }

  if (stage === 'intro') {
    return (
      <div className="bg-slate-800 border border-orange-500/40 p-8 text-center">
        <Flag className="w-8 h-8 text-orange-400 mx-auto mb-3" />
        <h2 className="text-lg font-bold text-white mb-2">Checkpoint</h2>
        <p className="text-sm text-slate-400 mb-6">{content.intro}</p>
        <button
          onClick={() => setStage('exercise')}
          className="px-8 py-2.5 bg-orange-600 hover:bg-orange-700 transition-colors font-medium text-white text-sm"
        >
          Start review ({total} question{total !== 1 ? 's' : ''})
        </button>
      </div>
    )
  }

  if (stage === 'exercise') {
    const exercise = content.exercises[exerciseIndex]
    return (
      <div>
        <div className="text-xs text-slate-500 mb-3">
          Review {exerciseIndex + 1} of {total}
        </div>
        {exercise.kind === 'exercise_mc' ? (
          <ExerciseMC content={exercise} onAnswer={handleRecord('exercise_mc')} onNext={handleAdvance} />
        ) : exercise.kind === 'exercise_fill' ? (
          <ExerciseClickFill content={exercise} onAnswer={handleRecord('exercise_fill')} onNext={handleAdvance} />
        ) : (
          <ExerciseOrderSteps content={exercise} onAnswer={handleRecord('exercise_order')} onNext={handleAdvance} />
        )}
      </div>
    )
  }

  const passed = rightCount * 2 >= total
  return (
    <div className="bg-slate-800 border border-slate-700 p-8 text-center">
      {passed ? (
        <CheckCircle2 className="w-8 h-8 text-emerald-400 mx-auto mb-3" />
      ) : (
        <XCircle className="w-8 h-8 text-orange-400 mx-auto mb-3" />
      )}
      <h2 className="text-lg font-bold text-white mb-2">
        {rightCount}/{total} right
      </h2>
      <p className="text-sm text-slate-400 mb-6">
        {passed
          ? 'Solid — this knowledge is sticking. Anything you missed will come back around.'
          : "No problem — the ones you missed will be back for another pass soon. That's how it sticks."}
      </p>
      <button
        onClick={() => onFinish({ rightCount, total, details })}
        className="px-8 py-2.5 bg-orange-600 hover:bg-orange-700 transition-colors font-medium text-white text-sm"
      >
        Continue
      </button>
    </div>
  )
}
