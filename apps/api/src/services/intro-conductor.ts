import { streamText, generateText, SONNET } from "../lib/llm"
import type { ExpertProfile, EXPERT_PROFILE_FIELDS } from "@forge/shared"

function buildProfileStatus(profile: ExpertProfile | null): string {
  if (!profile) return "No information captured yet."

  const lines: string[] = []

  const field = (key: keyof ExpertProfile, label: string) => {
    const val = profile[key]
    if (val === null || val === undefined) {
      lines.push(`  [ ] ${label}`)
    } else if (Array.isArray(val)) {
      lines.push(`  [x] ${label}: ${val.join(", ")}`)
    } else {
      lines.push(`  [x] ${label}: ${val}`)
    }
  }

  lines.push("Core (needed to proceed):")
  field("expertName", "Name")
  field("domain", "Area of Expertise")
  field("targetAudience", "Target Audience")

  lines.push("\nDepth (enriches the interview):")
  field("yearsExperience", "Experience")
  field("specializations", "Specializations")
  field("uniqueApproach", "Unique Approach")
  field("commonMistakes", "Common Mistakes")
  field("notableAchievements", "Achievements")
  field("industriesOrContexts", "Industries/Contexts")
  field("passionArea", "Passion Area")
  field("problemsTheySolve", "Problems They Solve")

  return lines.join("\n")
}

function buildSystemPrompt(profile: ExpertProfile | null): string {
  const profileStatus = buildProfileStatus(profile)
  const coreReady = !!(profile?.expertName && profile?.domain && profile?.targetAudience)
  const depthFields = profile ? [
    profile.yearsExperience, profile.specializations, profile.uniqueApproach,
    profile.commonMistakes, profile.passionArea, profile.problemsTheySolve,
  ].filter(v => v !== null && v !== undefined).length : 0

  return `You are a warm, friendly host welcoming someone to Forge — a tool that captures expert knowledge through conversation. Your goal is to build a rich profile of who they are and what makes their expertise special.

CURRENT PROFILE STATE:
${profileStatus}

${coreReady
    ? `The core 3 fields are captured. You've gathered ${depthFields} depth fields so far. Try to naturally uncover 2-3 more depth fields before suggesting they're ready to proceed. When you've explored enough, say something like "I've got a great picture of your expertise. Feel free to share more, or go ahead and plan your interview when you're ready."`
    : "Focus on gathering the core 3 fields first (name, expertise, audience), one at a time."}

Guidelines:
- Be warm and enthusiastic but not over-the-top
- Ask one thing at a time, don't front-load multiple questions
- Acknowledge what they share before moving on — show genuine interest
- Follow interesting threads rather than working through a rigid checklist
- If they mention something fascinating, dig into it even if it's not on the checklist
- If they give you multiple pieces in one message, acknowledge all of them
- After getting core 3, explore their background naturally: what makes them different, what mistakes they see others make, what they're most passionate about, what problems they solve
- Keep responses brief (2-3 sentences)
- Target 6-10 total exchanges for a rich profile, not just 3`
}

export async function* streamIntroConductorResponse(
  conversationHistory: Array<{ role: "user" | "assistant"; content: string }>,
  currentProfile: ExpertProfile | null = null
): AsyncGenerator<string> {
  const messages =
    conversationHistory.length === 0
      ? [{ role: "user" as const, content: "[System: The user just arrived. Give them a brief, warm welcome and ask their name.]" }]
      : [
          { role: "user" as const, content: "[System: Continue the conversation naturally based on the profile state shown in your instructions.]" },
          { role: "assistant" as const, content: "I understand. I'll respond naturally." },
          ...conversationHistory,
        ]

  yield* streamText(messages, {
    system: buildSystemPrompt(currentProfile),
    model: SONNET,
    temperature: 0.4,
    maxTokens: 384,
  })
}

export async function generateIntroOpening(): Promise<string> {
  return generateText(
    [{ role: "user", content: "[System: The user just arrived at Forge. Give them a brief, warm welcome and ask their name. One or two sentences max.]" }],
    {
      system: buildSystemPrompt(null),
      model: SONNET,
      temperature: 0.5,
      maxTokens: 128,
    }
  )
}
