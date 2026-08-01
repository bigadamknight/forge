import { Hono } from "hono"
import { streamSSE } from "hono/streaming"
import { db, workspaces, learners, paths, pathUnits, attempts } from "@forge/db"
import { eq, asc, and } from "drizzle-orm"
import { getWorkspaceExpertInfo } from "../services/expert-context"
import {
  loadWorkspaceKnowledgeUnits,
  deriveFocusAreas,
  generatePathSkeleton,
  estimatePathDays,
} from "../services/path-planner"
import { buildUnitSystemPrompt, generateUnitContent, summarizeUnitContent } from "../services/unit-generator"
import type { PathSequence } from "@forge/shared"

const app = new Hono()

// How many un-generated units to keep ready ahead of the learner
const GENERATION_BUFFER = 3

// ============ Focus vocabulary for onboarding ============

app.get("/:workspaceId/focus-areas", async (c) => {
  const { workspaceId } = c.req.param()
  const units = await loadWorkspaceKnowledgeUnits(workspaceId)
  const focusAreas = await deriveFocusAreas(workspaceId, units)
  return c.json({ focusAreas, knowledgeCount: units.length })
})

// ============ Onboard: create learner + plan path (SSE) ============

app.post("/:workspaceId/onboard", async (c) => {
  const { workspaceId } = c.req.param()
  const { displayName, goal, dailyMinutes, focusAreas, preferences } = await c.req.json()

  if (!goal || !dailyMinutes) {
    return c.json({ error: "goal and dailyMinutes are required" }, 400)
  }

  const [workspace] = await db.select().from(workspaces)
    .where(eq(workspaces.id, workspaceId)).limit(1)
  if (!workspace) return c.json({ error: "Workspace not found" }, 404)

  const knowledge = await loadWorkspaceKnowledgeUnits(workspaceId)
  if (knowledge.length === 0) {
    return c.json({ error: "No knowledge available yet. Complete an interview first." }, 400)
  }

  const expert = await getWorkspaceExpertInfo(workspaceId)

  return streamSSE(c, async (stream) => {
    try {
      const [learner] = await db.insert(learners).values({
        workspaceId,
        displayName: displayName || null,
        preferences: preferences || null,
      }).returning()

      console.log(`[learn] Planning path for learner ${learner.id} (goal=${goal}, ${dailyMinutes}min/day)`)
      const sequence = await generatePathSkeleton(
        expert, knowledge, goal, dailyMinutes, focusAreas || [], preferences || null
      )
      const estimatedDays = estimatePathDays(sequence, dailyMinutes)

      const [path] = await db.insert(paths).values({
        learnerId: learner.id,
        workspaceId,
        goal,
        dailyMinutes,
        focusAreas: focusAreas || [],
        sequence,
        estimatedDays,
      }).returning()

      // Materialise path_units rows (pending) from the sequence
      let orderIndex = 0
      for (const milestone of sequence.milestones) {
        for (const unit of milestone.units) {
          await db.insert(pathUnits).values({
            pathId: path.id,
            orderIndex: orderIndex++,
            kind: unit.kind,
            sourceUnitIds: unit.sourceUnitIds,
          })
        }
      }

      await stream.writeSSE({
        data: JSON.stringify({
          type: "plan",
          learnerId: learner.id,
          pathId: path.id,
          sequence,
          estimatedDays,
        }),
      })

      // Eagerly generate the first session's worth of units
      const generated = await generateAhead(path.id, expert, knowledge, learner.preferences, GENERATION_BUFFER,
        async (unit) => {
          await stream.writeSSE({
            data: JSON.stringify({ type: "unit", unitId: unit.id, orderIndex: unit.orderIndex, content: unit.content }),
          })
        })
      console.log(`[learn] Path ${path.id} planned (${orderIndex} units, ${generated} eagerly generated)`)

      await stream.writeSSE({ data: JSON.stringify({ type: "complete", pathId: path.id }) })
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error"
      console.error("[learn/onboard] Error:", message)
      await stream.writeSSE({ data: JSON.stringify({ type: "error", message }) })
    }
  })
})

