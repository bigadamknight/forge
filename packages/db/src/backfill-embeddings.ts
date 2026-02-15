/**
 * Backfill embeddings for existing extractions that don't have them yet.
 *
 * Usage: bun run --cwd packages/db src/backfill-embeddings.ts
 */
import { db } from "./index"
import { sql } from "drizzle-orm"
import { createHash } from "crypto"

const EMBEDDING_URL = process.env.AZURE_OPENAI_EMBEDDING_URL
const EMBEDDING_API_KEY = process.env.AZURE_OPENAI_EMBEDDING_API_KEY
const BATCH_SIZE = 16
const MAX_TEXT_LENGTH = 30000

if (!EMBEDDING_URL || !EMBEDDING_API_KEY) {
  console.error("Missing AZURE_OPENAI_EMBEDDING_URL or AZURE_OPENAI_EMBEDDING_API_KEY")
  process.exit(1)
}

async function backfill() {
  // Get all extractions without embeddings
  const rows = await db.execute(
    sql`SELECT id, type, content FROM extractions WHERE embedding IS NULL ORDER BY created_at ASC`
  )

  const total = rows.length
  if (total === 0) {
    console.log("All extractions already have embeddings.")
    process.exit(0)
  }

  console.log(`Found ${total} extractions without embeddings. Processing in batches of ${BATCH_SIZE}...`)

  let processed = 0
  let errors = 0
  const items = rows as any[]

  for (let start = 0; start < total; start += BATCH_SIZE) {
    const batch = items.slice(start, start + BATCH_SIZE)
    const texts = batch.map((r: any) => `[${r.type}] ${r.content}`.slice(0, MAX_TEXT_LENGTH))

    try {
      const response = await fetch(EMBEDDING_URL!, {
        method: "POST",
        headers: {
          "api-key": EMBEDDING_API_KEY!,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ input: texts }),
      })

      if (!response.ok) {
        console.error(`Batch error at ${start}: ${response.status} ${response.statusText}`)
        errors += batch.length
        continue
      }

      const data = await response.json()

      for (const item of data.data) {
        const row = batch[item.index]
        const embedding: number[] = item.embedding
        const vectorStr = `[${embedding.join(",")}]`

        // Update extraction
        await db.execute(
          sql`UPDATE extractions SET embedding = ${vectorStr}::vector WHERE id = ${row.id}`
        )

        // Cache the embedding
        const hash = createHash("sha256").update(texts[item.index]).digest("hex")
        await db.execute(
          sql`INSERT INTO embedding_cache (content_hash, embedding) VALUES (${hash}, ${vectorStr}::vector) ON CONFLICT (content_hash) DO NOTHING`
        )

        processed++
      }

      console.log(`  Processed ${Math.min(start + BATCH_SIZE, total)}/${total}`)
    } catch (err) {
      console.error(`Batch error at ${start}:`, err)
      errors += batch.length
    }
  }

  console.log(`\nBackfill complete: ${processed} embedded, ${errors} errors out of ${total} total.`)
  process.exit(0)
}

backfill()
