import { CheckCircle2, Circle, User, Briefcase, Lightbulb } from 'lucide-react'
import type { ExpertProfile } from '../../lib/api'
import { BASICS, BACKGROUND, PERSPECTIVE, TOTAL_FIELDS, isCaptured, formatValue, countCaptured, type FieldDef } from '../../lib/profileFields'

interface ProfileCardProps {
  profile: ExpertProfile
}

function FieldRow({ field, profile }: { field: FieldDef; profile: ExpertProfile }) {
  const value = profile[field.key]
  const captured = isCaptured(value)

  return (
    <div className={`flex items-start gap-3 px-3 py-1.5 transition-colors ${captured ? 'opacity-100' : 'opacity-40'}`}>
      <div className="mt-0.5 shrink-0">
        {captured ? (
          <CheckCircle2 className="w-3.5 h-3.5 text-green-400" />
        ) : (
          <Circle className="w-3.5 h-3.5 text-slate-500" />
        )}
      </div>
      <div className="flex-1 min-w-0">
        <span className={`text-xs font-medium ${captured ? 'text-white' : 'text-slate-500'}`}>
          {field.label}
        </span>
        {captured && (
          <div className="text-xs text-slate-400 mt-0.5 line-clamp-2">
            {formatValue(value)}
          </div>
        )}
      </div>
    </div>
  )
}

function Section({ title, icon: Icon, fields, profile }: {
  title: string
  icon: React.ComponentType<{ className?: string }>
  fields: FieldDef[]
  profile: ExpertProfile
}) {
  const sectionCaptured = fields.filter((f) => isCaptured(profile[f.key])).length

  return (
    <div className="mb-3 last:mb-0">
      <div className="flex items-center gap-2 mb-1 px-3">
        <Icon className="w-3.5 h-3.5 text-slate-500" />
        <span className="text-xs font-medium text-slate-500 uppercase tracking-wider">{title}</span>
        <span className="text-xs text-slate-600 ml-auto">{sectionCaptured}/{fields.length}</span>
      </div>
      <div className="space-y-0.5">
        {fields.map((field) => (
          <FieldRow key={field.key} field={field} profile={profile} />
        ))}
      </div>
    </div>
  )
}

export default function ProfileCard({ profile }: ProfileCardProps) {
  const captured = countCaptured(profile)
  const progress = Math.round((captured / TOTAL_FIELDS) * 100)

  return (
    <div className="bg-slate-800/50 p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-medium text-slate-300">Expert Profile</h3>
        <span className="text-sm text-orange-400 font-medium">{captured}/{TOTAL_FIELDS}</span>
      </div>

      <div className="w-full h-1.5 bg-slate-700 mb-4 overflow-hidden">
        <div
          className="h-full bg-gradient-to-r from-orange-500 to-amber-500 transition-all duration-700 ease-out"
          style={{ width: `${progress}%` }}
        />
      </div>

      <Section title="Basics" icon={User} fields={BASICS} profile={profile} />
      <Section title="Background" icon={Briefcase} fields={BACKGROUND} profile={profile} />
      <Section title="Perspective" icon={Lightbulb} fields={PERSPECTIVE} profile={profile} />
    </div>
  )
}
