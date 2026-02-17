import { Hono } from "hono"
import { db, forges, interviewSections, interviewQuestions, extractions } from "@forge/db"
import { eq, asc, and } from "drizzle-orm"
import { extractKnowledge } from "../services/extractor"
import { DEPTH_PRESETS, type InterviewDepth } from "@forge/shared"
import { embedExtractionAsync } from "../lib/embeddings"

const app = new Hono()

const ELEVENLABS_AGENT_ID = process.env.ELEVENLABS_AGENT_ID

// Build interview prompt and first message for a forge
async function buildInterviewContext(forgeId: string) {
  const [forge] = await db.select().from(forges).where(eq(forges.id, forgeId)).limit(1)
  if (!forge) return null

  const sections = await db.select().from(interviewSections)
    .where(eq(interviewSections.forgeId, forgeId))
    .orderBy(asc(interviewSections.orderIndex))

  const sectionDetails = []
  for (const section of sections) {
    const questions = await db.select().from(interviewQuestions)
      .where(eq(interviewQuestions.sectionId, section.id))
      .orderBy(asc(interviewQuestions.orderIndex))
    sectionDetails.push({ section, questions })
  }

  const interviewGuide = sectionDetails.map((sd, si) =>
    `Section ${si + 1}: ${sd.section.title}\nGoal: ${sd.section.goal}\nTopics to explore:\n${sd.questions.map((q, qi) =>
      `  ${qi + 1}. ${q.text} (extract: ${q.goal})`
    ).join("\n")}`
  ).join("\n\n")

  const prompt = `You are a warm, curious interviewer conducting a knowledge-capture interview with ${forge.expertName}, an expert in ${forge.domain}. Your goal is to help them share their deep expertise so it can be turned into an interactive guide for others.

INTERVIEW GUIDE:
${interviewGuide}

PROGRESS (updated dynamically):
{{interview_progress}}

SPEAKING STYLE:
- Keep responses SHORT. 1-2 sentences is ideal. Never more than 3.
- This is a spoken conversation, not written text. Use short, simple sentences.
- One question at a time. Never ask multiple questions in a single turn.
- Brief acknowledgements: "Great", "Interesting", "Got it" - then move on. Don't repeat back what they said.

INSTRUCTIONS:
- The topics listed are areas to explore, NOT literal questions to read out. Turn each topic into a natural, curious question based on the conversation so far.
- Work through the sections and topics in order, but keep it conversational and natural
- IMPORTANT: Check the PROGRESS section above. Skip any topics marked as ANSWERED. Pick up from the first unanswered topic.
- Probe deeper when they mention something interesting - ask "why", "how", "what happens if"
- If they give vague answers, ask for a specific example
- Gently guide them back if they go off-topic
- Never reveal the interview structure or that you're following a script
- When you feel a topic has been thoroughly explored, move naturally to the next one
- Cover all sections but don't rush - depth matters more than coverage
- CLOSING: When you've covered all sections, briefly summarise the key themes, then ask if there's anything else they'd like to add. If not, thank them and say goodbye.
${forge.targetAudience ? `\nThe tool being built is for: ${forge.targetAudience}. Keep this audience in mind when probing for practical details.` : ""}`

  const interviewConfig = forge.interviewConfig as any
  const firstMessage = interviewConfig?.firstMessage
    || `Hey ${forge.expertName}, really looking forward to hearing about your experience with ${forge.domain}. What got you started?`

  return { forge, prompt, firstMessage, sectionDetails }
}

