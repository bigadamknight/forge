import { Hono } from "hono"
import { db, forges, extractions } from "@forge/db"
import { eq, desc } from "drizzle-orm"
import { generateJSON, HAIKU } from "../lib/llm"

const app = new Hono()

// List all forges (lightweight - no large JSON blobs)
app.get("/", async (c) => {
  const results = await db
    .select({
      id: forges.id,
      title: forges.title,
      expertName: forges.expertName,
      domain: forges.domain,
      targetAudience: forges.targetAudience,
      status: forges.status,
      createdAt: forges.createdAt,
      updatedAt: forges.updatedAt,
    })
    .from(forges)
    .orderBy(desc(forges.createdAt))

  return c.json(results)
})

// Get a single forge
app.get("/:id", async (c) => {
  const { id } = c.req.param()
  const [forge] = await db
    .select()
    .from(forges)
    .where(eq(forges.id, id))
    .limit(1)

  if (!forge) {
    return c.json({ error: "Forge not found" }, 404)
  }
  return c.json(forge)
})

// Create a new forge
app.post("/", async (c) => {
  const body = await c.req.json()
  const { title, expertName, expertBio, domain, targetAudience, depth, draft } = body

  // Draft mode: create minimal forge for intro conversation
  if (draft) {
    const [forge] = await db
      .insert(forges)
      .values({
        title: "New Forge",
        status: "draft",
        metadata: { introMessages: [], introExtracted: {} },
      })
      .returning()
    return c.json(forge, 201)
  }

  if (!title || !expertName || !domain) {
    return c.json({ error: "title, expertName, and domain are required" }, 400)
  }

  const [forge] = await db
    .insert(forges)
    .values({
      title,
      expertName,
      expertBio,
      domain,
      targetAudience,
      depth: depth || "standard",
      status: "draft",
    })
    .returning()

  return c.json(forge, 201)
})

// Generate short contextual phrases for planning animations
app.post("/planning-text", async (c) => {
  const { expertName, domain, targetAudience } = await c.req.json()

  if (!expertName || !domain) {
    return c.json({ error: "expertName and domain are required" }, 400)
  }

  const result = await generateJSON<{ nodes: string[] }>(
    `Generate 10-14 short terms (1-3 words each) related to this expert's knowledge domain. Include a mix of:
- Core concepts and techniques from their field
- Tools, frameworks or methodologies they'd use
- Outcomes or goals their audience cares about
- The expert's name as one node
- 1-2 abstract/evocative terms

Expert: ${expertName}
Domain: ${domain}
${targetAudience ? `Audience: ${targetAudience}` : ""}

Return JSON: { "nodes": ["term1", "term2", ...] }`,
    { model: HAIKU, maxTokens: 300, temperature: 0.8 }
  )

  return c.json(result)
})

// Dev: seed test extractions for a forge
app.post("/:id/seed-extractions", async (c) => {
  const { id } = c.req.param()
  const [forge] = await db.select().from(forges).where(eq(forges.id, id)).limit(1)
  if (!forge) return c.json({ error: "Forge not found" }, 404)

  const types = ["fact", "procedure", "decision_rule", "warning", "tip", "metric", "example", "context"] as const

  const result = await generateJSON<{ extractions: Array<{ type: string; content: string; tags: string[] }> }>(
    `Generate 15-20 realistic knowledge extractions that an expert in this domain would share during an interview.

Expert: ${forge.expertName}
Domain: ${forge.domain}
${forge.targetAudience ? `Audience: ${forge.targetAudience}` : ""}
${forge.expertBio ? `Bio: ${forge.expertBio}` : ""}

Each extraction should be a specific, actionable piece of knowledge (1-3 sentences).
Use these types: ${types.join(", ")}

Return JSON: { "extractions": [{ "type": "fact|procedure|decision_rule|warning|tip|metric|example|context", "content": "...", "tags": ["tag1", "tag2"] }, ...] }`,
    { model: HAIKU, maxTokens: 4096, temperature: 0.7 }
  )

  const rows = result.extractions.map((ext) => ({
    forgeId: id,
    type: (types.includes(ext.type as any) ? ext.type : "fact") as typeof types[number],
    content: ext.content,
    confidence: 0.85 + Math.random() * 0.15,
    tags: ext.tags,
  }))

  await db.insert(extractions).values(rows)

  // Update forge status to processing (ready for tool gen)
  await db.update(forges).set({ status: "processing", updatedAt: new Date() }).where(eq(forges.id, id))

  return c.json({ seeded: rows.length })
})

// Delete a forge
app.delete("/:id", async (c) => {
  const { id } = c.req.param()
  await db.delete(forges).where(eq(forges.id, id))
  return c.json({ ok: true })
})

export default app
