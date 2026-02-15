import { CheckCircle2, Circle, PlayCircle } from 'lucide-react'
import type { InterviewState } from '../../lib/api'

function SectionStatusIcon({ isCompleted, isActive }: { isCompleted: boolean; isActive: boolean }) {
  if (isCompleted) return <CheckCircle2 className="w-4 h-4 text-green-400" />
  if (isActive) return <PlayCircle className="w-4 h-4 text-orange-400" />
  return <Circle className="w-4 h-4 text-slate-500" />
}

interface AgendaTrackerProps {
  sections: InterviewState['sections']
}

export default function AgendaTracker({ sections }: AgendaTrackerProps) {
  const totalQuestions = sections.reduce((acc, s) => acc + s.questions.length, 0)
  const answeredQuestions = sections.reduce(
    (acc, s) => acc + s.questions.filter((q) => q.status === 'answered').length,
    0
  )
  const progress = totalQuestions > 0 ? Math.round((answeredQuestions / totalQuestions) * 100) : 0

  return (
    <div className="bg-slate-800/50  p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-medium text-slate-300">Interview Progress</h3>
        <span className="text-sm text-orange-400 font-medium">{progress}%</span>
      </div>

      <div className="w-full h-1.5 bg-slate-700  mb-4 overflow-hidden">
        <div
          className="h-full bg-gradient-to-r from-orange-500 to-amber-500  transition-all duration-700 ease-out"
          style={{ width: `${progress}%` }}
        />
      </div>

      <div className="space-y-2">
        {sections.map((section) => {
          const sectionAnswered = section.questions.filter((q) => q.status === 'answered').length
          const sectionTotal = section.questions.length
          const isActive = section.status === 'active'
          const isCompleted = section.status === 'completed'

          return (
            <div
              key={section.id}
              className={`flex items-start gap-3 px-3 py-2  transition-colors ${
                isActive
                  ? 'bg-orange-500/10 border border-orange-500/20'
                  : isCompleted ? 'opacity-60' : 'opacity-40'
              }`}
            >
              <div className="mt-0.5">
                <SectionStatusIcon isCompleted={isCompleted} isActive={isActive} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between">
                  <span className={`text-sm font-medium truncate ${isActive ? 'text-white' : 'text-slate-400'}`}>
                    {section.title}
                  </span>
                  <span className="text-xs text-slate-500 ml-2 shrink-0">
                    {sectionAnswered}/{sectionTotal}
                  </span>
                </div>
                {isActive && (
                  <div className="mt-1.5 space-y-1">
                    {section.questions.map((q) => {
                      const textStyle = q.status === 'active'
                        ? 'text-orange-300'
                        : q.status === 'answered'
                          ? 'text-slate-500 line-through'
                          : 'text-slate-600'
                      const dotStyle = q.status === 'active'
                        ? 'bg-orange-400'
                        : q.status === 'answered'
                          ? 'bg-green-500/50'
                          : 'bg-slate-600'
                      return (
                        <div
                          key={q.id}
                          className={`flex items-center gap-2 text-xs ${textStyle}`}
                        >
                          <div className={`w-1.5 h-1.5  ${dotStyle}`} />
                          <span className="truncate">{q.text}</span>
                        </div>
                      )
                    })}
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
