import Anthropic from "@anthropic-ai/sdk"

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
})

const MODEL = "claude-opus-4-6"
const SONNET = "claude-sonnet-4-5-20250929"
const HAIKU = "claude-haiku-4-5-20251001"

export interface LLMOptions {
  system?: string
  temperature?: number
  maxTokens?: number
  model?: string
  cacheSystem?: boolean
  prefill?: string
  /** JSON Schema for structured output (uses output_config.format) */
  schema?: Record<string, unknown>
  /** Controls how much effort the model puts into a response */
  effort?: "low" | "medium" | "high" | "max"
}

function applyEffort(params: Record<string, unknown>, options: LLMOptions) {
  if (!options.effort) return
  // effort is only supported on Opus models
  const model = params.model as string
  if (!model.includes("opus")) return
  const existing = (params.output_config as Record<string, unknown>) || {}
  params.output_config = { ...existing, effort: options.effort }
}

export async function generateJSON<T>(prompt: string, options: LLMOptions = {}): Promise<T> {
  const model = options.model || MODEL
  const structured = !!options.schema
  console.log(`[generateJSON] Calling ${model} (maxTokens: ${options.maxTokens || 4096}, cache: ${!!options.cacheSystem}, structured: ${structured}, effort: ${options.effort || "default"})...`)

  const system: Anthropic.MessageCreateParams["system"] = options.cacheSystem && options.system
    ? [{ type: "text", text: options.system, cache_control: { type: "ephemeral" } }]
    : options.system

  const messages: Anthropic.MessageParam[] = [{ role: "user", content: prompt }]
  if (options.prefill && !structured) {
    messages.push({ role: "assistant", content: options.prefill })
  }

  const params: Anthropic.MessageCreateParams = {
    model,
    max_tokens: options.maxTokens || 4096,
    temperature: options.temperature ?? 0.3,
    system,
    messages,
  }

  if (structured) {
    ;(params as any).output_config = {
      format: { type: "json_schema", schema: options.schema },
    }
  }

  applyEffort(params as any, options)

  const response = await anthropic.messages.create(params)

  const usage = response.usage as any
  if (usage.cache_read_input_tokens || usage.cache_creation_input_tokens) {
    console.log(`[generateJSON] Cache: created=${usage.cache_creation_input_tokens || 0}, read=${usage.cache_read_input_tokens || 0}, input=${usage.input_tokens}`)
  }

  const rawText = response.content[0].type === "text" ? response.content[0].text : ""
  const text = options.prefill && !structured ? options.prefill + rawText : rawText
  const stopReason = response.stop_reason
  console.log(`[generateJSON] ${model} returned (${text.length} chars, stop: ${stopReason})`)

  // Structured output is guaranteed valid JSON
  if (structured) {
    return JSON.parse(rawText) as T
  }

  // Extract JSON from text response (may be wrapped in markdown code blocks)
  const jsonStr = extractJSON(text)

  try {
    return JSON.parse(jsonStr) as T
  } catch (e: any) {
    console.error("[generateJSON] Parse error:", e.message)
    console.error("[generateJSON] Last 200 chars:", jsonStr.slice(-200))

    if (stopReason === "max_tokens") {
      return JSON.parse(repairTruncatedJSON(jsonStr)) as T
    }
    throw e
  }
}

function extractJSON(text: string): string {
  const codeBlockMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/)
  if (codeBlockMatch) {
    return codeBlockMatch[1].trim()
  }

  const jsonMatch = text.match(/\{[\s\S]*\}/)
  if (!jsonMatch) {
    console.error("[generateJSON] No JSON found in response:", text.substring(0, 500))
    throw new Error("No JSON found in response")
  }

  // Remove trailing commas before closing brackets
  return jsonMatch[0].replace(/,(\s*[}\]])/g, "$1")
}

function repairTruncatedJSON(jsonStr: string): string {
  console.error("[generateJSON] Response was truncated, attempting repair")
  let repaired = jsonStr
  const openBraces = (repaired.match(/\{/g) || []).length
  const closeBraces = (repaired.match(/\}/g) || []).length
  const openBrackets = (repaired.match(/\[/g) || []).length
  const closeBrackets = (repaired.match(/\]/g) || []).length
  repaired = repaired.replace(/,\s*"[^"]*$/, "")
  repaired = repaired.replace(/,\s*$/, "")
  for (let i = 0; i < openBrackets - closeBrackets; i++) repaired += "]"
  for (let i = 0; i < openBraces - closeBraces; i++) repaired += "}"
  return repaired
}

function buildMessageParams(
  messages: Array<{ role: "user" | "assistant"; content: string }>,
  options: LLMOptions,
  tag: string
): Record<string, unknown> {
  const model = options.model || MODEL
  console.log(`[${tag}] Calling ${model} (effort: ${options.effort || "default"})`)
  const params: Record<string, unknown> = {
    model,
    max_tokens: options.maxTokens || 2048,
    temperature: options.temperature ?? 0.4,
    system: options.system,
    messages,
  }
  applyEffort(params, options)
  return params
}

export async function* streamText(
  messages: Array<{ role: "user" | "assistant"; content: string }>,
  options: LLMOptions = {}
): AsyncGenerator<string> {
  const params = buildMessageParams(messages, options, "streamText")
  const stream = anthropic.messages.stream(params as any)

  for await (const event of stream) {
    if (
      event.type === "content_block_delta" &&
      event.delta.type === "text_delta"
    ) {
      yield event.delta.text
    }
  }
}

export async function generateText(
  messages: Array<{ role: "user" | "assistant"; content: string }>,
  options: LLMOptions = {}
): Promise<string> {
  const params = buildMessageParams(messages, options, "generateText")
  const response = await anthropic.messages.create(params as any)
  return response.content[0].type === "text" ? response.content[0].text : ""
}

export { anthropic, MODEL, SONNET, HAIKU }
