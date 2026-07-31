import { generateJSON, HAIKU, SONNET } from "../lib/llm"
import type { ExpertProfile } from "@forge/shared"

// Legacy type kept for backward compat
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

export async function extractExpertProfile(
  conversationHistory: Array<{ role: string; content: string }>,
  previousProfile: ExpertProfile | null
): Promise<ExpertProfile> {
  const transcript = conversationHistory
    .map((m) => `${m.role}: ${m.content}`)
    .join("\n")

  const previousContext = previousProfile
    ? `\nPrevious profile state (keep these values unless the user corrects them):\n${JSON.stringify(previousProfile, null, 2)}\n`
    : ""

  return generateJSON<ExpertProfile>(
    `Extract an expert profile from this intro conversation. Return null for any field not yet clearly mentioned by the user. Only extract from USER messages, not assistant messages.
${previousContext}
Fields to extract:
- expertName: The person's name
- domain: Their area of expertise as a concise phrase (e.g. "sourdough bread baking", "B2B SaaS marketing")
- targetAudience: Who they want to help (e.g. "home bakers", "startup founders")
- yearsExperience: How long they've been doing this (e.g. "15 years", "over a decade")
- specializations: Array of specific sub-areas they're expert in (e.g. ["fermentation", "scoring techniques"])
- uniqueApproach: What makes their method/philosophy different from others
- commonMistakes: Array of mistakes they see beginners or others make
- notableAchievements: Array of career highlights, publications, certifications, etc.
- industriesOrContexts: Array of industries or contexts they've worked in
- passionArea: The thing they're most excited about or care most deeply about
- problemsTheySolve: Array of specific problems they help people with

Important:
- Keep previous values unless the user explicitly corrects them
- For array fields, merge new items with previous items (no duplicates)
- Be precise — only extract what's clearly stated, don't infer
- For the core 3 (name, domain, audience), be especially careful to capture exactly what the user says

Transcript:
${transcript}

Return JSON matching the ExpertProfile interface.`,
    { model: SONNET, maxTokens: 1024, temperature: 0.1 }
  )
}
