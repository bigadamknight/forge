import { Hono } from "hono"
import { streamSSE } from "hono/streaming"
import { db, workspaces, forges, interviewSections, interviewQuestions, messages, extractions } from "@forge/db"
import { eq, asc, and, or, inArray } from "drizzle-orm"
import { generateInterviewConfig, generateInterviewSkeleton, generateFollowUpSkeleton, generateSectionQuestions, generateFirstMessage, type SectionQuestions } from "../services/interview-planner"
import { buildKnowledgeSummary } from "../services/tool-generator"
import { generateJSON, HAIKU } from "../lib/llm"
import type { InterviewDepth } from "@forge/shared"
import { embedExtractionAsync } from "../lib/embeddings"
import { streamConductorResponse, generateOpeningMessage } from "../services/conductor"
import { streamIntroConductorResponse, generateIntroOpening } from "../services/intro-conductor"
import { extractIntroFields, extractExpertProfile } from "../services/intro-extractor"
import type { ExpertProfile, CustomExtractionType } from "@forge/shared"
import { EMPTY_EXPERT_PROFILE, getExtractionTypeKeys } from "@forge/shared"
import { validateResponse, CONFIDENCE_THRESHOLD } from "../services/validator"
import { extractKnowledge } from "../services/extractor"
import { findActiveQuestion, advanceToNextQuestion, completeRound } from "../services/interview-progress"

const app = new Hono()

// ============ Helpers ============

async function getForge(forgeId: string) {
  const [forge] = await db.select().from(forges).where(eq(forges.id, forgeId)).limit(1)
  return forge ?? null
}

async function getWorkspaceCustomTypes(workspaceId: string): Promise<CustomExtractionType[]> {
  const [workspace] = await db.select().from(workspaces).where(eq(workspaces.id, workspaceId)).limit(1)
  if (!workspace) return []
  const metadata = (workspace.metadata as any) || {}
  return metadata.customExtractionTypes || []
}

async function insertSectionsAndQuestions(
  forgeId: string,
  sections: Array<{ title: string; goal: string; questions: Array<{ text: string; goal: string }> }>,
  round = 1
): Promise<void> {
  for (let si = 0; si < sections.length; si++) {
    const section = sections[si]
    const [dbSection] = await db.insert(interviewSections).values({
      forgeId,
      title: section.title,
      goal: section.goal,
      orderIndex: si,
      round,
      status: si === 0 ? "active" : "pending",
    }).returning()

    for (let qi = 0; qi < section.questions.length; qi++) {
      await db.insert(interviewQuestions).values({
        sectionId: dbSection.id,
        text: section.questions[qi].text,
        goal: section.questions[qi].goal,
        orderIndex: qi,
        status: si === 0 && qi === 0 ? "active" : "pending",
      })
    }
  }
}

// ============ Plan Interview ============

app.post("/:forgeId/plan-interview", async (c) => {
  const { forgeId } = c.req.param()

  const forge = await getForge(forgeId)
  if (!forge) return c.json({ error: "Forge not found" }, 404)

  await db.update(forges).set({ status: "planning", updatedAt: new Date() }).where(eq(forges.id, forgeId))

  const config = await generateInterviewConfig(
    forge.expertName!,
    forge.domain!,
    forge.expertBio || "",
    forge.targetAudience
  )

  await db.update(forges).set({
    interviewConfig: config,
    status: "interviewing",
    updatedAt: new Date(),
  }).where(eq(forges.id, forgeId))

  await insertSectionsAndQuestions(forgeId, config.sections)

  const updated = await getForge(forgeId)
  return c.json(updated)
})

// ============ Plan Interview (SSE streaming) ============

