import { generateJSON, SONNET, HAIKU } from "../lib/llm"

interface ExtractionItem {
  type: string
  content: string
  confidence: number | null
  tags: string[] | null
}

interface ToolConfig {
  title: string
  description: string
  theme: {
    primaryColor: string
    accentColor: string
    icon: string
  }
  layout: Array<Record<string, unknown>>
}

export interface ToolPlanComponent {
  type: string
  focus: string
  outline: string[]
}

export interface ToolPlan {
  title: string
  theme: {
    primaryColor: string
    accentColor: string
    icon: string
  }
  components: ToolPlanComponent[]
}

export function deriveComponentSpec(entry: { type: string; focus: string }, index: number) {
  const id = `${entry.type}_${index + 1}`
  const title = entry.focus.length > 60 ? entry.focus.slice(0, 57) + "..." : entry.focus
  return { id, type: entry.type, title, description: entry.focus }
}

interface DocumentItem {
  title: string
  type: string
  content: string
}

// ============ Component Schemas (split by type for per-component generation) ============

const COMPONENT_SCHEMAS: Record<string, string> = {
  decision_tree: `"decision_tree" - For branching decisions
{
  "id": "unique_id", "type": "decision_tree", "title": "...", "description": "...",
  "rootQuestion": "The starting question",
  "nodes": [{ "id": "node_id", "question": "...", "options": [{ "label": "...", "nextNodeId": "..." or null, "recommendation": "..." , "explanation": "..." }] }]
}`,
  checklist: `"checklist" - For requirements or preparation lists
{
  "id": "unique_id", "type": "checklist", "title": "...", "description": "...",
  "items": [{ "id": "item_id", "text": "...", "required": true/false, "helpText": "...", "category": "..." }],
  "groupByCategory": true/false
}`,
  step_by_step: `"step_by_step" - For sequential procedures
{
  "id": "unique_id", "type": "step_by_step", "title": "...", "description": "...",
  "steps": [{ "id": "step_id", "title": "...", "content": "...", "tips": ["..."], "warnings": ["..."], "estimatedTime": "..." }]
}`,
  calculator: `"calculator" - For quantitative assessments
{
  "id": "unique_id", "type": "calculator", "title": "...", "description": "...",
  "inputs": [{ "id": "input_id", "label": "...", "type": "number"|"select"|"toggle", "options": [{"label":"...","value":0}], "defaultValue": 0, "unit": "...", "min": 0, "max": 100 }],
  "formula": "JavaScript expression using input IDs as variables, e.g. if inputs have ids 'revenue' and 'costs' then formula could be 'revenue - costs' or '(revenue - costs) / revenue * 100'. CRITICAL: The formula MUST reference the actual input IDs you defined and produce a number that changes when inputs change. Every input should influence the result.",
  "resultLabel": "...", "resultUnit": "...",
  "interpretation": [{ "range": [0, 50], "label": "Low", "color": "red", "advice": "..." }]
}`,
  question_flow: `"question_flow" - For personalized intake / "Ask the Expert"
{
  "id": "unique_id", "type": "question_flow", "title": "...", "description": "...",
  "questions": [{ "id": "q_id", "text": "...", "inputType": "text"|"select"|"number"|"multiselect", "options": ["..."], "placeholder": "...", "required": true/false }],
  "completionPrompt": "System prompt template for generating personalized advice based on answers"
}`,
  quiz: `"quiz" - For knowledge checks or scenario-based assessments
{
  "id": "unique_id", "type": "quiz", "title": "...", "description": "...",
  "mode": "knowledge_check"|"scenario",
  "questions": [{
    "id": "q_id", "text": "Question text",
    "scenario": "Optional scenario description (for scenario mode)",
    "options": [{ "id": "opt_id", "text": "...", "correct": true/false, "explanation": "Why this is right/wrong" }],
    "multipleCorrect": false
  }],
  "showImmediateFeedback": true,
  "showScoreAtEnd": true,
  "passingScore": 70
}`,
  custom: `"custom" - For any knowledge that doesn't fit the standard types. Design a bespoke layout.
{
  "id": "unique_id", "type": "custom", "title": "...", "description": "...",
  "sections": [
    {
      "heading": "Section heading",
      "variant": "text"|"list"|"highlight"|"quote"|"stats"|"timeline",
      "content": "Main content (markdown supported)",
      "items": ["For list/timeline variant - array of items"],
      "stats": [{ "label": "Stat name", "value": "Stat value", "description": "Context" }]
    }
  ]
}`,
}

