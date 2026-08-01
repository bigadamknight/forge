import { db, pathUnits, attempts } from "@forge/db"
import { eq, and, desc, asc, inArray } from "drizzle-orm"
import { generateJSON, HAIKU } from "../lib/llm"
import type { CheckpointReviewContent, ExerciseMCContent, ExerciseFillContent, ExerciseOrderContent, PathUnitContent } from "@forge/shared"

// SM-2-lite. Scheduling is code, not model: ease drifts with performance,
// intervals grow with the learner's consecutive-correct streak.

const EASE_START = 2.5
const EASE_MIN = 1.3
const EASE_MAX = 2.8

export interface SrsState {
  ease: number
  dueAt: Date
}

export function computeSrs(
  priorAttempts: Array<{ correct: string | null; ease: number | null }>,
  correct: "yes" | "no" | "partial"
): SrsState {
  const lastEase = priorAttempts[0]?.ease ?? EASE_START

  let streak = 0
  for (const a of priorAttempts) {
    if (a.correct === "yes") streak++
    else break
  }

  let ease: number
  let intervalDays: number
  if (correct === "yes") {
    ease = Math.min(EASE_MAX, lastEase + 0.1)
    intervalDays = Math.max(1, Math.round(Math.pow(ease, streak))) // 1, ~2.6, ~6.8, ...
  } else if (correct === "partial") {
    ease = Math.max(EASE_MIN, lastEase - 0.15)
    intervalDays = 1
  } else {
    ease = Math.max(EASE_MIN, lastEase - 0.3)
    intervalDays = 0 // due now — first candidate for the next checkpoint
  }

  return { ease, dueAt: new Date(Date.now() + intervalDays * 24 * 60 * 60 * 1000) }
}

// ============ Checkpoint resolution (serve time) ============

type ReviewableExercise = ExerciseMCContent | ExerciseFillContent | ExerciseOrderContent

const EXERCISE_KINDS: Array<"exercise_mc" | "exercise_fill" | "exercise_order"> = ["exercise_mc", "exercise_fill", "exercise_order"]

// Pick the learner's weakest / stalest completed exercises: wrong answers
// first, then those due for review, then oldest successes.
export async function resolveCheckpoint(
  pathId: string,
  learnerId: string,
  maxExercises = 3
): Promise<CheckpointReviewContent | null> {
  const completedExercises = await db.select().from(pathUnits)
    .where(and(
      eq(pathUnits.pathId, pathId),
      eq(pathUnits.status, "completed"),
      inArray(pathUnits.kind, EXERCISE_KINDS)
    ))
    .orderBy(asc(pathUnits.orderIndex))
  if (completedExercises.length === 0) return null

  const unitIds = completedExercises.map(u => u.id)
  const allAttempts = await db.select().from(attempts)
    .where(and(eq(attempts.learnerId, learnerId), inArray(attempts.pathUnitId, unitIds)))
    .orderBy(desc(attempts.createdAt))

  const latestByUnit = new Map<string, typeof allAttempts[number]>()
  for (const a of allAttempts) {
    if (!latestByUnit.has(a.pathUnitId)) latestByUnit.set(a.pathUnitId, a)
  }

  const now = Date.now()
  const scored = completedExercises.map(u => {
    const latest = latestByUnit.get(u.id)
    let priority: number
    if (!latest) priority = 2                                   // never attempted (completed via skip)
    else if (latest.correct !== "yes") priority = 0             // got it wrong — review first
    else if (latest.dueAt && latest.dueAt.getTime() <= now) priority = 1  // due for review
    else priority = 3                                           // healthy — only if nothing else
    const tiebreak = latest?.dueAt?.getTime() ?? latest?.createdAt.getTime() ?? 0
    return { unit: u, priority, tiebreak }
  })
  scored.sort((a, b) => a.priority - b.priority || a.tiebreak - b.tiebreak)

  const picked = scored.slice(0, maxExercises).filter(s => s.unit.content)
  if (picked.length === 0) return null

  const exercises: ReviewableExercise[] = []
  for (const { unit } of picked) {
    const content = unit.content as PathUnitContent
    if (content.kind === "exercise_mc" || content.kind === "exercise_order") {
      exercises.push(await paraphraseExercise(content))
    } else if (content.kind === "exercise_fill") {
      exercises.push(content) // blanks are fragile — re-serve verbatim
    }
  }
  if (exercises.length === 0) return null

  return {
    kind: "checkpoint_review",
    intro: "Checkpoint — a quick review of what you've covered, focused on where you can grow.",
    exercises,
    sourcePathUnitIds: picked.map(p => p.unit.id),
  }
}

// Light Haiku paraphrase so re-served exercises don't feel copy-pasted.
// Options/steps/answers stay identical; only the question framing changes.
async function paraphraseExercise<T extends ExerciseMCContent | ExerciseOrderContent>(content: T): Promise<T> {
  const field = content.kind === "exercise_mc" ? "question" : "prompt"
  const original = (content as any)[field] as string
  try {
    const result = await generateJSON<{ text: string }>(
      `Rephrase this exercise question so it reads freshly but tests exactly the same thing. Keep all facts, numbers, and difficulty identical. Return JSON: {"text": "..."}\n\nOriginal: ${original}`,
      { model: HAIKU, temperature: 0.6, maxTokens: 256 }
    )
    if (result.text && result.text.length > 10) {
      return { ...content, [field]: result.text }
    }
  } catch (err) {
    console.error("[srs] Paraphrase failed, serving original:", err)
  }
  return content
}