// Build a progress summary showing section/question status
async function buildProgressSummary(forgeId: string): Promise<string> {
  const sections = await db.select().from(interviewSections)
    .where(eq(interviewSections.forgeId, forgeId))
    .orderBy(asc(interviewSections.orderIndex))

  const lines: string[] = []
  let allComplete = true
  for (const section of sections) {
    const questions = await db.select().from(interviewQuestions)
      .where(eq(interviewQuestions.sectionId, section.id))
      .orderBy(asc(interviewQuestions.orderIndex))

    lines.push(`Section: ${section.title} [${section.status}]`)
    for (const q of questions) {
      let marker = "pending"
      if (q.status === "answered") marker = "ANSWERED"
      else if (q.status === "active") marker = "CURRENT"
      if (q.status !== "answered") allComplete = false
      lines.push(`  - [${marker}] ${q.text}`)
    }
  }

  if (sections.length === 0) return "No progress yet - starting fresh."

  if (allComplete) {
    lines.push("")
    lines.push("*** ALL TOPICS COVERED - INTERVIEW COMPLETE ***")
    lines.push("You MUST now wrap up: briefly summarise 2-3 key themes from the conversation, ask if there's anything else they'd like to add, then thank them warmly and say goodbye. Do NOT ask any more questions about the topics above.")
  }

  return lines.join("\n")
}

// ============ Get Voice Session Config ============

app.post("/:forgeId/voice-session", async (c) => {
  const { forgeId } = c.req.param()

  if (!ELEVENLABS_AGENT_ID) {
    return c.json({ error: "ELEVENLABS_AGENT_ID not configured" }, 500)
  }

  const ctx = await buildInterviewContext(forgeId)
  if (!ctx) return c.json({ error: "Forge not found" }, 404)

  const progress = await buildProgressSummary(forgeId)
  const depth = (ctx.forge.depth || "standard") as InterviewDepth
  const preset = DEPTH_PRESETS[depth]

  return c.json({
    agentId: ELEVENLABS_AGENT_ID,
    prompt: ctx.prompt,
    firstMessage: ctx.firstMessage,
    progress,
    maxDuration: preset.voiceMaxDuration,
  })
})

// ============ Get Interview Progress Summary ============

app.get("/:forgeId/voice-agent/progress", async (c) => {
  const { forgeId } = c.req.param()
  const progress = await buildProgressSummary(forgeId)
  return c.json({ progress })
})

// ============ Append Single Voice Message to Transcript ============

app.post("/:forgeId/voice-message", async (c) => {
  const { forgeId } = c.req.param()
  const { role, content } = await c.req.json()

  if (!role || !content) {
    return c.json({ error: "role and content required" }, 400)
  }

  const [forge] = await db.select().from(forges).where(eq(forges.id, forgeId)).limit(1)
  if (!forge) return c.json({ error: "Forge not found" }, 404)

  const metadata = (forge.metadata as any) || {}
  const transcript = Array.isArray(metadata.voiceTranscript) ? metadata.voiceTranscript : []

  // Deduplicate: skip exact duplicates in recent messages
  const recent = transcript.slice(-4)
  if (recent.some((m: any) => m.role === role && m.content === content)) {
    return c.json({ saved: false, count: transcript.length, reason: "duplicate" })
  }

  // Skip if agent is sending consecutive messages without user response
  // This prevents the agent looping when contextual updates trigger repeated speech
  if (role === 'assistant' && transcript.length >= 2) {
    const lastTwo = transcript.slice(-2)
    if (lastTwo.every((m: any) => m.role === 'assistant')) {
      return c.json({ saved: false, count: transcript.length, reason: "consecutive_assistant" })
    }
  }

  transcript.push({ role, content, timestamp: new Date().toISOString() })

  await db.update(forges).set({
    metadata: { ...metadata, voiceTranscript: transcript },
    updatedAt: new Date(),
  }).where(eq(forges.id, forgeId))

  return c.json({ saved: true, count: transcript.length })
})

// ============ Extract from Single Voice Message (real-time) ============

