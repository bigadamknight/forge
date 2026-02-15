import { db } from "@forge/db"
import { sql } from "drizzle-orm"
import { createHash } from "crypto"

const EMBEDDING_URL = process.env.AZURE_OPENAI_EMBEDDING_URL
const EMBEDDING_API_KEY = process.env.AZURE_OPENAI_EMBEDDING_API_KEY
const MAX_TEXT_LENGTH = 30000

function truncateAndHash(text: string): { truncated: string; hash: string } {
  const truncated = text.slice(0, MAX_TEXT_LENGTH)
  const hash = createHash("sha256").update(truncated).digest("hex")
  return { truncated, hash }
}

function toVectorStr(embedding: number[]): string {
  return `[${embedding.join(",")}]`
}

async function getCachedEmbedding(hash: string): Promise<number[] | null> {
  const cached = await db.execute(
    sql`SELECT embedding::text as embedding FROM embedding_cache WHERE content_hash = ${hash}`
  )
  if (cached.length > 0) {
    return parseVector((cached[0] as any).embedding)
  }
  return null
}

async function cacheEmbedding(hash: string, embedding: number[]): Promise<void> {
  const vectorStr = toVectorStr(embedding)
  await db.execute(
    sql`INSERT INTO embedding_cache (content_hash, embedding) VALUES (${hash}, ${vectorStr}::vector) ON CONFLICT (content_hash) DO NOTHING`
  )
}

async function callAzureEmbedding(input: string | string[]): Promise<Response | null> {
  if (!EMBEDDING_URL || !EMBEDDING_API_KEY) return null

  const response = await fetch(EMBEDDING_URL, {
    method: "POST",
    headers: {
      "api-key": EMBEDDING_API_KEY,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ input }),
  })

  if (!response.ok) {
    console.error(`[embeddings] Azure API error: ${response.status} ${response.statusText}`)
    return null
  }

  return response
}

// ============ Embedding Generation ============

export async function generateEmbedding(text: string): Promise<number[] | null> {
  if (!EMBEDDING_URL || !EMBEDDING_API_KEY) return null

  const { truncated, hash } = truncateAndHash(text)

  const cached = await getCachedEmbedding(hash)
  if (cached) return cached

  const response = await callAzureEmbedding(truncated)
  if (!response) return null

  const data = await response.json()
  const embedding: number[] = data.data[0].embedding

  await cacheEmbedding(hash, embedding)
  return embedding
}

export async function generateBatchEmbeddings(texts: string[]): Promise<(number[] | null)[]> {
  if (!EMBEDDING_URL || !EMBEDDING_API_KEY) return texts.map(() => null)

  const results: (number[] | null)[] = new Array(texts.length).fill(null)
  const uncachedIndices: number[] = []
  const uncachedTexts: string[] = []
  const uncachedHashes: string[] = []

  // Check cache for all texts
  for (let i = 0; i < texts.length; i++) {
    const { truncated, hash } = truncateAndHash(texts[i])
    const cached = await getCachedEmbedding(hash)
    if (cached) {
      results[i] = cached
    } else {
      uncachedIndices.push(i)
      uncachedTexts.push(truncated)
      uncachedHashes.push(hash)
    }
  }

  // Batch embed uncached texts (16 at a time per Azure limits)
  const BATCH_SIZE = 16
  for (let start = 0; start < uncachedTexts.length; start += BATCH_SIZE) {
    const batch = uncachedTexts.slice(start, start + BATCH_SIZE)

    const response = await callAzureEmbedding(batch)
    if (!response) continue

    const data = await response.json()
    for (const item of data.data) {
      const idx = start + item.index
      const embedding: number[] = item.embedding
      results[uncachedIndices[idx]] = embedding
      await cacheEmbedding(uncachedHashes[idx], embedding)
    }
  }

  return results
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

// ============ Helpers ============

function parseVector(vectorStr: string): number[] {
  return vectorStr.replace(/[\[\]]/g, "").split(",").map(Number)
}

export function embedExtractionAsync(extractionId: string, type: string, content: string) {
  if (!EMBEDDING_URL || !EMBEDDING_API_KEY) return

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
