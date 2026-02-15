import { Hono } from "hono"
import { db, documents, forges } from "@forge/db"
import { eq, and, asc } from "drizzle-orm"

const app = new Hono()

// ============ Add Document ============

app.post("/:forgeId/documents", async (c) => {
  const { forgeId } = c.req.param()
  const { type, title, content } = await c.req.json()

  if (!type || !title || !content) {
    return c.json({ error: "type, title, and content are required" }, 400)
  }

  if (type !== "text" && type !== "url") {
    return c.json({ error: "type must be 'text' or 'url'" }, 400)
  }

  const [forge] = await db.select().from(forges).where(eq(forges.id, forgeId)).limit(1)
  if (!forge) return c.json({ error: "Forge not found" }, 404)

  let extractedContent: string | null = null

  // For URLs, fetch and extract text content
  if (type === "url") {
    try {
      const response = await fetch(content, {
        headers: { "User-Agent": "Forge/1.0" },
        signal: AbortSignal.timeout(10000),
      })
      if (response.ok) {
        const html = await response.text()
        // Strip HTML tags to get plain text
        extractedContent = html
          .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
          .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
          .replace(/<[^>]+>/g, " ")
          .replace(/\s+/g, " ")
          .trim()
          .slice(0, 50000) // Cap at 50k chars
      }
    } catch (err: any) {
      console.warn(`[documents] Failed to fetch URL: ${err.message}`)
      // Store the URL anyway, just without extracted content
    }
  }

  const [doc] = await db.insert(documents).values({
    forgeId,
    type,
    title,
    content,
    extractedContent,
  }).returning()

  return c.json(doc)
})

// ============ List Documents ============

app.get("/:forgeId/documents", async (c) => {
  const { forgeId } = c.req.param()

  const docs = await db.select().from(documents)
    .where(eq(documents.forgeId, forgeId))
    .orderBy(asc(documents.createdAt))

  return c.json(docs)
})

// ============ Update Document ============

app.patch("/:forgeId/documents/:docId", async (c) => {
  const { forgeId, docId } = c.req.param()
  const { title, content } = await c.req.json()

  const updates: Record<string, string> = {}
  if (title !== undefined) updates.title = title
  if (content !== undefined) updates.content = content

  if (Object.keys(updates).length === 0) {
    return c.json({ error: "Nothing to update" }, 400)
  }

  const [doc] = await db.update(documents)
    .set(updates)
    .where(and(eq(documents.id, docId), eq(documents.forgeId, forgeId)))
    .returning()

  if (!doc) return c.json({ error: "Document not found" }, 404)

  return c.json(doc)
})

// ============ Delete Document ============

app.delete("/:forgeId/documents/:docId", async (c) => {
  const { forgeId, docId } = c.req.param()

  const result = await db.delete(documents)
    .where(and(eq(documents.id, docId), eq(documents.forgeId, forgeId)))
    .returning()

  if (result.length === 0) return c.json({ error: "Document not found" }, 404)

  return c.json({ deleted: true })
})

export default app
