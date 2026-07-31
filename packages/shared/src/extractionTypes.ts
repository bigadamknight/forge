export interface ExtractionTypeDefinition {
  key: string
  label: string
  color: string
  description: string
}

export interface CustomExtractionType {
  key: string
  label: string
  description: string
  color: string
}

export const STANDARD_EXTRACTION_TYPES: ExtractionTypeDefinition[] = [
  { key: "fact", label: "Fact", color: "bg-blue-500/15 text-blue-400", description: "A concrete fact, data point, or verifiable piece of information" },
  { key: "procedure", label: "Procedure", color: "bg-purple-500/15 text-purple-400", description: "A step-by-step process or workflow" },
  { key: "decision_rule", label: "Decision Rule", color: "bg-amber-500/15 text-amber-400", description: "An if/then decision logic with conditions and actions" },
  { key: "warning", label: "Warning", color: "bg-red-500/15 text-red-400", description: "A cautionary note, common mistake, or pitfall" },
  { key: "tip", label: "Tip", color: "bg-green-500/15 text-green-400", description: "A pro tip, best practice, or shortcut" },
  { key: "metric", label: "Metric", color: "bg-cyan-500/15 text-cyan-400", description: "A number, threshold, measurement, or benchmark" },
  { key: "definition", label: "Definition", color: "bg-indigo-500/15 text-indigo-400", description: "A term definition or concept explanation" },
  { key: "example", label: "Example", color: "bg-orange-500/15 text-orange-400", description: "A concrete example, case study, or anecdote" },
  { key: "context", label: "Context", color: "bg-slate-500/15 text-slate-400", description: "Background context or prerequisite knowledge" },
]

const standardMap = new Map(STANDARD_EXTRACTION_TYPES.map((t) => [t.key, t]))

export function getExtractionTypes(customTypes?: CustomExtractionType[]): Map<string, ExtractionTypeDefinition> {
  const merged = new Map(standardMap)
  if (customTypes) {
    for (const ct of customTypes) {
      if (!merged.has(ct.key)) {
        merged.set(ct.key, ct)
      }
    }
  }
  return merged
}

export function getExtractionTypeKeys(customTypes?: CustomExtractionType[]): string[] {
  return Array.from(getExtractionTypes(customTypes).keys())
}

export function buildExtractionPromptList(customTypes?: CustomExtractionType[]): string {
  const types = getExtractionTypes(customTypes)
  return Array.from(types.values())
    .map((t) => `- **${t.key}**: ${t.description}`)
    .join("\n")
}

export function buildExtractionTypeEnum(customTypes?: CustomExtractionType[]): string {
  return Array.from(getExtractionTypes(customTypes).keys()).join("|")
}
