import { Flag, CheckCircle, BookOpen, HelpCircle, Milestone } from 'lucide-react'
import type { PathSequence } from '@forge/shared'
import type { PathUnitSummary } from '../../lib/api'

interface PathTrailProps {
  sequence: PathSequence
  units: PathUnitSummary[]
}

// Start→Goal node trail grouped by milestone. Filled nodes are lesson/exercise
// units, hollow nodes are checkpoints; completed units glow orange.
export default function PathTrail({ sequence, units }: PathTrailProps) {
  const unitsByOrder = new Map(units.map((u) => [u.orderIndex, u]))
  let orderIndex = 0
  // First unit that isn't completed = the learner's current position
  const currentOrder = units.find((u) => u.status !== 'completed')?.orderIndex ?? -1

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2 text-sm text-slate-400">
        <Flag className="w-4 h-4 text-orange-400" />
        Start
      </div>

      {sequence.milestones.map((milestone, mi) => {
        const milestoneUnits = milestone.units.map(() => {
          const u = unitsByOrder.get(orderIndex)
          orderIndex++
          return u
        })
        const allDone = milestoneUnits.every((u) => u?.status === 'completed')

        return (
          <div key={mi} className="pl-2 border-l-2 border-slate-700 ml-2">
            <div className="flex items-center gap-2 mb-3">
              <Milestone className={`w-4 h-4 ${allDone ? 'text-orange-400' : 'text-slate-500'}`} />
              <div>
                <div className={`text-sm font-medium ${allDone ? 'text-orange-300' : 'text-white'}`}>
                  {milestone.title}
                </div>
                <div className="text-xs text-slate-500">{milestone.goal}</div>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2 pl-6 pb-2">
              {milestoneUnits.map((unit, ui) => {
                if (!unit) return null
                const isCheckpoint = unit.kind === 'checkpoint'
                const isCompleted = unit.status === 'completed'
                const isCurrent = unit.orderIndex === currentOrder
                const isLesson = unit.kind === 'lesson_card'

                return (
                  <div
                    key={ui}
                    title={`${unit.kind}${isCompleted ? ' (done)' : ''}`}
                    className={`w-8 h-8 flex items-center justify-center border transition-colors ${
                      isCheckpoint
                        ? isCompleted
                          ? 'border-orange-400 text-orange-400 rounded-full'
                          : 'border-slate-500 text-slate-500 rounded-full'
                        : isCompleted
                          ? 'bg-orange-500/20 border-orange-500 text-orange-300'
                          : isCurrent
                            ? 'bg-slate-700 border-orange-400 text-white animate-pulse'
                            : 'bg-slate-800 border-slate-600 text-slate-400'
                    }`}
                  >
                    {isCompleted ? (
                      <CheckCircle className="w-4 h-4" />
                    ) : isCheckpoint ? (
                      <Flag className="w-3.5 h-3.5" />
                    ) : isLesson ? (
                      <BookOpen className="w-4 h-4" />
                    ) : (
                      <HelpCircle className="w-4 h-4" />
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        )
      })}

      <div className="flex items-center gap-2 text-sm text-slate-400">
        <Flag className="w-4 h-4 text-emerald-400" />
        Goal
      </div>
    </div>
  )
}
