import { useState } from 'react'
import { ChevronDown, ChevronRight } from 'lucide-react'

interface SidebarSectionProps {
  title: string
  children: React.ReactNode
  defaultOpen?: boolean
  count?: number
}

export default function SidebarSection({ title, children, defaultOpen = true, count }: SidebarSectionProps) {
  const [open, setOpen] = useState(defaultOpen)

  return (
    <div>
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center gap-2 px-3 py-2 text-[10px] font-semibold tracking-widest text-slate-500 hover:text-slate-300 uppercase transition-colors"
      >
        {open ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
        {title}
        {count !== undefined && (
          <span className="ml-auto text-slate-600 font-normal">{count}</span>
        )}
      </button>
      {open && <div className="pb-1">{children}</div>}
    </div>
  )
}
