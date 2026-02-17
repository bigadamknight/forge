import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { Mic, Loader2, FileText, Brain, Lightbulb, ArrowRight, CheckCircle2, Clock, RefreshCw } from 'lucide-react'
import { getInterviewState, suggestFollowUps, type Forge } from '../../lib/api'
import ToolUpdateReview from './ToolUpdateReview'

interface InterviewRound {
  round: number
  topic: string
  status: string
  startedAt?: string
  completedAt?: string
}

interface InterviewSummaryPanelProps {
  forgeId: string
  forge?: Forge | null
  interviewRounds?: InterviewRound[]
}

export default function InterviewSummaryPanel({ forgeId, forge, interviewRounds }: InterviewSummaryPanelProps) {
  const navigate = useNavigate()
  const [updateRound, setUpdateRound] = useState<number | null>(null)

  const rounds = interviewRounds ?? [{ round: 1, topic: 'Initial interview', status: forge?.status === 'complete' ? 'completed' : 'interviewing' }]

  const { data, isLoading } = useQuery({
    queryKey: ['interview', forgeId],
    queryFn: () => getInterviewState(forgeId),
  })

  const { data: suggestionsData, isLoading: suggestionsLoading } = useQuery({
    queryKey: ['follow-up-suggestions', forgeId],
    queryFn: () => suggestFollowUps(forgeId),
    enabled: !!forge,
  })

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 text-slate-500 text-sm py-8">
        <Loader2 className="w-4 h-4 animate-spin" />
        Loading interview data...
      </div>
    )
  }

  const sections = data?.sections ?? []
  const extractions = data?.extractions ?? []

  return (
    <div>
      <div className="mb-6">
        <h2 className="text-xl font-bold text-white mb-1">Interview History</h2>
        <p className="text-slate-400 text-sm">
          Knowledge captured across {rounds.length} interview{rounds.length !== 1 ? 's' : ''}.
        </p>
      </div>

      {/* Interview rounds */}
      <div className="space-y-3 mb-8">
        {rounds.map((r) => {
          const roundSections = sections.filter((s) => (s.round ?? 1) === r.round)
          const roundExtractions = extractions.filter((e) =>
            roundSections.some((s) => s.id === e.sectionId)
          )
          const totalQuestions = roundSections.reduce((sum, s) => sum + (s.questions?.length || 0), 0)

          return (
            <div
              key={r.round}
              className="bg-slate-800/50 border border-slate-700/50 p-4"
            >
              <div className="flex items-start justify-between mb-2">
                <div className="flex items-center gap-2">
                  {r.status === 'completed' ? (
                    <CheckCircle2 className="w-4 h-4 text-green-400 shrink-0" />
                  ) : (
                    <Clock className="w-4 h-4 text-orange-400 shrink-0" />
                  )}
                  <span className="text-sm font-medium text-white">
                    {r.round === 1 ? 'Initial Interview' : r.topic}
                  </span>
                </div>
                <span className={`text-xs px-2 py-0.5 ${
                  r.status === 'completed'
                    ? 'bg-green-500/10 text-green-400'
                    : 'bg-orange-500/10 text-orange-400'
                }`}>
                  {r.status === 'completed' ? 'Complete' : 'In Progress'}
                </span>
              </div>

              <div className="flex items-center gap-4 text-xs text-slate-500">
                <span className="flex items-center gap-1">
                  <FileText className="w-3 h-3" />
                  {roundSections.length} sections
                </span>
                <span className="flex items-center gap-1">
                  <Mic className="w-3 h-3" />
                  {totalQuestions} questions
                </span>
                <span className="flex items-center gap-1">
                  <Brain className="w-3 h-3" />
                  {roundExtractions.length} extractions
                </span>
              </div>

              {r.round > 1 && r.status === 'completed' && (
                <button
                  onClick={() => setUpdateRound(r.round)}
                  className="mt-3 flex items-center gap-1.5 text-xs text-orange-400 hover:text-orange-300 transition-colors"
                >
                  <RefreshCw className="w-3 h-3" />
                  Update Tool with New Knowledge
                </button>
              )}
              {r.status === 'interviewing' && (
                <button
                  onClick={() => navigate(`/forge/${forgeId}/interview`)}
                  className="mt-3 flex items-center gap-1.5 text-xs text-orange-400 hover:text-orange-300 transition-colors"
                >
                  <ArrowRight className="w-3 h-3" />
                  Resume Interview
                </button>
              )}
            </div>
          )
        })}
      </div>

      {/* Follow-up suggestions */}
      {forge && (
        <div>
          <h3 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-3">
            Suggested Follow-ups
          </h3>
          {suggestionsLoading ? (
            <div className="flex items-center gap-2 text-slate-500 text-sm py-4">
              <Loader2 className="w-4 h-4 animate-spin" />
              Generating suggestions...
            </div>
          ) : suggestionsData?.suggestions?.length ? (
            <div className="space-y-2">
              {suggestionsData.suggestions.map((suggestion, i) => (
                <button
                  key={i}
                  onClick={() => navigate(`/forge/${forgeId}/interview?topic=${encodeURIComponent(suggestion.topic)}`)}
                  className="w-full flex items-center gap-3 px-4 py-3 bg-slate-800/30 border border-slate-700/30 hover:border-orange-500/30 hover:bg-slate-800/50 text-left text-sm transition-colors group"
                >
                  <Lightbulb className="w-4 h-4 text-yellow-500/50 group-hover:text-yellow-500 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="text-slate-300 group-hover:text-slate-200">{suggestion.topic}</div>
                    <div className="text-xs text-slate-500 mt-0.5">{suggestion.reason}</div>
                  </div>
                  <ArrowRight className="w-4 h-4 text-slate-600 group-hover:text-orange-400 transition-colors shrink-0" />
                </button>
              ))}
            </div>
          ) : (
            <p className="text-sm text-slate-500">No follow-up suggestions available yet.</p>
          )}
        </div>
      )}

      {/* Tool update review modal */}
      {updateRound !== null && (
        <ToolUpdateReview
          forgeId={forgeId}
          round={updateRound}
          onClose={() => setUpdateRound(null)}
          onApplied={() => setUpdateRound(null)}
        />
      )}
    </div>
  )
}
