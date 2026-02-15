export const EXTRACTION_TYPES: Record<string, { label: string; color: string }> = {
  fact: { label: 'Fact', color: 'bg-blue-500/15 text-blue-400' },
  procedure: { label: 'Procedure', color: 'bg-purple-500/15 text-purple-400' },
  decision_rule: { label: 'Decision Rule', color: 'bg-amber-500/15 text-amber-400' },
  warning: { label: 'Warning', color: 'bg-red-500/15 text-red-400' },
  tip: { label: 'Tip', color: 'bg-green-500/15 text-green-400' },
  metric: { label: 'Metric', color: 'bg-cyan-500/15 text-cyan-400' },
  definition: { label: 'Definition', color: 'bg-indigo-500/15 text-indigo-400' },
  example: { label: 'Example', color: 'bg-orange-500/15 text-orange-400' },
  context: { label: 'Context', color: 'bg-slate-500/15 text-slate-400' },
}

export const EXTRACTION_TYPE_KEYS = Object.keys(EXTRACTION_TYPES)