// ============ Get path (trail view) ============

app.get("/path/:pathId", async (c) => {
  const { pathId } = c.req.param()
  const [path] = await db.select().from(paths).where(eq(paths.id, pathId)).limit(1)
  if (!path) return c.json({ error: "Path not found" }, 404)

  const units = await db.select({
    id: pathUnits.id,
    orderIndex: pathUnits.orderIndex,
    kind: pathUnits.kind,
    status: pathUnits.status,
  }).from(pathUnits)
    .where(eq(pathUnits.pathId, pathId))
    .orderBy(asc(pathUnits.orderIndex))

  const completed = units.filter(u => u.status === "completed").length
  const remaining = units.length - completed
  const unitsPerDay = Math.max(1, Math.round(path.dailyMinutes / 3))
  const remainingDays = Math.ceil(remaining / unitsPerDay)

  return c.json({
    path: {
      id: path.id,
      learnerId: path.learnerId,
      workspaceId: path.workspaceId,
      goal: path.goal,
      dailyMinutes: path.dailyMinutes,
      focusAreas: path.focusAreas,
      sequence: path.sequence,
      status: path.status,
      estimatedDays: path.estimatedDays,
    },
    units,
    progress: { completed, total: units.length, remainingDays },
  })
})

// ============ Session: next units (lazy generation) ============

app.post("/path/:pathId/next", async (c) => {
  const { pathId } = c.req.param()
  let count = 0
  try {
    const body = await c.req.json()
    count = body?.count || 0
  } catch {}
  const sessionSize = Math.max(1, Math.min(count || 5, 10))

  const [path] = await db.select().from(paths).where(eq(paths.id, pathId)).limit(1)
  if (!path) return c.json({ error: "Path not found" }, 404)

  // Serve already-generated units immediately; only block on generation when
  // nothing is ready. Any shortfall is topped up in the background.
  let upcoming = await db.select().from(pathUnits)
    .where(and(eq(pathUnits.pathId, pathId), eq(pathUnits.status, "generated")))
    .orderBy(asc(pathUnits.orderIndex))
    .limit(sessionSize)

  if (upcoming.length === 0) {
    const expert = await getWorkspaceExpertInfo(path.workspaceId)
    const knowledge = await loadWorkspaceKnowledgeUnits(path.workspaceId)
    const [learner] = await db.select().from(learners).where(eq(learners.id, path.learnerId)).limit(1)
    await generateAhead(pathId, expert, knowledge, learner?.preferences ?? null, sessionSize)
    upcoming = await db.select().from(pathUnits)
      .where(and(eq(pathUnits.pathId, pathId), eq(pathUnits.status, "generated")))
      .orderBy(asc(pathUnits.orderIndex))
      .limit(sessionSize)
  } else if (upcoming.length < sessionSize) {
    topUpBuffer(pathId)
  }

  return c.json({ units: upcoming })
})

// ============ Attempts & completion ============

app.post("/unit/:unitId/attempt", async (c) => {
  const { unitId } = c.req.param()
  const { learnerId, answer, correct, latencyMs } = await c.req.json()
  if (!learnerId) return c.json({ error: "learnerId is required" }, 400)

  const [unit] = await db.select().from(pathUnits).where(eq(pathUnits.id, unitId)).limit(1)
  if (!unit) return c.json({ error: "Unit not found" }, 404)

  const [attempt] = await db.insert(attempts).values({
    pathUnitId: unitId,
    learnerId,
    answer: answer ?? null,
    correct: correct ?? null,
    latencyMs: latencyMs ?? null,
  }).returning()

  await db.update(pathUnits).set({
    status: "completed",
    completedAt: new Date(),
  }).where(eq(pathUnits.id, unitId))

  // Top up the generation buffer in the background
  topUpBuffer(unit.pathId)

  return c.json({ ok: true, attemptId: attempt.id })
})

