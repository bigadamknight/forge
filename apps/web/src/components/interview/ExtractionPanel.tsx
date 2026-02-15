import { Brain, Lightbulb, AlertTriangle, BookOpen, Target, BarChart3, Hash, Beaker, Info } from 'lucide-react'
import type { Extraction } from '../../lib/api'

interface ExtractionPanelProps {
  extractions: Extraction[]
  liveExtractions: Extraction[]
}

const TYPE_CONFIG: Record<string, { color: string, bg: string, icon: typeof Brain }> = {
  fact: { color: 'text-blue-400', bg: 'bg-blue-500/10 border-blue-500/20', icon: BookOpen },
  procedure: { color: 'text-purple-400', bg: 'bg-purple-500/10 border-purple-500/20', icon: Target },
  decision_rule: { color: 'text-cyan-400', bg: 'bg-cyan-500/10 border-cyan-500/20', icon: Brain },
  warning: { color: 'text-red-400', bg: 'bg-red-500/10 border-red-500/20', icon: AlertTriangle },
  tip: { color: 'text-green-400', bg: 'bg-green-500/10 border-green-500/20', icon: Lightbulb },
  metric: { color: 'text-amber-400', bg: 'bg-amber-500/10 border-amber-500/20', icon: BarChart3 },
  definition: { color: 'text-indigo-400', bg: 'bg-indigo-500/10 border-indigo-500/20', icon: Hash },
  example: { color: 'text-teal-400', bg: 'bg-teal-500/10 border-teal-500/20', icon: Beaker },
  context: { color: 'text-slate-400', bg: 'bg-slate-500/10 border-slate-500/20', icon: Info },
}

export default function ExtractionPanel({ extractions, liveExtractions }: ExtractionPanelProps) {
  const unique = [...new Map(
    [...extractions, ...liveExtractions].map((e) => [e.id, e])
  ).values()]

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between px-4 py-3 border-b border-slate-700/50">
        <div className="flex items-center gap-2">
          <Brain className="w-4 h-4 text-orange-400" />
          <h3 className="text-sm font-medium">Knowledge Distilled</h3>
        </div>
        <span className="text-xs text-slate-500 px-2 py-0.5 bg-slate-800 ">
          {unique.length} items
        </span>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-2">
        {unique.length === 0 ? (
          <div className="text-center py-8 text-slate-500">
            <Brain className="w-8 h-8 mx-auto mb-2 opacity-30" />
            <p className="text-sm">Knowledge will be distilled here as you share your expertise</p>
          </div>
        ) : (
          unique.map((extraction, i) => (
            <ExtractionCard
              key={extraction.id}
              extraction={extraction}
              isNew={i >= extractions.length}
            />
          ))
        )}
      </div>
    </div>
  )
}

function confidenceBadge(confidence: number): string {
  if (confidence >= 0.8) return 'bg-green-500/20 text-green-400'
  if (confidence >= 0.5) return 'bg-amber-500/20 text-amber-400'
  return 'bg-slate-500/20 text-slate-400'
}

function ExtractionCard({ extraction, isNew }: { extraction: Extraction, isNew: boolean }) {
  const config = TYPE_CONFIG[extraction.type] || TYPE_CONFIG.context
  const Icon = config.icon

  return (
    <div
      className={`border  p-3 transition-all duration-500 ${config.bg} ${
        isNew ? 'animate-slide-in' : ''
      }`}
    >
      <div className="flex items-start gap-2">
        <Icon className={`w-4 h-4 mt-0.5 shrink-0 ${config.color}`} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className={`text-xs font-medium ${config.color}`}>
              {extraction.type.replace('_', ' ')}
            </span>
            {extraction.confidence !== null && (
              <span className={`text-xs px-1.5 py-0.5 ${confidenceBadge(extraction.confidence)}`}>
                {Math.round(extraction.confidence * 100)}%
              </span>
            )}
          </div>
          <p className="text-sm text-slate-200 leading-relaxed">
            {extraction.content}
          </p>
          {extraction.tags && extraction.tags.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-2">
              {extraction.tags.map((tag) => (
                <span
                  key={tag}
                  className="text-xs px-1.5 py-0.5 bg-slate-700/50 text-slate-400"
                >
                  {tag}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
