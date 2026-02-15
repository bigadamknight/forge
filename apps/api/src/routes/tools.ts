import { Hono } from "hono"
import { streamSSE } from "hono/streaming"
import { db, forges, extractions, documents } from "@forge/db"
import { eq, asc, and } from "drizzle-orm"
import { generateToolConfig, generateToolPlan, generateComponent, buildKnowledgeSummary, buildDocumentSection, deriveComponentSpec, type ToolPlan } from "../services/tool-generator"
import { generateText, generateJSON } from "../lib/llm"
import { searchHybrid, hasEmbeddings } from "../lib/embeddings"

const app = new Hono()

// ============ Shared Helpers ============

async function getForge(forgeId: string) {
  const [forge] = await db.select().from(forges).where(eq(forges.id, forgeId)).limit(1)
  return forge ?? null
}

async function loadForgeExtractions(forgeId: string) {
  const items = await db.select().from(extractions)
    .where(eq(extractions.forgeId, forgeId))
    .orderBy(asc(extractions.createdAt))
  return items.map((e) => ({
    type: e.type, content: e.content, confidence: e.confidence, tags: e.tags,
  }))
}

async function loadForgeDocuments(forgeId: string) {
  const items = await db.select().from(documents)
    .where(eq(documents.forgeId, forgeId))
    .orderBy(asc(documents.createdAt))
  return items.map((d) => ({
    title: d.title, type: d.type, content: d.extractedContent || d.content,
  }))
}

async function loadExpertKnowledge(forgeId: string, query: string, limit = 15): Promise<string> {
  const useEmbed = await hasEmbeddings(forgeId)
  if (useEmbed) {
    const results = await searchHybrid(forgeId, query, limit)
    return results.map((r) => `[${r.type}] ${r.content}`).join("\n")
  }
  const all = await db.select().from(extractions)
    .where(eq(extractions.forgeId, forgeId))
    .orderBy(asc(extractions.createdAt))
  return all.slice(0, limit + 25).map((e) => `[${e.type}] ${e.content}`).join("\n")
}

// ============ Generate Tool from Knowledge ============

app.post("/:forgeId/generate-tool", async (c) => {
  const { forgeId } = c.req.param()

  const forge = await getForge(forgeId)
  if (!forge) return c.json({ error: "Forge not found" }, 404)

  await db.update(forges).set({ status: "generating", updatedAt: new Date() }).where(eq(forges.id, forgeId))

  const extractionItems = await loadForgeExtractions(forgeId)
  if (extractionItems.length === 0) {
    return c.json({ error: "No knowledge extracted yet. Complete the interview first." }, 400)
  }

  const docItems = await loadForgeDocuments(forgeId)
  console.log(`[generate-tool] Starting for ${forgeId} (${extractionItems.length} extractions, ${docItems.length} documents)`)

  let toolConfig
  try {
    toolConfig = await generateToolConfig(forge.expertName, forge.domain, forge.targetAudience, extractionItems, docItems)
    console.log("[generate-tool] Opus returned, saving config")
  } catch (err: any) {
    console.error("[generate-tool] Failed:", err.message)
    await db.update(forges).set({ status: "interviewing", updatedAt: new Date() }).where(eq(forges.id, forgeId))
    return c.json({ error: `Tool generation failed: ${err.message}` }, 500)
  }

  await db.update(forges).set({
    toolConfig: toolConfig as any,
    status: "complete",
    completedAt: new Date(),
    updatedAt: new Date(),
  }).where(eq(forges.id, forgeId))

  const updated = await getForge(forgeId)
  return c.json(updated)
})

// ============ Plan Tool (returns plan for user review) ============

app.post("/:forgeId/plan-tool", async (c) => {
  const { forgeId } = c.req.param()

  const forge = await getForge(forgeId)
  if (!forge) return c.json({ error: "Forge not found" }, 404)

  const extractionItems = await loadForgeExtractions(forgeId)
  if (extractionItems.length === 0) {
    return c.json({ error: "No knowledge extracted yet. Complete the interview first." }, 400)
  }

  const docItems = await loadForgeDocuments(forgeId)

  console.log(`[plan-tool] Planning for ${forgeId} with ${extractionItems.length} extractions`)

  const plan = await generateToolPlan(
    forge.expertName,
    forge.domain,
    forge.targetAudience,
    extractionItems,
    docItems
  )

  console.log(`[plan-tool] Plan ready: ${plan.components.length} components`)
  return c.json(plan)
})

