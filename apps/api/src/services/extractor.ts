import { generateJSON, SONNET } from "../lib/llm"
import { buildExtractionPromptList, buildExtractionTypeEnum, type CustomExtractionType } from "@forge/shared"
import type { ExtractionType } from "@forge/shared"

interface ExtractedItem {
  type: ExtractionType
  content: string
  structured?: Record<string, unknown>
  confidence: number
  tags: string[]
}

interface ExtractionResult {
  extractions: ExtractedItem[]
}

function buildSystemPrompt(customTypes?: CustomExtractionType[]): string {
  const typeList = buildExtractionPromptList(customTypes)
  return `You are a precise knowledge extraction engine. Your job is to extract discrete, actionable knowledge units from an expert's response during an interview.

Extract the following types of knowledge:
${typeList}

Guidelines:
- Each extraction should be standalone and self-contained
- Be selective - only extract genuinely useful knowledge
- Provide structured data where applicable (e.g. steps for procedures, conditions for decision rules)
- Confidence should reflect how clearly the expert stated the information
- Tag each extraction with relevant keywords`
}

export async function extractKnowledge(
  expertResponse: string,
  sectionTitle: string,
  questionText: string,
  existingExtractions: string[],
  effortOverride?: "low" | "medium" | "high" | "max",
  customTypes?: CustomExtractionType[]
): Promise<ExtractedItem[]> {
  const existingContext = existingExtractions.length > 0
    ? `\n\nAlready extracted (avoid duplicates):\n${existingExtractions.map((e) => `- ${e}`).join("\n")}`
    : ""

  const typeEnum = buildExtractionTypeEnum(customTypes)

  const prompt = `Extract knowledge from this expert's response:

**Section:** ${sectionTitle}
**Question:** ${questionText}
**Expert's Response:** ${expertResponse}
${existingContext}

Respond with JSON only:
{
  "extractions": [
    {
      "type": "${typeEnum}",
      "content": "The extracted knowledge (1-3 sentences, standalone)",
      "structured": null,
      "confidence": 0.8,
      "tags": ["tag1", "tag2"]
    }
  ]
}

If nothing worth extracting, return: {"extractions": []}`

  const result = await generateJSON<ExtractionResult>(prompt, {
    system: buildSystemPrompt(customTypes),
    temperature: 0.2,
    maxTokens: 2048,
    model: SONNET,
    effort: effortOverride || "medium",
  })

  return result.extractions || []
}
