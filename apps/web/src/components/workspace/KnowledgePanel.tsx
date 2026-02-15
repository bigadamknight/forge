import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Loader2, Pencil, Check, X, Database } from 'lucide-react'
import { getExtractions, updateExtraction, deleteExtraction } from '../../lib/api'
import { EXTRACTION_TYPES, EXTRACTION_TYPE_KEYS } from '../../lib/extractionTypes'

interface KnowledgePanelProps {
  forgeId: string
}

export default function KnowledgePanel({ forgeId }: KnowledgePanelProps) {
  const queryClient = useQueryClient()
  const [typeFilter, setTypeFilter] = useState<string | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editContent, setEditContent] = useState('')
  const [editType, setEditType] = useState('')
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [savedId, setSavedId] = useState<string | null>(null)

  const { data: items = [], isLoading } = useQuery({
    queryKey: ['extractions', forgeId],
    queryFn: () => getExtractions(forgeId),
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: { content?: string; type?: string } }) =>
      updateExtraction(forgeId, id, data),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['extractions', forgeId] })
      setSavedId(variables.id)
      setEditingId(null)
      setTimeout(() => setSavedId(null), 2000)
    },
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteExtraction(forgeId, id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['extractions', forgeId] })
      setDeletingId(null)
    },
  })

  const filtered = typeFilter ? items.filter((e) => e.type === typeFilter) : items

  const startEditing = (item: { id: string; content: string; type: string }) => {
    setEditingId(item.id)
    setEditContent(item.content)
    setEditType(item.type)
  }

  const saveEdit = () => {
    if (!editingId || !editContent.trim()) return
    const orig = items.find((e) => e.id === editingId)
    if (!orig) return
    const data: { content?: string; type?: string } = {}
    if (editContent !== orig.content) data.content = editContent
    if (editType !== orig.type) data.type = editType
    if (Object.keys(data).length === 0) { setEditingId(null); return }
    updateMutation.mutate({ id: editingId, data })
  }

  const typeCounts: Record<string, number> = {}
  for (const item of items) {
    typeCounts[item.type] = (typeCounts[item.type] || 0) + 1
  }

  return (
    <div>
      <div className="mb-6">
        <div className="flex items-center gap-2 mb-1">
          <Database className="w-5 h-5 text-slate-400" />
          <h2 className="text-xl font-bold text-white">Knowledge</h2>
          <span className="text-sm text-slate-500">({items.length})</span>
        </div>
        <p className="text-slate-400 text-sm">
          Extracted knowledge from interviews. Edit or remove items to refine your tool's expertise.
        </p>
      </div>

      {items.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mb-5">
          <button
            onClick={() => setTypeFilter(null)}
            className={`px-2.5 py-1 text-xs transition-colors ${
              typeFilter === null
                ? 'bg-orange-600 text-white'
                : 'bg-slate-800 text-slate-400 hover:text-white border border-slate-700/50'
            }`}
          >
            All ({items.length})
          </button>
          {EXTRACTION_TYPE_KEYS.filter((t) => typeCounts[t]).map((t) => {
            const meta = EXTRACTION_TYPES[t]
            return (
              <button
                key={t}
                onClick={() => setTypeFilter(typeFilter === t ? null : t)}
                className={`px-2.5 py-1 text-xs transition-colors ${
                  typeFilter === t
                    ? 'bg-orange-600 text-white'
                    : `${meta.color} hover:opacity-80 border border-transparent`
                }`}
              >
                {meta.label} ({typeCounts[t]})
              </button>
            )
          })}
        </div>
      )}

      {isLoading && (
        <div className="flex items-center gap-2 text-slate-500 text-sm py-4">
          <Loader2 className="w-4 h-4 animate-spin" />
          Loading extractions...
        </div>
      )}

      {filtered.length > 0 && (
        <div className="space-y-2">
          {filtered.map((item) => (
            <div key={item.id}>
              {editingId === item.id ? (
                <div className="bg-slate-800/50 border border-orange-500/30 p-4 space-y-3">
                  <div>
                    <label className="text-xs text-slate-500 mb-1 block">Type</label>
                    <select
                      value={editType}
                      onChange={(e) => setEditType(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-700/50 border border-slate-600/50 text-sm text-white focus:border-orange-500 focus:outline-none transition-colors"
                    >
                      {EXTRACTION_TYPE_KEYS.map((t) => (
                        <option key={t} value={t}>{EXTRACTION_TYPES[t].label}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="text-xs text-slate-500 mb-1 block">Content</label>
                    <textarea
                      value={editContent}
                      onChange={(e) => setEditContent(e.target.value)}
                      rows={4}
                      autoFocus
                      className="w-full px-3 py-2 bg-slate-700/50 border border-slate-600/50 text-sm text-white focus:border-orange-500 focus:outline-none transition-colors resize-none"
                    />
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={saveEdit}
                      disabled={!editContent.trim() || updateMutation.isPending}
                      className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-orange-600 hover:bg-orange-700 disabled:opacity-30 disabled:cursor-not-allowed text-white transition-colors"
                    >
                      {updateMutation.isPending ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <Check className="w-3.5 h-3.5" />
                      )}
                      Save
                    </button>
                    <button
                      onClick={() => setEditingId(null)}
                      className="px-3 py-1.5 text-xs text-slate-400 hover:text-white transition-colors"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <div className={`border transition-colors ${
                  savedId === item.id
                    ? 'bg-green-500/5 border-green-500/30'
                    : 'bg-slate-800/30 border-slate-700/30'
                }`}>
                  <div className="flex items-start gap-3 px-4 py-3 group">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1.5">
                        <span className={`text-[10px] font-medium px-2 py-0.5 ${EXTRACTION_TYPES[item.type]?.color || 'bg-slate-700 text-slate-300'}`}>
                          {EXTRACTION_TYPES[item.type]?.label || item.type}
                        </span>
                        {item.confidence != null && (
                          <span className="text-[10px] text-slate-600">
                            {Math.round(item.confidence * 100)}%
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-slate-200 line-clamp-2">{item.content}</p>
                      {item.tags && item.tags.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-1.5">
                          {item.tags.map((tag) => (
                            <span key={tag} className="text-[10px] px-1.5 py-0.5 bg-slate-700/50 text-slate-500">
                              {tag}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                    {savedId === item.id && (
                      <span className="text-xs text-green-400 shrink-0">Saved</span>
                    )}
                    <button
                      onClick={() => startEditing(item)}
                      className="text-slate-600 hover:text-orange-400 transition-colors shrink-0 opacity-0 group-hover:opacity-100"
                    >
                      <Pencil className="w-3.5 h-3.5" />
                    </button>
                    {deletingId === item.id ? (
                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          onClick={() => deleteMutation.mutate(item.id)}
                          disabled={deleteMutation.isPending}
                          className="text-xs px-2 py-0.5 text-red-400 hover:text-red-300 bg-red-500/10 hover:bg-red-500/20 transition-colors"
                        >
                          Delete
                        </button>
                        <button
                          onClick={() => setDeletingId(null)}
                          className="text-xs px-2 py-0.5 text-slate-500 hover:text-slate-300 transition-colors"
                        >
                          Cancel
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => setDeletingId(item.id)}
                        className="text-slate-600 hover:text-red-400 transition-colors shrink-0 opacity-0 group-hover:opacity-100"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {!isLoading && items.length === 0 && (
        <div className="text-center py-12">
          <Database className="w-10 h-10 mx-auto mb-3 text-slate-700" />
          <p className="text-slate-500 text-sm">No knowledge extracted yet.</p>
          <p className="text-slate-600 text-xs mt-1">Complete an interview to build your knowledge base.</p>
        </div>
      )}
    </div>
  )
}
