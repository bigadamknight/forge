import { generateJSON, SONNET } from "../lib/llm"
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

const SYSTEM_PROMPT = `You are a precise knowledge extraction engine. Your job is to extract discrete, actionable knowledge units from an expert's response during an interview.

Extract the following types of knowledge:
- **fact**: A concrete fact, data point, or definition
- **procedure**: A step-by-step process or workflow
- **decision_rule**: An if/then decision logic (conditions and actions)
- **warning**: A cautionary note, common mistake, or pitfall
- **tip**: A pro tip, best practice, or shortcut
- **metric**: A number, threshold, measurement, or benchmark
- **definition**: A term definition or concept explanation
- **example**: A concrete example, case study, or anecdote
- **context**: Background context or prerequisite knowledge

Guidelines:
- Each extraction should be standalone and self-contained
- Be selective - only extract genuinely useful knowledge
- Provide structured data where applicable (e.g. steps for procedures, conditions for decision rules)
- Confidence should reflect how clearly the expert stated the information
- Tag each extraction with relevant keywords`

export async function extractKnowledge(
  expertResponse: string,
  sectionTitle: string,
  questionText: string,
  existingExtractions: string[],
  effortOverride?: "low" | "medium" | "high" | "max"
): Promise<ExtractedItem[]> {
  const existingContext = existingExtractions.length > 0
    ? `\n\nAlready extracted (avoid duplicates):\n${existingExtractions.map((e) => `- ${e}`).join("\n")}`
    : ""

  const prompt = `Extract knowledge from this expert's response:

**Section:** ${sectionTitle}
**Question:** ${questionText}
**Expert's Response:** ${expertResponse}
${existingContext}

Respond with JSON only:
{
  "extractions": [
    {
      "type": "fact|procedure|decision_rule|warning|tip|metric|definition|example|context",
      "content": "The extracted knowledge (1-3 sentences, standalone)",
      "structured": null,
      "confidence": 0.8,
      "tags": ["tag1", "tag2"]
    }
  ]
}

If nothing worth extracting, return: {"extractions": []}`

  const result = await generateJSON<ExtractionResult>(prompt, {
    system: SYSTEM_PROMPT,
    temperature: 0.2,
    maxTokens: 2048,
    model: SONNET,
    effort: effortOverride || "medium",
  })

  return result.extractions || []
}
