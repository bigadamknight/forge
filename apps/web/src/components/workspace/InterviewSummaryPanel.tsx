import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { Mic, Loader2, Lightbulb, ArrowRight, CheckCircle2, Clock, RefreshCw, Plus } from 'lucide-react'
import { suggestFollowUps, createInterview, planInterviewStream, type Forge, type PlanInterviewEvent } from '../../lib/api'
import ToolUpdateReview from './ToolUpdateReview'

interface InterviewSummaryPanelProps {
  workspaceId: string
  interviews?: Forge[]
}

export default function InterviewSummaryPanel({ workspaceId, interviews = [] }: InterviewSummaryPanelProps) {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [updateForgeId, setUpdateForgeId] = useState<string | null>(null)
  const [newTopic, setNewTopic] = useState('')
  const [creatingInterview, setCreatingInterview] = useState(false)

  // Use the first interview for suggestions
  const primaryInterview = interviews[0]

  const handleCreateInterview = async (topic?: string) => {
    if (creatingInterview) return
    setCreatingInterview(true)
    try {
      const interview = await createInterview(workspaceId, topic || undefined)
      queryClient.invalidateQueries({ queryKey: ['workspace', workspaceId] })

      // If interview was created in planning status (has expert info), plan it before navigating
      if (interview.status === 'planning') {
        planInterviewStream(
          interview.id,
          (event: PlanInterviewEvent) => {
            if (event.type === 'complete') {
              navigate(`/workspace/${workspaceId}/interview/${interview.id}`)
            } else if (event.type === 'error') {
              setCreatingInterview(false)
            }
          },
          () => {},
          () => { setCreatingInterview(false) }
        )
      } else {
        // Draft status — needs intro first
        navigate(`/workspace/${workspaceId}/interview/${interview.id}`)
      }
    } catch {
      setCreatingInterview(false)
    }
  }

  const { data: suggestionsData, isLoading: suggestionsLoading } = useQuery({
    queryKey: ['follow-up-suggestions', primaryInterview?.id],
    queryFn: () => suggestFollowUps(primaryInterview!.id),
    enabled: !!primaryInterview,
  })

  return (
    <div>
      <div className="mb-6">
        <h2 className="text-xl font-bold text-white mb-1">Interviews</h2>
        <p className="text-slate-400 text-sm">
          Knowledge captured across {interviews.length} interview{interviews.length !== 1 ? 's' : ''}.
        </p>
      </div>

      {/* Interviews */}
      <div className="space-y-3 mb-8">
        {interviews.map((interview) => {
          const isComplete = interview.status === 'complete'

          return (
            <div
              key={interview.id}
              className="bg-slate-800/50 border border-slate-700/50 p-4"
            >
              <div className="flex items-start justify-between mb-2">
                <div className="flex items-center gap-2">
                  {isComplete ? (
                    <CheckCircle2 className="w-4 h-4 text-green-400 shrink-0" />
                  ) : (
                    <Clock className="w-4 h-4 text-orange-400 shrink-0" />
                  )}
                  <span className="text-sm font-medium text-white">
                    {interview.title}
                  </span>
                </div>
                <span className={`text-xs px-2 py-0.5 ${
                  isComplete
                    ? 'bg-green-500/10 text-green-400'
                    : 'bg-orange-500/10 text-orange-400'
                }`}>
                  {isComplete ? 'Complete' : 'In Progress'}
                </span>
              </div>

              <div className="flex items-center gap-4 text-xs text-slate-500">
                <span className="flex items-center gap-1">
                  <Mic className="w-3 h-3" />
                  {interview.domain}
                </span>
              </div>

              {isComplete && interviews.length > 1 && (
                <button
                  onClick={() => setUpdateForgeId(interview.id)}
                  className="mt-3 flex items-center gap-1.5 text-xs text-orange-400 hover:text-orange-300 transition-colors"
                >
                  <RefreshCw className="w-3 h-3" />
                  Update Tool with New Knowledge
                </button>
              )}
              {!isComplete && (
                <button
                  onClick={() => navigate(`/workspace/${workspaceId}/interview/${interview.id}`)}
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

      {/* New interview */}
      <div className="mb-8">
        <h3 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-3">
          New Interview
        </h3>
        <div className="flex items-center gap-2">
          <input
            type="text"
            value={newTopic}
            onChange={(e) => setNewTopic(e.target.value)}
            placeholder="What should this interview cover? e.g. Advanced techniques, Common mistakes"
            onKeyDown={(e) => e.key === 'Enter' && handleCreateInterview(newTopic.trim())}
            className="flex-1 px-3 py-2 bg-slate-800/50 border border-slate-700/50 text-sm text-white placeholder-slate-600 focus:border-orange-500 focus:outline-none transition-colors"
          />
          <button
            onClick={() => handleCreateInterview(newTopic.trim())}
            disabled={creatingInterview}
            className="flex items-center gap-1.5 px-4 py-2 bg-orange-600 hover:bg-orange-700 disabled:opacity-40 text-sm font-medium text-white transition-colors shrink-0"
          >
            {creatingInterview ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Planning...
              </>
            ) : (
              <>
                <Plus className="w-4 h-4" />
                Start Interview
              </>
            )}
          </button>
        </div>
      </div>

      {/* Follow-up suggestions */}
      {primaryInterview && (
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
                  onClick={() => handleCreateInterview(suggestion.topic)}
                  disabled={creatingInterview}
                  className="w-full flex items-center gap-3 px-4 py-3 bg-slate-800/30 border border-slate-700/30 hover:border-orange-500/30 hover:bg-slate-800/50 text-left text-sm transition-colors group disabled:opacity-50"
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
      {updateForgeId !== null && (
        <ToolUpdateReview
          workspaceId={workspaceId}
          forgeId={updateForgeId}
          onClose={() => setUpdateForgeId(null)}
          onApplied={() => setUpdateForgeId(null)}
        />
      )}
    </div>
  )
}
