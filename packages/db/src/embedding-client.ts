/**
 * Embeddings through Amazon Bedrock Titan Text Embeddings V2.
 *
 * Credentials come from the AWS SDK default chain (AWS_ACCESS_KEY_ID,
 * AWS_SECRET_ACCESS_KEY, AWS_REGION, profiles, ...). Titan takes one input per
 * call, so embedBatch fans out with bounded concurrency and keeps input order.
 */
import { BedrockRuntimeClient, InvokeModelCommand } from "@aws-sdk/client-bedrock-runtime"
import { createHash } from "crypto"
import { sql } from "drizzle-orm"

export const DEFAULT_EMBEDDING_MODEL = "amazon.titan-embed-text-v2:0"
export const DEFAULT_EMBEDDING_DIMENSIONS = 1024
export const DEFAULT_EMBEDDING_REGION = "eu-west-2"
export const MAX_TEXT_LENGTH = 30000
const MODEL_PREFIX = "amazon.titan-embed-text-v2"
const ALLOWED_DIMENSIONS = [256, 512, 1024]
const BATCH_CONCURRENCY = 10

/** The one method of BedrockRuntimeClient the embedding client uses; lets tests inject a fake. */
export interface BedrockInvoker {
  send(command: InvokeModelCommand): Promise<{ body?: Uint8Array | string }>
}

export interface EmbeddingClientOptions {
  model?: string
  dimensions?: number
  region?: string
  client?: BedrockInvoker
}

export interface EmbeddingClient {
  readonly model: string
  readonly dimensions: number
  embed(text: string): Promise<number[]>
  embedBatch(texts: string[]): Promise<number[][]>
}

export function createEmbeddingClient(options: EmbeddingClientOptions = {}): EmbeddingClient {
  const {
    model = DEFAULT_EMBEDDING_MODEL,
    dimensions = DEFAULT_EMBEDDING_DIMENSIONS,
    region = DEFAULT_EMBEDDING_REGION,
  } = options

  if (!model.startsWith(MODEL_PREFIX)) {
    throw new Error(`Unsupported embedding model "${model}": expected ${MODEL_PREFIX}*`)
  }
  if (!ALLOWED_DIMENSIONS.includes(dimensions)) {
    throw new Error(`Unsupported embedding dimensions ${dimensions}: expected one of ${ALLOWED_DIMENSIONS.join(", ")}`)
  }

  const client: BedrockInvoker = options.client ?? new BedrockRuntimeClient({ region })

  async function embed(text: string): Promise<number[]> {
    const response = await client.send(
      new InvokeModelCommand({
        modelId: model,
        contentType: "application/json",
        accept: "application/json",
        body: JSON.stringify({ inputText: text.slice(0, MAX_TEXT_LENGTH), dimensions, normalize: true }),
      })
    )
    const raw = response.body
    const parsed = JSON.parse(typeof raw === "string" ? raw : new TextDecoder().decode(raw))
    const embedding: number[] = parsed.embedding
    if (!Array.isArray(embedding) || embedding.length !== dimensions) {
      throw new Error(`Expected ${dimensions} embedding dimensions, got ${Array.isArray(embedding) ? embedding.length : "none"}`)
    }
    return embedding
  }

  async function embedBatch(texts: string[]): Promise<number[][]> {
    const results: number[][] = new Array(texts.length)
    let next = 0
    async function worker() {
      while (next < texts.length) {
        const i = next++
        results[i] = await embed(texts[i])
      }
    }
    await Promise.all(Array.from({ length: Math.min(BATCH_CONCURRENCY, texts.length) }, worker))
    return results
  }

  return { model, dimensions, embed, embedBatch }
}

/** Client configured from BEDROCK_EMBEDDING_MODEL, EMBEDDING_DIMENSIONS and AWS_REGION. */
export function createEmbeddingClientFromEnv(): EmbeddingClient {
  const dims = process.env.EMBEDDING_DIMENSIONS
  return createEmbeddingClient({
    model: process.env.BEDROCK_EMBEDDING_MODEL || undefined,
    dimensions: dims ? Number(dims) : undefined,
    region: process.env.AWS_REGION || undefined,
  })
}

/** True when AWS credentials look present (env keys or a profile). The SDK chain may still find others. */
export function isEmbeddingConfigured(): boolean {
  return Boolean(
    (process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY) || process.env.AWS_PROFILE
  )
}

// ============ Vector helpers ============

export function toVectorStr(embedding: number[]): string {
  return `[${embedding.join(",")}]`
}

export function parseVector(vectorStr: string): number[] {
  return vectorStr.replace(/[\[\]]/g, "").split(",").map(Number)
}

export function hashText(text: string): string {
  return createHash("sha256").update(text.slice(0, MAX_TEXT_LENGTH)).digest("hex")
}

// ============ Embedding cache, keyed on (content_hash, model) ============

export interface EmbeddingCacheStore {
  get(hash: string, model: string): Promise<number[] | null>
  set(hash: string, model: string, embedding: number[]): Promise<void>
}

export function createPgEmbeddingCache(db: { execute(query: any): PromiseLike<any> }): EmbeddingCacheStore {
  return {
    async get(hash, model) {
      const rows = await db.execute(
        sql`SELECT embedding::text as embedding FROM embedding_cache WHERE content_hash = ${hash} AND model = ${model}`
      )
      return rows.length > 0 && rows[0].embedding ? parseVector(rows[0].embedding) : null
    },
    async set(hash, model, embedding) {
      await db.execute(
        sql`INSERT INTO embedding_cache (content_hash, model, embedding) VALUES (${hash}, ${model}, ${toVectorStr(embedding)}::vector) ON CONFLICT (content_hash, model) DO NOTHING`
      )
    },
  }
}

export async function embedCached(
  client: EmbeddingClient,
  cache: EmbeddingCacheStore,
  text: string
): Promise<number[]> {
  const hash = hashText(text)
  const cached = await cache.get(hash, client.model)
  if (cached) return cached
  const embedding = await client.embed(text)
  await cache.set(hash, client.model, embedding)
  return embedding
}

export async function embedBatchCached(
  client: EmbeddingClient,
  cache: EmbeddingCacheStore,
  texts: string[]
): Promise<number[][]> {
  const results: number[][] = new Array(texts.length)
  const missIndices: number[] = []
  for (let i = 0; i < texts.length; i++) {
    const cached = await cache.get(hashText(texts[i]), client.model)
    if (cached) results[i] = cached
    else missIndices.push(i)
  }
  const fresh = await client.embedBatch(missIndices.map((i) => texts[i]))
  for (let k = 0; k < missIndices.length; k++) {
    const i = missIndices[k]
    results[i] = fresh[k]
    await cache.set(hashText(texts[i]), client.model, fresh[k])
  }
  return results
}
