/**
 * Backfill embeddings for extractions and knowledge units that don't have them yet.
 * Run after migration 0011 (which NULLs every embedding for the Bedrock switch).
 *
 * Usage: bun run --cwd packages/db backfill-embeddings
 * Needs DATABASE_URL, AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY, AWS_REGION.
 */
import { db } from "./index"
import { sql } from "drizzle-orm"
import {
  createEmbeddingClientFromEnv,
  createPgEmbeddingCache,
  embedBatchCached,
  isEmbeddingConfigured,
  toVectorStr,
} from "./embedding-client"

const BATCH_SIZE = 50

if (!isEmbeddingConfigured()) {
  console.error("Missing AWS credentials (AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY, or AWS_PROFILE)")
  process.exit(1)
}

const client = createEmbeddingClientFromEnv()
const cache = createPgEmbeddingCache(db)

async function backfillTable(table: "extractions" | "knowledge_units"): Promise<number> {
  const rows = (await db.execute(
    sql`SELECT id, type, content FROM ${sql.identifier(table)} WHERE embedding IS NULL ORDER BY created_at ASC`
  )) as any[]

  if (rows.length === 0) {
    console.log(`${table}: all rows already have embeddings.`)
    return 0
  }
  console.log(`${table}: ${rows.length} rows without embeddings (model ${client.model}, ${client.dimensions} dims)...`)

  let errors = 0
  for (let start = 0; start < rows.length; start += BATCH_SIZE) {
    const batch = rows.slice(start, start + BATCH_SIZE)
    try {
      const embeddings = await embedBatchCached(client, cache, batch.map((r) => `[${r.type}] ${r.content}`))
      for (let i = 0; i < batch.length; i++) {
        await db.execute(
          sql`UPDATE ${sql.identifier(table)} SET embedding = ${toVectorStr(embeddings[i])}::vector WHERE id = ${batch[i].id}`
        )
      }
      console.log(`  ${table}: ${Math.min(start + BATCH_SIZE, rows.length)}/${rows.length}`)
    } catch (err) {
      console.error(`  ${table}: batch error at ${start}:`, err)
      errors += batch.length
    }
  }
  return errors
}

async function backfill() {
  const errors = (await backfillTable("extractions")) + (await backfillTable("knowledge_units"))
  console.log(`\nBackfill complete with ${errors} errors.`)
  process.exit(errors > 0 ? 1 : 0)
}

backfill()
