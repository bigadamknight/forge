import { db, forges } from "@forge/db"
import { eq, sql } from "drizzle-orm"
import { embedKnowledgeUnitAsync } from "../lib/embeddings"

/**
 * Promote a forge's extractions into workspace-scoped knowledge units.
 * Idempotent: the partial unique index on extraction_id makes re-runs no-ops.
 * New units arrive as "proposed" for curation; embeddings are copied when the
 * source extraction already has one, otherwise generated async.
 */
export async function promoteExtractionsToUnits(forgeId: string): Promise<number> {
  const [forge] = await db.select({ workspaceId: forges.workspaceId })
    .from(forges).where(eq(forges.id, forgeId)).limit(1)
  if (!forge) return 0

  const rows = await db.execute(
    sql`INSERT INTO knowledge_units
          (workspace_id, extraction_id, type, content, structured, confidence, tags, status, embedding, created_at)
        SELECT ${forge.workspaceId}, e.id, e.type, e.content, e.structured, e.confidence, e.tags, 'proposed', e.embedding, e.created_at
        FROM extractions e
        WHERE e.forge_id = ${forgeId}
        ON CONFLICT DO NOTHING
        RETURNING id, type, content, embedding IS NULL AS needs_embedding`
  )

  for (const row of rows as any[]) {
    if (row.needs_embedding) {
      embedKnowledgeUnitAsync(row.id, row.type, row.content)
    }
  }

  console.log(`[knowledge-base] Promoted ${(rows as any[]).length} extractions to units for forge ${forgeId}`)
  return (rows as any[]).length
}