// ============ Generate Tool (Streaming with Progress) ============

app.post("/:forgeId/generate-tool-stream", async (c) => {
  const { forgeId } = c.req.param()

  const forge = await getForge(forgeId)
  if (!forge) return c.json({ error: "Forge not found" }, 404)

  const extractionItems = await loadForgeExtractions(forgeId)
  if (extractionItems.length === 0) {
    return c.json({ error: "No knowledge extracted yet. Complete the interview first." }, 400)
  }

  const docItems = await loadForgeDocuments(forgeId)

  const previousStatus = forge.status
  await db.update(forges).set({
    status: "generating",
    updatedAt: new Date(),
  }).where(eq(forges.id, forgeId))

  // Accept an optional confirmed plan from the request body
  let confirmedPlan: ToolPlan | null = null
  try {
    const body = await c.req.json()
    if (body?.plan) confirmedPlan = body.plan
  } catch {
    // No body or invalid JSON - will plan from scratch
  }

  return streamSSE(c, async (stream) => {
    try {
      // Step 1: Plan (skip if confirmed plan provided)
      let plan: ToolPlan
      if (confirmedPlan) {
        plan = confirmedPlan
        console.log(`[generate-tool-stream] Using confirmed plan for ${forgeId} (${plan.components.length} components)`)
      } else {
        console.log(`[generate-tool-stream] Planning for ${forgeId}`)
        plan = await generateToolPlan(
          forge.expertName,
          forge.domain,
          forge.targetAudience,
          extractionItems,
          docItems
        )
      }

      // Derive full specs from the slim plan
      const componentSpecs = plan.components.map((entry, i) => deriveComponentSpec(entry, i))

      await stream.writeSSE({
        data: JSON.stringify({
          type: "plan",
          title: plan.title,
          componentCount: componentSpecs.length,
          components: componentSpecs.map((c) => ({ type: c.type, title: c.title })),
        }),
      })

      const knowledgeSummary = buildKnowledgeSummary(extractionItems)
      const documentSection = buildDocumentSection(docItems)
      const layout: Array<Record<string, unknown>> = new Array(componentSpecs.length)

      console.log(`[generate-tool-stream] Generating ${componentSpecs.length} components in parallel`)

      await Promise.all(
        componentSpecs.map(async (spec, i) => {
          layout[i] = await generateComponent(spec, knowledgeSummary, documentSection, forge.expertName, forge.domain)
          console.log(`[generate-tool-stream] Finished ${i + 1}/${componentSpecs.length}: ${spec.title}`)

          await stream.writeSSE({
            data: JSON.stringify({
              type: "component",
              index: i + 1,
              total: componentSpecs.length,
              title: spec.title,
              componentType: spec.type,
            }),
          })
        })
      )

      // Step 3: Deduplicate IDs and assemble
      const seenIds = new Set<string>()
      for (const component of layout) {
        const id = component.id as string
        if (id && seenIds.has(id)) {
          component.id = `${id}_${seenIds.size}`
        }
        if (id) seenIds.add(component.id as string)
      }

      const toolConfig = {
        title: plan.title,
        description: "",
        theme: plan.theme,
        layout,
      }

      await db.update(forges).set({
        toolConfig: toolConfig as any,
        status: "complete",
        completedAt: new Date(),
        updatedAt: new Date(),
      }).where(eq(forges.id, forgeId))

      console.log(`[generate-tool-stream] Complete for ${forgeId}`)
      await stream.writeSSE({
        data: JSON.stringify({ type: "complete" }),
      })
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error"
      console.error("[generate-tool-stream] Error:", message)

      await db.update(forges).set({
        status: previousStatus === "generating" ? "interviewing" : previousStatus,
        updatedAt: new Date(),
      }).where(eq(forges.id, forgeId))

      await stream.writeSSE({
        data: JSON.stringify({ type: "error", message }),
      })
    }
  })
})

// ============ Get Tool Config ============

app.get("/:forgeId/tool", async (c) => {
  const { forgeId } = c.req.param()

  const forge = await getForge(forgeId)
  if (!forge) return c.json({ error: "Forge not found" }, 404)
  if (!forge.toolConfig) return c.json({ error: "Tool not generated yet" }, 400)

  return c.json({
    forge: {
      id: forge.id,
      title: forge.title,
      expertName: forge.expertName,
      domain: forge.domain,
      targetAudience: forge.targetAudience,
    },
    toolConfig: forge.toolConfig,
  })
})

