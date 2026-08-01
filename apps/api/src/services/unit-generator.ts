import { generateJSON, SONNET } from "../lib/llm"
import type { PathUnitContent, LearnerPreferences } from "@forge/shared"
import type { WorkspaceExpertInfo } from "./expert-context"
import type { WorkspaceKnowledgeUnit } from "./path-planner"

// Fill phase: one cached-Sonnet call per unit. The knowledge summary and
// learner preferences live in the system prompt so parallel calls share the
// prompt cache (same pattern as tool-generator's generateComponent).

const LESSON_CARD_SCHEMA = {
  type: "object",
  properties: {
    kind: { type: "string", const: "lesson_card" },
    variant: { type: "string", enum: ["narrative", "comparison", "table", "quote"] },
    concept: { type: "string" },
    body: { type: "string" },
    comparison: {
      type: "object",
      properties: {
        leftTitle: { type: "string" },
        leftItems: { type: "array", items: { type: "string" } },
        rightTitle: { type: "string" },
        rightItems: { type: "array", items: { type: "string" } },
      },
      required: ["leftTitle", "leftItems", "rightTitle", "rightItems"],
      additionalProperties: false,
    },
    table: {
      type: "object",
      properties: {
        caption: { type: "string" },
        headers: { type: "array", items: { type: "string" } },
        rows: { type: "array", items: { type: "array", items: { type: "string" } } },
      },
      required: ["caption", "headers", "rows"],
      additionalProperties: false,
    },
    quote: {
      type: "object",
      properties: {
        text: { type: "string" },
        attribution: { type: "string" },
      },
      required: ["text", "attribution"],
      additionalProperties: false,
    },
  },
  required: ["kind", "variant", "concept", "body"],
  additionalProperties: false,
}

const EXERCISE_MC_SCHEMA = {
  type: "object",
  properties: {
    kind: { type: "string", const: "exercise_mc" },
    question: { type: "string" },
    options: {
      type: "array",
      items: {
        type: "object",
        properties: {
          id: { type: "string" },
          text: { type: "string" },
          correct: { type: "boolean" },
          explanation: { type: "string" },
        },
        required: ["id", "text", "correct", "explanation"],
        additionalProperties: false,
      },
    },
  },
  required: ["kind", "question", "options"],
  additionalProperties: false,
}

const EXERCISE_FILL_SCHEMA = {
  type: "object",
  properties: {
    kind: { type: "string", const: "exercise_fill" },
    sentence: { type: "string" },
    blanks: { type: "array", items: { type: "string" } },
    wordBank: { type: "array", items: { type: "string" } },
    explanation: { type: "string" },
  },
  required: ["kind", "sentence", "blanks", "wordBank", "explanation"],
  additionalProperties: false,
}

const EXERCISE_ORDER_SCHEMA = {
  type: "object",
  properties: {
    kind: { type: "string", const: "exercise_order" },
    prompt: { type: "string" },
    steps: { type: "array", items: { type: "string" } },
    explanation: { type: "string" },
  },
  required: ["kind", "prompt", "steps", "explanation"],
  additionalProperties: false,
}

const SCHEMAS: Record<string, Record<string, unknown>> = {
  lesson_card: LESSON_CARD_SCHEMA,
  exercise_mc: EXERCISE_MC_SCHEMA,
  exercise_fill: EXERCISE_FILL_SCHEMA,
  exercise_order: EXERCISE_ORDER_SCHEMA,
}

