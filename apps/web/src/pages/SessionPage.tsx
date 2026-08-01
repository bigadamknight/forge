import { useEffect } from 'react'
import { useParams } from 'react-router-dom'
import { Loader2, PartyPopper, ArrowLeft } from 'lucide-react'
import { useSession } from '../hooks/useSession'
import LessonCard from '../components/learn/LessonCard'
import ExerciseMC from '../components/learn/ExerciseMC'
import ExerciseClickFill from '../components/learn/ExerciseClickFill'
import ExerciseOrderSteps from '../components/learn/ExerciseOrderSteps'
import CheckpointCard from '../components/learn/CheckpointCard'
import CheckpointReview from '../components/learn/CheckpointReview'
import { useRegisterInteraction } from '../lib/InteractionContext'
import { LEARN_SESSION_PAGE } from '../lib/pageInteractions'

export default function SessionPage() {
  const { workspaceId } = useParams<{ workspaceId: string }>()
  const {
    units,
    currentUnit,
    currentIndex,
    loading,
    error,
    sessionDone,
    handleContinue,
    handleAttempt,
    handleGradedAttempt,
    handleCheckpointFinish,
    handleNextAfterFeedback,
    handleBackToPath,
  } = useSession(workspaceId!)

  const { updateState } = useRegisterInteraction('page:learn-session', LEARN_SESSION_PAGE, {})

  useEffect(() => {
    if (currentUnit) {
      const content = currentUnit.content
      updateState({
        unitKind: currentUnit.kind,
        unitConcept: content && 'concept' in content ? content.concept : undefined,
        unitIndex: currentIndex,
        unitCount: units.length,
      })
    }
  }, [currentUnit, currentIndex, units.length, updateState])

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-3">
        <Loader2 className="w-8 h-8 animate-spin text-orange-400" />
        <p className="text-sm text-slate-400">Preparing your session...</p>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-red-400 text-sm">{error}</p>
      </div>
    )
  }

  if (sessionDone || !currentUnit) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center max-w-sm px-6">
          <PartyPopper className="w-10 h-10 text-orange-400 mx-auto mb-4" />
          <h1 className="text-xl font-bold text-white mb-2">Session complete</h1>
          <p className="text-sm text-slate-400 mb-6">
            {units.length > 0
              ? `You worked through ${units.length} unit${units.length !== 1 ? 's' : ''}. Come back tomorrow to keep your pace.`
              : "You're all caught up — nothing new to learn right now."}
          </p>
          <button
            onClick={handleBackToPath}
            className="px-8 py-3 bg-orange-600 hover:bg-orange-700 transition-colors font-medium text-white"
          >
            Back to your path
          </button>
        </div>
      </div>
    )
  }

  const content = currentUnit.content

  return (
    <div className="min-h-screen py-12">
      <div className="max-w-xl mx-auto px-6">
        <div className="flex items-center justify-between mb-6">
          <button
            onClick={handleBackToPath}
            className="flex items-center gap-1.5 text-sm text-slate-400 hover:text-white transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Path
          </button>
          <div className="flex gap-1.5">
            {units.map((_, i) => (
              <div
                key={i}
                className={`w-6 h-1 ${i < currentIndex ? 'bg-orange-500' : i === currentIndex ? 'bg-orange-500/50' : 'bg-slate-700'}`}
              />
            ))}
          </div>
        </div>

        {currentUnit.kind === 'checkpoint' ? (
          content && content.kind === 'checkpoint_review' ? (
            <CheckpointReview content={content} onFinish={handleCheckpointFinish} />
          ) : (
            <CheckpointCard onContinue={handleContinue} />
          )
        ) : !content ? (
          <div className="bg-slate-800 border border-slate-700 p-8 text-center">
            <Loader2 className="w-6 h-6 animate-spin text-orange-400 mx-auto mb-3" />
            <p className="text-sm text-slate-400">This unit is still being prepared — skip ahead and it'll be ready next time.</p>
            <button
              onClick={handleContinue}
              className="mt-4 px-6 py-2.5 bg-slate-700 hover:bg-slate-600 transition-colors text-white text-sm"
            >
              Skip for now
            </button>
          </div>
        ) : content.kind === 'lesson_card' ? (
          <LessonCard content={content} onContinue={handleContinue} />
        ) : content.kind === 'exercise_mc' ? (
          <ExerciseMC content={content} onAnswer={handleAttempt} onNext={handleNextAfterFeedback} />
        ) : content.kind === 'exercise_fill' ? (
          <ExerciseClickFill content={content} onAnswer={handleAttempt} onNext={handleNextAfterFeedback} />
        ) : content.kind === 'exercise_order' ? (
          <ExerciseOrderSteps content={content} onAnswer={handleGradedAttempt} onNext={handleNextAfterFeedback} />
        ) : (
          <CheckpointCard onContinue={handleContinue} />
        )}
      </div>
    </div>
  )
}
