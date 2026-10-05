import { describe, expect, test } from "bun:test"
import {
  createEmbeddingClient,
  embedBatchCached,
  embedCached,
  hashText,
  MAX_TEXT_LENGTH,
  type BedrockInvoker,
  type EmbeddingCacheStore,
} from "./embedding-client"

function fakeBedrock(opts: { dims?: number; delay?: (text: string) => number } = {}) {
  const bodies: any[] = []
  const commands: any[] = []
  let inFlight = 0
  let maxInFlight = 0
  const client: BedrockInvoker = {
    async send(command: any) {
      commands.push(command.input)
      const body = JSON.parse(command.input.body)
      bodies.push(body)
      inFlight++
      maxInFlight = Math.max(maxInFlight, inFlight)
      await new Promise((r) => setTimeout(r, opts.delay?.(body.inputText) ?? 0))
      inFlight--
      // First component encodes the input length so order can be checked.
      const embedding = new Array(opts.dims ?? body.dimensions).fill(0)
      embedding[0] = body.inputText.length
      return { body: new TextEncoder().encode(JSON.stringify({ embedding })) }
    },
  }
  return { client, bodies, commands, maxInFlight: () => maxInFlight }
}

function memoryCache(): EmbeddingCacheStore & { entries: Map<string, number[]> } {
  const entries = new Map<string, number[]>()
  return {
    entries,
    async get(hash, model) {
      return entries.get(`${hash}|${model}`) ?? null
    },
    async set(hash, model, embedding) {
      entries.set(`${hash}|${model}`, embedding)
    },
  }
}

function overflowError(n: number) {
  const e = new Error(`400 Bad Request: Too many input tokens. Max input tokens: 8192, request input token count: ${n}`)
  e.name = "ValidationException"
  return e
}

describe("token overflow", () => {
  test("retries once with a shorter cut computed from the reported count", async () => {
    const fake = fakeBedrock()
    let calls = 0
    const client: BedrockInvoker = {
      async send(command: any) {
        if (++calls === 1) throw overflowError(9949)
        return fake.client.send(command)
      },
    }
    await createEmbeddingClient({ client }).embed("a".repeat(25000))
    expect(calls).toBe(2)
    expect(fake.bodies).toHaveLength(1)
    expect(fake.bodies[0].inputText).toHaveLength(Math.floor((25000 * 7500) / 9949))
  })

  test("assumes 2x the limit when the count is missing and never cuts below 1000 chars", async () => {
    const a = fakeBedrock()
    let n = 0
    await createEmbeddingClient({
      client: { send: async (c: any) => (++n === 1 ? Promise.reject(new Error("Too many input tokens")) : a.client.send(c)) },
    }).embed("a".repeat(25000))
    expect(a.bodies[0].inputText).toHaveLength(Math.floor((25000 * 7500) / 16384))

    const b = fakeBedrock()
    let m = 0
    await createEmbeddingClient({
      client: { send: async (c: any) => (++m === 1 ? Promise.reject(overflowError(1_000_000)) : b.client.send(c)) },
    }).embed("a".repeat(25000))
    expect(b.bodies[0].inputText).toHaveLength(1000)
  })

  test("propagates the error after 3 retries", async () => {
    let calls = 0
    const client: BedrockInvoker = {
      async send() {
        calls++
        throw overflowError(9949)
      },
    }
    await expect(createEmbeddingClient({ client }).embed("a".repeat(25000))).rejects.toThrow(/Too many input tokens/)
    expect(calls).toBe(4)
  })

  test("other errors are not retried", async () => {
    let calls = 0
    const client: BedrockInvoker = {
      async send() {
        calls++
        throw new Error("boom")
      },
    }
    await expect(createEmbeddingClient({ client }).embed("x")).rejects.toThrow("boom")
    expect(calls).toBe(1)
  })
})