const KIND_INSTRUCTIONS: Record<string, string> = {
  lesson_card: `Write ONE bite-sized lesson card teaching exactly one concept (≤120 words in "body", markdown allowed).
Pick the variant that fits the knowledge: "comparison" for contrasts (fill the comparison field), "table" for metrics/definitions (fill the table field), "quote" to preserve the expert's own memorable phrasing (fill the quote field), otherwise "narrative".
Keep the expert's voice, numbers, and specifics — never generic filler.`,
  exercise_mc: `Write ONE multiple-choice question with exactly 4 options and exactly one correct answer.
The correct answer must come from the source knowledge. Distractors should be the misconceptions or mistakes the expert has warned about (see warnings/common-mistakes in the corpus) — plausible near-misses, not absurd throwaways.
Every option's "explanation" says why it's right or wrong, using the expert's actual reasoning.`,
  exercise_fill: `Write ONE fill-in-the-blank exercise from the source knowledge.
The "sentence" uses {{0}}, {{1}} placeholders (2-3 blanks) replacing load-bearing terms. "blanks" holds the correct term per placeholder index. "wordBank" = the correct terms plus 1-2 near-miss distractor terms drawn from related knowledge.
"explanation" gives the complete sentence and why it matters, in the expert's terms.`,
  exercise_order: `Write ONE order-the-steps exercise from a procedure in the source knowledge.
"steps" is the CORRECT order (3-6 steps), each trimmed to a short draggable one-liner (≤12 words) preserving the expert's specifics. The client shuffles them for display.
"prompt" names the procedure ("Order the steps of ..."). "explanation" says why the order matters, citing the expert's reasoning.`,
}

export function buildUnitSystemPrompt(
  expert: WorkspaceExpertInfo,
  units: WorkspaceKnowledgeUnit[],
  preferences: LearnerPreferences | null
): string {
  const corpus = units.map(u => `${u.id} [${u.type}] ${u.content}`).join("\n")
  const prefNote = preferences?.instructions?.length
    ? `\n\nLEARNER PREFERENCES (apply to all content you write):\n${preferences.instructions.map(i => `- ${i}`).join("\n")}`
    : ""
  return `You generate single learning units for a paced course built from ${expert.expertName}'s expertise in ${expert.domain}.

EXPERT KNOWLEDGE CORPUS (id [type] content):
${corpus}${prefNote}

Use ONLY the knowledge in the corpus. If the cited knowledge doesn't support the unit, base it on the closest corpus items — never invent facts.`
}

export async function generateUnitContent(
  kind: string,
  focus: string,
  sourceUnitIds: string[],
  systemPrompt: string,
  priorUnitSummaries: string[]
): Promise<PathUnitContent> {
  const schema = SCHEMAS[kind]
  if (!schema) throw new Error(`No generator for unit kind: ${kind}`)

  const dedupNote = priorUnitSummaries.length > 0
    ? `\n\nALREADY COVERED (do not repeat):\n${priorUnitSummaries.map(s => `- ${s}`).join("\n")}`
    : ""

  const prompt = `Generate one "${kind}" unit.

FOCUS: ${focus}
SOURCE KNOWLEDGE IDS (ground the unit in these corpus entries): ${sourceUnitIds.join(", ")}
${KIND_INSTRUCTIONS[kind]}${dedupNote}

Return ONLY the JSON object.`

  const content = await generateJSON<PathUnitContent>(prompt, {
    system: systemPrompt,
    temperature: 0.2,
    maxTokens: 2048,
    model: SONNET,
    cacheSystem: true,
    schema,
  })

  // Caps in code (the structured-output API doesn't support min/maxItems)
  if (content.kind === "exercise_mc") {
    content.options = content.options.slice(0, 4)
    const correctCount = content.options.filter(o => o.correct).length
    if (content.options.length < 2 || correctCount !== 1) {
      throw new Error(`exercise_mc invalid: ${content.options.length} options, ${correctCount} correct`)
    }
  }
  if (content.kind === "exercise_order") {
    content.steps = content.steps.slice(0, 6)
    if (content.steps.length < 3) throw new Error(`exercise_order has only ${content.steps.length} steps`)
  }
  if (content.kind === "exercise_fill") {
    content.blanks = content.blanks.slice(0, 3)
    if (content.blanks.length === 0) throw new Error("exercise_fill has no blanks")
    // Word bank must contain every correct term
    for (const b of content.blanks) {
      if (!content.wordBank.includes(b)) content.wordBank.push(b)
    }
  }
  return content
}

export function summarizeUnitContent(content: PathUnitContent): string {
  switch (content.kind) {
    case "lesson_card": return `lesson: ${content.concept}`
    case "exercise_mc": return `mc: ${content.question}`
    case "exercise_fill": return `fill: ${content.sentence.slice(0, 80)}`
    case "exercise_order": return `order: ${content.prompt}`
    default: return "unit"
  }
}
