import { useState, useEffect } from 'react'
import { GitBranch, RotateCcw, ChevronRight, Lightbulb } from 'lucide-react'
import type { DecisionTreeConfig } from '@forge/shared'
import CopyButton from './CopyButton'
import EditableText from './EditableText'

interface DecisionTreeProps {
  config: DecisionTreeConfig
  editMode?: boolean
  onConfigChange?: (config: DecisionTreeConfig) => void
  onComplete?: (complete: boolean) => void
}

export default function DecisionTree({ config, editMode, onConfigChange, onComplete }: DecisionTreeProps) {
  const [currentNodeId, setCurrentNodeId] = useState<string>(config.nodes[0]?.id ?? '')
  const [history, setHistory] = useState<string[]>([])
  const [recommendation, setRecommendation] = useState<{
    label: string
    explanation?: string
    _sourceNodeId?: string
    _sourceOptionIdx?: number
  } | null>(null)

  // Sync voice-driven selections from external updates (voice agent tool calls)
  useEffect(() => {
    const selectedPath = (config as any)._selectedPath as Array<{ nodeId: string; optionIndex: number }> | undefined
    if (!selectedPath || selectedPath.length === 0) return

    let nodeId = config.nodes[0]?.id ?? ''
    const hist: string[] = []
    let rec: typeof recommendation = null

    for (const step of selectedPath) {
      const node = config.nodes.find((n) => n.id === step.nodeId)
      if (!node) break
      const option = node.options[step.optionIndex]
      if (!option) break

      if (option.nextNodeId) {
        const targetExists = config.nodes.some((n) => n.id === option.nextNodeId)
        if (targetExists) {
          hist.push(nodeId)
          nodeId = option.nextNodeId!
        } else {
          rec = { label: option.recommendation || option.label, explanation: option.explanation, _sourceNodeId: step.nodeId, _sourceOptionIdx: step.optionIndex }
          onComplete?.(true)
          break
        }
      } else if (option.recommendation) {
        rec = { label: option.recommendation, explanation: option.explanation, _sourceNodeId: step.nodeId, _sourceOptionIdx: step.optionIndex }
        onComplete?.(true)
      }
    }

    setHistory(hist)
    setCurrentNodeId(nodeId)
    setRecommendation(rec)
  }, [JSON.stringify((config as any)._selectedPath)])

  const currentNode = config.nodes.find((n) => n.id === currentNodeId)

  const updateNode = (nodeId: string, patch: Partial<DecisionTreeConfig['nodes'][number]>) => {
    const nodes = config.nodes.map((n) =>
      n.id === nodeId ? { ...n, ...patch } : n
    )
    onConfigChange?.({ ...config, nodes })
  }

  const updateOption = (nodeId: string, optionIndex: number, patch: Partial<DecisionTreeConfig['nodes'][number]['options'][number]>) => {
    const nodes = config.nodes.map((n) => {
      if (n.id !== nodeId) return n
      const options = [...n.options]
      options[optionIndex] = { ...options[optionIndex], ...patch }
      return { ...n, options }
    })
    onConfigChange?.({ ...config, nodes })
  }

  const handleOptionClick = (option: {
    label: string
    nextNodeId?: string
    recommendation?: string
    explanation?: string
  }, optionIdx: number) => {
    if (option.nextNodeId) {
      // Check if the target node actually exists
      const targetNode = config.nodes.find((n) => n.id === option.nextNodeId)
      if (targetNode) {
        setHistory((prev) => [...prev, currentNodeId])
        setCurrentNodeId(option.nextNodeId!)
        setRecommendation(null)
      } else {
        // Dangling reference - treat as a terminal recommendation
        setRecommendation({
          label: option.recommendation || option.label,
          explanation: option.explanation,
          _sourceNodeId: currentNodeId,
          _sourceOptionIdx: optionIdx,
        })
        onComplete?.(true)
      }
    } else if (option.recommendation) {
      setRecommendation({
        label: option.recommendation,
        explanation: option.explanation,
        _sourceNodeId: currentNodeId,
        _sourceOptionIdx: optionIdx,
      })
      onComplete?.(true)
    }
  }

  const handleBack = () => {
    if (history.length === 0) return
    const prev = history[history.length - 1]
    setHistory((h) => h.slice(0, -1))
    setCurrentNodeId(prev)
    setRecommendation(null)
  }

  const handleStartOver = () => {
    setCurrentNodeId(config.nodes[0]?.id ?? '')
    setHistory([])
    setRecommendation(null)
  }

  return (
    <div className="space-y-4">
      {/* Progress indicator */}
      {history.length > 0 && (
        <div className="flex items-center gap-2 text-xs text-slate-500">
          <GitBranch className="w-3 h-3" />
          <span>Step {history.length + 1}</span>
          <div className="flex gap-1">
            {history.map((_, i) => (
              <div key={i} className="w-2 h-2  bg-orange-500" />
            ))}
            <div className="w-2 h-2  bg-orange-500/40 animate-pulse" />
          </div>
        </div>
      )}

      {/* Current question */}
      {!recommendation && currentNode && (
        <div className="space-y-3">
          <EditableText
            value={currentNode.question}
            onChange={(v) => updateNode(currentNode.id, { question: v })}
            editMode={editMode}
            as="p"
            className="text-xl font-medium text-white"
          />

          <div className="space-y-2">
            {currentNode.options.map((option, idx) => (
              <button
                key={idx}
                onClick={() => handleOptionClick(option, idx)}
                className="w-full text-left px-5 py-4 bg-slate-700/50 hover:bg-slate-700 border border-slate-600/50 hover:border-orange-500/50 transition-all group"
              >
                <div className="flex items-center justify-between">
                  <EditableText
                    value={option.label}
                    onChange={(v) => updateOption(currentNodeId, idx, { label: v })}
                    editMode={editMode}
                    as="span"
                    className="text-base text-slate-200 group-hover:text-white"
                  />
                  <ChevronRight className="w-4 h-4 text-slate-500 group-hover:text-orange-400 transition-colors" />
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Recommendation */}
      {recommendation && (
        <div className="space-y-3">
          <div className="p-6 bg-orange-500/10 border border-orange-500/30">
            <div className="flex items-start gap-3">
              <Lightbulb className="w-5 h-5 text-orange-400 shrink-0 mt-0.5" />
              <div className="space-y-2 flex-1">
                <div className="flex items-center justify-between">
                  <p className="text-[15px] font-semibold text-orange-300">
                    Recommendation
                  </p>
                  <CopyButton getText={() =>
                    `Recommendation: ${recommendation.label}${recommendation.explanation ? `\n${recommendation.explanation}` : ''}`
                  } />
                </div>
                <EditableText
                  value={recommendation.label}
                  onChange={(v) => {
                    setRecommendation((prev) => prev ? { ...prev, label: v } : prev)
                    if (recommendation._sourceNodeId !== undefined && recommendation._sourceOptionIdx !== undefined) {
                      updateOption(recommendation._sourceNodeId, recommendation._sourceOptionIdx, { recommendation: v })
                    }
                  }}
                  editMode={editMode}
                  as="p"
                  className="text-[15px] text-white"
                />
                {recommendation.explanation && (
                  <EditableText
                    value={recommendation.explanation}
                    onChange={(v) => {
                      setRecommendation((prev) => prev ? { ...prev, explanation: v } : prev)
                      if (recommendation._sourceNodeId !== undefined && recommendation._sourceOptionIdx !== undefined) {
                        updateOption(recommendation._sourceNodeId, recommendation._sourceOptionIdx, { explanation: v })
                      }
                    }}
                    editMode={editMode}
                    as="p"
                    className="text-[15px] text-slate-400 leading-relaxed"
                    multiline
                  />
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Navigation */}
      <div className="flex items-center gap-2 pt-2">
        {history.length > 0 && (
          <button
            onClick={handleBack}
            className="px-3 py-1.5 text-xs text-slate-400 hover:text-white bg-slate-700/50 hover:bg-slate-700 transition-colors"
          >
            Back
          </button>
        )}
        {(history.length > 0 || recommendation) && (
          <button
            onClick={handleStartOver}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-slate-400 hover:text-orange-400 bg-slate-700/50 hover:bg-slate-700 transition-colors"
          >
            <RotateCcw className="w-3 h-3" />
            Start Over
          </button>
        )}
      </div>
    </div>
  )
}
