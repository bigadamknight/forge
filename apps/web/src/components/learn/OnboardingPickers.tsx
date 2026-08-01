import { Compass, Layers, Wrench } from 'lucide-react'
import type { LearnerGoal } from '@forge/shared'

const GOALS: Array<{ value: LearnerGoal; label: string; description: string; icon: typeof Compass }> = [
  { value: 'basics', label: 'Understand the basics', description: 'Core facts, definitions, and warnings', icon: Compass },
  { value: 'deep', label: 'Go deep', description: 'Everything the expert shared, nuances included', icon: Layers },
  { value: 'practical', label: 'Apply practically', description: 'Procedures and decisions, practice-heavy', icon: Wrench },
]

interface GoalPickerProps {
  value: LearnerGoal
  onChange: (goal: LearnerGoal) => void
}

export function GoalPicker({ value, onChange }: GoalPickerProps) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
      {GOALS.map(({ value: v, label, description, icon: Icon }) => (
        <button
          key={v}
          type="button"
          onClick={() => onChange(v)}
          className={`text-left p-4 border transition-colors ${
            value === v
              ? 'border-orange-500 bg-orange-500/10'
              : 'border-slate-700 bg-slate-800 hover:border-slate-500'
          }`}
        >
          <Icon className={`w-5 h-5 mb-2 ${value === v ? 'text-orange-400' : 'text-slate-400'}`} />
          <div className="font-medium text-white text-sm">{label}</div>
          <div className="text-xs text-slate-400 mt-1">{description}</div>
        </button>
      ))}
    </div>
  )
}

const TIMES = [
  { minutes: 5, label: 'Casual', detail: '5 min/day' },
  { minutes: 15, label: 'Regular', detail: '15 min/day' },
  { minutes: 30, label: 'Intensive', detail: '30+ min/day' },
]

interface TimePickerProps {
  value: number
  onChange: (minutes: number) => void
}

export function TimePicker({ value, onChange }: TimePickerProps) {
  return (
    <div className="grid grid-cols-3 gap-3">
      {TIMES.map(({ minutes, label, detail }) => (
        <button
          key={minutes}
          type="button"
          onClick={() => onChange(minutes)}
          className={`p-4 border text-center transition-colors ${
            value === minutes
              ? 'border-orange-500 bg-orange-500/10'
              : 'border-slate-700 bg-slate-800 hover:border-slate-500'
          }`}
        >
          <div className="font-medium text-white text-sm">{label}</div>
          <div className="text-xs text-slate-400 mt-1">{detail}</div>
        </button>
      ))}
    </div>
  )
}

interface FocusPickerProps {
  options: string[]
  selected: string[]
  onToggle: (area: string) => void
}

export function FocusPicker({ options, selected, onToggle }: FocusPickerProps) {
  if (options.length === 0) return null
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((area) => {
        const isSelected = selected.includes(area)
        return (
          <button
            key={area}
            type="button"
            onClick={() => onToggle(area)}
            className={`px-3 py-1.5 text-sm border transition-colors ${
              isSelected
                ? 'border-orange-500 bg-orange-500/10 text-orange-300'
                : 'border-slate-700 bg-slate-800 text-slate-300 hover:border-slate-500'
            }`}
          >
            {area}
          </button>
        )
      })}
    </div>
  )
}
