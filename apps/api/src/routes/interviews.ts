import { Hono } from "hono"
import { streamSSE } from "hono/streaming"
import { db, forges, interviewSections, interviewQuestions, messages, extractions } from "@forge/db"
import { eq, asc, and, or } from "drizzle-orm"
import { generateInterviewConfig, generateInterviewSkeleton, generateSectionQuestions, generateFirstMessage, type SectionQuestions } from "../services/interview-planner"
import type { InterviewDepth } from "@forge/shared"
import { embedExtractionAsync } from "../lib/embeddings"
import { streamConductorResponse, generateOpeningMessage } from "../services/conductor"
import { validateResponse, CONFIDENCE_THRESHOLD } from "../services/validator"
import { extractKnowledge } from "../services/extractor"

const app = new Hono()

// ============ Plan Interview ============
// Opus generates the interview config from expert intro

app.post("/:forgeId/plan-interview", async (c) => {
  const { forgeId } = c.req.param()

  const [forge] = await db.select().from(forges).where(eq(forges.id, forgeId)).limit(1)
  if (!forge) return c.json({ error: "Forge not found" }, 404)

  // Update status to planning
  await db.update(forges).set({ status: "planning", updatedAt: new Date() }).where(eq(forges.id, forgeId))

  // Generate interview config with Opus
  const config = await generateInterviewConfig(
    forge.expertName,
    forge.domain,
    forge.expertBio || "",
    forge.targetAudience
  )

  // Save config and create sections/questions in DB
  await db.update(forges).set({
    interviewConfig: config,
    status: "interviewing",
    updatedAt: new Date(),
  }).where(eq(forges.id, forgeId))

  // Create sections and questions
  for (let si = 0; si < config.sections.length; si++) {
    const section = config.sections[si]
    const [dbSection] = await db.insert(interviewSections).values({
      forgeId,
      title: section.title,
      goal: section.goal,
      orderIndex: si,
      status: si === 0 ? "active" : "pending",
    }).returning()

    for (let qi = 0; qi < section.questions.length; qi++) {
      const question = section.questions[qi]
      await db.insert(interviewQuestions).values({
        sectionId: dbSection.id,
        text: question.text,
        goal: question.goal,
        orderIndex: qi,
        status: si === 0 && qi === 0 ? "active" : "pending",
      })
    }
  }

  // Return updated forge
  const [updated] = await db.select().from(forges).where(eq(forges.id, forgeId)).limit(1)
  return c.json(updated)
})

// ============ Plan Interview (SSE streaming) ============

