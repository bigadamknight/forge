import { Hono } from "hono"
import { streamSSE } from "hono/streaming"
import { db, workspaces, forges, extractions, documents, toolAdvice } from "@forge/db"
import { eq, asc, and, inArray } from "drizzle-orm"
import { generateToolConfig, generateToolPlan, generateComponent, buildKnowledgeSummary, buildDocumentSection, deriveComponentSpec, type ToolPlan } from "../services/tool-generator"
import { generateText, generateJSON, HAIKU } from "../lib/llm"
import { searchUnitsHybrid, hasUnitEmbeddings } from "../lib/embeddings"
import { validateComponentConfig } from "../lib/component-validation"
import { buildExpertContext, getWorkspaceExpertInfo, loadExpertKnowledge } from "../services/expert-context"
import { buildComponentPromptSummary, buildToolUsageRules } from "@forge/shared"

const app = new Hono()

// ============ Shared Helpers ============

async function getWorkspace(workspaceId: string) {
  const [workspace] = await db.select().from(workspaces).where(eq(workspaces.id, workspaceId)).limit(1)
  return workspace ?? null
}

async function getWorkspaceForgeIds(workspaceId: string): Promise<string[]> {
  const rows = await db.select({ id: forges.id })
    .from(forges).where(eq(forges.workspaceId, workspaceId))
  return rows.map(r => r.id)
}

async function loadWorkspaceExtractions(workspaceId: string) {
  const forgeIds = await getWorkspaceForgeIds(workspaceId)
  if (forgeIds.length === 0) return []
  const items = await db.select().from(extractions)
    .where(inArray(extractions.forgeId, forgeIds))
    .orderBy(asc(extractions.createdAt))
  return items.map((e) => ({
    type: e.type, content: e.content, confidence: e.confidence, tags: e.tags,
  }))
}

async function loadWorkspaceDocuments(workspaceId: string) {
  const items = await db.select().from(documents)
    .where(eq(documents.workspaceId, workspaceId))
    .orderBy(asc(documents.createdAt))
  return items.map((d) => ({
    title: d.title, type: d.type, content: d.extractedContent || d.content,
  }))
}

// ============ Generate Tool from Knowledge ============

app.post("/:workspaceId/generate-tool", async (c) => {
  const { workspaceId } = c.req.param()

  const workspace = await getWorkspace(workspaceId)
  if (!workspace) return c.json({ error: "Workspace not found" }, 404)

  const expert = await getWorkspaceExpertInfo(workspaceId)

  const extractionItems = await loadWorkspaceExtractions(workspaceId)
  if (extractionItems.length === 0) {
    return c.json({ error: "No knowledge extracted yet. Complete the interview first." }, 400)
  }

  const docItems = await loadWorkspaceDocuments(workspaceId)
  console.log(`[generate-tool] Starting for workspace ${workspaceId} (${extractionItems.length} extractions, ${docItems.length} documents)`)

  let toolConfig
  try {
    toolConfig = await generateToolConfig(expert.expertName, expert.domain, expert.targetAudience, extractionItems, docItems)
    console.log("[generate-tool] Opus returned, saving config")
  } catch (err: any) {
    console.error("[generate-tool] Failed:", err.message)
    return c.json({ error: `Tool generation failed: ${err.message}` }, 500)
  }

  await db.update(workspaces).set({
    toolConfig: toolConfig as any,
    updatedAt: new Date(),
  }).where(eq(workspaces.id, workspaceId))

  // Mark all interviews as complete
  await db.update(forges).set({
    status: "complete",
    completedAt: new Date(),
    updatedAt: new Date(),
  }).where(eq(forges.workspaceId, workspaceId))

  const updated = await getWorkspace(workspaceId)
  return c.json(updated)
})

// ============ Plan Tool (returns plan for user review) ============

app.post("/:workspaceId/plan-tool", async (c) => {
  const { workspaceId } = c.req.param()

  const workspace = await getWorkspace(workspaceId)
  if (!workspace) return c.json({ error: "Workspace not found" }, 404)

  const expert = await getWorkspaceExpertInfo(workspaceId)
  const extractionItems = await loadWorkspaceExtractions(workspaceId)
  if (extractionItems.length === 0) {
    return c.json({ error: "No knowledge extracted yet. Complete the interview first." }, 400)
  }

  const docItems = await loadWorkspaceDocuments(workspaceId)

  console.log(`[plan-tool] Planning for workspace ${workspaceId} with ${extractionItems.length} extractions`)

  const plan = await generateToolPlan(
    expert.expertName,
    expert.domain,
    expert.targetAudience,
    extractionItems,
    docItems
  )

  console.log(`[plan-tool] Plan ready: ${plan.components.length} components`)
  return c.json(plan)
})

