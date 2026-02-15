import { Hono } from "hono"
import { db, forges } from "@forge/db"
import { eq, desc } from "drizzle-orm"

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
  const { title, expertName, expertBio, domain, targetAudience, depth } = body

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

// Delete a forge
app.delete("/:id", async (c) => {
  const { id } = c.req.param()
  await db.delete(forges).where(eq(forges.id, id))
  return c.json({ ok: true })
})

export default app
