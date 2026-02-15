import { streamText, generateText } from "../lib/llm"

const SYSTEM_PROMPT = `You are a warm, curious interviewer having a natural conversation with a domain expert. Your role is to help them share their knowledge in a way that will be useful to others.

Guidelines:
- Be genuinely interested and engaged
- Acknowledge what they share before asking follow-ups
- Probe deeper when they mention something interesting - ask "why", "how", "what happens if"
- Keep the conversation natural, not like a formal interview
- Guide them back if they go off-topic, but gently
- Never reveal the interview structure or that you're following a script
- Use their name occasionally
- If they give a vague answer, ask for a specific example
- Keep responses concise (2-4 sentences typically)`

export function buildConductorMessages(
  expertName: string,
  domain: string,
  sectionTitle: string,
  sectionGoal: string,
  questionText: string,
  questionGoal: string,
  conversationHistory: Array<{ role: "user" | "assistant"; content: string }>
): Array<{ role: "user" | "assistant"; content: string }> {
  const contextMessage = `[Interview Context]
Expert: ${expertName}
Domain: ${domain}
Current Section: ${sectionTitle} (Goal: ${sectionGoal})
Current Topic: ${questionText}
Extraction Goal: ${questionGoal}

Respond naturally to what the expert just said. Acknowledge their answer, then either:
- Probe deeper on something interesting they mentioned ("tell me more about...", "what happens when...", "why is that?")
- Or move to the current topic by turning it into a natural, curious question (don't just state the topic - ask about their experience with it)

Keep it conversational, 2-3 sentences max.`

  if (conversationHistory.length === 0) {
    return [{ role: "user", content: contextMessage }]
  }

  return [
    { role: "user", content: contextMessage },
    { role: "assistant", content: "I understand the context. I'll respond naturally to the expert." },
    ...conversationHistory,
  ]
}

export async function* streamConductorResponse(
  expertName: string,
  domain: string,
  sectionTitle: string,
  sectionGoal: string,
  questionText: string,
  questionGoal: string,
  conversationHistory: Array<{ role: "user" | "assistant"; content: string }>
): AsyncGenerator<string> {
  const messages = buildConductorMessages(
    expertName,
    domain,
    sectionTitle,
    sectionGoal,
    questionText,
    questionGoal,
    conversationHistory
  )

  yield* streamText(messages, {
    system: SYSTEM_PROMPT,
    temperature: 0.4,
    maxTokens: 1024,
    effort: "medium",
  })
}

export async function generateOpeningMessage(
  expertName: string,
  domain: string,
  sectionTitle: string,
  questionText: string,
  isFirstQuestion: boolean
): Promise<string> {
  const prompt = isFirstQuestion
    ? `You're starting an interview with ${expertName} about "${domain}".

Give them a brief, warm welcome (one sentence max), then ask an engaging opening question about the topic "${questionText}". The question should be open-ended and get them talking about their experience. Don't repeat the topic verbatim - turn it into a natural, curious question.

Example: if the topic is "Key first-year challenges", you might ask "What surprised you most when you were first getting started?"`
    : `You're continuing an interview with ${expertName} about "${domain}". You're moving to a new area: "${sectionTitle}".

Transition briefly (one sentence), then ask an engaging question about "${questionText}". Turn the topic into a natural, curious question that gets them sharing specific experiences. Don't repeat the topic verbatim.`

  return generateText(
    [{ role: "user", content: prompt }],
    {
      system: SYSTEM_PROMPT,
      temperature: 0.5,
      maxTokens: 256,
    }
  )
}
