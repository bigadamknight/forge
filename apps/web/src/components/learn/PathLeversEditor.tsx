import { Loader2, SlidersHorizontal, X } from 'lucide-react'
import type { LearnerGoal } from '@forge/shared'
import { GoalPicker, TimePicker, FocusPicker } from './OnboardingPickers'

interface PathLeversEditorProps {
  goal: LearnerGoal
  dailyMinutes: number
  focusAreas: string[]
  focusOptions: string[]
  saving: boolean
  replanNeeded: boolean
  onGoalChange: (goal: LearnerGoal) => void
  onMinutesChange: (minutes: number) => void
  onToggleFocus: (area: string) => void
  onSave: () => void
  onCancel: () => void
}

export default function PathLeversEditor({
  goal,
  dailyMinutes,
  focusAreas,
  focusOptions,
  saving,
  replanNeeded,
  onGoalChange,
  onMinutesChange,
  onToggleFocus,
  onSave,
  onCancel,
}: PathLeversEditorProps) {
  return (
    <div className="bg-slate-800 border border-slate-700 p-6 mb-8">
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-2">
          <SlidersHorizontal className="w-4 h-4 text-orange-400" />
          <span className="text-sm font-medium text-white">Adjust your path</span>
        </div>
        <button
          onClick={onCancel}
          disabled={saving}
          aria-label="Close"
          className="text-slate-500 hover:text-white transition-colors disabled:opacity-40"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      <div className="space-y-5">
        <GoalPicker value={goal} onChange={onGoalChange} />
        <TimePicker value={dailyMinutes} onChange={onMinutesChange} />
        {focusOptions.length > 0 && (
          <FocusPicker options={focusOptions} selected={focusAreas} onToggle={onToggleFocus} />
        )}
      </div>

      {saving ? (
        <div className="mt-6 flex items-center justify-center gap-2 py-2.5 text-sm text-slate-400">
          <Loader2 className="w-4 h-4 animate-spin text-orange-400" />
          {replanNeeded ? 'Re-planning your path — this takes a minute...' : 'Saving...'}
        </div>
      ) : (
        <button
          onClick={onSave}
          className="mt-6 w-full px-6 py-2.5 bg-orange-600 hover:bg-orange-700 transition-colors font-medium text-white text-sm"
        >
          {replanNeeded ? 'Save & re-plan path' : 'Save'}
        </button>
      )}
      {replanNeeded && !saving && (
        <p className="mt-2 text-xs text-slate-500 text-center">
          Changing goal or focus rebuilds your path. Completed units and progress are kept.
        </p>
      )}
    </div>
  )
}
