import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { Plus, Flame, ArrowRight, Trash2 } from 'lucide-react'
import { getForges, deleteForge, type Forge } from '../lib/api'

const STATUS_COLORS: Record<string, string> = {
  draft: 'bg-slate-500/20 text-slate-400',
  planning: 'bg-blue-500/20 text-blue-400',
  interviewing: 'bg-purple-500/20 text-purple-400',
  processing: 'bg-amber-500/20 text-amber-400',
  generating: 'bg-cyan-500/20 text-cyan-400',
  complete: 'bg-green-500/20 text-green-400',
  archived: 'bg-slate-600/20 text-slate-500',
}

export default function HomePage() {
  const queryClient = useQueryClient()
  const [deleteTarget, setDeleteTarget] = useState<Forge | null>(null)
  const [deleteConfirmText, setDeleteConfirmText] = useState('')

  const { data: forges, isLoading } = useQuery({
    queryKey: ['forges'],
    queryFn: getForges,
  })

  const deleteMutation = useMutation({
    mutationFn: deleteForge,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['forges'] })
      setDeleteTarget(null)
      setDeleteConfirmText('')
    },
  })

  const handleDelete = () => {
    if (!deleteTarget || deleteConfirmText.toLowerCase() !== 'delete') return
    deleteMutation.mutate(deleteTarget.id)
  }

  return (
    <div className="px-8 py-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-12">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-orange-500/20 ">
            <Flame className="w-8 h-8 text-orange-400" />
          </div>
          <div>
            <h1 className="text-3xl font-bold">Forge</h1>
            <p className="text-slate-400 text-sm">Expert knowledge, forged into tools for everyone</p>
          </div>
        </div>
        <Link
          to="/forge/new"
          className="flex items-center gap-2 px-4 py-2 bg-orange-600 hover:bg-orange-700  transition-colors font-medium"
        >
          <Plus className="w-4 h-4" />
          New Forge
        </Link>
      </div>

      {/* Forge List */}
      {isLoading ? (
        <div className="text-slate-400 text-center py-12">Loading...</div>
      ) : !forges || forges.length === 0 ? (
        <div className="text-center py-16">
          <Flame className="w-16 h-16 mx-auto mb-4 text-slate-600" />
          <h2 className="text-xl font-medium text-slate-400 mb-2">No forges yet</h2>
          <p className="text-slate-500 mb-6">
            Create your first forge to capture expert knowledge and turn it into an interactive tool.
          </p>
          <Link
            to="/forge/new"
            className="inline-flex items-center gap-2 px-6 py-3 bg-orange-600 hover:bg-orange-700  transition-colors font-medium"
          >
            <Plus className="w-5 h-5" />
            Create Your First Forge
          </Link>
        </div>
      ) : (
        <div className="space-y-3">
          {forges.map((forge) => (
            <ForgeCard
              key={forge.id}
              forge={forge}
              onDelete={() => { setDeleteTarget(forge); setDeleteConfirmText('') }}
            />
          ))}
        </div>
      )}

      {/* Delete confirmation modal */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="bg-slate-800 border border-slate-700  p-6 max-w-md w-full mx-4 shadow-2xl">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10  bg-red-500/10 flex items-center justify-center shrink-0">
                <Trash2 className="w-5 h-5 text-red-400" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-white">Delete Forge</h3>
                <p className="text-sm text-slate-400">This action cannot be undone</p>
              </div>
            </div>
            <p className="text-sm text-slate-300 mb-1">
              This will permanently delete <span className="font-medium text-white">{deleteTarget.title}</span> including all interview data, extractions, and generated tools.
            </p>
            <p className="text-xs text-slate-500 mb-4">
              {deleteTarget.expertName} &middot; {deleteTarget.domain}
            </p>
            <div className="mb-4">
              <label className="text-xs text-slate-500 block mb-1.5">
                Type <span className="text-red-400 font-mono font-medium">delete</span> to confirm
              </label>
              <input
                type="text"
                value={deleteConfirmText}
                onChange={(e) => setDeleteConfirmText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && deleteConfirmText.toLowerCase() === 'delete') {
                    handleDelete()
                  }
                }}
                placeholder="delete"
                autoFocus
                className="w-full px-3 py-2 bg-slate-900 border border-slate-600  text-sm text-white placeholder-slate-600 focus:border-red-500/50 focus:outline-none transition-colors font-mono"
              />
            </div>
            <div className="flex items-center gap-2 justify-end">
              <button
                onClick={() => setDeleteTarget(null)}
                className="px-4 py-2 text-sm text-slate-400 hover:text-white bg-slate-700/50 hover:bg-slate-700  transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                disabled={deleteConfirmText.toLowerCase() !== 'delete' || deleteMutation.isPending}
                className="px-4 py-2 text-sm text-white bg-red-600 hover:bg-red-700 disabled:opacity-30 disabled:cursor-not-allowed  transition-colors"
              >
                {deleteMutation.isPending ? 'Deleting...' : 'Delete Forever'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function ForgeCard({ forge, onDelete }: { forge: Forge; onDelete: () => void }) {
  const statusStyle = STATUS_COLORS[forge.status] || STATUS_COLORS.draft

  const getLink = () => {
    if (forge.status === 'complete') return `/forge/${forge.id}/tool`
    if (forge.status === 'interviewing') return `/forge/${forge.id}/interview`
    return `/forge/${forge.id}/interview`
  }

  return (
    <div className="bg-slate-800  p-4 hover:bg-slate-750 transition-colors group">
      <div className="flex items-center gap-4">
        <div className="p-2 bg-orange-500/10 ">
          <Flame className="w-5 h-5 text-orange-400" />
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <h3 className="font-medium truncate">{forge.title}</h3>
            <span className={`px-2 py-0.5 text-xs${statusStyle}`}>
              {forge.status}
            </span>
          </div>
          <p className="text-sm text-slate-400">
            {forge.expertName} &middot; {forge.domain}
            {forge.targetAudience && ` &middot; For: ${forge.targetAudience}`}
          </p>
        </div>

        <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
          <button
            onClick={(e) => {
              e.preventDefault()
              onDelete()
            }}
            className="p-2 text-slate-500 hover:text-red-400 transition-colors"
          >
            <Trash2 className="w-4 h-4" />
          </button>
          <Link
            to={getLink()}
            className="flex items-center gap-1 px-3 py-1.5 bg-orange-600 hover:bg-orange-700text-sm transition-colors"
          >
            Continue
            <ArrowRight className="w-3 h-3" />
          </Link>
        </div>
      </div>
    </div>
  )
}
