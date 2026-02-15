import { generateJSON, SONNET } from "../lib/llm"
import type { ValidationResult } from "@forge/shared"

const SYSTEM_PROMPT = `You are a precise knowledge extraction validator. Your job is to assess whether a user's response to an interview question has adequately addressed the question's goal.

Analyze the conversation and determine:
1. Whether the goal has been met (the expert has provided the required knowledge)
2. Your confidence level (0.0 to 1.0)
3. What key points were extracted
4. What's still missing (if anything)
5. Follow-up questions that could deepen the response

Be strict but fair. A goal is "met" when the expert has provided substantive, actionable information - not just a surface-level answer.`

export async function validateResponse(
  questionText: string,
  questionGoal: string,
  sectionGoal: string,
  conversationMessages: Array<{ role: string; content: string }>
): Promise<ValidationResult> {
  const messagesText = conversationMessages
    .map((m) => `${m.role === "user" ? "Expert" : "Interviewer"}: ${m.content}`)
    .join("\n\n")

  const prompt = `Evaluate whether this interview question's goal has been met:

**Question:** ${questionText}
**Question Goal:** ${questionGoal}
**Section Goal:** ${sectionGoal}

**Conversation:**
${messagesText}

Respond with JSON only:
{
  "meets_goal": true/false,
  "confidence": 0.0-1.0,
  "explanation": "Brief explanation of your assessment",
  "missing_aspects": ["aspect1", "aspect2"],
  "extracted_data": {
    "key_points": ["point1", "point2"],
    "relevant_quotes": ["quote1"],
    "metadata": {}
  },
  "follow_up_questions": ["question1"]
}`

  return generateJSON<ValidationResult>(prompt, {
    system: SYSTEM_PROMPT,
    temperature: 0.1,
    maxTokens: 2048,
    model: SONNET,
    effort: "medium",
  })
}

export const CONFIDENCE_THRESHOLD = 0.7
