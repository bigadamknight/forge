import { db } from "@forge/db"
import { sql } from "drizzle-orm"
import { createHash } from "crypto"

const EMBEDDING_URL = process.env.AZURE_OPENAI_EMBEDDING_URL
const EMBEDDING_API_KEY = process.env.AZURE_OPENAI_EMBEDDING_API_KEY
const MAX_TEXT_LENGTH = 30000

export interface SearchResult {
  id: string
  type: string
  content: string
  confidence: number | null
  tags: string[] | null
  score: number
}

async function generateEmbedding(text: string): Promise<number[] | null> {
  if (!EMBEDDING_URL || !EMBEDDING_API_KEY) return null

  const truncated = text.slice(0, MAX_TEXT_LENGTH)
  const hash = createHash("sha256").update(truncated).digest("hex")

  const cached = await db.execute(
    sql`SELECT embedding::text as embedding FROM embedding_cache WHERE content_hash = ${hash}`
  )
  if (cached.length > 0) {
    return parseVector((cached[0] as any).embedding)
  }

  const response = await fetch(EMBEDDING_URL, {
    method: "POST",
    headers: {
      "api-key": EMBEDDING_API_KEY,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ input: truncated }),
  })

  if (!response.ok) return null

  const data = await response.json()
  const embedding: number[] = data.data[0].embedding

  const vectorStr = `[${embedding.join(",")}]`
  await db.execute(
    sql`INSERT INTO embedding_cache (content_hash, embedding) VALUES (${hash}, ${vectorStr}::vector) ON CONFLICT (content_hash) DO NOTHING`
  )

  return embedding
}

async function searchSimilar(forgeId: string, query: string, topK: number): Promise<SearchResult[]> {
  const queryEmbedding = await generateEmbedding(query)
  if (!queryEmbedding) return []

  const vectorStr = `[${queryEmbedding.join(",")}]`
  const rows = await db.execute(
    sql`SELECT id, type, content, confidence, tags::text as tags, embedding <=> ${vectorStr}::vector AS distance
        FROM extractions
        WHERE forge_id = ${forgeId} AND embedding IS NOT NULL
        ORDER BY distance ASC
        LIMIT ${topK}`
  )

  return (rows as any[]).map((r: any) => ({
    id: r.id,
    type: r.type,
    content: r.content,
    confidence: r.confidence,
    tags: r.tags ? JSON.parse(r.tags) : null,
    score: 1 - r.distance,
  }))
}

async function searchKeyword(forgeId: string, query: string, topK: number): Promise<SearchResult[]> {
  const rows = await db.execute(
    sql`SELECT id, type, content, confidence, tags::text as tags,
           GREATEST(similarity(content, ${query}), 0.01) AS similarity
        FROM extractions
        WHERE forge_id = ${forgeId}
          AND (content ILIKE ${"%" + query + "%"} OR content % ${query})
        ORDER BY similarity DESC
        LIMIT ${topK}`
  )

  return (rows as any[]).map((r: any) => ({
    id: r.id,
    type: r.type,
    content: r.content,
    confidence: r.confidence,
    tags: r.tags ? JSON.parse(r.tags) : null,
    score: r.similarity,
  }))
}

export async function searchHybrid(forgeId: string, query: string, topK: number = 15): Promise<SearchResult[]> {
  const [semanticResults, keywordResults] = await Promise.all([
    searchSimilar(forgeId, query, topK * 2),
    searchKeyword(forgeId, query, topK * 2),
  ])

  const K = 60
  const scores = new Map<string, { result: SearchResult; score: number }>()

  function accumulateRRF(results: SearchResult[]) {
    results.forEach((r, rank) => {
      const rrfScore = 1 / (K + rank)
      const existing = scores.get(r.id)
      if (existing) {
        existing.score += rrfScore
      } else {
        scores.set(r.id, { result: r, score: rrfScore })
      }
    })
  }

  accumulateRRF(semanticResults)
  accumulateRRF(keywordResults)

  return [...scores.values()]
    .sort((a, b) => b.score - a.score)
    .slice(0, topK)
    .map(({ result, score }) => ({ ...result, score }))
}

export async function hasEmbeddings(forgeId: string): Promise<boolean> {
  const result = await db.execute(
    sql`SELECT COUNT(*) as count FROM extractions WHERE forge_id = ${forgeId} AND embedding IS NOT NULL`
  )
  return parseInt((result[0] as any).count) > 0
}

function parseVector(vectorStr: string): number[] {
  return vectorStr.replace(/[\[\]]/g, "").split(",").map(Number)
}