app.post("/:forgeId/plan-interview-stream", async (c) => {
  const { forgeId } = c.req.param()

  const forge = await getForge(forgeId)
  if (!forge) return c.json({ error: "Forge not found" }, 404)

  await db.update(forges).set({ status: "planning", updatedAt: new Date() }).where(eq(forges.id, forgeId))

  return streamSSE(c, async (stream) => {
    try {
      await stream.writeSSE({ data: JSON.stringify({ type: "analysing" }) })

      const depth = (forge.depth || "standard") as InterviewDepth
      const forgeMetadata = (forge.metadata as any) || {}
      const profile: ExpertProfile | null = forgeMetadata.introProfile || null
      const followUpTopic: string | null = forgeMetadata.followUpTopic || null

      // For follow-up interviews, scope the bio/domain to the specific topic
      const expertBio = followUpTopic
        ? `${forge.expertBio || ""}\n\nFOCUS: This is a follow-up interview specifically about: ${followUpTopic}. Design all sections around this topic.`
        : forge.expertBio || ""

      const skeleton = await generateInterviewSkeleton(
        forge.expertName!,
        forge.domain!,
        expertBio,
        forge.targetAudience,
        depth,
        profile
      )

      await stream.writeSSE({
        data: JSON.stringify({
          type: "skeleton",
          domainContext: skeleton.domainContext,
          extractionPriorities: skeleton.extractionPriorities,
          estimatedDurationMinutes: skeleton.estimatedDurationMinutes,
          sections: skeleton.sections.map((s, i) => ({ index: i, title: s.title, goal: s.goal })),
        }),
      })

      const sectionQuestions: SectionQuestions[] = new Array(skeleton.sections.length)

      await Promise.all(
        skeleton.sections.map(async (section, i) => {
          const result = await generateSectionQuestions(
            forge.expertName!, forge.domain!, forge.expertBio || "",
            forge.targetAudience, section.title, section.goal,
            skeleton.domainContext, depth, profile
          )
          sectionQuestions[i] = result
          await stream.writeSSE({
            data: JSON.stringify({ type: "questions", sectionIndex: i, questions: result.questions }),
          })
        })
      )

      const config = {
        sections: skeleton.sections.map((s, i) => ({
          title: s.title,
          goal: s.goal,
          questions: sectionQuestions[i].questions,
        })),
        estimatedDurationMinutes: skeleton.estimatedDurationMinutes,
        domainContext: skeleton.domainContext,
        extractionPriorities: skeleton.extractionPriorities,
        firstMessage: "",
      }

      const [firstMessage] = await Promise.all([
        generateFirstMessage(forge.expertName!, forge.domain!, skeleton.sections.map((s) => s.title)),
        insertSectionsAndQuestions(forgeId, config.sections),
      ])
      config.firstMessage = firstMessage

      await db.update(forges).set({
        interviewConfig: config,
        status: "interviewing",
        updatedAt: new Date(),
      }).where(eq(forges.id, forgeId))

      await stream.writeSSE({
        data: JSON.stringify({ type: "complete", forgeId }),
      })
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error"
      console.error("[plan-interview-stream] Error:", message)
      await stream.writeSSE({
        data: JSON.stringify({ type: "error", message }),
      })
    }
  })
})

// ============ Get Interview State ============

app.get("/:forgeId/interview", async (c) => {
  const { forgeId } = c.req.param()

  const forge = await getForge(forgeId)
  if (!forge) return c.json({ error: "Forge not found" }, 404)

  const sections = await db.select().from(interviewSections)
    .where(eq(interviewSections.forgeId, forgeId))
    .orderBy(asc(interviewSections.orderIndex))

  const sectionsWithQuestions = await Promise.all(
    sections.map(async (section) => {
      const questions = await db.select().from(interviewQuestions)
        .where(eq(interviewQuestions.sectionId, section.id))
        .orderBy(asc(interviewQuestions.orderIndex))

      const questionsWithMessages = await Promise.all(
        questions.map(async (question) => {
          const msgs = await db.select().from(messages)
            .where(eq(messages.questionId, question.id))
            .orderBy(asc(messages.createdAt))
          return { ...question, messages: msgs }
        })
      )

      return { ...section, questions: questionsWithMessages }
    })
  )

  const allExtractions = await db.select().from(extractions)
    .where(eq(extractions.forgeId, forgeId))
    .orderBy(asc(extractions.createdAt))

  const currentRound = Math.max(1, ...sections.map(s => s.round))

  return c.json({
    forge,
    sections: sectionsWithQuestions,
    extractions: allExtractions,
    currentRound,
  })
})

// ============ Generate Opening Message ============