app.post("/unit/:unitId/complete", async (c) => {
  const { unitId } = c.req.param()
  const [unit] = await db.select().from(pathUnits).where(eq(pathUnits.id, unitId)).limit(1)
  if (!unit) return c.json({ error: "Unit not found" }, 404)

  await db.update(pathUnits).set({
    status: "completed",
    completedAt: new Date(),
  }).where(eq(pathUnits.id, unitId))

  topUpBuffer(unit.pathId)

  return c.json({ ok: true })
})

// ============ Helpers ============

// Generate content for pending units up to `horizon` ahead of the learner's
// position. Checkpoints are marked generated without LLM content (Phase 1:
// rendered as milestone markers; Phase 2 makes them adaptive reviews).
async function generateAhead(
  pathId: string,
  expert: Awaited<ReturnType<typeof getWorkspaceExpertInfo>>,
  knowledge: Awaited<ReturnType<typeof loadWorkspaceKnowledgeUnits>>,
  preferences: any,
  horizon: number,
  onUnit?: (unit: { id: string; orderIndex: number; content: unknown }) => Promise<void>
): Promise<number> {
  const pending = await db.select().from(pathUnits)
    .where(and(eq(pathUnits.pathId, pathId), eq(pathUnits.status, "pending")))
    .orderBy(asc(pathUnits.orderIndex))
    .limit(horizon)
  if (pending.length === 0) return 0

  const [path] = await db.select({ sequence: paths.sequence }).from(paths)
    .where(eq(paths.id, pathId)).limit(1)
  const sequence = path?.sequence as PathSequence | null
  const specByOrder = new Map<number, { focus: string }>()
  if (sequence) {
    let i = 0
    for (const m of sequence.milestones) {
      for (const u of m.units) specByOrder.set(i++, { focus: u.focus })
    }
  }

  // Prior generated units for dedup context
  const generatedPrior = await db.select().from(pathUnits)
    .where(and(eq(pathUnits.pathId, pathId), eq(pathUnits.status, "generated")))
    .orderBy(asc(pathUnits.orderIndex))
  const priorSummaries = generatedPrior
    .filter(u => u.content)
    .map(u => summarizeUnitContent(u.content as any))
    .slice(-10)

  const systemPrompt = buildUnitSystemPrompt(expert, knowledge, preferences)
  let generated = 0

  for (const unit of pending) {
    if (unit.kind === "checkpoint") {
      await db.update(pathUnits).set({ status: "generated", generatedAt: new Date() })
        .where(eq(pathUnits.id, unit.id))
      continue
    }
    const spec = specByOrder.get(unit.orderIndex)
    try {
      const content = await generateUnitContent(
        unit.kind,
        spec?.focus || "the cited knowledge",
        unit.sourceUnitIds || [],
        systemPrompt,
        priorSummaries
      )
      await db.update(pathUnits).set({
        content: content as any,
        status: "generated",
        generatedAt: new Date(),
      }).where(eq(pathUnits.id, unit.id))
      priorSummaries.push(summarizeUnitContent(content))
      generated++
      if (onUnit) await onUnit({ id: unit.id, orderIndex: unit.orderIndex, content })
    } catch (err) {
      console.error(`[learn] Unit generation failed for ${unit.id} (${unit.kind}):`, err)
    }
  }
  return generated
}

// Fire-and-forget buffer top-up after a unit completes
function topUpBuffer(pathId: string) {
  ;(async () => {
    const [path] = await db.select().from(paths).where(eq(paths.id, pathId)).limit(1)
    if (!path) return
    const expert = await getWorkspaceExpertInfo(path.workspaceId)
    const knowledge = await loadWorkspaceKnowledgeUnits(path.workspaceId)
    const [learner] = await db.select().from(learners).where(eq(learners.id, path.learnerId)).limit(1)
    await generateAhead(pathId, expert, knowledge, learner?.preferences ?? null, GENERATION_BUFFER)
  })().catch(err => console.error(`[learn] Buffer top-up failed for path ${pathId}:`, err))
}

export default app
