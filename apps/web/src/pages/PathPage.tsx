import { useEffect } from 'react'
import { useParams } from 'react-router-dom'
import { GraduationCap, Loader2, Clock, Play, SlidersHorizontal } from 'lucide-react'
import { usePath } from '../hooks/usePath'
import PathTrail from '../components/learn/PathTrail'
import PathLeversEditor from '../components/learn/PathLeversEditor'
import { useRegisterInteraction } from '../lib/InteractionContext'
import { LEARN_PATH_PAGE } from '../lib/pageInteractions'

export default function PathPage() {
  const { workspaceId } = useParams<{ workspaceId: string }>()
  const {
    data,
    loading,
    error,
    handleStartSession,
    editingLevers,
    focusOptions,
    draftGoal,
    draftMinutes,
    draftFocus,
    savingLevers,
    replanNeeded,
    handleOpenLevers,
    handleCloseLevers,
    handleToggleFocus,
    setDraftGoal,
    setDraftMinutes,
    handleSaveLevers,
  } = usePath(workspaceId!)

  const { updateState } = useRegisterInteraction('page:learn-path', LEARN_PATH_PAGE, {})

  useEffect(() => {
    if (data) {
      updateState({
        pathTitle: data.path.sequence?.title,
        completed: data.progress.completed,
        total: data.progress.total,
        remainingDays: data.progress.remainingDays,
      })
    }
  }, [data, updateState])

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-orange-400" />
      </div>
    )
  }

  if (error || !data) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-red-400 text-sm">{error || 'Path not found'}</p>
      </div>
    )
  }

  const { path, units, progress } = data
  const done = progress.completed >= progress.total && progress.total > 0

  return (
    <div className="min-h-screen py-12">
      <div className="max-w-2xl mx-auto px-6">
        <div className="flex items-center gap-3 mb-1">
          <GraduationCap className="w-7 h-7 text-orange-400" />
          <h1 className="text-xl font-bold text-white">{path.sequence?.title || 'Your learning path'}</h1>
        </div>

        <div className="flex items-center gap-4 mb-8 text-sm text-slate-400">
          <span>{progress.completed}/{progress.total} units complete</span>
          <span className="flex items-center gap-1.5">
            <Clock className="w-4 h-4" />
            {done ? 'Path complete' : `~${progress.remainingDays} day${progress.remainingDays !== 1 ? 's' : ''} at your pace`}
          </span>
          {path.focusAreas && path.focusAreas.length > 0 && (
            <span className="text-slate-500">Prioritizing: {path.focusAreas.join(', ')}</span>
          )}
          <button
            onClick={handleOpenLevers}
            className="ml-auto flex items-center gap-1.5 text-slate-400 hover:text-white transition-colors"
          >
            <SlidersHorizontal className="w-4 h-4" />
            Adjust path
          </button>
        </div>

        {editingLevers && (
          <PathLeversEditor
            goal={draftGoal}
            dailyMinutes={draftMinutes}
            focusAreas={draftFocus}
            focusOptions={focusOptions}
            saving={savingLevers}
            replanNeeded={replanNeeded}
            onGoalChange={setDraftGoal}
            onMinutesChange={setDraftMinutes}
            onToggleFocus={handleToggleFocus}
            onSave={handleSaveLevers}
            onCancel={handleCloseLevers}
          />
        )}

        {!done && (
          <button
            onClick={handleStartSession}
            className="w-full flex items-center justify-center gap-2 px-6 py-3 mb-10 bg-orange-600 hover:bg-orange-700 transition-colors font-medium text-white"
          >
            <Play className="w-5 h-5" />
            {progress.completed === 0 ? 'Start your first session' : 'Continue learning'}
          </button>
        )}

        {path.sequence && <PathTrail sequence={path.sequence} units={units} />}
      </div>
    </div>
  )
}