// ============ Generate Tool (Streaming with Progress) ============

app.post("/:workspaceId/generate-tool-stream", async (c) => {
  const { workspaceId } = c.req.param()

  const workspace = await getWorkspace(workspaceId)
  if (!workspace) return c.json({ error: "Workspace not found" }, 404)

  const expert = await getWorkspaceExpertInfo(workspaceId)
  const extractionItems = await loadWorkspaceExtractions(workspaceId)
  if (extractionItems.length === 0) {
    return c.json({ error: "No knowledge extracted yet. Complete the interview first." }, 400)
  }

  const docItems = await loadWorkspaceDocuments(workspaceId)

  // Mark interviews as generating
  await db.update(forges).set({
    status: "generating",
    updatedAt: new Date(),
  }).where(eq(forges.workspaceId, workspaceId))

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
        console.log(`[generate-tool-stream] Using confirmed plan for workspace ${workspaceId} (${plan.components.length} components)`)
      } else {
        console.log(`[generate-tool-stream] Planning for workspace ${workspaceId}`)
        plan = await generateToolPlan(
          expert.expertName,
          expert.domain,
          expert.targetAudience,
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
          layout[i] = await generateComponent(spec, knowledgeSummary, documentSection, expert.expertName, expert.domain)
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

      await db.update(workspaces).set({
        toolConfig: toolConfig as any,
        updatedAt: new Date(),
      }).where(eq(workspaces.id, workspaceId))

      // Mark interviews as complete
      await db.update(forges).set({
        status: "complete",
        completedAt: new Date(),
        updatedAt: new Date(),
      }).where(eq(forges.workspaceId, workspaceId))

      console.log(`[generate-tool-stream] Complete for workspace ${workspaceId}`)
      await stream.writeSSE({
        data: JSON.stringify({ type: "complete" }),
      })
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error"
      console.error("[generate-tool-stream] Error:", message)

      // Revert interview status
      await db.update(forges).set({
        status: "interviewing",
        updatedAt: new Date(),
      }).where(eq(forges.workspaceId, workspaceId))

      await stream.writeSSE({
        data: JSON.stringify({ type: "error", message }),
      })
    }
  })
})

// ============ Get Tool Config ============

app.get("/:workspaceId/tool", async (c) => {
  const { workspaceId } = c.req.param()

  const workspace = await getWorkspace(workspaceId)
  if (!workspace) return c.json({ error: "Workspace not found" }, 404)
  if (!workspace.toolConfig) return c.json({ error: "Tool not generated yet" }, 400)

  const expert = await getWorkspaceExpertInfo(workspaceId)

  return c.json({
    workspace: {
      id: workspace.id,
      title: workspace.title,
      expertName: expert.expertName,
      domain: expert.domain,
      targetAudience: expert.targetAudience,
    },
    toolConfig: workspace.toolConfig,
  })
})

// ============ Ask the Expert (Cascading Context) ============

app.post("/:workspaceId/tool/ask", async (c) => {
  const { workspaceId } = c.req.param()
  const { question, userContext, componentContext } = await c.req.json()

  if (!question) return c.json({ error: "question is required" }, 400)

  const workspace = await getWorkspace(workspaceId)
  if (!workspace) return c.json({ error: "Workspace not found" }, 404)

  const { expert, preamble } = await buildExpertContext(workspaceId, {
    query: question,
    componentContext,
    userContext,
  })

  const system = `${preamble}

LAYER 5 - CURRENT QUESTION:
The user is asking: ${question}

Instructions:
- Answer as if you are ${expert.expertName} sharing their expertise
- Be specific, practical, and actionable
- Reference the expert's actual knowledge and numbers when relevant
- If the expert's knowledge doesn't cover this question, say so honestly
- Use markdown formatting for readability (headers, bullet points, bold for emphasis)
- Give thorough, detailed answers — the user wants real depth, not a summary`

  const response = await generateText(
    [{ role: "user", content: question }],
    { system, temperature: 0.4, maxTokens: 4096, effort: "medium" }
  )

  return c.json({ answer: response })
})

