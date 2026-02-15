// Seed 3 test interviews into the database
// Usage: bun run packages/db/src/seed-interviews.ts
//
// Creates complete interview data (forges, sections, questions, messages, extractions)
// with status "processing" so they're ready for the next pipeline steps.

import { db } from "./index"
import { forges, interviewSections, interviewQuestions, messages, extractions } from "./schema"
import { allInterviews, type FixtureInterview } from "./fixtures/interviews"
import { eq } from "drizzle-orm"

async function seedInterview(interview: FixtureInterview) {
  const { forge: forgeData, interviewConfig, sections } = interview

  // Create forge
  const [forge] = await db
    .insert(forges)
    .values({
      title: forgeData.title,
      expertName: forgeData.expertName,
      expertBio: forgeData.expertBio,
      domain: forgeData.domain,
      targetAudience: forgeData.targetAudience,
      status: "processing",
      interviewConfig,
      updatedAt: new Date(),
    })
    .returning()

  console.log(`  Created forge: ${forge.title} (${forge.id})`)

  for (let si = 0; si < sections.length; si++) {
    const sectionData = sections[si]

    const [section] = await db
      .insert(interviewSections)
      .values({
        forgeId: forge.id,
        title: sectionData.title,
        goal: sectionData.goal,
        orderIndex: si,
        status: "completed",
        summary: sectionData.summary,
        completedAt: new Date(),
      })
      .returning()

    for (let qi = 0; qi < sectionData.questions.length; qi++) {
      const questionData = sectionData.questions[qi]

      const [question] = await db
        .insert(interviewQuestions)
        .values({
          sectionId: section.id,
          text: questionData.text,
          goal: questionData.goal,
          orderIndex: qi,
          status: "answered",
          validationResult: questionData.validation,
          answeredAt: new Date(),
        })
        .returning()

      // Insert messages
      for (const msg of questionData.messages) {
        await db.insert(messages).values({
          questionId: question.id,
          role: msg.role,
          content: msg.content,
        })
      }

      // Insert extractions
      for (const ext of questionData.extractions) {
        await db.insert(extractions).values({
          forgeId: forge.id,
          sectionId: section.id,
          questionId: question.id,
          type: ext.type,
          content: ext.content,
          confidence: ext.confidence,
          tags: ext.tags,
          structured: ext.structured || null,
        })
      }
    }
  }

  return forge
}

async function main() {
  const args = process.argv.slice(2)
  const shouldClean = args.includes("--clean")

  if (shouldClean) {
    console.log("Cleaning existing test data...")
    // Delete forges that match our test titles (cascades handle the rest)
    const testTitles = allInterviews.map((i) => i.forge.title)
    for (const title of testTitles) {
      await db.delete(forges).where(eq(forges.title, title))
    }
    console.log("Cleaned.\n")
  }

  console.log("Seeding 3 test interviews...\n")

  const created = []
  for (const interview of allInterviews) {
    const forge = await seedInterview(interview)
    created.push(forge)
  }

  console.log("\nDone. Created forges:")
  for (const forge of created) {
    console.log(`  ${forge.id} - ${forge.title} (${forge.status})`)
  }

  console.log("\nAll interviews are in 'processing' status, ready for knowledge base assembly and tool generation.")
  process.exit(0)
}

main().catch((err) => {
  console.error("Seed failed:", err)
  process.exit(1)
})
