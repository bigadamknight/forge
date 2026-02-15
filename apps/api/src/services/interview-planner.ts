import { generateJSON, generateText, SONNET } from "../lib/llm"
import type { InterviewConfig, InterviewDepth } from "@forge/shared"
import { DEPTH_PRESETS } from "@forge/shared"

const SYSTEM_PROMPT = `You are an expert interview designer for Forge, a platform that captures expert knowledge and turns it into interactive tools for non-experts.

Your job is to design a tailored interview plan that will extract the most valuable, actionable knowledge from a domain expert. The interview should:

1. Cover the key areas of their expertise thoroughly
2. Prioritize knowledge that can be structured into tools (procedures, decision rules, checklists, calculations)
3. Include questions that surface both explicit knowledge (steps, facts) and tacit knowledge (warnings, tips, judgment calls)
4. Be natural and conversational, not interrogative
5. Start broad and go deeper in each section

Each question must have a clear validation goal - what specific knowledge should be extracted from the answer.`

export async function generateInterviewConfig(
  expertName: string,
  domain: string,
  expertBio: string,
  targetAudience: string | null
): Promise<InterviewConfig> {
  const prompt = `Design an interview plan for the following expert:

**Expert:** ${expertName}
**Domain:** ${domain}
**Background:** ${expertBio}
**Target Audience:** ${targetAudience || "General public"}

Create a structured interview with 4-6 sections, each containing 2-4 questions. The interview should extract everything needed to build an interactive guide/tool for the target audience.

Respond with JSON only:
{
  "sections": [
    {
      "title": "Section title",
      "goal": "What knowledge this section should extract",
      "questions": [
        {
          "text": "The question to ask",
          "goal": "What specific knowledge this question should extract"
        }
      ]
    }
  ],
  "estimatedDurationMinutes": 20,
  "domainContext": "A brief description of the domain and why this knowledge matters",
  "extractionPriorities": ["procedures", "decision_rules", "warnings"]
}`

  return generateJSON<InterviewConfig>(prompt, {
    system: SYSTEM_PROMPT,
    temperature: 0.5,
    maxTokens: 4096,
    effort: "high",
  })
}

// ============ Streaming interview planning (two-call approach) ============

export interface InterviewSkeleton {
  sections: Array<{ title: string; goal: string }>
  estimatedDurationMinutes: number
  domainContext: string
  extractionPriorities: string[]
}

export interface SectionQuestions {
  questions: Array<{ text: string; goal: string }>
}

export async function generateInterviewSkeleton(
  expertName: string,
  domain: string,
  expertBio: string,
  targetAudience: string | null,
  depth: InterviewDepth = "standard"
): Promise<InterviewSkeleton> {
  const preset = DEPTH_PRESETS[depth]
  const prompt = `Design an interview structure for the following expert:

**Expert:** ${expertName}
**Domain:** ${domain}
**Background:** ${expertBio}
**Target Audience:** ${targetAudience || "General public"}

CRITICAL CONSTRAINT: You MUST create exactly ${preset.sections.min}-${preset.sections.max} sections. No more than ${preset.sections.max}. This is a ${preset.label.toLowerCase()} interview (~${preset.estimatedMinutes} minutes) so keep it focused and concise. Combine related topics into fewer, broader sections rather than splitting them out.

Do NOT include questions yet - only section titles and goals.

Respond with JSON only:
{
  "sections": [
    {
      "title": "Section title",
      "goal": "What knowledge this section should extract"
    }
  ],
  "estimatedDurationMinutes": ${preset.estimatedMinutes},
  "domainContext": "A brief description of the domain and why this knowledge matters",
  "extractionPriorities": ["procedures", "decision_rules", "warnings"]
}`

  const skeleton = await generateJSON<InterviewSkeleton>(prompt, {
    system: SYSTEM_PROMPT,
    temperature: 0.5,
    maxTokens: 2048,
    effort: "high",
  })

  // Hard cap: truncate sections if LLM exceeded the max
  if (skeleton.sections.length > preset.sections.max) {
    skeleton.sections = skeleton.sections.slice(0, preset.sections.max)
  }

  return skeleton
}

