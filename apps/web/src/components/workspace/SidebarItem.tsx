import { useState } from 'react'
import { Check, Trash2, type LucideIcon } from 'lucide-react'

interface SidebarItemProps {
  icon: LucideIcon
  label: string
  active?: boolean
  complete?: boolean
  onClick: () => void
  onDelete?: () => void
}

export default function SidebarItem({ icon: Icon, label, active, complete, onClick, onDelete }: SidebarItemProps) {
  const [confirming, setConfirming] = useState(false)

  return (
    <div className="relative">
      <button
        onClick={onClick}
        className={`w-full flex items-center gap-2.5 px-3 py-1.5 text-sm transition-colors group ${
          active
            ? 'text-white bg-slate-800/60 border-l-2 border-orange-500 pl-[10px]'
            : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/30 border-l-2 border-transparent pl-[10px]'
        }`}
      >
        <Icon className={`w-4 h-4 shrink-0 ${active ? 'text-orange-400' : 'text-slate-500 group-hover:text-slate-400'}`} />
        <span className="truncate flex-1 text-left">{label}</span>
        {complete && (
          <div className="w-4 h-4 bg-green-500/20 flex items-center justify-center shrink-0">
            <Check className="w-3 h-3 text-green-400" />
          </div>
        )}
        {onDelete && !confirming && (
          <div
            role="button"
            tabIndex={0}
            onClick={(e) => { e.stopPropagation(); setConfirming(true) }}
            onKeyDown={(e) => { if (e.key === 'Enter') { e.stopPropagation(); setConfirming(true) } }}
            className="w-4 h-4 flex items-center justify-center shrink-0 opacity-0 group-hover:opacity-100 text-slate-600 hover:text-red-400 transition-all"
          >
            <Trash2 className="w-3 h-3" />
          </div>
        )}
      </button>
      {confirming && (
        <div className="flex items-center gap-1 px-3 py-1.5 bg-slate-800 border-l-2 border-red-500/50 pl-[10px]">
          <span className="text-xs text-slate-400 flex-1">Delete?</span>
          <button
            onClick={() => { onDelete?.(); setConfirming(false) }}
            className="text-xs px-2 py-0.5 text-red-400 hover:text-red-300 bg-red-500/10 hover:bg-red-500/20 transition-colors"
          >
            Delete
          </button>
          <button
            onClick={() => setConfirming(false)}
            className="text-xs px-2 py-0.5 text-slate-500 hover:text-slate-300 transition-colors"
          >
            Cancel
          </button>
        </div>
      )}
    </div>
  )
}
