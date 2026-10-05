import {
  db,
  createEmbeddingClientFromEnv,
  createPgEmbeddingCache,
  embedBatchCached,
  embedCached,
  isEmbeddingConfigured,
  toVectorStr,
  type EmbeddingClient,
} from "@forge/db"
import { sql } from "drizzle-orm"

const cache = createPgEmbeddingCache(db)
let client: EmbeddingClient | null = null

function getClient(): EmbeddingClient | null {
  if (!isEmbeddingConfigured()) return null
  client ??= createEmbeddingClientFromEnv()
  return client
}

// ============ Embedding Generation ============

export async function generateEmbedding(text: string): Promise<number[] | null> {
  const c = getClient()
  if (!c) return null
  try {
    return await embedCached(c, cache, text)
  } catch (err) {
    console.error("[embeddings] Bedrock embedding failed:", err)
    return null
  }
}

export async function generateBatchEmbeddings(texts: string[]): Promise<(number[] | null)[]> {
  const c = getClient()
  if (!c) return texts.map(() => null)
  try {
    return await embedBatchCached(c, cache, texts)
  } catch (err) {
    console.error("[embeddings] Bedrock batch embedding failed:", err)
    return texts.map(() => null)
  }
}

// ============ Search Functions ============

export interface SearchResult {
  id: string
  type: string
  content: string
  confidence: number | null
  tags: string[] | null
  score: number
}

function mapRow(row: any, scoreField: string): SearchResult {
  return {
    id: row.id,
    type: row.type,
    content: row.content,
    confidence: row.confidence,
    tags: row.tags ? JSON.parse(row.tags) : null,
    score: row[scoreField],
  }
}

export async function searchSimilar(
  forgeId: string,
  query: string,
  topK: number = 10
): Promise<SearchResult[]> {
  const queryEmbedding = await generateEmbedding(query)
  if (!queryEmbedding) return []

  const vectorStr = toVectorStr(queryEmbedding)
  const rows = await db.execute(
    sql`SELECT id, type, content, confidence, tags::text as tags, 1 - (embedding <=> ${vectorStr}::vector) AS score
        FROM extractions
        WHERE forge_id = ${forgeId} AND embedding IS NOT NULL
        ORDER BY embedding <=> ${vectorStr}::vector ASC
        LIMIT ${topK}`
  )

  return (rows as any[]).map((r: any) => mapRow(r, "score"))
}

export async function searchKeyword(
  forgeId: string,
  query: string,
  topK: number = 10
): Promise<SearchResult[]> {
  const rows = await db.execute(
    sql`SELECT id, type, content, confidence, tags::text as tags,
           GREATEST(similarity(content, ${query}), 0.01) AS score
        FROM extractions
        WHERE forge_id = ${forgeId}
          AND (content ILIKE ${'%' + query + '%'} OR content % ${query})
        ORDER BY score DESC
        LIMIT ${topK}`
  )

  return (rows as any[]).map((r: any) => mapRow(r, "score"))
}

export async function searchHybrid(
  forgeId: string,
  query: string,
  topK: number = 15
): Promise<SearchResult[]> {
  const [semanticResults, keywordResults] = await Promise.all([
    searchSimilar(forgeId, query, topK * 2),
    searchKeyword(forgeId, query, topK * 2),
  ])

  // Reciprocal Rank Fusion scoring
  const K = 60
  const scores = new Map<string, { result: SearchResult; score: number }>()

  for (const results of [semanticResults, keywordResults]) {
    for (let rank = 0; rank < results.length; rank++) {
      const r = results[rank]
      const rrfScore = 1 / (K + rank)
      const existing = scores.get(r.id)
      if (existing) {
        existing.score += rrfScore
      } else {
        scores.set(r.id, { result: r, score: rrfScore })
      }
    }
  }

  return [...scores.values()]
    .sort((a, b) => b.score - a.score)
    .slice(0, topK)
    .map(({ result, score }) => ({ ...result, score }))
}

// ============ Knowledge Unit Search (workspace-scoped) ============