// ============ Ask the Expert (Cascading Context) ============

app.post("/:forgeId/tool/ask", async (c) => {
  const { forgeId } = c.req.param()
  const { question, userContext, componentContext } = await c.req.json()

  if (!question) return c.json({ error: "question is required" }, 400)

  const forge = await getForge(forgeId)
  if (!forge) return c.json({ error: "Forge not found" }, 404)

  const expertKnowledge = await loadExpertKnowledge(forgeId, question, 15)

  const allDocuments = await db.select().from(documents)
    .where(eq(documents.forgeId, forgeId))
    .orderBy(asc(documents.createdAt))
  const documentContext = allDocuments.length > 0
    ? `\n\nSUPPORTING DOCUMENTS:\n${allDocuments.map((d) => `[${d.title}] ${(d.extractedContent || d.content).slice(0, 5000)}`).join("\n\n")}`
    : ""

  const metadata = (forge.metadata as any) || {}
  const voiceTranscript = Array.isArray(metadata.voiceTranscript)
    ? metadata.voiceTranscript.filter((m: any) => m.role === "user").slice(-20).map((m: any) => m.content).join("\n")
    : ""
  const transcriptContext = voiceTranscript
    ? `\n\nVOICE INTERVIEW TRANSCRIPT (expert's own words):\n${voiceTranscript}`
    : ""

  // Build cascading context (5 layers)
  const system = `You are an AI assistant that channels the expertise of ${forge.expertName} in ${forge.domain}.

LAYER 1 - DOMAIN CONTEXT:
${forge.domain}. ${forge.targetAudience ? `This tool is designed for: ${forge.targetAudience}` : ""}

LAYER 2 - EXPERT KNOWLEDGE:
The following knowledge was extracted directly from ${forge.expertName}:
${expertKnowledge}${transcriptContext}${documentContext}

LAYER 3 - TOOL CONTEXT:
${componentContext ? `The user is currently looking at: ${componentContext}` : "They are using an interactive guide built from this expert's knowledge."}

LAYER 4 - USER SITUATION:
${userContext ? `About the user: ${JSON.stringify(userContext)}` : "No specific context provided."}

LAYER 5 - CURRENT QUESTION:
The user is asking: ${question}

Instructions:
- Answer as if you are ${forge.expertName} sharing their expertise
- Be specific, practical, and actionable
- Reference the expert's actual knowledge and numbers when relevant
- If the expert's knowledge doesn't cover this question, say so honestly
- Keep answers focused and concise`

  const response = await generateText(
    [{ role: "user", content: question }],
    { system, temperature: 0.4, maxTokens: 1024, effort: "medium" }
  )

  return c.json({ answer: response })
})

// ============ Tool Voice Session (Shared Agent) ============

const ELEVENLABS_AGENT_ID = process.env.ELEVENLABS_AGENT_ID

function buildComponentSummary(layout: Array<Record<string, any>>): string {
  return layout.map((c) => {
    const base = `- ${c.id} (${c.type}): "${c.title}"`
    switch (c.type) {
      case 'checklist':
        return `${base}\n  Items: ${(c.items || []).map((i: any) => `${i.id}="${i.text}"`).join(', ')}\n  Checked: [${(c.checkedIds || []).join(', ')}]`
      case 'question_flow':
        return `${base}\n  Questions: ${(c.questions || []).map((q: any) => `${q.id}="${q.text}" (${q.inputType}${q.options ? ': ' + q.options.join('/') : ''})`).join('; ')}`
      case 'decision_tree':
        return `${base}\n  Nodes: ${(c.nodes || []).map((n: any) => `${n.id}="${n.question}" [${(n.options || []).map((o: any, i: number) => `${i}:"${o.label}"`).join(', ')}]`).join('; ')}`
      case 'step_by_step':
        return `${base}\n  Steps: ${(c.steps || []).map((s: any) => `${s.id}="${s.title}"`).join(', ')}\n  Completed: [${(c.completedSteps || []).join(', ')}]`
      case 'calculator':
        return `${base}\n  Inputs: ${(c.inputs || []).map((i: any) => `${i.id}="${i.label}" (${i.type})`).join(', ')}`
      default:
        return base
    }
  }).join('\n')
}