app.post("/:forgeId/interview/opening", async (c) => {
  const { forgeId } = c.req.param()

  const forge = await getForge(forgeId)
  if (!forge) return c.json({ error: "Forge not found" }, 404)

  // Find active question
  const { activeSection, activeQuestion } = await findActiveQuestion(forgeId)
  if (!activeQuestion || !activeSection) {
    return c.json({ error: "No active question" }, 400)
  }

  const isFirst = activeSection.orderIndex === 0 && activeQuestion.orderIndex === 0

  const opening = await generateOpeningMessage(
    forge.expertName!,
    forge.domain!,
    activeSection.title,
    activeQuestion.text,
    isFirst
  )

  // Save as assistant message
  const [msg] = await db.insert(messages).values({
    questionId: activeQuestion.id,
    role: "assistant",
    content: opening,
  }).returning()

  return c.json({ message: msg, opening })
})

// ============ Send Message (with SSE streaming) ============

app.post("/:forgeId/interview/message", async (c) => {
  const { forgeId } = c.req.param()
  const { content } = await c.req.json()

  if (!content) return c.json({ error: "content is required" }, 400)

  const forge = await getForge(forgeId)
  if (!forge) return c.json({ error: "Forge not found" }, 404)

  const { activeSection, activeQuestion } = await findActiveQuestion(forgeId)
  if (!activeQuestion || !activeSection) {
    return c.json({ error: "No active question" }, 400)
  }

  // Save user message
  await db.insert(messages).values({
    questionId: activeQuestion.id,
    role: "user",
    content,
  })

  // Get all messages for this question
  const questionMessages = await db.select().from(messages)
    .where(eq(messages.questionId, activeQuestion.id))
    .orderBy(asc(messages.createdAt))

  const conversationHistory = questionMessages.map((m) => ({
    role: m.role as "user" | "assistant",
    content: m.content,
  }))

  // Get existing extractions for dedup + workspace custom types
  const [existing, customTypes] = await Promise.all([
    db.select().from(extractions).where(eq(extractions.forgeId, forgeId)),
    getWorkspaceCustomTypes(forge.workspaceId),
  ])
  const existingContents = existing.map((e) => e.content)

  return streamSSE(c, async (stream) => {
    try {
      // Run conductor (streamed), validator, and extractor in parallel
      let fullResponse = ""

      const conductorPromise = (async () => {
        const generator = streamConductorResponse(
          forge.expertName!,
          forge.domain!,
          activeSection.title,
          activeSection.goal || "",
          activeQuestion.text,
          activeQuestion.goal || "",
          conversationHistory
        )
        for await (const chunk of generator) {
          fullResponse += chunk
          await stream.writeSSE({ data: JSON.stringify({ type: "chunk", content: chunk }) })
        }
      })()

      const validatorPromise = validateResponse(
        activeQuestion.text,
        activeQuestion.goal || "",
        activeSection.goal || "",
        questionMessages.map((m) => ({ role: m.role, content: m.content }))
      )

      const extractorPromise = extractKnowledge(
        content,
        activeSection.title,
        activeQuestion.text,
        existingContents,
        undefined,
        customTypes
      )

      // Wait for all three
      const [, validationResult, extractedItems] = await Promise.all([
        conductorPromise,
        validatorPromise,
        extractorPromise,
      ])

      // Save conductor response
      const [assistantMsg] = await db.insert(messages).values({
        questionId: activeQuestion.id,
        role: "assistant",
        content: fullResponse,
      }).returning()

      await stream.writeSSE({
        data: JSON.stringify({ type: "done", messageId: assistantMsg.id }),
      })

      // Save validation result
      await db.update(interviewQuestions).set({
        validationResult,
      }).where(eq(interviewQuestions.id, activeQuestion.id))

      await stream.writeSSE({
        data: JSON.stringify({ type: "validation", result: validationResult }),
      })

      // Save extractions
      if (extractedItems.length > 0) {
        const savedExtractions = []
        for (const item of extractedItems) {
          const [saved] = await db.insert(extractions).values({
            forgeId,
            sectionId: activeSection.id,
            questionId: activeQuestion.id,
            type: item.type,
            content: item.content,
            structured: item.structured || null,
            confidence: item.confidence,
            tags: item.tags,
            round: activeSection.round,
          }).returning()
          savedExtractions.push(saved)
          // Fire-and-forget embedding generation
          embedExtractionAsync(saved.id, item.type, item.content)
        }

        await stream.writeSSE({
          data: JSON.stringify({
            type: "extraction",
            items: savedExtractions.map((e) => ({
              id: e.id,
              type: e.type,
              content: e.content,
              confidence: e.confidence,
              tags: e.tags,
            })),
          }),
        })
      }

      // Auto-advance if validation passes
      if (validationResult.meets_goal && validationResult.confidence >= CONFIDENCE_THRESHOLD) {
        const advanced = await advanceToNextQuestion(forgeId, activeSection.id, activeQuestion.id)
        if (advanced) {
          await stream.writeSSE({
            data: JSON.stringify({
              type: "advance",
              sectionId: advanced.sectionId,
              questionId: advanced.questionId,
            }),
          })
        } else {
          const allSections = await db.select().from(interviewSections)
            .where(eq(interviewSections.forgeId, forgeId))
          const maxRound = Math.max(1, ...allSections.map(s => s.round))
          await completeRound(forgeId, maxRound)

          await stream.writeSSE({
            data: JSON.stringify({ type: "interview_complete" }),
          })
        }
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error"
      await stream.writeSSE({
        data: JSON.stringify({ type: "error", message }),
      })
    }
  })
})

// ============ Manually Advance ============

app.post("/:forgeId/interview/next", async (c) => {
  const { forgeId } = c.req.param()
  const { activeSection, activeQuestion } = await findActiveQuestion(forgeId)
  if (!activeQuestion || !activeSection) {
    return c.json({ error: "No active question" }, 400)
  }

  const advanced = await advanceToNextQuestion(forgeId, activeSection.id, activeQuestion.id)
  if (!advanced) {
    return c.json({ complete: true })
  }
  return c.json(advanced)
})

// ============ Complete Interview ============

app.post("/:forgeId/interview/complete", async (c) => {
  const { forgeId } = c.req.param()

  // Find current round
  const allSections = await db.select().from(interviewSections)
    .where(eq(interviewSections.forgeId, forgeId))
  const currentRound = Math.max(1, ...allSections.map(s => s.round))

  // Only mark sections from current round as completed
  const roundSections = allSections.filter(s => s.round === currentRound)

  for (const section of roundSections) {
    if (section.status !== "completed") {
      await db.update(interviewSections).set({
        status: "completed",
        completedAt: new Date(),
      }).where(eq(interviewSections.id, section.id))
    }

    await db.update(interviewQuestions).set({
      status: "answered",
      answeredAt: new Date(),
    }).where(and(
      eq(interviewQuestions.sectionId, section.id),
      or(
        eq(interviewQuestions.status, "active"),
        eq(interviewQuestions.status, "pending")
      )
    ))
  }

  await completeRound(forgeId, currentRound)

  const forge = await getForge(forgeId)
  return c.json(forge)
})

// ============ Get Extractions ============

app.get("/:forgeId/extractions", async (c) => {
  const { forgeId } = c.req.param()
  const results = await db.select().from(extractions)
    .where(eq(extractions.forgeId, forgeId))
    .orderBy(asc(extractions.createdAt))
  return c.json(results)
})

// ============ Update Extraction ============

app.patch("/:forgeId/extractions/:extractionId", async (c) => {
  const { forgeId, extractionId } = c.req.param()
  const { content, type, tags, confidence } = await c.req.json()

  if (type !== undefined) {
    const forge = await getForge(forgeId)
    if (!forge) return c.json({ error: "Forge not found" }, 404)
    const customTypes = await getWorkspaceCustomTypes(forge.workspaceId)
    const validTypes = getExtractionTypeKeys(customTypes)
    if (!validTypes.includes(type)) {
      return c.json({ error: "Invalid extraction type" }, 400)
    }
  }

  const updates: Record<string, unknown> = {}
  if (content !== undefined) updates.content = content
  if (type !== undefined) updates.type = type
  if (tags !== undefined) updates.tags = tags
  if (confidence !== undefined) updates.confidence = confidence

  if (Object.keys(updates).length === 0) {
    return c.json({ error: "Nothing to update" }, 400)
  }

  const [extraction] = await db.update(extractions)
    .set(updates)
    .where(and(eq(extractions.id, extractionId), eq(extractions.forgeId, forgeId)))
    .returning()

  if (!extraction) return c.json({ error: "Extraction not found" }, 404)

  // Re-embed async if content changed
  if (content !== undefined) {
    embedExtractionAsync(extractionId, extraction.type, extraction.content)
  }

  return c.json(extraction)
})

// ============ Delete Extraction ============

app.delete("/:forgeId/extractions/:extractionId", async (c) => {
  const { forgeId, extractionId } = c.req.param()

  const result = await db.delete(extractions)
    .where(and(eq(extractions.id, extractionId), eq(extractions.forgeId, forgeId)))
    .returning()

  if (result.length === 0) return c.json({ error: "Extraction not found" }, 404)

  return c.json({ deleted: true })
})

// ============ Follow-Up Interview (SSE streaming) ============

app.post("/:forgeId/follow-up", async (c) => {
  const { forgeId } = c.req.param()
  const { topic } = await c.req.json()

  if (!topic) return c.json({ error: "topic is required" }, 400)

  const forge = await getForge(forgeId)
  if (!forge) return c.json({ error: "Forge not found" }, 404)

  // Load existing extractions across entire workspace for context
  const workspaceForges = await db.select({ id: forges.id })
    .from(forges).where(eq(forges.workspaceId, forge.workspaceId))
  const forgeIds = workspaceForges.map(f => f.id)
  const allExtractions = await db.select().from(extractions)
    .where(inArray(extractions.forgeId, forgeIds))
    .orderBy(asc(extractions.createdAt))
  const extractionItems = allExtractions.map(e => ({
    type: e.type,
    content: e.content,
    confidence: e.confidence,
    tags: e.tags,
  }))
  const existingKnowledge = buildKnowledgeSummary(extractionItems)

  // Get existing components from workspace toolConfig
  const [workspace] = await db.select().from(workspaces)
    .where(eq(workspaces.id, forge.workspaceId)).limit(1)
  const existingComponents = ((workspace?.toolConfig as any)?.layout || []).map((c: any) => c.title as string)

  // Create a new forge (interview) in the same workspace
  const [newForge] = await db.insert(forges).values({
    workspaceId: forge.workspaceId,
    title: `Follow-up: ${topic}`,
    expertName: forge.expertName,
    domain: forge.domain,
    targetAudience: forge.targetAudience,
    depth: forge.depth,
    status: "planning",
    metadata: { followUpTopic: topic },
  }).returning()

  return streamSSE(c, async (stream) => {
    try {
      await stream.writeSSE({ data: JSON.stringify({ type: "analysing" }) })

      const skeleton = await generateFollowUpSkeleton(
        forge.expertName!,
        forge.domain!,
        forge.expertBio || "",
        forge.targetAudience,
        topic,
        existingKnowledge,
        existingComponents
      )

      await stream.writeSSE({
        data: JSON.stringify({
          type: "skeleton",
          domainContext: skeleton.domainContext,
          extractionPriorities: skeleton.extractionPriorities,
          estimatedDurationMinutes: skeleton.estimatedDurationMinutes,
          sections: skeleton.sections.map((s, i) => ({ index: i, title: s.title, goal: s.goal })),
        }),
      })

      const sectionQuestions: SectionQuestions[] = new Array(skeleton.sections.length)

      await Promise.all(
        skeleton.sections.map(async (section, i) => {
          const result = await generateSectionQuestions(
            forge.expertName!, forge.domain!, forge.expertBio || "",
            forge.targetAudience, section.title, section.goal,
            skeleton.domainContext, "quick" as InterviewDepth
          )
          sectionQuestions[i] = result
          await stream.writeSSE({
            data: JSON.stringify({ type: "questions", sectionIndex: i, questions: result.questions }),
          })
        })
      )

      const config = {
        sections: skeleton.sections.map((s, i) => ({
          title: s.title,
          goal: s.goal,
          questions: sectionQuestions[i].questions,
        })),
        estimatedDurationMinutes: skeleton.estimatedDurationMinutes,
        domainContext: skeleton.domainContext,
        extractionPriorities: skeleton.extractionPriorities,
        firstMessage: "",
      }

      const [firstMessage] = await Promise.all([
        generateFirstMessage(forge.expertName!, forge.domain!, skeleton.sections.map(s => s.title)),
        insertSectionsAndQuestions(newForge.id, config.sections),
      ])
      config.firstMessage = firstMessage

      await db.update(forges).set({
        interviewConfig: config,
        status: "interviewing",
        updatedAt: new Date(),
      }).where(eq(forges.id, newForge.id))

      await stream.writeSSE({
        data: JSON.stringify({ type: "complete", forgeId: newForge.id }),
      })
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error"
      console.error("[follow-up] Error:", message)
      await stream.writeSSE({
        data: JSON.stringify({ type: "error", message }),
      })
    }
  })
})

// ============ Suggest Follow-Ups ============

app.post("/:forgeId/suggest-followups", async (c) => {
  const { forgeId } = c.req.param()

  const forge = await getForge(forgeId)
  if (!forge) return c.json({ error: "Forge not found" }, 404)

  // Load extractions from all forges in workspace
  const workspaceForges = await db.select({ id: forges.id })
    .from(forges).where(eq(forges.workspaceId, forge.workspaceId))
  const forgeIds = workspaceForges.map(f => f.id)
  const allExtractions = await db.select().from(extractions)
    .where(inArray(extractions.forgeId, forgeIds))
    .orderBy(asc(extractions.createdAt))
  const extractionItems = allExtractions.map(e => ({
    type: e.type, content: e.content, confidence: e.confidence, tags: e.tags,
  }))
  const knowledgeSummary = buildKnowledgeSummary(extractionItems)

  // Get component titles from workspace toolConfig
  const [workspace] = await db.select().from(workspaces)
    .where(eq(workspaces.id, forge.workspaceId)).limit(1)
  const componentTitles = ((workspace?.toolConfig as any)?.layout || []).map((c: any) => c.title).join(", ")

  const result = await generateJSON<{ suggestions: Array<{ topic: string, reason: string }> }>(
    `Analyze the existing knowledge and tool components for this expert, then suggest 3 follow-up interview topics that would fill gaps or deepen the most valuable areas.

EXPERT: ${forge.expertName}
DOMAIN: ${forge.domain}
TARGET AUDIENCE: ${forge.targetAudience || "General audience"}

EXISTING KNOWLEDGE:
${knowledgeSummary}

EXISTING TOOL COMPONENTS: ${componentTitles}

Suggest 3 follow-up topics that would:
1. Fill gaps in the current knowledge
2. Deepen areas that users would benefit most from
3. Not repeat what's already well-covered

Return JSON: { "suggestions": [{ "topic": "short topic phrase", "reason": "why this would be valuable" }] }`,
    { model: HAIKU, maxTokens: 1024, temperature: 0.6 }
  )

  return c.json(result)
})

// ============ Intro Phase ============

app.post("/:forgeId/intro/opening", async (c) => {
  const { forgeId } = c.req.param()
  const forge = await getForge(forgeId)
  if (!forge) return c.json({ error: "Forge not found" }, 404)
  if (forge.status !== "draft") return c.json({ error: "Forge is not in intro phase" }, 400)

  const content = await generateIntroOpening()
  const metadata = (forge.metadata as any) || {}
  const introMessages = [{ role: "assistant", content }]

  await db.update(forges).set({
    metadata: { ...metadata, introMessages },
    updatedAt: new Date(),
  }).where(eq(forges.id, forgeId))

  return c.json({ content })
})

app.post("/:forgeId/intro/message", async (c) => {
  const { forgeId } = c.req.param()
  const { content } = await c.req.json()

  const forge = await getForge(forgeId)
  if (!forge) return c.json({ error: "Forge not found" }, 404)
  if (forge.status !== "draft") return c.json({ error: "Forge is not in intro phase" }, 400)

  const metadata = (forge.metadata as any) || {}
  const introMessages: Array<{ role: "user" | "assistant"; content: string }> = [...(metadata.introMessages || [])]
  const previousProfile: ExpertProfile = metadata.introProfile || EMPTY_EXPERT_PROFILE

  // Append user message
  introMessages.push({ role: "user", content })

  // Get existing extractions for dedup + workspace custom types
  const [existingExtractions, introCustomTypes] = await Promise.all([
    db.select().from(extractions).where(eq(extractions.forgeId, forgeId)),
    getWorkspaceCustomTypes(forge.workspaceId),
  ])
  const existingContents = existingExtractions.map((e) => e.content)

  return streamSSE(c, async (stream) => {
    // Run conductor, profile extractor, and knowledge extractor in parallel
    let fullResponse = ""

    const conductorPromise = (async () => {
      for await (const chunk of streamIntroConductorResponse(introMessages, previousProfile)) {
        fullResponse += chunk
        await stream.writeSSE({ data: JSON.stringify({ type: "chunk", content: chunk }) })
      }
    })()

    const profilePromise = extractExpertProfile(introMessages, previousProfile)

    const knowledgePromise = extractKnowledge(
      content,
      forge.domain || "General",
      "Intro conversation",
      existingContents,
      "low",
      introCustomTypes
    )

    const [, profile, extractedItems] = await Promise.all([conductorPromise, profilePromise, knowledgePromise])

    // Append assistant message
    introMessages.push({ role: "assistant", content: fullResponse })

    // Merge profile (keep previous values if new ones are null)
    const mergedProfile: ExpertProfile = { ...EMPTY_EXPERT_PROFILE }
    for (const key of Object.keys(EMPTY_EXPERT_PROFILE) as Array<keyof ExpertProfile>) {
      const newVal = profile[key]
      const prevVal = previousProfile[key]
      if (newVal !== null && newVal !== undefined) {
        ;(mergedProfile as any)[key] = newVal
      } else if (prevVal !== null && prevVal !== undefined) {
        ;(mergedProfile as any)[key] = prevVal
      }
    }

    // Backward compat: also maintain introExtracted
    const newExtracted = {
      expertName: mergedProfile.expertName,
      domain: mergedProfile.domain,
      targetAudience: mergedProfile.targetAudience,
    }

    // Save to forge metadata
    await db.update(forges).set({
      metadata: { ...metadata, introMessages, introProfile: mergedProfile, introExtracted: newExtracted },
      updatedAt: new Date(),
    }).where(eq(forges.id, forgeId))

    await stream.writeSSE({ data: JSON.stringify({ type: "done" }) })
    await stream.writeSSE({ data: JSON.stringify({ type: "profile_updated", profile: mergedProfile }) })
    await stream.writeSSE({ data: JSON.stringify({ type: "intro_extracted", fields: newExtracted }) })

    // Save knowledge extractions
    if (extractedItems.length > 0) {
      const savedExtractions = []
      for (const item of extractedItems) {
        const [saved] = await db.insert(extractions).values({
          forgeId,
          type: item.type,
          content: item.content,
          structured: item.structured || null,
          confidence: item.confidence,
          tags: item.tags,
        }).returning()
        savedExtractions.push(saved)
        embedExtractionAsync(saved.id, item.type, item.content)
      }

      await stream.writeSSE({
        data: JSON.stringify({
          type: "extraction",
          items: savedExtractions.map((e) => ({
            id: e.id,
            type: e.type,
            content: e.content,
            confidence: e.confidence,
            tags: e.tags,
          })),
        }),
      })
    }
  })
})

app.post("/:forgeId/intro/complete", async (c) => {
  const { forgeId } = c.req.param()
  const { depth } = await c.req.json()

  const forge = await getForge(forgeId)
  if (!forge) return c.json({ error: "Forge not found" }, 404)

  const metadata = (forge.metadata as any) || {}
  const profile: ExpertProfile = metadata.introProfile || metadata.introExtracted || {}

  if (!profile.expertName || !profile.domain) {
    return c.json({ error: "Expert name and domain not yet captured" }, 400)
  }

  // Build expertBio from full intro transcript (user messages only)
  const introTranscript = (metadata.introMessages || [])
    .filter((m: any) => m.role === "user")
    .map((m: any) => m.content)
    .join("\n")

  await db.update(forges).set({
    title: `${profile.domain} - ${profile.expertName}`,
    expertName: profile.expertName,
    domain: profile.domain,
    targetAudience: profile.targetAudience || null,
    expertBio: introTranscript,
    depth: depth || "standard",
    status: "planning",
    metadata: { ...metadata, introProfile: profile },
    updatedAt: new Date(),
  }).where(eq(forges.id, forgeId))

  // Also update workspace title
  await db.update(workspaces).set({
    title: `${profile.domain} - ${profile.expertName}`,
    updatedAt: new Date(),
  }).where(eq(workspaces.id, forge.workspaceId))

  return c.json({ ok: true })
})

export default app