app.post("/:forgeId/voice-extract", async (c) => {
  const { forgeId } = c.req.param()
  const { content } = await c.req.json()

  if (!content) {
    return c.json({ error: "content required" }, 400)
  }

  const [forge] = await db.select().from(forges).where(eq(forges.id, forgeId)).limit(1)
  if (!forge) return c.json({ error: "Forge not found" }, 404)

  // Find active section for context
  const activeSection = await db.select().from(interviewSections)
    .where(and(eq(interviewSections.forgeId, forgeId), eq(interviewSections.status, "active")))
    .orderBy(asc(interviewSections.orderIndex))
    .limit(1)

  const sectionForContext = activeSection[0] || null
  const sectionTitle = sectionForContext?.title || forge.domain

  const existing = await db.select().from(extractions)
    .where(eq(extractions.forgeId, forgeId))
  const existingContents = existing.map((e) => e.content)

  try {
    const items = await extractKnowledge(
      content,
      sectionTitle,
      "Voice interview response",
      existingContents,
      "low"
    )

    const saved = []
    for (const item of items) {
      const [row] = await db.insert(extractions).values({
        forgeId,
        sectionId: sectionForContext?.id || null,
        type: item.type,
        content: item.content,
        confidence: item.confidence,
        tags: item.tags,
      }).returning()

      saved.push({
        id: row.id,
        type: item.type,
        content: item.content,
        confidence: item.confidence,
        tags: item.tags,
      })
      // Fire-and-forget embedding generation
      embedExtractionAsync(row.id, item.type, item.content)
    }

    // Advance interview progress when we get extractions
    if (saved.length > 0 && sectionForContext) {
      await advanceVoiceProgress(forgeId, sectionForContext.id)
    }

    return c.json({ extractions: saved })
  } catch (err) {
    console.error("Voice extraction failed:", err)
    return c.json({ extractions: [] })
  }
})

// Advance question in voice mode only when enough knowledge has been captured
async function advanceVoiceProgress(forgeId: string, currentSectionId: string) {
  const [forge] = await db.select({ depth: forges.depth }).from(forges).where(eq(forges.id, forgeId)).limit(1)
  const depth = (forge?.depth || "standard") as InterviewDepth
  const extractionsPerQuestion = DEPTH_PRESETS[depth].extractionsPerQuestion
  const sectionExtractions = await db.select().from(extractions)
    .where(and(
      eq(extractions.forgeId, forgeId),
      eq(extractions.sectionId, currentSectionId)
    ))

  const sectionQuestions = await db.select().from(interviewQuestions)
    .where(eq(interviewQuestions.sectionId, currentSectionId))
    .orderBy(asc(interviewQuestions.orderIndex))

  const answeredCount = sectionQuestions.filter((q) => q.status === "answered").length
  const activeQuestion = sectionQuestions.find((q) => q.status === "active")

  if (!activeQuestion) return

  // Only advance when we have enough extractions to justify completing this question
  const extractionsNeeded = (answeredCount + 1) * extractionsPerQuestion
  if (sectionExtractions.length < extractionsNeeded) return

  // Mark current question as answered
  await db.update(interviewQuestions).set({
    status: "answered",
    answeredAt: new Date(),
  }).where(eq(interviewQuestions.id, activeQuestion.id))

  // Find next pending question in this section
  const nextQuestions = await db.select().from(interviewQuestions)
    .where(and(
      eq(interviewQuestions.sectionId, currentSectionId),
      eq(interviewQuestions.status, "pending")
    ))
    .orderBy(asc(interviewQuestions.orderIndex))
    .limit(1)

  if (nextQuestions.length > 0) {
    await db.update(interviewQuestions).set({ status: "active" })
      .where(eq(interviewQuestions.id, nextQuestions[0].id))
    return
  }

  // Section complete - activate next section
  await db.update(interviewSections).set({
    status: "completed",
    completedAt: new Date(),
  }).where(eq(interviewSections.id, currentSectionId))

  const nextSections = await db.select().from(interviewSections)
    .where(and(
      eq(interviewSections.forgeId, forgeId),
      eq(interviewSections.status, "pending")
    ))
    .orderBy(asc(interviewSections.orderIndex))
    .limit(1)

  if (nextSections.length === 0) return

  await db.update(interviewSections).set({ status: "active" })
    .where(eq(interviewSections.id, nextSections[0].id))

  const firstQuestion = await db.select().from(interviewQuestions)
    .where(eq(interviewQuestions.sectionId, nextSections[0].id))
    .orderBy(asc(interviewQuestions.orderIndex))
    .limit(1)

  if (firstQuestion.length > 0) {
    await db.update(interviewQuestions).set({ status: "active" })
      .where(eq(interviewQuestions.id, firstQuestion[0].id))
  }
}

export default app