app.post("/:forgeId/tool/voice-session", async (c) => {
  const { forgeId } = c.req.param()

  if (!ELEVENLABS_AGENT_ID) {
    return c.json({ error: "ELEVENLABS_AGENT_ID not configured" }, 500)
  }

  let mode = "widget"
  try {
    const body = await c.req.json()
    if (body?.mode) mode = body.mode
  } catch {}

  const forge = await getForge(forgeId)
  if (!forge) return c.json({ error: "Forge not found" }, 404)

  const expertKnowledge = await loadExpertKnowledge(forgeId, forge.domain, 50)

  const allDocuments = await db.select().from(documents)
    .where(eq(documents.forgeId, forgeId))
  const docContext = allDocuments.length > 0
    ? `\n\nSUPPORTING DOCUMENTS:\n${allDocuments.map((d) => `[${d.title}] ${(d.extractedContent || d.content).slice(0, 3000)}`).join("\n\n")}`
    : ""

  const toolConfig = forge.toolConfig as any
  const layout = toolConfig?.layout || []

  let prompt: string
  let firstMessage: string

  if (mode === "chat") {
    // Chat mode: knowledge-first, can suggest sections but doesn't manipulate them
    const sectionList = layout.map((c: any) => `- "${c.title}" (${c.type})`).join("\n")

    prompt = `You are ${forge.expertName}, an expert in ${forge.domain}. You are having a conversation with someone who wants to learn from your expertise.${forge.targetAudience ? ` Your audience is: ${forge.targetAudience}.` : ''}

EXPERT KNOWLEDGE (your primary resource):
${expertKnowledge}${docContext}

The user has an interactive guide with these sections:
${sectionList}

You can suggest the user check out a specific section when relevant by calling navigate_to_section with the section's component_id. But your main role is sharing expertise - answer questions, give advice, and have a natural conversation about ${forge.domain}.

CONVERSATION STYLE:
- Be warm, conversational, and concise
- Lead with expertise - share knowledge freely and proactively
- When a topic relates to a specific section, mention it naturally (e.g. "there's a section on that you might find helpful")
- Reference specific facts, numbers, and insights from the expert knowledge above
- If something is beyond your knowledge, say so honestly`

    firstMessage = `Hi! I'm here as your ${forge.domain} expert, drawing on ${forge.expertName}'s knowledge. What would you like to know?`
  } else {
    // Widget mode: interactive, can manipulate components directly
    const componentSummary = buildComponentSummary(layout)

    prompt = `You are ${forge.expertName}, an expert in ${forge.domain}. You are having a conversation with someone who wants to learn from your expertise.${forge.targetAudience ? ` Your audience is: ${forge.targetAudience}.` : ''}

EXPERT KNOWLEDGE (your primary resource):
${expertKnowledge}${docContext}

The user has an interactive tool with these sections available. You can help them interact with it using the tools below, but your main role is sharing your expertise and answering questions.

AVAILABLE COMPONENTS (use exact IDs when calling tools):
${componentSummary}

TOOL USAGE RULES:
- When the user mentions completing, checking off, or having done checklist items, call toggle_checklist_items. Match their description to the item IDs listed above.
- When the user answers a question in a question flow, call answer_question. For select questions, match their words to the closest option.
- When the user chooses a path in a decision tree, call select_decision_option with the matching option_index.
- When the user says they've completed a step, call complete_step.
- When the user provides a number for a calculator, call set_calculator_value.
- When a section feels complete or the user wants to move on, call navigate_to_section.
- For general questions about ${forge.domain}, just answer conversationally using expert knowledge.
- Always use the exact component IDs and item/question/step IDs from the listing above.
- After calling a tool, briefly confirm what you updated.

CONVERSATION STYLE:
- Be warm, conversational, and concise
- Lead with expertise - share knowledge freely and proactively
- Reference specific facts, numbers, and insights from the expert knowledge above
- If something is beyond your knowledge, say so honestly`

    firstMessage = `Hi! I'm here as your ${forge.domain} expert, drawing on ${forge.expertName}'s knowledge. What would you like to know?`
  }

  return c.json({
    agentId: ELEVENLABS_AGENT_ID,
    prompt,
    firstMessage,
  })
})

