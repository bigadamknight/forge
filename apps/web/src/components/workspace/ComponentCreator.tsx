import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import {
  MessageCircle, GitBranch, CheckSquare, ListOrdered,
  Calculator, HelpCircle, Layers, Loader2, ArrowLeft, Sparkles,
  GraduationCap,
} from 'lucide-react'
import { generateSingleComponent } from '../../lib/api'

const COMPONENT_TYPES = [
  { type: 'question_flow', label: 'Question Flow', desc: 'Personalized intake questionnaire with AI advice', icon: MessageCircle },
  { type: 'decision_tree', label: 'Decision Tree', desc: 'Branching logic with recommendations', icon: GitBranch },
  { type: 'checklist', label: 'Checklist', desc: 'Requirements or preparation list', icon: CheckSquare },
  { type: 'step_by_step', label: 'Step by Step', desc: 'Sequential procedures and processes', icon: ListOrdered },
  { type: 'calculator', label: 'Calculator', desc: 'Quantitative assessment with formulas', icon: Calculator },
  { type: 'quiz', label: 'Quiz', desc: 'Knowledge check or scenario assessment', icon: HelpCircle },
  { type: 'curriculum', label: 'Curriculum', desc: 'Structured learning path with expandable modules', icon: GraduationCap },
  { type: 'custom', label: 'Custom', desc: 'Bespoke layout for unique content', icon: Layers },
]

interface ComponentCreatorProps {
  workspaceId: string
  onCreated: () => void
}

export default function ComponentCreator({ workspaceId, onCreated }: ComponentCreatorProps) {
  const queryClient = useQueryClient()
  const [selectedType, setSelectedType] = useState<string | null>(null)
  const [focus, setFocus] = useState('')
  const [outline, setOutline] = useState('')

  const mutation = useMutation({
    mutationFn: (component: { type: string; focus: string; outline: string[] }) =>
      generateSingleComponent(workspaceId, component),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tool', workspaceId] })
      setSelectedType(null)
      setFocus('')
      setOutline('')
      onCreated()
    },
  })

  const handleGenerate = () => {
    if (!selectedType || !focus.trim()) return
    const outlineItems = outline.trim()
      ? outline.split('\n').map((l) => l.trim()).filter(Boolean)
      : []
    mutation.mutate({ type: selectedType, focus: focus.trim(), outline: outlineItems })
  }

  if (selectedType) {
    const meta = COMPONENT_TYPES.find((t) => t.type === selectedType)!
    const Icon = meta.icon

    return (
      <div className="space-y-4">
        <button
          onClick={() => { setSelectedType(null); mutation.reset() }}
          className="flex items-center gap-1.5 text-sm text-slate-400 hover:text-white transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to types
        </button>

        <div className="flex items-center gap-3 mb-2">
          <div className="w-10 h-10 bg-orange-500/10 flex items-center justify-center">
            <Icon className="w-5 h-5 text-orange-400" />
          </div>
          <div>
            <h3 className="font-medium text-white">{meta.label}</h3>
            <p className="text-xs text-slate-500">{meta.desc}</p>
          </div>
        </div>

        <div>
          <label className="text-xs text-slate-400 mb-1.5 block">What should this component cover?</label>
          <input
            type="text"
            value={focus}
            onChange={(e) => setFocus(e.target.value)}
            placeholder="e.g. Sourdough starter troubleshooting guide"
            autoFocus
            className="w-full px-3 py-2 bg-slate-800/50 border border-slate-700/50 text-sm text-white placeholder-slate-600 focus:border-orange-500 focus:outline-none transition-colors"
          />
        </div>

        <div>
          <label className="text-xs text-slate-400 mb-1.5 block">Key points to include (one per line, optional)</label>
          <textarea
            value={outline}
            onChange={(e) => setOutline(e.target.value)}
            rows={4}
            placeholder={"Common problems and fixes\nWhen to discard and start over\nSeasonal adjustments"}
            className="w-full px-3 py-2 bg-slate-800/50 border border-slate-700/50 text-sm text-white placeholder-slate-600 focus:border-orange-500 focus:outline-none transition-colors resize-none"
          />
        </div>

        {mutation.isError && (
          <p className="text-sm text-red-400">{(mutation.error as Error).message}</p>
        )}

        <button
          onClick={handleGenerate}
          disabled={!focus.trim() || mutation.isPending}
          className="flex items-center gap-2 px-4 py-2.5 bg-orange-600 hover:bg-orange-700 disabled:opacity-40 disabled:cursor-not-allowed text-sm font-medium text-white transition-colors"
        >
          {mutation.isPending ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              Generating...
            </>
          ) : (
            <>
              <Sparkles className="w-4 h-4" />
              Generate Component
            </>
          )}
        </button>
      </div>
    )
  }

  return (
    <div>
      <h3 className="text-lg font-semibold text-white mb-1">Add a Component</h3>
      <p className="text-sm text-slate-400 mb-4">Choose a component type to generate from your expert knowledge.</p>
      <div className="grid grid-cols-2 gap-2">
        {COMPONENT_TYPES.map((ct) => {
          const Icon = ct.icon
          return (
            <button
              key={ct.type}
              onClick={() => setSelectedType(ct.type)}
              className="flex items-start gap-3 p-3 bg-slate-800/30 border border-slate-700/30 hover:border-orange-500/30 hover:bg-slate-800/50 text-left transition-colors group"
            >
              <Icon className="w-5 h-5 text-slate-500 group-hover:text-orange-400 transition-colors mt-0.5 shrink-0" />
              <div>
                <div className="text-sm font-medium text-slate-300 group-hover:text-white transition-colors">{ct.label}</div>
                <div className="text-xs text-slate-500 mt-0.5">{ct.desc}</div>
              </div>
            </button>
          )
        })}
      </div>
    </div>
  )
}