const DESIGNER_SYSTEM = `You are an expert tool designer. Your job is to select the right interactive components to make expert knowledge accessible to non-experts.

Component types and when to use them:
- question_flow: intake questionnaire that generates personalised AI advice
- decision_tree: branching "what should I do?" logic with recommendations
- checklist: requirements or readiness validation lists
- step_by_step: sequential procedures and processes
- calculator: quantitative assessments with interactive inputs and formulas
- quiz: knowledge check or scenario-based assessment to test understanding
- custom: bespoke layout for knowledge that doesn't fit the above types (stats, timelines, key quotes, reference material). Use this to create something unique and tailored.

Rules:
- Pick 2-4 components (keep it focused and high-impact)
- Order logically: intake -> assessment -> guidance -> procedures
- Each component should map to specific knowledge from the extractions
- Fewer, richer components are better than many shallow ones
- Consider using "quiz" when the expert's knowledge lends itself to testing understanding (common mistakes, best practices, scenario-based decisions)
- Consider using "custom" when the expert's knowledge has a unique structure (e.g. key statistics, timeline of events, curated quotes/principles) that would be flattened by forcing it into a standard type`

// ============ JSON Schemas for Structured Output ============

const PLAN_SCHEMA = {
  type: "object",
  properties: {
    title: { type: "string" },
    theme: {
      type: "object",
      properties: {
        primaryColor: { type: "string" },
        accentColor: { type: "string" },
        icon: { type: "string" },
      },
      required: ["primaryColor", "accentColor", "icon"],
      additionalProperties: false,
    },
    components: {
      type: "array",
      items: {
        type: "object",
        properties: {
          type: {
            type: "string",
            enum: Object.keys(COMPONENT_SCHEMAS),
          },
          focus: { type: "string" },
          outline: {
            type: "array",
            items: { type: "string" },
            description: "4-6 bullet points of specific content this component will contain",
          },
        },
        required: ["type", "focus", "outline"],
        additionalProperties: false,
      },
    },
  },
  required: ["title", "theme", "components"],
  additionalProperties: false,
}

const OPERATIONS_BOARD_SCHEMA = {
  type: "object",
  properties: {
    id: { type: "string" },
    type: { type: "string", const: "task_board" },
    title: { type: "string" },
    tasks: {
      type: "array",
      items: {
        type: "object",
        properties: {
          id: { type: "string" },
          text: { type: "string" },
          description: { type: "string" },
          frequency: { type: "string", enum: ["weekly", "monthly", "as_needed"] },
          linkedComponentId: { type: "string" },
          linkedComponentTitle: { type: "string" },
          category: { type: "string" },
        },
        required: ["id", "text", "description", "frequency", "category"],
        additionalProperties: false,
      },
    },
  },
  required: ["id", "type", "title", "tasks"],
  additionalProperties: false,
}

// ============ Helpers ============

export function buildKnowledgeSummary(extractions: ExtractionItem[]): string {
  const grouped: Record<string, string[]> = {}
  for (const e of extractions) {
    ;(grouped[e.type] ??= []).push(e.content)
  }
  return Object.entries(grouped)
    .map(([type, items]) => `## ${type.toUpperCase()} (${items.length})\n${items.map((item, i) => `${i + 1}. ${item}`).join("\n")}`)
    .join("\n\n")
}

export function buildDocumentSection(docs?: DocumentItem[]): string {
  if (!docs || docs.length === 0) return ""
  return `\n\nSUPPORTING DOCUMENTS:\n${docs.map((d, i) => `### Document ${i + 1}: ${d.title}\n${d.content.slice(0, 10000)}`).join("\n\n")}`
}

// ============ Step 1: Plan ============

export async function generateToolPlan(
  expertName: string,
  domain: string,
  targetAudience: string | null,
  extractions: ExtractionItem[],
  docs?: DocumentItem[]
): Promise<ToolPlan> {
  const knowledgeSummary = buildKnowledgeSummary(extractions)
  const documentSection = buildDocumentSection(docs)

  const system = `${DESIGNER_SYSTEM}

Output valid JSON only.`

  const prompt = `Pick the right components for this expert's knowledge.

EXPERT: ${expertName}
DOMAIN: ${domain}
TARGET AUDIENCE: ${targetAudience || "General audience"}

EXTRACTED KNOWLEDGE:
${knowledgeSummary}${documentSection}

Output JSON with:
{
  "title": "Short tool title",
  "theme": { "primaryColor": "#hex", "accentColor": "#hex", "icon": "lucide-icon-name" },
  "components": [
    { "type": "component_type", "focus": "what specific knowledge this covers", "outline": ["bullet 1", "bullet 2", ...] }
  ]
}

RULES:
- Pick 2-4 components. Fewer, richer components are better than many shallow ones.
- The "focus" field tells the next step what expert knowledge to put in each component - be specific (e.g. "food supply channels: wholesale vs retail vs donation" not "comparison of options").
- The "outline" field should list 4-6 specific items/topics this component will contain. These help the user understand what they're getting and prevent overlap between components.
- CRITICAL: Each component must cover DISTINCT knowledge. Do not repeat the same information across components. For example, if a step_by_step covers "register with local authority" as a step, a checklist should NOT also have "register with local authority" as an item. Instead, focus the checklist on a different dimension (e.g. ongoing compliance vs one-time setup).
- Think about complementary angles: procedures (how to do it) vs assessments (am I ready?) vs references (key information) - not the same content in different formats.

Return ONLY the JSON.`

  return generateJSON<ToolPlan>(prompt, {
    system,
    temperature: 0.2,
    maxTokens: 4096,
    schema: PLAN_SCHEMA,
    effort: "high",
  })
}