// ============ Refine Tool via Conversation (Opus Conductor) ============

app.post("/:forgeId/tool/refine", async (c) => {
  const { forgeId } = c.req.param()
  const { message, activeComponentId, layout, userContext } = await c.req.json()

  if (!message) return c.json({ error: "message is required" }, 400)

  const forge = await getForge(forgeId)
  if (!forge) return c.json({ error: "Forge not found" }, 404)

  const expertKnowledge = await loadExpertKnowledge(forgeId, message, 20)

  // Find the active component config
  const activeComponent = layout?.find((c: any) => c.id === activeComponentId)

  // Build component summary for navigation decisions
  const componentSummary = (layout || [])
    .map((c: any) => `- ${c.id} (${c.type}): ${c.title}`)
    .join("\n")

  const system = `You are channeling ${forge.expertName}'s expertise in ${forge.domain}. Your primary role is sharing knowledge and answering questions as ${forge.expertName} would.${forge.targetAudience ? ` Your audience is: ${forge.targetAudience}.` : ''}

You also manage an interactive tool built from this expertise. When appropriate, you can:
1. Update tool components based on what the user says
2. Navigate the UI to a relevant component

EXPERT KNOWLEDGE:
${expertKnowledge}

ALL COMPONENTS:
${componentSummary}

${activeComponent ? `ACTIVE COMPONENT (${activeComponentId}):
${JSON.stringify(activeComponent, null, 2)}` : "No active component (user is on Overview)"}

${userContext ? `USER CONTEXT: ${JSON.stringify(userContext)}` : ""}

RULES:
- If the user asks a question, answer it using the expert's knowledge
- If the user suggests adding, removing, or changing something in a component, return the full updated component config in "updatedConfig"
- If the change applies to a different component than the active one, set "navigateToComponentId" to that component's id
- Only update one component at a time
- When updating, return the COMPLETE component config (not a partial patch)
- Keep the same id, type, and structure - only modify the content
- If no update is needed, omit "action" entirely
- Be concise in your response

COMPONENT-SPECIFIC RULES:
- For "checklist" components: to mark items as checked/completed, add their item IDs to the "checkedIds" array on the config. NEVER modify item text to indicate completion - the UI renders its own checkboxes based on checkedIds. Example: { "checkedIds": ["item-1", "item-3"] }
- For "step_by_step" components: to mark steps complete, set the "completedSteps" array with step IDs
- NEVER add emoji checkmarks, "COMPLETED" text, or other visual markers to item text - the UI handles all visual state`

  try {
    const result = await generateJSON<{
      response: string
      action?: {
        navigateToComponentId?: string
        updatedConfig?: Record<string, unknown>
        changeDescription: string
      }
    }>(
      `User message: "${message}"

Respond as JSON:
{
  "response": "your reply to the user",
  "action": {
    "navigateToComponentId": "component_id (only if navigating to a different component)",
    "updatedConfig": { full updated component config object },
    "changeDescription": "brief description of what changed"
  }
}

If no component update is needed, omit the "action" field entirely. Return ONLY the JSON.`,
      {
        system,
        temperature: 0.3,
        maxTokens: 8192,
        effort: "high",
      }
    )

    // If there's an update, also persist it to the database
    if (result.action?.updatedConfig && forge.toolConfig) {
      const currentConfig = forge.toolConfig as any
      const targetId = result.action.navigateToComponentId || activeComponentId
      const updatedLayout = currentConfig.layout.map((c: any) =>
        c.id === targetId ? result.action!.updatedConfig : c
      )
      await db.update(forges).set({
        toolConfig: { ...currentConfig, layout: updatedLayout },
        updatedAt: new Date(),
      }).where(eq(forges.id, forgeId))
    }

    return c.json(result)
  } catch (err: any) {
    console.error("[tool/refine] Error:", err.message)
    return c.json({ error: `Refine failed: ${err.message}` }, 500)
  }
})

// ============ Update Tool Config (Inline Editing) ============

