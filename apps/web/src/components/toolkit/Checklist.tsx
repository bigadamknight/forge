import { useState, useEffect } from 'react'
import { CheckSquare, Square, Star, HelpCircle, ChevronUp, List, LayoutGrid } from 'lucide-react'
import type { ChecklistConfig } from '@forge/shared'
import CopyButton from './CopyButton'
import EditableText from './EditableText'
import EditableList from './EditableList'

interface ChecklistProps {
  config: ChecklistConfig
  onComplete?: (complete: boolean) => void
  editMode?: boolean
  onConfigChange?: (config: ChecklistConfig) => void
}

export default function Checklist({ config, onComplete, editMode, onConfigChange }: ChecklistProps) {
  const [checked, setChecked] = useState<Set<string>>(() => new Set(config.checkedIds || []))

  // Sync checked state when config.checkedIds changes from external update (e.g. Opus refine)
  useEffect(() => {
    if (config.checkedIds) setChecked(new Set(config.checkedIds))
  }, [JSON.stringify(config.checkedIds)])

  const [expandedHelp, setExpandedHelp] = useState<string | null>(null)
  const [viewMode, setViewMode] = useState<'list' | 'card'>(() => {
    try {
      return (localStorage.getItem(`checklist-view-${config.id}`) as 'list' | 'card') || 'list'
    } catch { return 'list' }
  })

  const toggleView = () => {
    const next = viewMode === 'list' ? 'card' : 'list'
    setViewMode(next)
    try { localStorage.setItem(`checklist-view-${config.id}`, next) } catch {}
  }

  const toggleItem = (id: string) => {
    if (editMode) return
    const next = new Set(checked)
    if (next.has(id)) {
      next.delete(id)
    } else {
      next.add(id)
    }
    setChecked(next)
    onComplete?.(next.size === config.items.length)
    onConfigChange?.({ ...config, checkedIds: [...next] })
  }

  const toggleHelp = (id: string) => {
    setExpandedHelp((prev) => (prev === id ? null : id))
  }

  const updateItem = (index: number, patch: Partial<ChecklistConfig['items'][number]>) => {
    const items = [...config.items]
    items[index] = { ...items[index], ...patch }
    onConfigChange?.({ ...config, items })
  }

  const completedCount = checked.size
  const totalCount = config.items.length
  const requiredCount = config.items.filter((i) => i.required).length
  const requiredCompleted = config.items.filter(
    (i) => i.required && checked.has(i.id)
  ).length
  const progress = totalCount > 0 ? (completedCount / totalCount) * 100 : 0

  const renderItem = (item: ChecklistConfig['items'][number], index: number) => {
    const isChecked = checked.has(item.id)
    const isHelpOpen = expandedHelp === item.id

    return (
      <div key={item.id} className="group/item">
        <div
          className={`flex items-start gap-3 px-4 py-3  transition-colors ${editMode ? '' : 'cursor-pointer hover:bg-slate-700/30'} ${
            isChecked ? 'opacity-70' : ''
          }`}
          onClick={() => toggleItem(item.id)}
        >
          {isChecked ? (
            <CheckSquare className="w-5 h-5 text-orange-400 shrink-0 mt-0.5" />
          ) : (
            <Square className="w-5 h-5 text-slate-500 shrink-0 mt-0.5" />
          )}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <EditableText
                value={item.text}
                editMode={editMode}
                onChange={(v) => updateItem(index, { text: v })}
                className={`text-base ${
                  isChecked
                    ? 'text-slate-400 line-through'
                    : 'text-slate-200'
                }`}
              />
              {item.required && (
                <Star className="w-3 h-3 text-orange-400 shrink-0" />
              )}
            </div>
          </div>
          {item.helpText && !editMode && (
            <button
              onClick={(e) => {
                e.stopPropagation()
                toggleHelp(item.id)
              }}
              className="p-1 text-slate-500 hover:text-slate-300 transition-colors shrink-0"
            >
              {isHelpOpen ? (
                <ChevronUp className="w-4 h-4" />
              ) : (
                <HelpCircle className="w-4 h-4" />
              )}
            </button>
          )}
        </div>
        {isHelpOpen && item.helpText && !editMode && (
          <div className="ml-11 mr-3 mb-2 px-3 py-2 text-sm text-slate-400 bg-slate-700/30  leading-relaxed">
            {item.helpText}
          </div>
        )}
        {editMode && item.helpText && (
          <div className="ml-11 mr-3 mb-2">
            <EditableText
              value={item.helpText}
              editMode={editMode}
              onChange={(v) => updateItem(index, { helpText: v })}
              className="text-xs text-slate-400"
              multiline
            />
          </div>
        )}
      </div>
    )
  }

  const renderCard = (item: ChecklistConfig['items'][number], index: number) => {
    const isChecked = checked.has(item.id)

    return (
      <div
        key={item.id}
        onClick={() => toggleItem(item.id)}
        className={`relative p-4  border transition-all ${editMode ? '' : 'cursor-pointer'} ${
          isChecked
            ? 'bg-orange-500/10 border-orange-500/30'
            : 'bg-slate-800/30 border-slate-700/50 hover:border-slate-600/50'
        }`}
      >
        <div className="flex items-start gap-3">
          {isChecked ? (
            <CheckSquare className="w-5 h-5 text-orange-400 shrink-0 mt-0.5" />
          ) : (
            <Square className="w-5 h-5 text-slate-500 shrink-0 mt-0.5" />
          )}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <EditableText
                value={item.text}
                editMode={editMode}
                onChange={(v) => updateItem(index, { text: v })}
                className={`text-sm font-medium ${
                  isChecked ? 'text-slate-400 line-through' : 'text-slate-200'
                }`}
              />
              {item.required && (
                <Star className="w-3 h-3 text-orange-400 shrink-0" />
              )}
            </div>
            {item.helpText && (
              <EditableText
                value={item.helpText}
                editMode={editMode}
                onChange={(v) => updateItem(index, { helpText: v })}
                className="text-xs text-slate-500 mt-1.5 leading-relaxed"
                as="p"
                multiline
              />
            )}
          </div>
        </div>
      </div>
    )
  }

  const groupedItems = (() => {
    if (!config.groupByCategory) return null
    const groups: Record<string, ChecklistConfig['items']> = {}
    for (const item of config.items) {
      const cat = item.category || 'General'
      if (!groups[cat]) groups[cat] = []
      groups[cat].push(item)
    }
    return groups
  })()

  return (
    <div className="space-y-4">
      {/* Progress bar */}
      <div className="space-y-2">
        <div className="flex items-center justify-between text-sm text-slate-400">
          <div className="flex items-center gap-2">
            <span>{completedCount} of {totalCount} completed</span>
            <CopyButton getText={() =>
              config.items.map((item) => `${checked.has(item.id) ? '[x]' : '[ ]'} ${item.text}${item.required ? ' (required)' : ''}${item.helpText ? ` - ${item.helpText}` : ''}`).join('\n')
            } />
          </div>
          <div className="flex items-center gap-3">
            {requiredCount > 0 && (
              <span className="flex items-center gap-1">
                <Star className="w-3 h-3 text-orange-400" />
                {requiredCompleted}/{requiredCount} required
              </span>
            )}
            <div className="flex items-center gap-0.5 bg-slate-700/50  p-0.5">
              <button
                onClick={toggleView}
                className={`p-1${viewMode === 'list' ? 'bg-slate-600 text-white' : 'text-slate-500 hover:text-slate-300'} transition-colors`}
                title="List view"
              >
                <List className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={toggleView}
                className={`p-1${viewMode === 'card' ? 'bg-slate-600 text-white' : 'text-slate-500 hover:text-slate-300'} transition-colors`}
                title="Card view"
              >
                <LayoutGrid className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>
        <div className="h-2 bg-slate-700  overflow-hidden">
          <div
            className="h-full bg-orange-500  transition-all duration-300"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      {/* Items */}
      {viewMode === 'card' ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {groupedItems
            ? Object.entries(groupedItems).flatMap(([, items]) =>
                items.map((item) => renderCard(item, config.items.indexOf(item)))
              )
            : config.items.map((item, idx) => renderCard(item, idx))
          }
        </div>
      ) : groupedItems ? (
        Object.entries(groupedItems).map(([category, items]) => (
          <div key={category} className="space-y-1">
            <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wider px-3 pt-2">
              {category}
            </h4>
            {items.map((item) => renderItem(item, config.items.indexOf(item)))}
          </div>
        ))
      ) : (
        <EditableList
          items={config.items}
          editMode={editMode}
          onChange={(items) => onConfigChange?.({ ...config, items })}
          createItem={() => ({ id: crypto.randomUUID(), text: 'New item', required: false, helpText: '', category: '' })}
          itemLabel="item"
          renderItem={(item, idx) => renderItem(item, idx)}
        />
      )}
    </div>
  )
}
