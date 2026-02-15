import { LayoutDashboard, FileText, MessageCircle, Mic, Plus } from 'lucide-react'
import { getComponentIcon } from '../../lib/componentIcons'
import SidebarSection from './SidebarSection'
import SidebarItem from './SidebarItem'
import type { ActivePanel, ChatInfo } from '../../hooks/useToolDashboard'

interface Tab {
  id: string
  title: string
  type: string
  complete: boolean
}

interface Doc {
  id: string
  title: string
  type: string
}

interface WorkspaceSidebarProps {
  tabs: Tab[]
  documents: Doc[]
  chats: ChatInfo[]
  overallProgress: number
  activePanel: ActivePanel
  onPanelChange: (panel: ActivePanel) => void
  onAddDocument?: () => void
  onNewChat?: () => void
}

export default function WorkspaceSidebar({
  tabs,
  documents,
  chats,
  overallProgress,
  activePanel,
  onPanelChange,
  onAddDocument,
  onNewChat,
}: WorkspaceSidebarProps) {
  return (
    <div className="w-64 shrink-0 border-r border-slate-700/50 bg-slate-900/50 flex flex-col overflow-y-auto">
      {/* Progress bar */}
      <div className="px-3 pt-4 pb-2">
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-[10px] font-semibold tracking-widest text-slate-500 uppercase">Progress</span>
          <span className="text-xs text-slate-400">{overallProgress}%</span>
        </div>
        <div className="h-1.5 bg-slate-700 overflow-hidden">
          <div
            className="h-full bg-orange-500 transition-all duration-500"
            style={{ width: `${overallProgress}%` }}
          />
        </div>
      </div>

      {/* Tools section */}
      <SidebarSection title="Tools" count={tabs.length}>
        <SidebarItem
          icon={LayoutDashboard}
          label="Overview"
          active={activePanel.type === 'overview'}
          onClick={() => onPanelChange({ type: 'overview' })}
        />
        {tabs.map((tab, idx) => (
          <SidebarItem
            key={tab.id}
            icon={getComponentIcon(tab.type)}
            label={tab.title}
            active={activePanel.type === 'component' && activePanel.index === idx}
            complete={tab.complete}
            onClick={() => onPanelChange({ type: 'component', index: idx })}
          />
        ))}
      </SidebarSection>

      {/* Documents section */}
      <SidebarSection title="Documents" count={documents.length}>
        <SidebarItem
          icon={FileText}
          label="All Documents"
          active={activePanel.type === 'documents'}
          onClick={() => onPanelChange({ type: 'documents' })}
        />
        {onAddDocument && (
          <button
            onClick={onAddDocument}
            className="w-full flex items-center gap-2.5 px-3 py-1.5 text-xs text-slate-500 hover:text-orange-400 transition-colors border-l-2 border-transparent pl-[10px]"
          >
            <Plus className="w-3.5 h-3.5" />
            Add Document
          </button>
        )}
      </SidebarSection>

      {/* Knowledge section */}
      <SidebarSection title="Knowledge">
        {chats.map((chat) => (
          <SidebarItem
            key={chat.id}
            icon={MessageCircle}
            label={chat.title}
            active={activePanel.type === 'chat' && activePanel.chatId === chat.id}
            onClick={() => onPanelChange({ type: 'chat', chatId: chat.id })}
          />
        ))}
        {onNewChat && (
          <button
            onClick={onNewChat}
            className="w-full flex items-center gap-2.5 px-3 py-1.5 text-xs text-slate-500 hover:text-orange-400 transition-colors border-l-2 border-transparent pl-[10px]"
          >
            <Plus className="w-3.5 h-3.5" />
            New Chat
          </button>
        )}
        <SidebarItem
          icon={Mic}
          label="Interview #1"
          active={activePanel.type === 'interview'}
          onClick={() => onPanelChange({ type: 'interview' })}
        />
      </SidebarSection>
    </div>
  )
}