app.patch("/:forgeId/tool-config", async (c) => {
  const { forgeId } = c.req.param()
  const { layout } = await c.req.json()

  if (!layout || !Array.isArray(layout)) {
    return c.json({ error: "layout array is required" }, 400)
  }

  const forge = await getForge(forgeId)
  if (!forge) return c.json({ error: "Forge not found" }, 404)
  if (!forge.toolConfig) return c.json({ error: "No tool config to update" }, 400)

  const updatedConfig = { ...(forge.toolConfig as any), layout }

  await db.update(forges).set({
    toolConfig: updatedConfig,
    updatedAt: new Date(),
  }).where(eq(forges.id, forgeId))

  return c.json({ ok: true })
})

// ============ Integrate New Knowledge into Existing Tool ============

app.post("/:forgeId/integrate-knowledge", async (c) => {
  const { forgeId } = c.req.param()
  const { round } = await c.req.json()

  if (!round) return c.json({ error: "round is required" }, 400)

  const forge = await getForge(forgeId)
  if (!forge) return c.json({ error: "Forge not found" }, 404)
  if (!forge.toolConfig) return c.json({ error: "No tool config to update" }, 400)

  // Load new extractions from this round
  const newExtractions = await db.select().from(extractions)
    .where(and(eq(extractions.forgeId, forgeId), eq(extractions.round, round)))
    .orderBy(asc(extractions.createdAt))

  if (newExtractions.length === 0) {
    return c.json({ error: "No extractions found for this round" }, 400)
  }

  const newKnowledge = newExtractions.map(e => `[${e.type}] ${e.content}`).join("\n")
  const toolConfig = forge.toolConfig as any
  const existingComponents = (toolConfig.layout || []).map((c: any) => ({
    id: c.id,
    type: c.type,
    title: c.title,
    summary: JSON.stringify(c).slice(0, 500),
  }))

  const componentList = existingComponents.map((c: any) =>
    `- ${c.id} (${c.type}): "${c.title}"`
  ).join("\n")

  const result = await generateJSON<{
    proposals: Array<{
      type: "update" | "new"
      componentId?: string
      componentType?: string
      title: string
      description: string
      preview: Record<string, unknown>
    }>
  }>(
    `Analyze new follow-up interview knowledge and propose updates to an existing interactive tool.

EXPERT: ${forge.expertName}
DOMAIN: ${forge.domain}

NEW KNOWLEDGE (from follow-up interview round ${round}):
${newKnowledge}

EXISTING TOOL COMPONENTS:
${componentList}

EXISTING COMPONENT CONFIGS:
${JSON.stringify(toolConfig.layout, null, 2)}

Propose updates that integrate the new knowledge. For each proposal:
- type "update": modify an existing component with enriched data (provide full replacement config in "preview")
- type "new": add a brand new component (provide full config in "preview")

Prefer updating existing components over creating new ones. Only propose a new component if the knowledge doesn't fit existing ones.

For "update" proposals, the "preview" must be the COMPLETE component config (same structure as the existing one, with new knowledge integrated). Keep the same id and type.

For "new" proposals, use an appropriate component type and generate a complete config following standard schemas.

Return JSON: { "proposals": [{ "type": "update"|"new", "componentId": "existing_id (for updates)", "componentType": "type (for new)", "title": "what this change does", "description": "why this improves the tool", "preview": { full component config } }] }`,
    {
      temperature: 0.2,
      maxTokens: 8192,
      effort: "high",
    }
  )

  return c.json(result)
})

// ============ Apply Knowledge Integration Updates ============

app.post("/:forgeId/apply-updates", async (c) => {
  const { forgeId } = c.req.param()
  const { proposals } = await c.req.json()

  if (!proposals || !Array.isArray(proposals)) {
    return c.json({ error: "proposals array is required" }, 400)
  }

  const forge = await getForge(forgeId)
  if (!forge) return c.json({ error: "Forge not found" }, 404)
  if (!forge.toolConfig) return c.json({ error: "No tool config to update" }, 400)

  const currentConfig = forge.toolConfig as any
  let layout = [...currentConfig.layout]

  for (const proposal of proposals) {
    if (proposal.type === "update" && proposal.componentId) {
      // Replace matching component
      layout = layout.map((c: any) =>
        c.id === proposal.componentId ? proposal.preview : c
      )
    } else if (proposal.type === "new" && proposal.preview) {
      // Append new component
      layout.push(proposal.preview)
    }
  }

  await db.update(forges).set({
    toolConfig: { ...currentConfig, layout },
    updatedAt: new Date(),
  }).where(eq(forges.id, forgeId))

  return c.json({ ok: true })
})

export default app