export async function generateSectionQuestions(
  expertName: string,
  domain: string,
  expertBio: string,
  targetAudience: string | null,
  sectionTitle: string,
  sectionGoal: string,
  domainContext: string,
  depth: InterviewDepth = "standard"
): Promise<SectionQuestions> {
  const preset = DEPTH_PRESETS[depth]
  const prompt = `You are designing interview questions for one section of an expert interview.

**Expert:** ${expertName}
**Domain:** ${domain}
**Background:** ${expertBio}
**Target Audience:** ${targetAudience || "General public"}
**Domain Context:** ${domainContext}

**Section:** ${sectionTitle}
**Section Goal:** ${sectionGoal}

Generate ${preset.questionsPerSection.min}-${preset.questionsPerSection.max} short topic prompts for this section. Each should be a brief phrase (3-8 words) identifying a knowledge area to explore - NOT a full question. The conductor will turn these into natural conversational questions.

Examples of good topic prompts: "Key first-year challenges", "Essential equipment and setup", "Common beginner mistakes", "Budgeting and cost management"

Respond with JSON only:
{
  "questions": [
    {
      "text": "Short topic prompt",
      "goal": "What specific knowledge this topic should extract"
    }
  ]
}`

  const result = await generateJSON<SectionQuestions>(prompt, {
    system: SYSTEM_PROMPT,
    model: SONNET,
    cacheSystem: true,
    temperature: 0.5,
    maxTokens: 1024,
  })

  // Hard cap: truncate questions if LLM exceeded the max
  if (result.questions.length > preset.questionsPerSection.max) {
    result.questions = result.questions.slice(0, preset.questionsPerSection.max)
  }

  return result
}

export async function generateFollowUpSkeleton(
  expertName: string,
  domain: string,
  expertBio: string,
  targetAudience: string | null,
  topic: string,
  existingKnowledge: string,
  existingComponents: string[]
): Promise<InterviewSkeleton> {
  const componentList = existingComponents.map((t, i) => `${i + 1}. ${t}`).join("\n")

  const prompt = `Design a FOLLOW-UP interview structure for an expert who has already been interviewed.

**Expert:** ${expertName}
**Domain:** ${domain}
**Background:** ${expertBio}
**Target Audience:** ${targetAudience || "General public"}

**Follow-up Focus:** ${topic}

**Already Captured Knowledge (DO NOT repeat):**
${existingKnowledge}

**Existing Tool Components:**
${componentList}

Create 2-3 focused sections that dig deeper into "${topic}" WITHOUT repeating knowledge already captured above. Focus on gaps, nuances, and new angles.

Do NOT include questions yet - only section titles and goals.

Respond with JSON only:
{
  "sections": [
    {
      "title": "Section title",
      "goal": "What NEW knowledge this section should extract"
    }
  ],
  "estimatedDurationMinutes": 15,
  "domainContext": "Brief context for this follow-up focus area",
  "extractionPriorities": ["specific_priorities_for_this_topic"]
}`

  const skeleton = await generateJSON<InterviewSkeleton>(prompt, {
    system: SYSTEM_PROMPT,
    temperature: 0.5,
    maxTokens: 2048,
    effort: "high",
  })

  // Hard cap at 3 sections for follow-ups
  if (skeleton.sections.length > 3) {
    skeleton.sections = skeleton.sections.slice(0, 3)
  }

  return skeleton
}

export async function generateFirstMessage(
  expertName: string,
  domain: string,
  sectionTitles: string[]
): Promise<string> {
  const sectionList = sectionTitles.map((t, i) => `${i + 1}. ${t}`).join("\n")

  return generateText(
    [{
      role: "user",
      content: `Write an opening message for a voice interview with ${expertName} about "${domain}".

The interview has these sections:
${sectionList}

The message should:
1. Welcome them warmly (one sentence, their name, the topic)
2. Briefly explain what's going to happen - you'll be having a conversation to capture their expertise, covering a few key areas (mention 2-3 of the section themes naturally, don't list them all)
3. Reassure them it's conversational, not a test - there are no wrong answers, just share what they know
4. End by asking if they're ready to get started

Keep the whole thing to 4-5 sentences. Warm but not gushing. No exclamation marks. Sound like a real person.`,
    }],
    {
      model: SONNET,
      temperature: 0.6,
      maxTokens: 250,
    }
  )
}
