import { generateJSON, HAIKU } from "../lib/llm"

export interface IntroFields {
  expertName: string | null
  domain: string | null
  targetAudience: string | null
}

export async function extractIntroFields(
  conversationHistory: Array<{ role: string; content: string }>
): Promise<IntroFields> {
  const transcript = conversationHistory
    .map((m) => `${m.role}: ${m.content}`)
    .join("\n")

  return generateJSON<IntroFields>(
    `Extract the following from this conversation. Return null for any field not yet clearly mentioned by the user.

- expertName: The person's name (from user messages only, not the assistant greeting)
- domain: Their area of expertise as a concise phrase (e.g. "sourdough bread baking", "B2B SaaS marketing")
- targetAudience: Who they want to help (e.g. "home bakers", "startup founders")

Transcript:
${transcript}

Return JSON: { "expertName": "...", "domain": "...", "targetAudience": "..." }`,
    { model: HAIKU, maxTokens: 256, temperature: 0.1 }
  )
}
