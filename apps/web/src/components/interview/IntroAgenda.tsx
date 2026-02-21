import { CheckCircle2, Circle } from 'lucide-react'
import type { IntroFields } from '../../lib/api'

interface IntroAgendaProps {
  fields: IntroFields
}

const AGENDA_ITEMS = [
  { key: 'expertName' as const, label: 'Your Name' },
  { key: 'domain' as const, label: 'Area of Expertise' },
  { key: 'targetAudience' as const, label: 'Target Audience' },
]

export default function IntroAgenda({ fields }: IntroAgendaProps) {
  const captured = AGENDA_ITEMS.filter((item) => !!fields[item.key]).length
  const progress = Math.round((captured / AGENDA_ITEMS.length) * 100)

  return (
    <div className="bg-slate-800/50 p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-medium text-slate-300">Getting Started</h3>
        <span className="text-sm text-orange-400 font-medium">{captured}/{AGENDA_ITEMS.length}</span>
      </div>

      <div className="w-full h-1.5 bg-slate-700 mb-4 overflow-hidden">
        <div
          className="h-full bg-gradient-to-r from-orange-500 to-amber-500 transition-all duration-700 ease-out"
          style={{ width: `${progress}%` }}
        />
      </div>

      <div className="space-y-2">
        {AGENDA_ITEMS.map((item) => {
          const value = fields[item.key]
          const isCaptured = !!value

          return (
            <div
              key={item.key}
              className={`flex items-start gap-3 px-3 py-2 transition-colors ${
                isCaptured ? 'opacity-100' : 'opacity-50'
              }`}
            >
              <div className="mt-0.5">
                {isCaptured ? (
                  <CheckCircle2 className="w-4 h-4 text-green-400" />
                ) : (
                  <Circle className="w-4 h-4 text-slate-500" />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <span className={`text-sm font-medium ${isCaptured ? 'text-white' : 'text-slate-400'}`}>
                  {item.label}
                </span>
                {isCaptured && (
                  <div className="text-xs text-slate-400 mt-0.5 truncate">
                    {value}
                  </div>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
