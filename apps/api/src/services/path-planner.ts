import { db, knowledgeUnits, interviewSections, forges } from "@forge/db"
import { eq, and, inArray } from "drizzle-orm"
import { generateJSON } from "../lib/llm"
import type { PathSequence, LearnerGoal, LearnerPreferences } from "@forge/shared"
import type { WorkspaceExpertInfo } from "./expert-context"

// Structure phase of the learning-path pipeline: one Opus call producing a
// milestone/unit skeleton with mandatory knowledge-unit citations, then hard
// caps and provenance filtering applied in code.

const MILESTONE_CAPS: Record<LearnerGoal, { min: number; max: number }> = {
  basics: { min: 3, max: 4 },
  deep: { min: 5, max: 7 },
  practical: { min: 4, max: 5 },
}

// ~3 minutes per unit; a milestone should be roughly a week at the learner's pace
const MINUTES_PER_UNIT = 3

const PATH_SKELETON_SCHEMA = {
  type: "object",
  properties: {
    title: { type: "string" },
    estimatedWeeks: { type: "number" },
    milestones: {
      type: "array",
      items: {
        type: "object",
        properties: {
          title: { type: "string" },
          goal: { type: "string" },
          focusArea: { type: "string" },
          units: {
            type: "array",
            items: {
              type: "object",
              properties: {
                kind: { type: "string", enum: ["lesson_card", "exercise_mc", "exercise_fill", "checkpoint"] },
                focus: { type: "string" },
                sourceUnitIds: { type: "array", items: { type: "string" } },
              },
              required: ["kind", "focus", "sourceUnitIds"],
              additionalProperties: false,
            },
          },
        },
        required: ["title", "goal", "units"],
        additionalProperties: false,
      },
    },
  },
  required: ["title", "estimatedWeeks", "milestones"],
  additionalProperties: false,
}

export interface WorkspaceKnowledgeUnit {
  id: string
  type: string
  content: string
  tags: string[] | null
}

export async function loadWorkspaceKnowledgeUnits(workspaceId: string): Promise<WorkspaceKnowledgeUnit[]> {
  const rows = await db.select({
    id: knowledgeUnits.id,
    type: knowledgeUnits.type,
    content: knowledgeUnits.content,
    tags: knowledgeUnits.tags,
  }).from(knowledgeUnits)
    .where(and(
      eq(knowledgeUnits.workspaceId, workspaceId),
      inArray(knowledgeUnits.status, ["proposed", "approved"])
    ))
  return rows
}

// Focus areas are derived, not invented: section titles + distinct tags
export async function deriveFocusAreas(workspaceId: string, units: WorkspaceKnowledgeUnit[]): Promise<string[]> {
  const forgeRows = await db.select({ id: forges.id }).from(forges)
    .where(eq(forges.workspaceId, workspaceId))
  const sectionRows = forgeRows.length > 0
    ? await db.select({ title: interviewSections.title }).from(interviewSections)
        .where(inArray(interviewSections.forgeId, forgeRows.map(r => r.id)))
    : []

  const tagCounts = new Map<string, number>()
  for (const u of units) {
    for (const t of u.tags || []) tagCounts.set(t, (tagCounts.get(t) || 0) + 1)
  }
  const topTags = [...tagCounts.entries()]
    .filter(([, n]) => n >= 3)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6)
    .map(([t]) => t)

  const areas = [...sectionRows.map(s => s.title), ...topTags]
  return [...new Set(areas)].slice(0, 10)
}

export async function generatePathSkeleton(
  expert: WorkspaceExpertInfo,
  units: WorkspaceKnowledgeUnit[],
  goal: LearnerGoal,
  dailyMinutes: number,
  focusAreas: string[],
  preferences: LearnerPreferences | null
): Promise<PathSequence> {
  const caps = MILESTONE_CAPS[goal]
  const unitsPerSession = Math.max(1, Math.round(dailyMinutes / MINUTES_PER_UNIT))
  const maxUnitsPerMilestone = Math.min(12, unitsPerSession * 5) // ≈ one week per milestone

  const corpus = units.map(u => `${u.id} [${u.type}] ${u.content}`).join("\n")
  const preferenceNote = preferences?.instructions?.length
    ? `\nLEARNER PREFERENCES (respect in titles/framing): ${preferences.instructions.join("; ")}`
    : ""
  const focusNote = focusAreas.length > 0
    ? `\nFOCUS AREAS SELECTED BY THE LEARNER (order matching milestones first, expand their coverage): ${focusAreas.join(", ")}`
    : ""

  const goalGuidance: Record<LearnerGoal, string> = {
    basics: "Prioritise facts, definitions, and warnings. Lean on lesson cards and fill-in exercises.",
    deep: "Cover everything: procedures, decision rules, examples, nuances.",
    practical: "Prioritise procedures, decision rules, and examples. Weight toward exercises.",
  }

  const prompt = `Design a paced learning path from this expert's knowledge corpus.

EXPERT: ${expert.expertName}
DOMAIN: ${expert.domain}
TARGET AUDIENCE: ${expert.targetAudience || "General audience"}
LEARNER GOAL: ${goal} — ${goalGuidance[goal]}
TIME BUDGET: ${dailyMinutes} min/day (~${unitsPerSession} units per session)${focusNote}${preferenceNote}

KNOWLEDGE CORPUS (id [type] content):
${corpus}

RULES:
- Create ${caps.min}-${caps.max} milestones, each with up to ${maxUnitsPerMilestone} units.
- Unit kinds: "lesson_card" (teaches 1 concept), "exercise_mc" (multiple choice), "exercise_fill" (fill-in-the-blank), "checkpoint" (review marker).
- Alternate teaching and practice: a lesson_card followed by an exercise on the same knowledge.
- Every milestone ends with a "checkpoint" unit.
- Every unit's sourceUnitIds MUST reference ids from the corpus above. If the corpus doesn't support a milestone, omit the milestone — do NOT fill gaps with general knowledge.
- exercise_fill works best on fact/definition/metric knowledge; exercise_mc on decision_rule/warning knowledge.
- Each unit's "focus" states the specific knowledge it covers (be concrete, not generic).
- The final milestone must be titled "Master and retain" and consist of exercises revisiting the most important knowledge, ending with a checkpoint.

Return JSON matching the schema.`

  const skeleton = await generateJSON<PathSequence>(prompt, {
    system: "You are an expert learning designer. You turn expert knowledge corpora into paced, practice-heavy learning paths. Output valid JSON only.",
    temperature: 0.5,
    maxTokens: 8192,
    schema: PATH_SKELETON_SCHEMA,
    effort: "high",
  })

  // Caps and provenance enforcement in code
  const validIds = new Set(units.map(u => u.id))
  skeleton.milestones = skeleton.milestones.slice(0, caps.max).map(m => ({
    ...m,
    units: m.units.slice(0, maxUnitsPerMilestone).map(u => ({
      ...u,
      sourceUnitIds: u.sourceUnitIds.filter(id => validIds.has(id)),
    })).filter(u => u.kind === "checkpoint" || u.sourceUnitIds.length > 0),
  })).filter(m => m.units.length > 0)

  return skeleton
}

export function estimatePathDays(sequence: PathSequence, dailyMinutes: number): number {
  const totalUnits = sequence.milestones.reduce((n, m) => n + m.units.length, 0)
  const unitsPerDay = Math.max(1, Math.round(dailyMinutes / MINUTES_PER_UNIT))
  return Math.max(1, Math.ceil(totalUnits / unitsPerDay))
}