// ============ Structured Advice (SSE Stream) ============

app.post("/:workspaceId/tool/advice", async (c) => {
  const { workspaceId } = c.req.param()
  const { question, userContext, componentContext } = await c.req.json()

  if (!question) return c.json({ error: "question is required" }, 400)

  const workspace = await getWorkspace(workspaceId)
  if (!workspace) return c.json({ error: "Workspace not found" }, 404)

  const { expert, preamble: contextPreamble } = await buildExpertContext(workspaceId, {
    query: question,
    componentContext,
    userContext,
  })

  return streamSSE(c, async (stream) => {
    try {
      console.log(`[tool/advice] Step 1: outline for workspace ${workspaceId}`)
      const outline = await generateJSON<{
        sections: Array<{ title: string; description: string }>
      }>(
        `${contextPreamble}

QUESTION: ${question}

You are planning a structured, personalized advice response for this user. Based on their question and situation, create an outline of 3-5 advice sections.

Each section should cover a distinct aspect of the advice. Return JSON:
{ "sections": [{ "title": "Section title", "description": "Brief description of what this section covers" }] }`,
        {
          model: HAIKU,
          temperature: 0.2,
          maxTokens: 1024,
        }
      )

      await stream.writeSSE({
        data: JSON.stringify({ type: "outline", sections: outline.sections }),
      })

      console.log(`[tool/advice] Step 2: generating ${outline.sections.length} sections in parallel`)
      const sectionContents: string[] = new Array(outline.sections.length).fill("")
      await Promise.all(
        outline.sections.map(async (section, index) => {
          const content = await generateText(
            [{ role: "user", content: `${contextPreamble}

QUESTION: ${question}

You are writing one section of personalized advice. Write ONLY the content for this section:

SECTION: ${section.title}
DESCRIPTION: ${section.description}

Instructions:
- Answer as if you are ${expert.expertName} sharing their expertise
- Be specific, practical, and actionable
- Reference the expert's actual knowledge and numbers when relevant
- If the expert's knowledge doesn't cover this, say so honestly
- Use markdown formatting (bullet points, bold for emphasis)
- Write 2-4 paragraphs of detailed, actionable advice for this section only
- Do NOT include the section title - just the content` }],
            { temperature: 0.4, maxTokens: 2048 }
          )

          sectionContents[index] = content
          await stream.writeSSE({
            data: JSON.stringify({ type: "section", index, content }),
          })
          console.log(`[tool/advice] Section ${index + 1}/${outline.sections.length} complete: ${section.title}`)
        })
      )

      const [saved] = await db.insert(toolAdvice).values({
        workspaceId,
        question,
        userContext: userContext ?? null,
        sections: outline.sections.map((s, i) => ({ ...s, content: sectionContents[i] })),
      }).returning({ id: toolAdvice.id })

      await stream.writeSSE({
        data: JSON.stringify({ type: "complete", adviceId: saved.id }),
      })
      console.log(`[tool/advice] Complete for workspace ${workspaceId}, saved as ${saved.id}`)
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error"
      console.error("[tool/advice] Error:", message)
      await stream.writeSSE({
        data: JSON.stringify({ type: "error", message }),
      })
    }
  })
})

// ============ Saved Advice ============

app.get("/:workspaceId/tool/advice", async (c) => {
  const { workspaceId } = c.req.param()
  const items = await db.select().from(toolAdvice)
    .where(eq(toolAdvice.workspaceId, workspaceId))
    .orderBy(asc(toolAdvice.createdAt))
  return c.json({ advice: items })
})

// ============ Tool Voice Session (Shared Agent) ============

const ELEVENLABS_AGENT_ID = process.env.ELEVENLABS_AGENT_ID

// buildComponentSummary replaced by shared buildComponentPromptSummary

