import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Plus, Trash2, X } from 'lucide-react'
import { STANDARD_EXTRACTION_TYPES, type CustomExtractionType } from '../../lib/extractionTypes'
import { updateWorkspaceExtractionTypes } from '../../lib/api'

interface ExtractionTypesManagerProps {
  workspaceId: string
  customTypes: CustomExtractionType[]
  onClose: () => void
}

const COLOR_PRESETS = [
  { label: 'Pink', value: 'bg-pink-500/15 text-pink-400' },
  { label: 'Rose', value: 'bg-rose-500/15 text-rose-400' },
  { label: 'Fuchsia', value: 'bg-fuchsia-500/15 text-fuchsia-400' },
  { label: 'Violet', value: 'bg-violet-500/15 text-violet-400' },
  { label: 'Sky', value: 'bg-sky-500/15 text-sky-400' },
  { label: 'Emerald', value: 'bg-emerald-500/15 text-emerald-400' },
  { label: 'Lime', value: 'bg-lime-500/15 text-lime-400' },
  { label: 'Yellow', value: 'bg-yellow-500/15 text-yellow-400' },
]

function slugify(label: string): string {
  return label
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_|_$/g, '')
}

export default function ExtractionTypesManager({ workspaceId, customTypes, onClose }: ExtractionTypesManagerProps) {
  const queryClient = useQueryClient()
  const [types, setTypes] = useState<CustomExtractionType[]>(customTypes)
  const [adding, setAdding] = useState(false)
  const [newLabel, setNewLabel] = useState('')
  const [newDescription, setNewDescription] = useState('')
  const [newColor, setNewColor] = useState(COLOR_PRESETS[0].value)

  const saveMutation = useMutation({
    mutationFn: (updated: CustomExtractionType[]) =>
      updateWorkspaceExtractionTypes(workspaceId, updated),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['workspace', workspaceId] })
    },
  })

  const handleAdd = () => {
    if (!newLabel.trim()) return
    const key = slugify(newLabel)
    if (!key) return
    // Check for duplicate key
    const allKeys = new Set([
      ...STANDARD_EXTRACTION_TYPES.map((t) => t.key),
      ...types.map((t) => t.key),
    ])
    if (allKeys.has(key)) return

    const updated = [...types, { key, label: newLabel.trim(), description: newDescription.trim(), color: newColor }]
    setTypes(updated)
    saveMutation.mutate(updated)
    setNewLabel('')
    setNewDescription('')
    setNewColor(COLOR_PRESETS[0].value)
    setAdding(false)
  }

  const handleDelete = (key: string) => {
    const updated = types.filter((t) => t.key !== key)
    setTypes(updated)
    saveMutation.mutate(updated)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
      <div className="bg-slate-900 border border-slate-700/50 w-full max-w-2xl max-h-[80vh] overflow-y-auto">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-700/50">
          <h2 className="text-lg font-semibold text-white">Extraction Types</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-white transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="px-6 py-4">
          <h3 className="text-sm font-medium text-slate-300 mb-3">Standard Types</h3>
          <div className="grid grid-cols-3 gap-2 mb-6">
            {STANDARD_EXTRACTION_TYPES.map((t) => (
              <div key={t.key} className="bg-slate-800/50 border border-slate-700/30 p-3">
                <div className="flex items-center gap-2 mb-1">
                  <span className={`text-[10px] font-medium px-2 py-0.5 ${t.color}`}>
                    {t.label}
                  </span>
                </div>
                <p className="text-xs text-slate-500 leading-relaxed">{t.description}</p>
              </div>
            ))}
          </div>

          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-medium text-slate-300">Custom Types</h3>
            {!adding && (
              <button
                onClick={() => setAdding(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-orange-600 hover:bg-orange-700 text-white transition-colors"
              >
                <Plus className="w-3.5 h-3.5" />
                Add Custom Type
              </button>
            )}
          </div>

          {types.length === 0 && !adding && (
            <p className="text-sm text-slate-500 py-4 text-center">
              No custom extraction types yet. Add one to capture domain-specific knowledge.
            </p>
          )}

          {types.map((t) => (
            <div key={t.key} className="flex items-center gap-3 bg-slate-800/30 border border-slate-700/30 px-4 py-3 mb-2">
              <span className={`text-[10px] font-medium px-2 py-0.5 shrink-0 ${t.color}`}>
                {t.label}
              </span>
              <span className="text-xs text-slate-400 flex-1 truncate">{t.description}</span>
              <span className="text-[10px] text-slate-600 font-mono shrink-0">{t.key}</span>
              <button
                onClick={() => handleDelete(t.key)}
                className="text-slate-600 hover:text-red-400 transition-colors shrink-0"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}

          {adding && (
            <div className="bg-slate-800/50 border border-orange-500/30 p-4 mt-2 space-y-3">
              <div>
                <label className="text-xs text-slate-500 mb-1 block">Label</label>
                <input
                  value={newLabel}
                  onChange={(e) => setNewLabel(e.target.value)}
                  placeholder="e.g. Regulation"
                  autoFocus
                  className="w-full px-3 py-2 bg-slate-700/50 border border-slate-600/50 text-sm text-white focus:border-orange-500 focus:outline-none transition-colors"
                />
                {newLabel && (
                  <p className="text-[10px] text-slate-600 mt-1">Key: {slugify(newLabel)}</p>
                )}
              </div>
              <div>
                <label className="text-xs text-slate-500 mb-1 block">Description (used in extraction prompt)</label>
                <input
                  value={newDescription}
                  onChange={(e) => setNewDescription(e.target.value)}
                  placeholder="e.g. A specific law, regulation, or compliance requirement"
                  className="w-full px-3 py-2 bg-slate-700/50 border border-slate-600/50 text-sm text-white focus:border-orange-500 focus:outline-none transition-colors"
                />
              </div>
              <div>
                <label className="text-xs text-slate-500 mb-1 block">Color</label>
                <div className="flex flex-wrap gap-2">
                  {COLOR_PRESETS.map((c) => (
                    <button
                      key={c.value}
                      onClick={() => setNewColor(c.value)}
                      className={`text-xs px-2.5 py-1 transition-colors ${c.value} ${
                        newColor === c.value ? 'ring-1 ring-orange-500' : ''
                      }`}
                    >
                      {c.label}
                    </button>
                  ))}
                </div>
              </div>
              <div className="flex items-center gap-2 pt-1">
                <button
                  onClick={handleAdd}
                  disabled={!newLabel.trim() || !newDescription.trim()}
                  className="px-3 py-1.5 text-xs bg-orange-600 hover:bg-orange-700 disabled:opacity-30 disabled:cursor-not-allowed text-white transition-colors"
                >
                  Add
                </button>
                <button
                  onClick={() => setAdding(false)}
                  className="px-3 py-1.5 text-xs text-slate-400 hover:text-white transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
