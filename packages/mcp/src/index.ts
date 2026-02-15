#!/usr/bin/env bun
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js"
import { z } from "zod"
import { db, forges, extractions, documents } from "@forge/db"
import { eq, asc, desc, sql } from "drizzle-orm"
import Anthropic from "@anthropic-ai/sdk"
import { searchHybrid, hasEmbeddings } from "./search"

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

const server = new McpServer({
  name: "forge-knowledge",
  version: "1.0.0",
})

function textResult(data: unknown) {
  return { content: [{ type: "text" as const, text: typeof data === "string" ? data : JSON.stringify(data, null, 2) }] }
}

function errorResult(message: string) {
  return { content: [{ type: "text" as const, text: message }], isError: true as const }
}

// ============ forge_list ============

server.tool(
  "forge_list",
  "List all available forges (knowledge bases). Returns forge ID, title, expert name, domain, status, and extraction count.",
  {},
  async () => {
    const rows = await db
      .select({
        id: forges.id,
        title: forges.title,
        expertName: forges.expertName,
        domain: forges.domain,
        targetAudience: forges.targetAudience,
        status: forges.status,
        createdAt: forges.createdAt,
      })
      .from(forges)
      .orderBy(desc(forges.createdAt))

    const counts = await db.execute(
      sql`SELECT forge_id, COUNT(*) as count FROM extractions GROUP BY forge_id`
    )
    const countMap = new Map((counts as any[]).map((r) => [r.forge_id, parseInt(r.count)]))

    return textResult(rows.map((f) => ({
      id: f.id,
      title: f.title,
      expertName: f.expertName,
      domain: f.domain,
      targetAudience: f.targetAudience,
      status: f.status,
      extractionCount: countMap.get(f.id) || 0,
      createdAt: f.createdAt.toISOString(),
    })))
  }
)

// ============ forge_get ============

server.tool(
  "forge_get",
  "Get detailed information about a specific forge including extractions, documents, and tool components.",
  { forgeId: z.string() },
  // @ts-expect-error - MCP SDK Zod generics hit TS recursion limit
  async ({ forgeId }: { forgeId: string }) => {
    const [forge] = await db.select().from(forges).where(eq(forges.id, forgeId)).limit(1)
    if (!forge) return errorResult("Forge not found")

    const forgeExtractions = await db
      .select({ id: extractions.id, type: extractions.type, content: extractions.content, confidence: extractions.confidence, tags: extractions.tags })
      .from(extractions)
      .where(eq(extractions.forgeId, forgeId))
      .orderBy(asc(extractions.createdAt))

    const forgeDocs = await db
      .select({ id: documents.id, title: documents.title, type: documents.type })
      .from(documents)
      .where(eq(documents.forgeId, forgeId))

    const toolConfig = forge.toolConfig as any
    const components = toolConfig?.layout?.map((c: any) => ({
      id: c.id,
      type: c.type,
      title: c.title,
    })) || []

    return textResult({
      id: forge.id,
      title: forge.title,
      expertName: forge.expertName,
      domain: forge.domain,
      targetAudience: forge.targetAudience,
      status: forge.status,
      depth: forge.depth,
      extractionCount: forgeExtractions.length,
      documentCount: forgeDocs.length,
      components,
      extractions: forgeExtractions.map((e) => ({
        id: e.id,
        type: e.type,
        content: e.content,
        confidence: e.confidence,
        tags: e.tags,
      })),
      documents: forgeDocs,
      createdAt: forge.createdAt.toISOString(),
    })
  }
)

// ============ forge_search ============

server.tool(
  "forge_search",
  "Search a forge's knowledge base using hybrid semantic + keyword search. Returns the most relevant extractions ranked by combined score. Parameters: forgeId (UUID), query (search text), limit (optional, default 15, max 50).",
  { forgeId: z.string(), query: z.string(), limit: z.number().optional() },
  async ({ forgeId, query, limit: rawLimit }: { forgeId: string; query: string; limit?: number }) => {
    const limit = Math.min(Math.max(rawLimit || 15, 1), 50)

    const [forge] = await db.select().from(forges).where(eq(forges.id, forgeId)).limit(1)
    if (!forge) return errorResult("Forge not found")

    const useEmbeddings = await hasEmbeddings(forgeId)
    let results

    if (useEmbeddings) {
      results = await searchHybrid(forgeId, query, limit)
    } else {
      const all = await db
        .select()
        .from(extractions)
        .where(eq(extractions.forgeId, forgeId))
        .orderBy(asc(extractions.createdAt))

      const queryLower = query.toLowerCase()
      results = all
        .filter((e) => e.content.toLowerCase().includes(queryLower))
        .slice(0, limit)
        .map((e) => ({
          id: e.id,
          type: e.type,
          content: e.content,
          confidence: e.confidence,
          tags: e.tags,
          score: 1,
        }))
    }

    return textResult({
      forgeId,
      query,
      resultCount: results.length,
      searchMethod: useEmbeddings ? "hybrid (semantic + keyword)" : "keyword fallback",
      results: results.map((r) => ({
        id: r.id,
        type: r.type,
        content: r.content,
        confidence: r.confidence,
        tags: r.tags,
        score: Math.round(r.score * 1000) / 1000,
      })),
    })
  }
)