app.post("/:workspaceId/tool/voice-session", async (c) => {
  const { workspaceId } = c.req.param()

  if (!ELEVENLABS_AGENT_ID) {
    return c.json({ error: "ELEVENLABS_AGENT_ID not configured" }, 500)
  }

  let mode = "widget"
  try {
    const body = await c.req.json()
    if (body?.mode) mode = body.mode
  } catch {}

  const workspace = await getWorkspace(workspaceId)
  if (!workspace) return c.json({ error: "Workspace not found" }, 404)

  const expert = await getWorkspaceExpertInfo(workspaceId)
  const expertKnowledge = await loadExpertKnowledge(workspaceId, expert.domain, 50)

  const allDocuments = await db.select().from(documents)
    .where(eq(documents.workspaceId, workspaceId))
  const docContext = allDocuments.length > 0
    ? `\n\nSUPPORTING DOCUMENTS:\n${allDocuments.map((d) => `[${d.title}] ${(d.extractedContent || d.content).slice(0, 3000)}`).join("\n\n")}`
    : ""

  const toolConfig = workspace.toolConfig as any
  const layout = toolConfig?.layout || []

  let prompt: string
  let firstMessage: string

  if (mode === "chat") {
    const sectionList = layout.map((c: any) => `- "${c.title}" (${c.type})`).join("\n")

    prompt = `You are ${expert.expertName}, an expert in ${expert.domain}. You are having a conversation with someone who wants to learn from your expertise.${expert.targetAudience ? ` Your audience is: ${expert.targetAudience}.` : ''}

EXPERT KNOWLEDGE (your primary resource):
${expertKnowledge}${docContext}

The user has an interactive guide with these sections:
${sectionList}

You can suggest the user check out a specific section when relevant by calling navigate_to_section with the section's component_id. But your main role is sharing expertise - answer questions, give advice, and have a natural conversation about ${expert.domain}.

CONVERSATION STYLE:
- Be warm, conversational, and concise
- Lead with expertise - share knowledge freely and proactively
- When a topic relates to a specific section, mention it naturally (e.g. "there's a section on that you might find helpful")
- Reference specific facts, numbers, and insights from the expert knowledge above
- If something is beyond your knowledge, say so honestly`

    firstMessage = `Hi! I'm here as your ${expert.domain} expert, drawing on ${expert.expertName}'s knowledge. What would you like to know?`
  } else {
    const componentSummary = buildComponentPromptSummary(layout)

    prompt = `You are ${expert.expertName}, an expert in ${expert.domain}. You are having a conversation with someone who wants to learn from your expertise.${expert.targetAudience ? ` Your audience is: ${expert.targetAudience}.` : ''}

EXPERT KNOWLEDGE (your primary resource):
${expertKnowledge}${docContext}

The user has an interactive tool with these sections available. You can help them interact with it using the tools below, but your main role is sharing your expertise and answering questions.

AVAILABLE COMPONENTS (use exact IDs when calling tools):
${componentSummary}

TOOL USAGE RULES:
${buildToolUsageRules(expert.domain)}

CONVERSATION STYLE:
- Be warm, conversational, and concise
- Lead with expertise - share knowledge freely and proactively
- Reference specific facts, numbers, and insights from the expert knowledge above
- If something is beyond your knowledge, say so honestly`

    firstMessage = `Hi! I'm here as your ${expert.domain} expert, drawing on ${expert.expertName}'s knowledge. What would you like to know?`
  }

  return c.json({
    agentId: ELEVENLABS_AGENT_ID,
    prompt,
    firstMessage,
  })
})

// ============ Refine Tool via Conversation (Opus Conductor) ============