export async function searchUnitsSimilar(
  workspaceId: string,
  query: string,
  topK: number = 10
): Promise<SearchResult[]> {
  const queryEmbedding = await generateEmbedding(query)
  if (!queryEmbedding) return []

  const vectorStr = toVectorStr(queryEmbedding)
  const rows = await db.execute(
    sql`SELECT id, type, content, confidence, tags::text as tags, 1 - (embedding <=> ${vectorStr}::vector) AS score
        FROM knowledge_units
        WHERE workspace_id = ${workspaceId} AND status IN ('proposed', 'approved') AND embedding IS NOT NULL
        ORDER BY embedding <=> ${vectorStr}::vector ASC
        LIMIT ${topK}`
  )

  return (rows as any[]).map((r: any) => mapRow(r, "score"))
}

export async function searchUnitsKeyword(
  workspaceId: string,
  query: string,
  topK: number = 10
): Promise<SearchResult[]> {
  const rows = await db.execute(
    sql`SELECT id, type, content, confidence, tags::text as tags,
           GREATEST(similarity(content, ${query}), 0.01) AS score
        FROM knowledge_units
        WHERE workspace_id = ${workspaceId} AND status IN ('proposed', 'approved')
          AND (content ILIKE ${'%' + query + '%'} OR content % ${query})
        ORDER BY score DESC
        LIMIT ${topK}`
  )

  return (rows as any[]).map((r: any) => mapRow(r, "score"))
}

export async function searchUnitsHybrid(
  workspaceId: string,
  query: string,
  topK: number = 15
): Promise<SearchResult[]> {
  const [semanticResults, keywordResults] = await Promise.all([
    searchUnitsSimilar(workspaceId, query, topK * 2),
    searchUnitsKeyword(workspaceId, query, topK * 2),
  ])

  const K = 60
  const scores = new Map<string, { result: SearchResult; score: number }>()

  for (const results of [semanticResults, keywordResults]) {
    for (let rank = 0; rank < results.length; rank++) {
      const r = results[rank]
      const rrfScore = 1 / (K + rank)
      const existing = scores.get(r.id)
      if (existing) {
        existing.score += rrfScore
      } else {
        scores.set(r.id, { result: r, score: rrfScore })
      }
    }
  }

  return [...scores.values()]
    .sort((a, b) => b.score - a.score)
    .slice(0, topK)
    .map(({ result, score }) => ({ ...result, score }))
}

export async function hasUnitEmbeddings(workspaceId: string): Promise<boolean> {
  const result = await db.execute(
    sql`SELECT COUNT(*) as count FROM knowledge_units WHERE workspace_id = ${workspaceId} AND embedding IS NOT NULL`
  )
  return parseInt((result[0] as any).count) > 0
}

export function embedKnowledgeUnitAsync(unitId: string, type: string, content: string) {
  if (!isEmbeddingConfigured()) return

  generateEmbedding(`[${type}] ${content}`).then((embedding) => {
    if (!embedding) return
    const vectorStr = toVectorStr(embedding)
    db.execute(
      sql`UPDATE knowledge_units SET embedding = ${vectorStr}::vector WHERE id = ${unitId}`
    ).catch((err) => console.error(`[embeddings] Failed to save unit embedding for ${unitId}:`, err))
  }).catch((err) => console.error(`[embeddings] Failed to generate embedding:`, err))
}

// ============ Helpers ============

export function embedExtractionAsync(extractionId: string, type: string, content: string) {
  if (!isEmbeddingConfigured()) return

  generateEmbedding(`[${type}] ${content}`).then((embedding) => {
    if (!embedding) return
    const vectorStr = toVectorStr(embedding)
    db.execute(
      sql`UPDATE extractions SET embedding = ${vectorStr}::vector WHERE id = ${extractionId}`
    ).catch((err) => console.error(`[embeddings] Failed to save embedding for ${extractionId}:`, err))
  }).catch((err) => console.error(`[embeddings] Failed to generate embedding:`, err))
}

// Check if any extractions have embeddings for a forge
export async function hasEmbeddings(forgeId: string): Promise<boolean> {
  const result = await db.execute(
    sql`SELECT COUNT(*) as count FROM extractions WHERE forge_id = ${forgeId} AND embedding IS NOT NULL`
  )
  return parseInt((result[0] as any).count) > 0
}
