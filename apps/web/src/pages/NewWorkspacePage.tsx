import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Flame, Loader2 } from 'lucide-react'
import { createWorkspace } from '../lib/api'
import { useRegisterInteraction } from '../lib/InteractionContext'
import { NEW_WORKSPACE_PAGE } from '../lib/pageInteractions'

export default function NewWorkspacePage() {
  const navigate = useNavigate()
  const [title, setTitle] = useState('')
  const [creating, setCreating] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useRegisterInteraction('page:new-workspace', NEW_WORKSPACE_PAGE, { title: '', creating: false })

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!title.trim() || creating) return
    setCreating(true)
    setError(null)

    try {
      const { workspace } = await createWorkspace(title.trim())
      navigate(`/workspace/${workspace.id}`, { replace: true })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create workspace')
      setCreating(false)
    }
  }

  return (
    <div className="h-screen flex items-center justify-center">
      <form onSubmit={handleSubmit} className="w-full max-w-md px-6">
        <div className="flex items-center gap-3 justify-center mb-8">
          <Flame className="w-8 h-8 text-orange-400" />
          <h1 className="text-2xl font-bold">New Workspace</h1>
        </div>

        <div className="mb-6">
          <label htmlFor="workspace-title" className="block text-sm text-slate-400 mb-2">
            What are you building?
          </label>
          <input
            id="workspace-title"
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. Sourdough Baking Toolkit"
            autoFocus
            className="w-full px-4 py-3 bg-slate-800 border border-slate-700 text-white placeholder-slate-500 focus:border-orange-500/50 focus:outline-none transition-colors text-lg"
          />
        </div>

        {error && (
          <p className="text-red-400 text-sm mb-4">{error}</p>
        )}

        <button
          type="submit"
          disabled={!title.trim() || creating}
          className="w-full flex items-center justify-center gap-2 px-6 py-3 bg-orange-600 hover:bg-orange-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors font-medium text-white"
        >
          {creating ? (
            <>
              <Loader2 className="w-5 h-5 animate-spin" />
              Creating...
            </>
          ) : (
            'Create Workspace'
          )}
        </button>
      </form>
    </div>
  )
}
