import { User, Briefcase, Lightbulb, Pencil } from 'lucide-react'
import type { ExpertProfile } from '../../lib/api'
import { BASICS, BACKGROUND, PERSPECTIVE, isCaptured, formatValue, type FieldDef } from '../../lib/profileFields'

interface ProfileSummaryCardProps {
  profile: ExpertProfile
  onEdit?: () => void
}

function FieldRow({ field, profile }: { field: FieldDef; profile: ExpertProfile }) {
  const value = profile[field.key]
  if (!isCaptured(value)) return null

  return (
    <div className="flex items-start gap-3 py-2">
      <span className="text-sm text-slate-500 w-40 shrink-0">{field.label}</span>
      <span className="text-sm text-slate-200">{formatValue(value)}</span>
    </div>
  )
}

function Section({ title, icon: Icon, fields, profile }: {
  title: string
  icon: React.ComponentType<{ className?: string }>
  fields: FieldDef[]
  profile: ExpertProfile
}) {
  const hasAny = fields.some((f) => isCaptured(profile[f.key]))
  if (!hasAny) return null

  return (
    <div className="mb-6 last:mb-0">
      <div className="flex items-center gap-2 mb-3 pb-2 border-b border-slate-700/50">
        <Icon className="w-4 h-4 text-slate-500" />
        <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">{title}</span>
      </div>
      <div className="space-y-0.5">
        {fields.map((field) => (
          <FieldRow key={field.key} field={field} profile={profile} />
        ))}
      </div>
    </div>
  )
}

export default function ProfileSummaryCard({ profile, onEdit }: ProfileSummaryCardProps) {
  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-bold text-white">Expert Profile</h2>
        {onEdit && (
          <button
            onClick={onEdit}
            className="flex items-center gap-1.5 text-sm text-slate-400 hover:text-orange-400 transition-colors"
          >
            <Pencil className="w-3.5 h-3.5" />
            Edit Profile
          </button>
        )}
      </div>

      <div className="bg-slate-800/50 border border-slate-700/50 p-6">
        <Section title="Basics" icon={User} fields={BASICS} profile={profile} />
        <Section title="Background" icon={Briefcase} fields={BACKGROUND} profile={profile} />
        <Section title="Perspective" icon={Lightbulb} fields={PERSPECTIVE} profile={profile} />
      </div>
    </div>
  )
}