app.post("/:forgeId/plan-interview-stream", async (c) => {
  const { forgeId } = c.req.param()

  const [forge] = await db.select().from(forges).where(eq(forges.id, forgeId)).limit(1)
  if (!forge) return c.json({ error: "Forge not found" }, 404)

  await db.update(forges).set({ status: "planning", updatedAt: new Date() }).where(eq(forges.id, forgeId))

  return streamSSE(c, async (stream) => {
    try {
      // Stage 1: Analysing
      await stream.writeSSE({ data: JSON.stringify({ type: "analysing" }) })

      // Stage 2: Generate skeleton (Opus)
      const depth = (forge.depth || "standard") as InterviewDepth
      const skeleton = await generateInterviewSkeleton(
        forge.expertName,
        forge.domain,
        forge.expertBio || "",
        forge.targetAudience,
        depth
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

      // Stage 3: Generate questions per section in parallel (Sonnet)
      const sectionQuestions: SectionQuestions[] = new Array(skeleton.sections.length)

      await Promise.all(
        skeleton.sections.map(async (section, i) => {
          const result = await generateSectionQuestions(
            forge.expertName,
            forge.domain,
            forge.expertBio || "",
            forge.targetAudience,
            section.title,
            section.goal,
            skeleton.domainContext,
            depth
          )
          sectionQuestions[i] = result
          await stream.writeSSE({
            data: JSON.stringify({
              type: "questions",
              sectionIndex: i,
              questions: result.questions,
            }),
          })
        })
      )

      // Stage 4: Generate first message + save to DB in parallel
      const sectionTitles = skeleton.sections.map((s) => s.title)
      const firstMessagePromise = generateFirstMessage(forge.expertName, forge.domain, sectionTitles)

      const config = {
        sections: skeleton.sections.map((s, i) => ({
          title: s.title,
          goal: s.goal,
          questions: sectionQuestions[i].questions,
        })),
        estimatedDurationMinutes: skeleton.estimatedDurationMinutes,
        domainContext: skeleton.domainContext,
        extractionPriorities: skeleton.extractionPriorities,
        firstMessage: "", // populated below
      }

      // DB inserts run while first message generates
      const dbInsertPromise = (async () => {
        for (let si = 0; si < config.sections.length; si++) {
          const section = config.sections[si]
          const [dbSection] = await db.insert(interviewSections).values({
            forgeId,
            title: section.title,
            goal: section.goal,
            orderIndex: si,
            status: si === 0 ? "active" : "pending",
          }).returning()

          for (let qi = 0; qi < section.questions.length; qi++) {
            const question = section.questions[qi]
            await db.insert(interviewQuestions).values({
              sectionId: dbSection.id,
              text: question.text,
              goal: question.goal,
              orderIndex: qi,
              status: si === 0 && qi === 0 ? "active" : "pending",
            })
          }
        }
      })()

      const [firstMessage] = await Promise.all([firstMessagePromise, dbInsertPromise])
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

  const [forge] = await db.select().from(forges).where(eq(forges.id, forgeId)).limit(1)
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

  return c.json({
    forge,
    sections: sectionsWithQuestions,
    extractions: allExtractions,
  })
})

// ============ Generate Opening Message ============

app.post("/:forgeId/interview/opening", async (c) => {
  const { forgeId } = c.req.param()

  const [forge] = await db.select().from(forges).where(eq(forges.id, forgeId)).limit(1)
  if (!forge) return c.json({ error: "Forge not found" }, 404)

  // Find active question
  const { activeSection, activeQuestion } = await findActiveQuestion(forgeId)
  if (!activeQuestion || !activeSection) {
    return c.json({ error: "No active question" }, 400)
  }

  const isFirst = activeSection.orderIndex === 0 && activeQuestion.orderIndex === 0

  const opening = await generateOpeningMessage(
    forge.expertName,
    forge.domain,
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

  const [forge] = await db.select().from(forges).where(eq(forges.id, forgeId)).limit(1)
  if (!forge) return c.json({ error: "Forge not found" }, 404)

  // Find active question
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

  // Get existing extractions for dedup
  const existing = await db.select().from(extractions)
    .where(eq(extractions.forgeId, forgeId))
  const existingContents = existing.map((e) => e.content)

  return streamSSE(c, async (stream) => {
    try {
      // Run conductor (streamed), validator, and extractor in parallel
      let fullResponse = ""

      const conductorPromise = (async () => {
        const generator = streamConductorResponse(
          forge.expertName,
          forge.domain,
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
        existingContents
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
          // Interview complete
          await db.update(forges).set({
            status: "processing",
            updatedAt: new Date(),
          }).where(eq(forges.id, forgeId))

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

  // Mark any remaining questions/sections as answered
  const sections = await db.select().from(interviewSections)
    .where(eq(interviewSections.forgeId, forgeId))

  for (const section of sections) {
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

  await db.update(forges).set({
    status: "processing",
    updatedAt: new Date(),
  }).where(eq(forges.id, forgeId))

  const [forge] = await db.select().from(forges).where(eq(forges.id, forgeId)).limit(1)
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

// ============ Helpers ============

async function findActiveQuestion(forgeId: string) {
  const sections = await db.select().from(interviewSections)
    .where(and(
      eq(interviewSections.forgeId, forgeId),
      eq(interviewSections.status, "active")
    ))
    .orderBy(asc(interviewSections.orderIndex))
    .limit(1)

  if (sections.length === 0) return { activeSection: null, activeQuestion: null }
  const activeSection = sections[0]

  const questions = await db.select().from(interviewQuestions)
    .where(and(
      eq(interviewQuestions.sectionId, activeSection.id),
      eq(interviewQuestions.status, "active")
    ))
    .orderBy(asc(interviewQuestions.orderIndex))
    .limit(1)

  if (questions.length === 0) return { activeSection, activeQuestion: null }
  return { activeSection, activeQuestion: questions[0] }
}

async function advanceToNextQuestion(
  forgeId: string,
  currentSectionId: string,
  currentQuestionId: string
): Promise<{ sectionId: string; questionId: string } | null> {
  // Mark current question as answered
  await db.update(interviewQuestions).set({
    status: "answered",
    answeredAt: new Date(),
  }).where(eq(interviewQuestions.id, currentQuestionId))

  // Find next question in current section
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
    return { sectionId: currentSectionId, questionId: nextQuestions[0].id }
  }

  // Section complete - mark it
  await db.update(interviewSections).set({
    status: "completed",
    completedAt: new Date(),
  }).where(eq(interviewSections.id, currentSectionId))

  // Find next section
  const nextSections = await db.select().from(interviewSections)
    .where(and(
      eq(interviewSections.forgeId, forgeId),
      eq(interviewSections.status, "pending")
    ))
    .orderBy(asc(interviewSections.orderIndex))
    .limit(1)

  if (nextSections.length === 0) return null // Interview complete

  // Activate next section and its first question
  await db.update(interviewSections).set({ status: "active" })
    .where(eq(interviewSections.id, nextSections[0].id))

  const firstQuestion = await db.select().from(interviewQuestions)
    .where(eq(interviewQuestions.sectionId, nextSections[0].id))
    .orderBy(asc(interviewQuestions.orderIndex))
    .limit(1)

  if (firstQuestion.length > 0) {
    await db.update(interviewQuestions).set({ status: "active" })
      .where(eq(interviewQuestions.id, firstQuestion[0].id))
    return { sectionId: nextSections[0].id, questionId: firstQuestion[0].id }
  }

  return null
}

export default app