describe("createEmbeddingClient", () => {
  test("defaults and request shape", async () => {
    const fake = fakeBedrock()
    const c = createEmbeddingClient({ client: fake.client })
    expect(c.model).toBe("amazon.titan-embed-text-v2:0")
    expect(c.dimensions).toBe(1024)
    const v = await c.embed("hello")
    expect(v).toHaveLength(1024)
    expect(fake.commands[0].modelId).toBe("amazon.titan-embed-text-v2:0")
    expect(fake.commands[0].contentType).toBe("application/json")
    expect(fake.bodies[0]).toEqual({ inputText: "hello", dimensions: 1024, normalize: true })
  })

  test("truncates input to 25000 characters", async () => {
    const fake = fakeBedrock()
    await createEmbeddingClient({ client: fake.client }).embed("x".repeat(MAX_TEXT_LENGTH + 500))
    expect(fake.bodies[0].inputText).toHaveLength(25000)
  })

  test("rejects a response with the wrong dimension count", async () => {
    const fake = fakeBedrock({ dims: 512 })
    await expect(createEmbeddingClient({ client: fake.client }).embed("hi")).rejects.toThrow(/1024/)
  })

  test("embedBatch preserves order and bounds concurrency at 10", async () => {
    // Earlier items take longer, so completion order is reversed.
    const fake = fakeBedrock({ delay: (t) => 30 - t.length })
    const texts = Array.from({ length: 25 }, (_, i) => "a".repeat(i + 1))
    const out = await createEmbeddingClient({ client: fake.client, dimensions: 256 }).embedBatch(texts)
    expect(out.map((v) => v[0])).toEqual(texts.map((t) => t.length))
    expect(fake.maxInFlight()).toBeLessThanOrEqual(10)
    expect(fake.maxInFlight()).toBeGreaterThan(1)
    expect(await createEmbeddingClient({ client: fake.client }).embedBatch([])).toEqual([])
  })

  test("accepts 256, 512 and 1024 dimensions", async () => {
    for (const dimensions of [256, 512, 1024]) {
      const fake = fakeBedrock()
      const v = await createEmbeddingClient({ client: fake.client, dimensions }).embed("x")
      expect(v).toHaveLength(dimensions)
      expect(fake.bodies[0].dimensions).toBe(dimensions)
    }
  })

  test("bad config throws", () => {
    const fake = fakeBedrock()
    expect(() => createEmbeddingClient({ client: fake.client, dimensions: 1536 })).toThrow(/dimensions/)
    expect(() => createEmbeddingClient({ client: fake.client, dimensions: 0 })).toThrow(/dimensions/)
    expect(() => createEmbeddingClient({ client: fake.client, model: "text-embedding-3-small" })).toThrow(/model/)
    expect(() => createEmbeddingClient({ client: fake.client, model: "amazon.titan-embed-text-v1" })).toThrow(/model/)
  })
})

describe("embedding cache", () => {
  test("hit skips Bedrock", async () => {
    const fake = fakeBedrock()
    const c = createEmbeddingClient({ client: fake.client })
    const cache = memoryCache()
    await embedCached(c, cache, "same")
    await embedCached(c, cache, "same")
    expect(fake.bodies).toHaveLength(1)
  })

  test("keyed by model and dimensions-bearing model id", async () => {
    const fake = fakeBedrock()
    const cache = memoryCache()
    const a = createEmbeddingClient({ client: fake.client, model: "amazon.titan-embed-text-v2:0" })
    const b = createEmbeddingClient({ client: fake.client, model: "amazon.titan-embed-text-v2:1" })
    await embedCached(a, cache, "text")
    await embedCached(b, cache, "text")
    expect(fake.bodies).toHaveLength(2)
    const hash = hashText("text")
    expect([...cache.entries.keys()].sort()).toEqual([
      `${hash}|amazon.titan-embed-text-v2:0`,
      `${hash}|amazon.titan-embed-text-v2:1`,
    ])
  })

  test("hash covers the truncated text", () => {
    expect(hashText("y".repeat(25000))).toBe(hashText("y".repeat(31000)))
  })

  test("embedBatchCached only embeds misses and keeps order", async () => {
    const fake = fakeBedrock()
    const c = createEmbeddingClient({ client: fake.client })
    const cache = memoryCache()
    await embedCached(c, cache, "bb")
    fake.bodies.length = 0
    const out = await embedBatchCached(c, cache, ["a", "bb", "ccc"])
    expect(out.map((v) => v[0])).toEqual([1, 2, 3])
    expect(fake.bodies.map((b) => b.inputText).sort()).toEqual(["a", "ccc"])
  })
})