// ============ forge_ask ============

server.tool(
  "forge_ask",
  "Ask the expert a question. Uses the forge's knowledge base (extractions, documents, voice transcript) to generate an answer channeling the expert's voice and knowledge. Parameters: forgeId (UUID), question (text), context (optional user situation).",
  { forgeId: z.string(), question: z.string(), context: z.string().optional() },
  // @ts-expect-error - MCP SDK Zod generics hit TS recursion limit
  async ({ forgeId, question, context }: { forgeId: string; question: string; context?: string }) => {
    if (!process.env.ANTHROPIC_API_KEY) return errorResult("ANTHROPIC_API_KEY not configured")

    const [forge] = await db.select().from(forges).where(eq(forges.id, forgeId)).limit(1)
    if (!forge) return errorResult("Forge not found")

    // Get relevant extractions via hybrid search or full load
    let expertKnowledge: string
    const useEmbeddings = await hasEmbeddings(forgeId)
    if (useEmbeddings) {
      const results = await searchHybrid(forgeId, question, 15)
      expertKnowledge = results.map((r) => `[${r.type}] ${r.content}`).join("\n")
    } else {
      const all = await db
        .select()
        .from(extractions)
        .where(eq(extractions.forgeId, forgeId))
        .orderBy(asc(extractions.createdAt))
      expertKnowledge = all.map((e) => `[${e.type}] ${e.content}`).join("\n")
    }

    // Get documents
    const allDocs = await db
      .select()
      .from(documents)
      .where(eq(documents.forgeId, forgeId))
      .orderBy(asc(documents.createdAt))

    const documentContext = allDocs.length > 0
      ? `\n\nSUPPORTING DOCUMENTS:\n${allDocs.map((d) => `[${d.title}] ${(d.extractedContent || d.content).slice(0, 5000)}`).join("\n\n")}`
      : ""

    // Get voice transcript
    const metadata = (forge.metadata as any) || {}
    const voiceTranscript = Array.isArray(metadata.voiceTranscript)
      ? metadata.voiceTranscript
          .filter((m: any) => m.role === "user")
          .slice(-20)
          .map((m: any) => m.content)
          .join("\n")
      : ""
    const transcriptContext = voiceTranscript
      ? `\n\nVOICE INTERVIEW TRANSCRIPT (expert's own words):\n${voiceTranscript}`
      : ""

    const system = `You are an AI assistant that channels the expertise of ${forge.expertName} in ${forge.domain}.

DOMAIN: ${forge.domain}${forge.targetAudience ? `. Designed for: ${forge.targetAudience}` : ""}

EXPERT KNOWLEDGE (extracted from ${forge.expertName}):
${expertKnowledge}${transcriptContext}${documentContext}

${context ? `USER CONTEXT: ${context}` : ""}

Instructions:
- Answer as if you are ${forge.expertName} sharing their expertise
- Be specific, practical, and actionable
- Reference the expert's actual knowledge and data when relevant
- If the expert's knowledge doesn't cover this question, say so honestly
- Keep answers focused and concise`

    const response = await anthropic.messages.create({
      model: "claude-sonnet-4-5-20250929",
      max_tokens: 1024,
      temperature: 0.4,
      system,
      messages: [{ role: "user", content: question }],
    })

    const answer = response.content[0].type === "text" ? response.content[0].text : ""
    return textResult(answer)
  }
)

// ============ Start Server ============

async function main() {
  const transport = new StdioServerTransport()
  await server.connect(transport)
  console.error("[forge-mcp] Server started on stdio")
}

main().catch((err) => {
  console.error("[forge-mcp] Fatal error:", err)
  process.exit(1)
})
