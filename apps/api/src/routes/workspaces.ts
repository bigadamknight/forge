import { Hono } from "hono"
import { db, workspaces, forges } from "@forge/db"
import { eq, desc, sql } from "drizzle-orm"

const app = new Hono()

// List all workspaces with interview counts
app.get("/", async (c) => {
  const results = await db
    .select({
      id: workspaces.id,
      title: workspaces.title,
      description: workspaces.description,
      metadata: workspaces.metadata,
      createdAt: workspaces.createdAt,
      updatedAt: workspaces.updatedAt,
    })
    .from(workspaces)
    .orderBy(desc(workspaces.createdAt))

  // Get interview summaries for each workspace
  const withInterviews = await Promise.all(
    results.map(async (ws) => {
      const interviews = await db
        .select({
          id: forges.id,
          title: forges.title,
          expertName: forges.expertName,
          domain: forges.domain,
          status: forges.status,
          createdAt: forges.createdAt,
        })
        .from(forges)
        .where(eq(forges.workspaceId, ws.id))
        .orderBy(desc(forges.createdAt))

      return {
        ...ws,
        interviewCount: interviews.length,
        latestStatus: interviews[0]?.status || "draft",
        expertName: interviews[0]?.expertName || null,
        domain: interviews[0]?.domain || null,
      }
    })
  )

  return c.json(withInterviews)
})

// Get workspace detail with interviews
app.get("/:workspaceId", async (c) => {
  const { workspaceId } = c.req.param()

  const [workspace] = await db
    .select()
    .from(workspaces)
    .where(eq(workspaces.id, workspaceId))
    .limit(1)

  if (!workspace) return c.json({ error: "Workspace not found" }, 404)

  const interviews = await db
    .select({
      id: forges.id,
      title: forges.title,
      expertName: forges.expertName,
      domain: forges.domain,
      targetAudience: forges.targetAudience,
      status: forges.status,
      depth: forges.depth,
      metadata: forges.metadata,
      createdAt: forges.createdAt,
      updatedAt: forges.updatedAt,
      completedAt: forges.completedAt,
    })
    .from(forges)
    .where(eq(forges.workspaceId, workspaceId))
    .orderBy(forges.createdAt)

  return c.json({ ...workspace, interviews })
})

// Create workspace with first draft interview
app.post("/", async (c) => {
  const body = await c.req.json().catch(() => ({}))
  const { title } = body

  const [workspace] = await db
    .insert(workspaces)
    .values({
      title: title || "New Workspace",
    })
    .returning()

  // Auto-create first draft interview
  const [interview] = await db
    .insert(forges)
    .values({
      workspaceId: workspace.id,
      title: "New Interview",
      status: "draft",
      metadata: { introMessages: [], introExtracted: {} },
    })
    .returning()

  return c.json({ workspace, interview }, 201)
})

// Create new interview in workspace
app.post("/:workspaceId/interviews", async (c) => {
  const { workspaceId } = c.req.param()
  const body = await c.req.json().catch(() => ({}))
  const { topic } = body

  const [workspace] = await db
    .select()
    .from(workspaces)
    .where(eq(workspaces.id, workspaceId))
    .limit(1)

  if (!workspace) return c.json({ error: "Workspace not found" }, 404)

  // Copy expert info from existing interviews
  const [existingInterview] = await db
    .select()
    .from(forges)
    .where(eq(forges.workspaceId, workspaceId))
    .orderBy(desc(forges.createdAt))
    .limit(1)

  // Follow-up interviews skip intro phase — go straight to planning-ready
  const hasExpertInfo = !!(existingInterview?.expertName && existingInterview?.domain)

  const [interview] = await db
    .insert(forges)
    .values({
      workspaceId,
      title: topic ? `Follow-up: ${topic}` : "New Interview",
      expertName: existingInterview?.expertName || null,
      domain: existingInterview?.domain || null,
      targetAudience: existingInterview?.targetAudience || null,
      expertBio: existingInterview?.expertBio || null,
      depth: existingInterview?.depth || "standard",
      status: hasExpertInfo ? "planning" : "draft",
      metadata: {
        ...(topic ? { followUpTopic: topic } : {}),
        introMessages: [],
        introExtracted: {},
      },
    })
    .returning()

  return c.json(interview, 201)
})

// Update workspace
app.patch("/:workspaceId", async (c) => {
  const { workspaceId } = c.req.param()
  const body = await c.req.json()
  const updates: Record<string, unknown> = {}

  if (body.title !== undefined) updates.title = body.title
  if (body.description !== undefined) updates.description = body.description

  if (Object.keys(updates).length === 0) {
    return c.json({ error: "Nothing to update" }, 400)
  }

  updates.updatedAt = new Date()

  const [updated] = await db
    .update(workspaces)
    .set(updates)
    .where(eq(workspaces.id, workspaceId))
    .returning()

  if (!updated) return c.json({ error: "Workspace not found" }, 404)

  return c.json(updated)
})

// Update workspace custom extraction types
app.put("/:workspaceId/extraction-types", async (c) => {
  const { workspaceId } = c.req.param()
  const { customExtractionTypes } = await c.req.json()

  if (!Array.isArray(customExtractionTypes)) {
    return c.json({ error: "customExtractionTypes must be an array" }, 400)
  }

  const [workspace] = await db
    .select()
    .from(workspaces)
    .where(eq(workspaces.id, workspaceId))
    .limit(1)

  if (!workspace) return c.json({ error: "Workspace not found" }, 404)

  const metadata = (workspace.metadata as Record<string, unknown>) || {}

  const [updated] = await db
    .update(workspaces)
    .set({
      metadata: { ...metadata, customExtractionTypes },
      updatedAt: new Date(),
    })
    .where(eq(workspaces.id, workspaceId))
    .returning()

  return c.json(updated)
})

// Delete workspace
app.delete("/:workspaceId", async (c) => {
  const { workspaceId } = c.req.param()
  await db.delete(workspaces).where(eq(workspaces.id, workspaceId))
  return c.json({ ok: true })
})

export default app
