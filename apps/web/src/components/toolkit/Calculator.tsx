import { useState, useMemo, useEffect } from 'react'
import { Calculator as CalcIcon, TrendingUp } from 'lucide-react'
import type { CalculatorConfig } from '@forge/shared'
import CopyButton from './CopyButton'
import EditableText from './EditableText'
import { text, input as inputStyle } from './theme'

interface CalculatorProps {
  config: CalculatorConfig
  editMode?: boolean
  onConfigChange?: (config: CalculatorConfig) => void
  onComplete?: (complete: boolean) => void
}

export default function Calculator({ config, editMode, onConfigChange, onComplete }: CalculatorProps) {
  const [hasInteracted, setHasInteracted] = useState(false)
  const initialValues: Record<string, number> = {}
  for (const input of config.inputs) {
    if (input.defaultValue !== undefined) {
      initialValues[input.id] = input.defaultValue
    } else if (input.type === 'toggle') {
      initialValues[input.id] = 0
    } else if (input.type === 'select' && input.options?.length) {
      initialValues[input.id] = input.options[0].value
    } else {
      initialValues[input.id] = 0
    }
  }

  const [values, setValues] = useState<Record<string, number>>(initialValues)

  // Sync voice-set values from external updates (voice agent tool calls)
  useEffect(() => {
    const voiceValues = (config as any)._voiceValues as Record<string, number> | undefined
    if (!voiceValues) return
    setValues((prev) => ({ ...prev, ...voiceValues }))
    if (!hasInteracted) {
      setHasInteracted(true)
      onComplete?.(true)
    }
  }, [JSON.stringify((config as any)._voiceValues)])

  const updateInput = (index: number, patch: Partial<CalculatorConfig['inputs'][number]>) => {
    const inputs = [...config.inputs]
    inputs[index] = { ...inputs[index], ...patch }
    onConfigChange?.({ ...config, inputs })
  }

  const updateInterpretation = (index: number, patch: Partial<NonNullable<CalculatorConfig['interpretation']>[number]>) => {
    if (!config.interpretation) return
    const interpretation = [...config.interpretation]
    interpretation[index] = { ...interpretation[index], ...patch }
    onConfigChange?.({ ...config, interpretation })
  }

  const updateValue = (id: string, value: number) => {
    setValues((prev) => ({ ...prev, [id]: value }))
    if (!hasInteracted) {
      setHasInteracted(true)
      onComplete?.(true)
    }
  }

  const result = useMemo(() => {
    try {
      let formula = config.formula
      for (const [key, val] of Object.entries(values)) {
        formula = formula.replace(new RegExp(`\\b${key}\\b`, 'g'), String(val))
      }
      // Safe evaluation using Function constructor
      const fn = new Function(`return (${formula})`)
      const res = fn()
      return typeof res === 'number' && !isNaN(res) ? res : null
    } catch {
      return null
    }
  }, [values, config.formula])

  const interpretationIndex = useMemo(() => {
    if (result === null || !config.interpretation) return -1
    return config.interpretation.findIndex(
      (i) => result >= i.range[0] && result <= i.range[1]
    )
  }, [result, config.interpretation])

  const interpretation = interpretationIndex >= 0 ? config.interpretation?.[interpretationIndex] ?? null : null

  const colorMap: Record<string, string> = {
    green: 'text-green-400 bg-green-500/10 border-green-500/30',
    yellow: 'text-yellow-400 bg-yellow-500/10 border-yellow-500/30',
    amber: 'text-amber-400 bg-amber-500/10 border-amber-500/30',
    orange: 'text-orange-400 bg-orange-500/10 border-orange-500/30',
    red: 'text-red-400 bg-red-500/10 border-red-500/30',
    blue: 'text-blue-400 bg-blue-500/10 border-blue-500/30',
  }

  return (
    <div className="space-y-5">
      {/* Inputs */}
      <div className="space-y-4">
        {config.inputs.map((input, inputIdx) => (
          <div key={input.id} className="space-y-1.5">
            <label className="text-sm text-slate-300 font-medium">
              <EditableText
                value={input.label}
                onChange={(v) => updateInput(inputIdx, { label: v })}
                editMode={editMode}
                as="span"
                className="text-base text-slate-300 font-medium"
              />
              {input.unit && (
                <span className="text-slate-500 ml-1">({input.unit})</span>
              )}
            </label>

            {input.type === 'number' && (
              <input
                type="number"
                value={values[input.id] ?? 0}
                min={input.min}
                max={input.max}
                onChange={(e) =>
                  updateValue(input.id, parseFloat(e.target.value) || 0)
                }
                className={`w-full ${inputStyle.select}`}
              />
            )}

            {input.type === 'select' && input.options && (
              <select
                value={values[input.id] ?? 0}
                onChange={(e) =>
                  updateValue(input.id, parseFloat(e.target.value))
                }
                className={`w-full ${inputStyle.select}`}
              >
                {input.options.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            )}

            {input.type === 'toggle' && (
              <button
                onClick={() =>
                  updateValue(input.id, values[input.id] ? 0 : 1)
                }
                className={`relative w-12 h-6  transition-colors ${
                  values[input.id]
                    ? 'bg-orange-500'
                    : 'bg-slate-600'
                }`}
              >
                <div
                  className={`absolute top-1 w-4 h-4  bg-white transition-transform ${
                    values[input.id] ? 'translate-x-7' : 'translate-x-1'
                  }`}
                />
              </button>
            )}
          </div>
        ))}
      </div>

      {/* Result */}
      {result !== null && (
        <div className="space-y-3">
          <div className="p-6 bg-slate-700/30 border border-slate-600/50">
            <div className="flex items-center justify-between text-xs text-slate-500 mb-1">
              <div className="flex items-center gap-2">
                <CalcIcon className="w-3 h-3" />
                {config.resultLabel}
              </div>
              <CopyButton getText={() => {
                const inputSummary = config.inputs.map((input) =>
                  `${input.label}: ${values[input.id]}${input.unit ? ` ${input.unit}` : ''}`
                ).join('\n')
                return `${config.resultLabel}: ${typeof result === 'number' ? result.toLocaleString(undefined, { maximumFractionDigits: 2 }) : result}${config.resultUnit ? ` ${config.resultUnit}` : ''}${interpretation ? `\n${interpretation.label}: ${interpretation.advice}` : ''}\n\nInputs:\n${inputSummary}`
              }} />
            </div>
            <div className="flex items-baseline gap-2 mt-1">
              <span className="text-3xl font-bold text-white">
                {typeof result === 'number' ? result.toLocaleString(undefined, { maximumFractionDigits: 2 }) : result}
              </span>
              {config.resultUnit && (
                <span className="text-sm text-slate-400">
                  {config.resultUnit}
                </span>
              )}
            </div>
          </div>

          {/* Interpretation */}
          {interpretation && (
            <div
              className={`p-3 border ${
                colorMap[interpretation.color] ?? 'text-slate-300 bg-slate-700/30 border-slate-600/50'
              }`}
            >
              <div className="flex items-center gap-2 mb-1">
                <TrendingUp className="w-4 h-4" />
                <span className="text-[15px] font-semibold">
                  {interpretation.label}
                </span>
              </div>
              <EditableText
                value={interpretation.advice}
                onChange={(v) => updateInterpretation(interpretationIndex, { advice: v })}
                editMode={editMode}
                as="p"
                className="text-[15px] opacity-80 leading-relaxed"
                multiline
              />
            </div>
          )}

          {/* Interpretation scale */}
          {config.interpretation && config.interpretation.length > 0 && (
            <div className="flex gap-0.5 h-2  overflow-hidden">
              {config.interpretation.map((band, idx) => {
                const bgMap: Record<string, string> = {
                  green: 'bg-green-500',
                  yellow: 'bg-yellow-500',
                  amber: 'bg-amber-500',
                  orange: 'bg-orange-500',
                  red: 'bg-red-500',
                  blue: 'bg-blue-500',
                }
                const isActive = interpretation?.label === band.label
                return (
                  <div
                    key={idx}
                    className={`flex-1 ${bgMap[band.color] ?? 'bg-slate-600'} ${
                      isActive ? 'opacity-100 ring-1 ring-white/30' : 'opacity-30'
                    } transition-opacity`}
                  />
                )
              })}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
