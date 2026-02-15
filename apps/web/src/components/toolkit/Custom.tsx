import { useState, useEffect } from 'react'
import { CheckCircle, Quote, TrendingUp } from 'lucide-react'
import Markdown from 'react-markdown'
import type { CustomConfig, CustomSection } from '@forge/shared'
import CopyButton from './CopyButton'
import EditableText from './EditableText'

interface CustomProps {
  config: CustomConfig
  onComplete?: (complete: boolean) => void
  editMode?: boolean
  onConfigChange?: (config: CustomConfig) => void
}

interface SectionRendererProps {
  section: CustomSection
  editMode?: boolean
  onSectionChange?: (section: CustomSection) => void
}

function SectionRenderer({ section, editMode, onSectionChange }: SectionRendererProps) {
  const updateStat = (index: number, patch: Partial<{ label: string; value: string; description?: string }>) => {
    const stats = [...(section.stats || [])]
    stats[index] = { ...stats[index], ...patch }
    onSectionChange?.({ ...section, stats })
  }

  const updateItem = (index: number, value: string) => {
    const items = [...(section.items || [])]
    items[index] = value
    onSectionChange?.({ ...section, items })
  }

  switch (section.variant) {
    case 'stats':
      return (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {section.stats?.map((stat, i) => (
            <div key={i} className="bg-slate-700/30 border border-slate-600/30 p-4">
              <EditableText
                value={stat.value}
                onChange={(v) => updateStat(i, { value: v })}
                editMode={editMode}
                as="div"
                className="text-2xl font-bold text-white mb-1"
              />
              <EditableText
                value={stat.label}
                onChange={(v) => updateStat(i, { label: v })}
                editMode={editMode}
                as="div"
                className="text-sm font-medium text-slate-300"
              />
              {(stat.description || editMode) && (
                <EditableText
                  value={stat.description || ''}
                  onChange={(v) => updateStat(i, { description: v })}
                  editMode={editMode}
                  as="div"
                  className="text-xs text-slate-500 mt-1"
                />
              )}
            </div>
          ))}
        </div>
      )

    case 'quote':
      return (
        <div className="bg-slate-700/20 border-l-2 border-orange-500/50 p-4 flex gap-3">
          <Quote className="w-5 h-5 text-orange-400/60 shrink-0 mt-0.5" />
          {editMode ? (
            <EditableText
              value={section.content || ''}
              onChange={(v) => onSectionChange?.({ ...section, content: v })}
              editMode={editMode}
              as="div"
              className="text-slate-200 italic leading-relaxed"
              multiline
            />
          ) : (
            <div className="text-slate-200 italic leading-relaxed">
              <Markdown>{section.content || ''}</Markdown>
            </div>
          )}
        </div>
      )

    case 'highlight':
      return (
        <div className="bg-orange-500/10 border border-orange-500/20 p-4">
          <div className="flex items-start gap-3">
            <TrendingUp className="w-5 h-5 text-orange-400 shrink-0 mt-0.5" />
            {editMode ? (
              <EditableText
                value={section.content || ''}
                onChange={(v) => onSectionChange?.({ ...section, content: v })}
                editMode={editMode}
                as="div"
                className="text-slate-200 leading-relaxed"
                multiline
              />
            ) : (
              <div className="text-slate-200 leading-relaxed">
                <Markdown>{section.content || ''}</Markdown>
              </div>
            )}
          </div>
        </div>
      )

    case 'timeline':
      return (
        <div className="space-y-0">
          {section.items?.map((item, i) => (
            <div key={i} className="flex gap-3">
              <div className="flex flex-col items-center">
                <div className="w-2.5 h-2.5 rounded-full bg-orange-500 shrink-0 mt-1.5" />
                {i < (section.items?.length || 0) - 1 && (
                  <div className="w-px flex-1 bg-slate-700 my-1" />
                )}
              </div>
              <div className="pb-4">
                <EditableText
                  value={item}
                  onChange={(v) => updateItem(i, v)}
                  editMode={editMode}
                  as="div"
                  className="text-sm text-slate-300"
                />
              </div>
            </div>
          ))}
        </div>
      )

    case 'list':
      return (
        <ul className="space-y-2">
          {section.items?.map((item, i) => (
            <li key={i} className="flex items-start gap-2 text-sm text-slate-300">
              <span className="text-orange-400 mt-1 shrink-0">-</span>
              <EditableText
                value={item}
                onChange={(v) => updateItem(i, v)}
                editMode={editMode}
                as="span"
                className="text-sm text-slate-300"
              />
            </li>
          ))}
        </ul>
      )

    case 'text':
    default:
      return editMode ? (
        <EditableText
          value={section.content || ''}
          onChange={(v) => onSectionChange?.({ ...section, content: v })}
          editMode={editMode}
          as="div"
          className="text-sm text-slate-300 leading-relaxed"
          multiline
        />
      ) : (
        <div className="prose-card text-sm text-slate-300 leading-relaxed">
          <Markdown>{section.content || ''}</Markdown>
        </div>
      )
  }
}

export default function Custom({ config, onComplete, editMode, onConfigChange }: CustomProps) {
  const storageKey = `custom-ack-${config.id}`
  const [acknowledged, setAcknowledged] = useState(() => {
    try { return localStorage.getItem(storageKey) === '1' } catch { return false }
  })

  useEffect(() => {
    if (acknowledged) onComplete?.(true)
  }, [])

  const toggleAck = () => {
    const next = !acknowledged
    setAcknowledged(next)
    onComplete?.(next)
    try { localStorage.setItem(storageKey, next ? '1' : '0') } catch {}
  }

  const updateSection = (index: number, section: CustomSection) => {
    const sections = [...config.sections]
    sections[index] = section
    onConfigChange?.({ ...config, sections })
  }

  const allText = config.sections.map((s) => {
    const parts = [
      s.heading,
      s.content,
      s.items?.join('\n'),
      s.stats?.map((st) => `${st.label}: ${st.value}`).join('\n'),
    ]
    return parts.filter(Boolean).join('\n')
  }).join('\n\n')

  return (
    <div>
      <div className="flex items-center justify-end mb-4">
        <CopyButton getText={() => allText} />
      </div>

      <div className="space-y-6">
        {config.sections.map((section, i) => (
          <div key={i}>
            {(section.heading || editMode) && (
              <EditableText
                value={section.heading || ''}
                onChange={(v) => updateSection(i, { ...section, heading: v })}
                editMode={editMode}
                as="h3"
                className="text-base font-semibold text-white mb-3"
              />
            )}
            <SectionRenderer
              section={section}
              editMode={editMode}
              onSectionChange={(s) => updateSection(i, s)}
            />
          </div>
        ))}
      </div>

      {!editMode && (
        <div className="mt-6 pt-4 border-t border-slate-700/50">
          <button
            onClick={toggleAck}
            className={`flex items-center gap-2 px-3 py-1.5 text-xs transition-colors ${
              acknowledged
                ? 'bg-green-500/10 text-green-400 hover:bg-green-500/20'
                : 'bg-slate-700/30 text-slate-500 hover:text-slate-300 hover:bg-slate-700/50'
            }`}
          >
            <CheckCircle className={`w-3.5 h-3.5 ${acknowledged ? 'text-green-400' : 'text-slate-600'}`} />
            {acknowledged ? 'Reviewed' : 'Mark as reviewed'}
          </button>
        </div>
      )}
    </div>
  )
}
