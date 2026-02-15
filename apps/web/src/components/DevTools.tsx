import { useState, useEffect } from 'react'
import { Bug } from 'lucide-react'

interface DevAction {
  label: string
  fn: () => void
}

interface Props {
  actions: DevAction[]
}

export default function DevTools({ actions }: Props) {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setVisible((v) => !v)
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [])

  if (!visible) return null

  return (
    <div className="fixed bottom-4 right-4 z-50 bg-slate-800 border border-slate-600 p-3 shadow-xl min-w-48">
      <div className="flex items-center gap-2 text-xs text-slate-400 mb-2 pb-2 border-b border-slate-700">
        <Bug className="w-3 h-3" />
        Dev Tools
      </div>
      <div className="space-y-1">
        {actions.map((action) => (
          <button
            key={action.label}
            onClick={() => { action.fn(); setVisible(false) }}
            className="block w-full text-left px-2 py-1.5 text-sm text-slate-300 hover:bg-slate-700 transition-colors"
          >
            {action.label}
          </button>
        ))}
      </div>
    </div>
  )
}
