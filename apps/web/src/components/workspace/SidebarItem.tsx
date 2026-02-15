import { Check, type LucideIcon } from 'lucide-react'

interface SidebarItemProps {
  icon: LucideIcon
  label: string
  active?: boolean
  complete?: boolean
  onClick: () => void
}

export default function SidebarItem({ icon: Icon, label, active, complete, onClick }: SidebarItemProps) {
  return (
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
    </button>
  )
}