// ============ Step 2: Generate individual component ============

export async function generateComponent(
  componentSpec: { id: string; type: string; title: string; description: string },
  knowledgeSummary: string,
  documentSection: string,
  expertName: string,
  domain: string
): Promise<Record<string, unknown>> {
  const schema = COMPONENT_SCHEMAS[componentSpec.type]
  if (!schema) {
    throw new Error(`Unknown component type: ${componentSpec.type}`)
  }

  // System prompt includes knowledge (cached across parallel calls) + schema
  const system = `You are an expert tool designer generating a single component for an interactive guide based on ${expertName}'s expertise in ${domain}.

EXPERT KNOWLEDGE:
${knowledgeSummary}${documentSection}

Fill components with real, specific information from the expert's knowledge - not generic placeholders.`

  const prompt = `Generate the JSON content for this component.

COMPONENT: ${componentSpec.title}
TYPE: ${componentSpec.type}
PURPOSE: ${componentSpec.description}

Schema for this component type:
${schema}

Use the expert's actual numbers, timelines, advice, and specifics.

CALCULATOR RULES (if type is "calculator"): The "formula" field is a JavaScript expression evaluated at runtime. Input IDs become variables - e.g. inputs with ids "revenue" and "costs" allow formula "revenue - costs". The formula MUST reference every input ID so the result changes dynamically. Set interpretation ranges to match realistic output values. Test mentally: plug in the defaultValues and verify the formula produces a sensible number in range.

QUIZ RULES (if type is "quiz"): Generate 5-10 questions that test real knowledge from the expert. Each question should have 3-4 options with exactly one correct answer (unless multipleCorrect is true). Every option needs an "explanation" field explaining why it's right or wrong. For "scenario" mode, include a "scenario" field describing the situation. Use the expert's actual examples and specifics - not generic trivia. Set passingScore to 70 for knowledge_check, omit for scenario mode.

Output ONLY the JSON object, no explanation.`

  return generateJSON<Record<string, unknown>>(prompt, {
    system,
    temperature: 0.2,
    maxTokens: 4096,
    model: SONNET,
    cacheSystem: true,
  })
}

// ============ Step 3: Generate Operations Board ============

export async function generateOperationsBoard(
  plan: ToolPlan,
  knowledgeSummary: string,
  documentSection: string,
  expertName: string,
  domain: string
): Promise<Record<string, unknown>> {
  const componentSpecs = plan.components.map((entry, i) => deriveComponentSpec(entry, i))
  const componentList = componentSpecs
    .map((c) => `- ${c.id} (${c.type}): ${c.title}`)
    .join("\n")

  const system = `You are an expert operations advisor generating a recurring task board based on ${expertName}'s expertise in ${domain}.

EXPERT KNOWLEDGE:
${knowledgeSummary}${documentSection}

Your job is to distill the expert's knowledge into actionable recurring tasks that someone can use as a weekly/monthly operations checklist. Use the expert's actual specifics - real numbers, real timelines, real procedures - not generic advice.`

  const prompt = `Generate a weekly operations board with 8-15 recurring tasks based on the expert's knowledge.

SETUP TOOLKIT COMPONENTS (link tasks back to these where relevant):
${componentList}

RULES:
- Generate 8-15 tasks grouped by category
- Each task should be a concrete, actionable item from the expert's knowledge
- Use frequency "weekly" for things done every week, "monthly" for monthly reviews, "as_needed" for event-driven tasks
- Where a task relates to a setup toolkit section, set linkedComponentId and linkedComponentTitle to link back to it
- Categories should be meaningful groupings from the expert's domain (not generic like "Admin")
- Task text should be short and scannable (under 60 chars)
- Task description should explain what to do and why, using the expert's specific advice
- Use unique snake_case ids for each task

Return ONLY the JSON object matching the schema.`

  return generateJSON<Record<string, unknown>>(prompt, {
    system,
    temperature: 0.2,
    maxTokens: 4096,
    model: HAIKU,
    cacheSystem: true,
    schema: OPERATIONS_BOARD_SCHEMA,
  })
}

// ============ Convenience wrapper (non-streaming) ============

export async function generateToolConfig(
  expertName: string,
  domain: string,
  targetAudience: string | null,
  extractions: ExtractionItem[],
  docs?: DocumentItem[]
): Promise<ToolConfig> {
  const plan = await generateToolPlan(expertName, domain, targetAudience, extractions, docs)
  const knowledgeSummary = buildKnowledgeSummary(extractions)
  const documentSection = buildDocumentSection(docs)

  const componentSpecs = plan.components.map((entry, i) => deriveComponentSpec(entry, i))

  const layout = await Promise.all(
    componentSpecs.map((spec) => generateComponent(spec, knowledgeSummary, documentSection, expertName, domain))
  )

  return {
    title: plan.title,
    description: "",
    theme: plan.theme,
    layout,
  }
}