app.post("/:workspaceId/tool/refine", async (c) => {
  const { workspaceId } = c.req.param()
  const { message, activeComponentId, layout, userContext } = await c.req.json()

  if (!message) return c.json({ error: "message is required" }, 400)

  const workspace = await getWorkspace(workspaceId)
  if (!workspace) return c.json({ error: "Workspace not found" }, 404)

  const expert = await getWorkspaceExpertInfo(workspaceId)
  const expertKnowledge = await loadExpertKnowledge(workspaceId, message, 20)

  // Load supporting documents and voice transcript for richer context
  const allDocuments = await db.select().from(documents)
    .where(eq(documents.workspaceId, workspaceId))
    .orderBy(asc(documents.createdAt))
  const documentContext = allDocuments.length > 0
    ? `\n\nSUPPORTING DOCUMENTS:\n${allDocuments.map((d) => `[${d.title}] ${(d.extractedContent || d.content).slice(0, 5000)}`).join("\n\n")}`
    : ""

  const allInterviews = await db.select({ metadata: forges.metadata }).from(forges)
    .where(eq(forges.workspaceId, workspaceId))
  let voiceTranscript = ""
  for (const interview of allInterviews) {
    const meta = (interview.metadata as any) || {}
    if (Array.isArray(meta.voiceTranscript)) {
      voiceTranscript += meta.voiceTranscript
        .filter((m: any) => m.role === "user")
        .slice(-10)
        .map((m: any) => m.content)
        .join("\n") + "\n"
    }
  }
  const transcriptContext = voiceTranscript
    ? `\n\nVOICE INTERVIEW TRANSCRIPT (expert's own words):\n${voiceTranscript.trim()}`
    : ""

  // Find the active component config
  const activeComponent = layout?.find((c: any) => c.id === activeComponentId)

  // Build component summary for navigation decisions
  const componentSummary = (layout || [])
    .map((c: any) => `- ${c.id} (${c.type}): ${c.title}`)
    .join("\n")

  const system = `You are channeling ${expert.expertName}'s expertise in ${expert.domain}. Your primary role is sharing knowledge and answering questions as ${expert.expertName} would.${expert.targetAudience ? ` Your audience is: ${expert.targetAudience}.` : ''}

You also manage an interactive tool built from this expertise. When appropriate, you can:
1. Update tool components based on what the user says
2. Navigate the UI to a relevant component

EXPERT KNOWLEDGE:
${expertKnowledge}${transcriptContext}${documentContext}

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
    if (result.action?.updatedConfig && workspace.toolConfig) {
      const currentConfig = workspace.toolConfig as any
      const targetId = result.action.navigateToComponentId || activeComponentId
      const updatedLayout = currentConfig.layout.map((c: any) =>
        c.id === targetId ? result.action!.updatedConfig : c
      )
      await db.update(workspaces).set({
        toolConfig: { ...currentConfig, layout: updatedLayout },
        updatedAt: new Date(),
      }).where(eq(workspaces.id, workspaceId))
    }

    return c.json(result)
  } catch (err: any) {
    console.error("[tool/refine] Error:", err.message)
    return c.json({ error: `Refine failed: ${err.message}` }, 500)
  }
})

// ============ Update Tool Config (Inline Editing) ============

app.patch("/:workspaceId/tool-config", async (c) => {
  const { workspaceId } = c.req.param()
  const { layout } = await c.req.json()

  if (!layout || !Array.isArray(layout)) {
    return c.json({ error: "layout array is required" }, 400)
  }

  const workspace = await getWorkspace(workspaceId)
  if (!workspace) return c.json({ error: "Workspace not found" }, 404)
  if (!workspace.toolConfig) return c.json({ error: "No tool config to update" }, 400)

  const updatedConfig = { ...(workspace.toolConfig as any), layout }

  await db.update(workspaces).set({
    toolConfig: updatedConfig,
    updatedAt: new Date(),
  }).where(eq(workspaces.id, workspaceId))

  return c.json({ ok: true })
})

// ============ Integrate New Knowledge into Existing Tool ============

app.post("/:workspaceId/integrate-knowledge", async (c) => {
  const { workspaceId } = c.req.param()
  const { forgeId } = await c.req.json()

  if (!forgeId) return c.json({ error: "forgeId is required" }, 400)

  const workspace = await getWorkspace(workspaceId)
  if (!workspace) return c.json({ error: "Workspace not found" }, 404)
  if (!workspace.toolConfig) return c.json({ error: "No tool config to update" }, 400)

  const expert = await getWorkspaceExpertInfo(workspaceId)

  // Load extractions from the specified interview
  const newExtractions = await db.select().from(extractions)
    .where(eq(extractions.forgeId, forgeId))
    .orderBy(asc(extractions.createdAt))

  if (newExtractions.length === 0) {
    return c.json({ error: "No extractions found for this interview" }, 400)
  }

  const newKnowledge = newExtractions.map(e => `[${e.type}] ${e.content}`).join("\n")
  const toolConfig = workspace.toolConfig as any
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

EXPERT: ${expert.expertName}
DOMAIN: ${expert.domain}

NEW KNOWLEDGE (from follow-up interview):
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

app.post("/:workspaceId/apply-updates", async (c) => {
  const { workspaceId } = c.req.param()
  const { proposals } = await c.req.json()

  if (!proposals || !Array.isArray(proposals)) {
    return c.json({ error: "proposals array is required" }, 400)
  }

  const workspace = await getWorkspace(workspaceId)
  if (!workspace) return c.json({ error: "Workspace not found" }, 404)
  if (!workspace.toolConfig) return c.json({ error: "No tool config to update" }, 400)

  const currentConfig = workspace.toolConfig as any
  let layout = [...currentConfig.layout]

  const applied: string[] = []
  const rejected: Array<{ title: string; errors: string[] }> = []

  for (const proposal of proposals) {
    const { valid, errors } = validateComponentConfig(proposal.preview)
    if (!valid) {
      rejected.push({ title: proposal.title || "untitled", errors })
      continue
    }
    if (proposal.type === "update" && proposal.componentId) {
      const existing = layout.find((c: any) => c.id === proposal.componentId)
      if (!existing) {
        rejected.push({ title: proposal.title || "untitled", errors: [`no component with id ${proposal.componentId}`] })
        continue
      }
      if (proposal.preview.type !== existing.type || proposal.preview.id !== existing.id) {
        rejected.push({ title: proposal.title || "untitled", errors: ["update must keep the component's id and type"] })
        continue
      }
      layout = layout.map((c: any) =>
        c.id === proposal.componentId ? proposal.preview : c
      )
      applied.push(proposal.title || proposal.componentId)
    } else if (proposal.type === "new" && proposal.preview) {
      if (layout.some((c: any) => c.id === proposal.preview.id)) {
        rejected.push({ title: proposal.title || "untitled", errors: [`duplicate component id ${proposal.preview.id}`] })
        continue
      }
      layout.push(proposal.preview)
      applied.push(proposal.title || proposal.preview.id)
    }
  }

  if (applied.length > 0) {
    await db.update(workspaces).set({
      toolConfig: { ...currentConfig, layout },
      updatedAt: new Date(),
    }).where(eq(workspaces.id, workspaceId))
  }

  return c.json({ ok: true, applied, rejected })
})

// ============ Generate Single Component ============

app.post("/:workspaceId/generate-component", async (c) => {
  const { workspaceId } = c.req.param()

  const workspace = await getWorkspace(workspaceId)
  if (!workspace) return c.json({ error: "Workspace not found" }, 404)

  const body = await c.req.json()
  const { type, focus, outline } = body
  if (!type || !focus) {
    return c.json({ error: "type and focus are required" }, 400)
  }

  const expert = await getWorkspaceExpertInfo(workspaceId)
  const extractionItems = await loadWorkspaceExtractions(workspaceId)
  if (extractionItems.length === 0) {
    return c.json({ error: "No knowledge extracted yet. Complete an interview first." }, 400)
  }

  const docItems = await loadWorkspaceDocuments(workspaceId)
  const knowledgeSummary = buildKnowledgeSummary(extractionItems)
  const documentSection = buildDocumentSection(docItems)

  // Determine index from existing layout
  const currentConfig = (workspace.toolConfig as any) || null
  const existingLayout: Array<Record<string, unknown>> = currentConfig?.layout || []
  const index = existingLayout.length

  const spec = deriveComponentSpec({ type, focus }, index)
  console.log(`[generate-component] Generating ${spec.type}: ${spec.title} for workspace ${workspaceId}`)

  try {
    const component = await generateComponent(spec, knowledgeSummary, documentSection, expert.expertName, expert.domain)

    // Append to existing layout or create new toolConfig
    const newLayout = [...existingLayout, component]
    const toolConfig = currentConfig
      ? { ...currentConfig, layout: newLayout }
      : { title: `${expert.expertName}'s ${expert.domain} Guide`, description: "", theme: { primaryColor: "#f97316", accentColor: "#fb923c", icon: "Lightbulb" }, layout: newLayout }

    await db.update(workspaces).set({
      toolConfig: toolConfig as any,
      updatedAt: new Date(),
    }).where(eq(workspaces.id, workspaceId))

    console.log(`[generate-component] Complete for workspace ${workspaceId}`)
    return c.json(component)
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error"
    console.error("[generate-component] Error:", message)
    return c.json({ error: `Component generation failed: ${message}` }, 500)
  }
})

export default app
