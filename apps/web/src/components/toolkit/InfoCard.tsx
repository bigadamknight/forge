import { useState, useEffect } from 'react'
import { Lightbulb, AlertTriangle, Info, CheckCircle } from 'lucide-react'
import Markdown from 'react-markdown'
import type { InfoCardConfig } from '@forge/shared'
import CopyButton from './CopyButton'
import EditableText from './EditableText'

interface InfoCardProps {
  config: InfoCardConfig
  onComplete?: (complete: boolean) => void
  editMode?: boolean
  onConfigChange?: (config: InfoCardConfig) => void
}

const variantStyles = {
  tip: {
    bg: 'bg-emerald-500/10',
    border: 'border-emerald-500/30',
    iconColor: 'text-emerald-400',
    Icon: Lightbulb,
  },
  warning: {
    bg: 'bg-amber-500/10',
    border: 'border-amber-500/30',
    iconColor: 'text-amber-400',
    Icon: AlertTriangle,
  },
  info: {
    bg: 'bg-blue-500/10',
    border: 'border-blue-500/30',
    iconColor: 'text-blue-400',
    Icon: Info,
  },
  success: {
    bg: 'bg-green-500/10',
    border: 'border-green-500/30',
    iconColor: 'text-green-400',
    Icon: CheckCircle,
  },
}

export default function InfoCard({ config, onComplete, editMode, onConfigChange }: InfoCardProps) {
  const storageKey = `info-ack-${config.id}`
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

  const style = variantStyles[config.variant]
  const { Icon } = style

  return (
    <div className={`${style.bg} border ${style.border} overflow-hidden`}>
      <div className="p-6">
        <div className="flex items-start gap-3 mb-4">
          <Icon className={`w-5 h-5 ${style.iconColor} shrink-0 mt-0.5`} />
          {config.title && (
            <h3 className="text-lg font-semibold text-white">{config.title}</h3>
          )}
          <div className="ml-auto">
            <CopyButton getText={() => config.content + (config.details ? `\n\n${config.details}` : '')} />
          </div>
        </div>

        {editMode ? (
          <EditableText
            value={config.content}
            onChange={(v) => onConfigChange?.({ ...config, content: v })}
            editMode={editMode}
            as="div"
            className="text-base text-slate-200 leading-relaxed whitespace-pre-wrap"
            multiline
          />
        ) : (
          <div className="prose-card text-base text-slate-200 leading-relaxed">
            <Markdown>{config.content}</Markdown>
          </div>
        )}

        {config.details && (
          <div className="mt-4 pt-4 border-t border-white/10">
            {editMode ? (
              <EditableText
                value={config.details}
                onChange={(v) => onConfigChange?.({ ...config, details: v })}
                editMode={editMode}
                as="div"
                className="text-[15px] text-slate-300 leading-relaxed whitespace-pre-wrap"
                multiline
              />
            ) : (
              <div className="prose-card text-[15px] text-slate-300 leading-relaxed">
                <Markdown>{config.details}</Markdown>
              </div>
            )}
          </div>
        )}
      </div>

      {!editMode && (
        <div className="px-6 pb-5">
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
