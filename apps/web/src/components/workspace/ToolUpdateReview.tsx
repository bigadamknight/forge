import { useState, useEffect } from 'react'
import { Loader2, Check, Plus, X } from 'lucide-react'
import { integrateKnowledge, applyToolUpdates } from '../../lib/api'

interface Proposal {
  type: 'update' | 'new'
  componentId?: string
  componentType?: string
  title: string
  description: string
  preview: Record<string, unknown>
}

interface ToolUpdateReviewProps {
  forgeId: string
  round: number
  onClose: () => void
  onApplied: () => void
}

export default function ToolUpdateReview({ forgeId, round, onClose, onApplied }: ToolUpdateReviewProps) {
  const [proposals, setProposals] = useState<Proposal[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selected, setSelected] = useState<Record<number, boolean>>({})
  const [applying, setApplying] = useState(false)

  useEffect(() => {
    integrateKnowledge(forgeId, round)
      .then((result) => {
        setProposals(result.proposals)
        setSelected(Object.fromEntries(result.proposals.map((_, i) => [i, true])))
      })
      .catch((err) => {
        setError(err instanceof Error ? err.message : 'Failed to generate proposals')
      })
      .finally(() => setLoading(false))
  }, [forgeId, round])

  const handleApply = async () => {
    setApplying(true)
    try {
      const selectedProposals = proposals
        .filter((_, i) => selected[i])
      await applyToolUpdates(forgeId, selectedProposals as unknown as Array<Record<string, unknown>>)
      onApplied()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to apply updates')
      setApplying(false)
    }
  }

  const selectedCount = Object.values(selected).filter(Boolean).length

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="bg-slate-800 border border-slate-700 p-6 max-w-lg w-full mx-4 shadow-2xl max-h-[80vh] flex flex-col">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-white">Update Tool</h3>
          <button
            onClick={onClose}
            className="p-1 text-slate-400 hover:text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {loading ? (
          <div className="flex items-center gap-3 text-slate-400 py-8 justify-center">
            <Loader2 className="w-5 h-5 animate-spin" />
            Analysing new knowledge...
          </div>
        ) : error ? (
          <div className="text-center py-8">
            <p className="text-red-400 text-sm mb-3">{error}</p>
            <button
              onClick={onClose}
              className="text-sm text-slate-400 hover:text-white transition-colors"
            >
              Close
            </button>
          </div>
        ) : proposals.length === 0 ? (
          <div className="text-center py-8">
            <p className="text-slate-400 text-sm mb-3">No updates suggested for this round.</p>
            <button
              onClick={onClose}
              className="text-sm text-slate-400 hover:text-white transition-colors"
            >
              Close
            </button>
          </div>
        ) : (
          <>
            <p className="text-sm text-slate-400 mb-4">
              Select which updates to apply from the follow-up interview.
            </p>

            <div className="flex-1 overflow-y-auto space-y-2 mb-4">
              {proposals.map((proposal, i) => (
                <label
                  key={i}
                  className={`flex items-start gap-3 p-3 border transition-colors cursor-pointer ${
                    selected[i]
                      ? 'bg-slate-700/50 border-orange-500/30'
                      : 'bg-slate-800/50 border-slate-700/30'
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={selected[i] ?? false}
                    onChange={(e) => setSelected((prev) => ({ ...prev, [i]: e.target.checked }))}
                    className="mt-0.5 accent-orange-500"
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className={`text-xs px-1.5 py-0.5 ${
                        proposal.type === 'new'
                          ? 'bg-green-500/10 text-green-400'
                          : 'bg-blue-500/10 text-blue-400'
                      }`}>
                        {proposal.type === 'new' ? (
                          <span className="flex items-center gap-1"><Plus className="w-3 h-3" />New</span>
                        ) : (
                          <span className="flex items-center gap-1"><Check className="w-3 h-3" />Update</span>
                        )}
                      </span>
                      <span className="text-sm font-medium text-white truncate">{proposal.title}</span>
                    </div>
                    <p className="text-xs text-slate-400">{proposal.description}</p>
                    {proposal.componentId && (
                      <p className="text-xs text-slate-600 mt-1">Component: {proposal.componentId}</p>
                    )}
                  </div>
                </label>
              ))}
            </div>

            <div className="flex items-center gap-2 justify-end pt-2 border-t border-slate-700/50">
              <button
                onClick={onClose}
                className="px-4 py-2 text-sm text-slate-400 hover:text-white bg-slate-700/50 hover:bg-slate-700 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleApply}
                disabled={selectedCount === 0 || applying}
                className="px-4 py-2 text-sm text-white bg-orange-600 hover:bg-orange-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
              >
                {applying ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : null}
                Apply {selectedCount} Update{selectedCount !== 1 ? 's' : ''}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
