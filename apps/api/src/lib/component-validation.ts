// Structural validation for LLM-generated component configs before they are
// written into toolConfig.layout. Not a full schema check — it enforces the
// invariants the renderers actually depend on so a malformed config can't
// blank the tool page.

type Config = Record<string, unknown>

const isNonEmptyString = (v: unknown): v is string => typeof v === "string" && v.length > 0
const isNonEmptyArray = (v: unknown): v is unknown[] => Array.isArray(v) && v.length > 0

// Per-type required fields: array fields must be non-empty, string fields non-empty strings
const TYPE_REQUIREMENTS: Record<string, Array<{ field: string; kind: "array" | "string" }>> = {
  decision_tree: [{ field: "rootQuestion", kind: "string" }, { field: "nodes", kind: "array" }],
  checklist: [{ field: "items", kind: "array" }],
  step_by_step: [{ field: "steps", kind: "array" }],
  calculator: [{ field: "inputs", kind: "array" }, { field: "formula", kind: "string" }, { field: "resultLabel", kind: "string" }],
  info_card: [{ field: "content", kind: "string" }],
  question_flow: [{ field: "questions", kind: "array" }, { field: "completionPrompt", kind: "string" }],
  quiz: [{ field: "questions", kind: "array" }],
  curriculum: [{ field: "modules", kind: "array" }],
  custom: [{ field: "sections", kind: "array" }],
  task_board: [{ field: "tasks", kind: "array" }],
}

export function validateComponentConfig(config: unknown): { valid: boolean; errors: string[] } {
  const errors: string[] = []

  if (!config || typeof config !== "object" || Array.isArray(config)) {
    return { valid: false, errors: ["config must be an object"] }
  }
  const c = config as Config

  if (!isNonEmptyString(c.id)) errors.push("missing id")
  if (!isNonEmptyString(c.title)) errors.push("missing title")
  if (!isNonEmptyString(c.type)) {
    errors.push("missing type")
    return { valid: false, errors }
  }

  const requirements = TYPE_REQUIREMENTS[c.type as string]
  if (!requirements) {
    errors.push(`unknown component type: ${c.type}`)
    return { valid: false, errors }
  }

  for (const req of requirements) {
    const value = c[req.field]
    if (req.kind === "array" && !isNonEmptyArray(value)) {
      errors.push(`${c.type}.${req.field} must be a non-empty array`)
    }
    if (req.kind === "string" && !isNonEmptyString(value)) {
      errors.push(`${c.type}.${req.field} must be a non-empty string`)
    }
  }

  return { valid: errors.length === 0, errors }
}
