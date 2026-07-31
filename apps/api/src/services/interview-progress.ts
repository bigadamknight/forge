import { db, forges, interviewSections, interviewQuestions } from "@forge/db"
import { eq, asc, and } from "drizzle-orm"
import { promoteExtractionsToUnits } from "./knowledge-base"

// Shared interview progression engine used by both the text (interviews.ts)
// and voice (voice.ts) paths, so advancement and completion behave identically
// regardless of capture mode.

export async function findActiveQuestion(forgeId: string) {
  const allSections = await db.select().from(interviewSections)
    .where(eq(interviewSections.forgeId, forgeId))
    .orderBy(asc(interviewSections.orderIndex))
  const currentRound = Math.max(1, ...allSections.map(s => s.round))
  const activeSection = allSections.find(s => s.round === currentRound && s.status === "active")

  if (!activeSection) return { activeSection: null, activeQuestion: null }

  const [activeQuestion] = await db.select().from(interviewQuestions)
    .where(and(
      eq(interviewQuestions.sectionId, activeSection.id),
      eq(interviewQuestions.status, "active")
    ))
    .orderBy(asc(interviewQuestions.orderIndex))
    .limit(1)

  return { activeSection, activeQuestion: activeQuestion ?? null }
}

export async function advanceToNextQuestion(
  forgeId: string,
  currentSectionId: string,
  currentQuestionId: string
): Promise<{ sectionId: string; questionId: string } | null> {
  await db.update(interviewQuestions).set({
    status: "answered",
    answeredAt: new Date(),
  }).where(eq(interviewQuestions.id, currentQuestionId))

  // Try next question in current section
  const [nextQuestion] = await db.select().from(interviewQuestions)
    .where(and(
      eq(interviewQuestions.sectionId, currentSectionId),
      eq(interviewQuestions.status, "pending")
    ))
    .orderBy(asc(interviewQuestions.orderIndex))
    .limit(1)

  if (nextQuestion) {
    await db.update(interviewQuestions).set({ status: "active" })
      .where(eq(interviewQuestions.id, nextQuestion.id))
    return { sectionId: currentSectionId, questionId: nextQuestion.id }
  }

  // Section complete
  await db.update(interviewSections).set({
    status: "completed",
    completedAt: new Date(),
  }).where(eq(interviewSections.id, currentSectionId))

  // Find next pending section in the same round
  const [currentSection] = await db.select().from(interviewSections)
    .where(eq(interviewSections.id, currentSectionId)).limit(1)
  const round = currentSection?.round ?? 1

  const allPendingSections = await db.select().from(interviewSections)
    .where(and(
      eq(interviewSections.forgeId, forgeId),
      eq(interviewSections.status, "pending")
    ))
    .orderBy(asc(interviewSections.orderIndex))
  const nextSection = allPendingSections.find(s => s.round === round)

  if (!nextSection) return null

  await db.update(interviewSections).set({ status: "active" })
    .where(eq(interviewSections.id, nextSection.id))

  const [firstQuestion] = await db.select().from(interviewQuestions)
    .where(eq(interviewQuestions.sectionId, nextSection.id))
    .orderBy(asc(interviewQuestions.orderIndex))
    .limit(1)

  if (firstQuestion) {
    await db.update(interviewQuestions).set({ status: "active" })
      .where(eq(interviewQuestions.id, firstQuestion.id))
    return { sectionId: nextSection.id, questionId: firstQuestion.id }
  }

  return null
}

export async function getMaxRound(forgeId: string): Promise<number> {
  const allSections = await db.select({ round: interviewSections.round })
    .from(interviewSections)
    .where(eq(interviewSections.forgeId, forgeId))
  return Math.max(1, ...allSections.map(s => s.round))
}

export async function completeRound(forgeId: string, round: number): Promise<void> {
  // Promote this round's extractions into the workspace knowledge layer
  promoteExtractionsToUnits(forgeId).catch((err) =>
    console.error(`[interview-progress] Knowledge promotion failed for ${forgeId}:`, err)
  )

  if (round > 1) {
    await db.update(forges).set({
      status: "complete",
      updatedAt: new Date(),
    }).where(eq(forges.id, forgeId))

    const [forge] = await db.select().from(forges).where(eq(forges.id, forgeId)).limit(1)
    if (forge) {
      const metadata = (forge.metadata as any) || {}
      const rounds = metadata.interviewRounds || []
      const roundEntry = rounds.find((r: any) => r.round === round)
      if (roundEntry) {
        roundEntry.status = "completed"
        roundEntry.completedAt = new Date().toISOString()
      }
      await db.update(forges).set({
        metadata: { ...metadata, interviewRounds: rounds },
      }).where(eq(forges.id, forgeId))
    }
  } else {
    await db.update(forges).set({
      status: "processing",
      updatedAt: new Date(),
    }).where(eq(forges.id, forgeId))
  }
}
