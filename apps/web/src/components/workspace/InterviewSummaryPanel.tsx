import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { Mic, ExternalLink, Loader2, FileText, Brain, Lightbulb } from 'lucide-react'
import { getInterviewState } from '../../lib/api'

interface InterviewSummaryPanelProps {
  forgeId: string
}

export default function InterviewSummaryPanel({ forgeId }: InterviewSummaryPanelProps) {
  const { data, isLoading } = useQuery({
    queryKey: ['interview', forgeId],
    queryFn: () => getInterviewState(forgeId),
  })

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 text-slate-500 text-sm py-8">
        <Loader2 className="w-4 h-4 animate-spin" />
        Loading interview data...
      </div>
    )
  }

  if (!data) {
    return (
      <div className="text-center py-12">
        <Mic className="w-10 h-10 mx-auto mb-3 text-slate-600" />
        <p className="text-slate-400 text-sm">No interview data available.</p>
        <Link
          to={`/forge/${forgeId}/interview`}
          className="inline-flex items-center gap-1.5 mt-3 text-sm text-orange-400 hover:text-orange-300 transition-colors"
        >
          Start Interview
          <ExternalLink className="w-3.5 h-3.5" />
        </Link>
      </div>
    )
  }

  const { sections, extractions } = data
  const totalQuestions = sections.reduce((sum, s) => sum + (s.questions?.length || 0), 0)
  const answeredQuestions = sections.reduce(
    (sum, s) => sum + (s.questions?.filter((q) => q.status === 'answered' || q.messages?.length > 0)?.length || 0),
    0
  )
  const isComplete = answeredQuestions >= totalQuestions && totalQuestions > 0

  return (
    <div>
      <div className="mb-6">
        <h2 className="text-xl font-bold text-white mb-1">Interview #1</h2>
        <p className="text-slate-400 text-sm">
          Summary of the expert interview used to build this tool.
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3 mb-6">
        <div className="bg-slate-800/50 border border-slate-700/50 p-4">
          <div className="flex items-center gap-2 mb-2">
            <FileText className="w-4 h-4 text-slate-500" />
            <span className="text-xs text-slate-500 uppercase tracking-wider">Sections</span>
          </div>
          <span className="text-2xl font-bold text-white">{sections.length}</span>
        </div>
        <div className="bg-slate-800/50 border border-slate-700/50 p-4">
          <div className="flex items-center gap-2 mb-2">
            <Mic className="w-4 h-4 text-slate-500" />
            <span className="text-xs text-slate-500 uppercase tracking-wider">Answers</span>
          </div>
          <span className="text-2xl font-bold text-white">{answeredQuestions}/{totalQuestions}</span>
        </div>
        <div className="bg-slate-800/50 border border-slate-700/50 p-4">
          <div className="flex items-center gap-2 mb-2">
            <Brain className="w-4 h-4 text-slate-500" />
            <span className="text-xs text-slate-500 uppercase tracking-wider">Extractions</span>
          </div>
          <span className="text-2xl font-bold text-white">{extractions.length}</span>
        </div>
      </div>

      {/* Status */}
      <div className={`px-4 py-3 mb-6 border ${isComplete ? 'bg-green-500/5 border-green-500/20' : 'bg-orange-500/5 border-orange-500/20'}`}>
        <span className={`text-sm ${isComplete ? 'text-green-400' : 'text-orange-400'}`}>
          {isComplete ? 'Interview complete' : `Interview in progress - ${answeredQuestions} of ${totalQuestions} questions answered`}
        </span>
      </div>

      {/* Link to full interview */}
      <Link
        to={`/forge/${forgeId}/interview`}
        className="inline-flex items-center gap-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 border border-slate-700/50 text-sm text-slate-300 hover:text-white transition-colors"
      >
        <ExternalLink className="w-4 h-4" />
        Open Full Interview
      </Link>

      {/* Follow-up suggestions */}
      <div className="mt-8">
        <h3 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-3">
          Suggested Follow-ups
        </h3>
        <div className="space-y-2">
          {[
            'Deep dive on edge cases and exceptions',
            'Common mistakes and how to avoid them',
            'Advanced techniques for experienced users',
          ].map((suggestion, i) => (
            <div
              key={i}
              className="flex items-center gap-3 px-4 py-3 bg-slate-800/30 border border-slate-700/30 text-sm text-slate-400"
            >
              <Lightbulb className="w-4 h-4 text-yellow-500/50 shrink-0" />
              {suggestion}
              <span className="ml-auto text-xs text-slate-600">Coming soon</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
