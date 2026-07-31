import { LayoutDashboard, FileText, MessageCircle, Mic, Plus, Database, User, CheckCircle2, Circle } from 'lucide-react'
import { getComponentIcon } from '../../lib/componentIcons'
import SidebarSection from './SidebarSection'
import SidebarItem from './SidebarItem'
import type { ActivePanel, ChatInfo } from '../../hooks/useToolDashboard'
import type { Forge } from '../../lib/api'

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
  extractionCount: number
  chats: ChatInfo[]
  overallProgress: number
  activePanel: ActivePanel
  interviews?: Forge[]
  workspaceId?: string
  creatorMode?: boolean
  profileStatus?: 'not_started' | 'in_progress' | 'complete'
  showProfile?: boolean
  onPanelChange: (panel: ActivePanel) => void
  onAddDocument?: () => void
  onNewChat?: () => void
  onDeleteChat?: (chatId: string) => void
  onNewInterview?: () => void
}

export default function WorkspaceSidebar({
  tabs,
  documents,
  extractionCount,
  chats,
  overallProgress,
  activePanel,
  interviews,
  workspaceId,
  creatorMode = true,
  profileStatus,
  showProfile = false,
  onPanelChange,
  onAddDocument,
  onNewChat,
  onDeleteChat,
  onNewInterview,
}: WorkspaceSidebarProps) {
  return (
    <div className="w-64 shrink-0 border-r border-slate-700/50 bg-slate-900/50 flex flex-col overflow-y-auto">
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

      {/* Profile section */}
      {showProfile && (
        <SidebarSection title="Profile" count={profileStatus === 'complete' ? 1 : 0}>
          <SidebarItem
            icon={User}
            label="Expert Profile"
            active={activePanel.type === 'profile'}
            onClick={() => onPanelChange({ type: 'profile' })}
            complete={profileStatus === 'complete'}
          />
        </SidebarSection>
      )}

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

      {/* Documents section - hidden when empty and no add handler */}
      {(documents.length > 0 || onAddDocument) && (
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
      )}

      {/* Knowledge section */}
      <SidebarSection title={creatorMode ? 'Knowledge' : 'Chat'} count={creatorMode ? extractionCount : chats.length}>
        {creatorMode && (
          <SidebarItem
            icon={Database}
            label="Distilled Knowledge"
            active={activePanel.type === 'knowledge'}
            onClick={() => onPanelChange({ type: 'knowledge' })}
          />
        )}
        {chats.map((chat) => (
          <SidebarItem
            key={chat.id}
            icon={MessageCircle}
            label={chat.title}
            active={activePanel.type === 'chat' && activePanel.chatId === chat.id}
            onClick={() => onPanelChange({ type: 'chat', chatId: chat.id })}
            onDelete={onDeleteChat ? () => onDeleteChat(chat.id) : undefined}
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
        {interviews && interviews.map((interview) => (
          <SidebarItem
            key={`interview-${interview.id}`}
            icon={Mic}
            label={interview.title.slice(0, 30) + (interview.title.length > 30 ? '...' : '')}
            active={activePanel.type === 'interview' && activePanel.forgeId === interview.id}
            onClick={() => onPanelChange({ type: 'interview', forgeId: interview.id })}
          />
        ))}
        {onNewInterview && (
          <button
            onClick={onNewInterview}
            className="w-full flex items-center gap-2.5 px-3 py-1.5 text-xs text-slate-500 hover:text-orange-400 transition-colors border-l-2 border-transparent pl-[10px]"
          >
            <Plus className="w-3.5 h-3.5" />
            New Interview
          </button>
        )}
      </SidebarSection>
    </div>
  )
}
