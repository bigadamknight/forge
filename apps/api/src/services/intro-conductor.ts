import { streamText, generateText, SONNET } from "../lib/llm"

const SYSTEM_PROMPT = `You are a warm, friendly host welcoming someone to Forge — a tool that captures expert knowledge through conversation. Your goal is to learn three things naturally:

1. Their name
2. Their area of expertise (what they know deeply)
3. Who they want to help with this knowledge (target audience)

Guidelines:
- Be warm and enthusiastic but not over-the-top
- Ask one thing at a time, don't front-load all three questions
- Acknowledge what they share before moving on
- If they give you multiple pieces in one message, acknowledge all of them
- Once you have all three, say something like "Great, I've got what I need to plan your interview. Feel free to share any additional context about your expertise, or go ahead and plan your interview when you're ready."
- After that point, if they share more context, acknowledge it warmly
- Keep responses brief (2-3 sentences)`

export async function* streamIntroConductorResponse(
  conversationHistory: Array<{ role: "user" | "assistant"; content: string }>
): AsyncGenerator<string> {
  const messages =
    conversationHistory.length === 0
      ? [{ role: "user" as const, content: "[System: The user just arrived. Give them a brief, warm welcome and ask their name.]" }]
      : [
          { role: "user" as const, content: "[System: Continue the conversation naturally. Gather any missing info (name, expertise, audience).]" },
          { role: "assistant" as const, content: "I understand. I'll respond naturally." },
          ...conversationHistory,
        ]

  yield* streamText(messages, {
    system: SYSTEM_PROMPT,
    model: SONNET,
    temperature: 0.4,
    maxTokens: 256,
  })
}

export async function generateIntroOpening(): Promise<string> {
  return generateText(
    [{ role: "user", content: "[System: The user just arrived at Forge. Give them a brief, warm welcome and ask their name. One or two sentences max.]" }],
    {
      system: SYSTEM_PROMPT,
      model: SONNET,
      temperature: 0.5,
      maxTokens: 128,
    }
  )
}
