import { db, forges, extractions, documents } from "@forge/db"
import { eq, asc, inArray } from "drizzle-orm"
import { searchUnitsHybrid, hasUnitEmbeddings } from "../lib/embeddings"

// Shared 5-layer expert context, used by tool/ask, tool/advice, voice sessions,
// and the learning-path unit generators. Layers 1-4 are assembled here; callers
// append layer 5 (the current question/task) and their own instructions.

export interface WorkspaceExpertInfo {
  expertName: string
  domain: string
  targetAudience: string | null
  metadata: unknown
}

export async function getWorkspaceExpertInfo(workspaceId: string): Promise<WorkspaceExpertInfo> {
  const [interview] = await db.select({
    expertName: forges.expertName,
    domain: forges.domain,
    targetAudience: forges.targetAudience,
    metadata: forges.metadata,
  }).from(forges)
    .where(eq(forges.workspaceId, workspaceId))
    .orderBy(forges.createdAt)
    .limit(1)
  return {
    expertName: interview?.expertName || "Expert",
    domain: interview?.domain || "General",
    targetAudience: interview?.targetAudience || null,
    metadata: interview?.metadata || null,
  }
}

export async function loadExpertKnowledge(workspaceId: string, query: string, limit = 15): Promise<string> {
  // Workspace-scoped hybrid search over the curated knowledge layer
  if (await hasUnitEmbeddings(workspaceId)) {
    const results = await searchUnitsHybrid(workspaceId, query, limit)
    if (results.length > 0) {
      return results.map((r) => `[${r.type}] ${r.content}`).join("\n")
    }
  }

  // Fallback: raw extractions across the workspace's forges
  const forgeRows = await db.select({ id: forges.id })
    .from(forges).where(eq(forges.workspaceId, workspaceId))
  const forgeIds = forgeRows.map(r => r.id)
  if (forgeIds.length === 0) return ""
  const all = await db.select().from(extractions)
    .where(inArray(extractions.forgeId, forgeIds))
    .orderBy(asc(extractions.createdAt))
  return all.slice(0, limit + 25).map((e) => `[${e.type}] ${e.content}`).join("\n")
}

async function loadDocumentContext(workspaceId: string, perDocChars = 5000): Promise<string> {
  const allDocuments = await db.select().from(documents)
    .where(eq(documents.workspaceId, workspaceId))
    .orderBy(asc(documents.createdAt))
  if (allDocuments.length === 0) return ""
  return `\n\nSUPPORTING DOCUMENTS:\n${allDocuments
    .map((d) => `[${d.title}] ${(d.extractedContent || d.content).slice(0, perDocChars)}`)
    .join("\n\n")}`
}

async function loadTranscriptContext(workspaceId: string): Promise<string> {
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
  return voiceTranscript
    ? `\n\nVOICE INTERVIEW TRANSCRIPT (expert's own words):\n${voiceTranscript.trim()}`
    : ""
}

export interface ExpertContextOptions {
  query: string
  knowledgeLimit?: number
  componentContext?: string
  userContext?: unknown
}

export interface ExpertContext {
  expert: WorkspaceExpertInfo
  expertKnowledge: string
  preamble: string
}

export async function buildExpertContext(
  workspaceId: string,
  options: ExpertContextOptions
): Promise<ExpertContext> {
  const expert = await getWorkspaceExpertInfo(workspaceId)
  const [expertKnowledge, documentContext, transcriptContext] = await Promise.all([
    loadExpertKnowledge(workspaceId, options.query, options.knowledgeLimit ?? 15),
    loadDocumentContext(workspaceId),
    loadTranscriptContext(workspaceId),
  ])

  const preamble = `You are an AI assistant that channels the expertise of ${expert.expertName} in ${expert.domain}.

LAYER 1 - DOMAIN CONTEXT:
${expert.domain}. ${expert.targetAudience ? `This tool is designed for: ${expert.targetAudience}` : ""}

LAYER 2 - EXPERT KNOWLEDGE:
The following knowledge was extracted directly from ${expert.expertName}:
${expertKnowledge}${transcriptContext}${documentContext}

LAYER 3 - TOOL CONTEXT:
${options.componentContext ? `The user is currently looking at: ${options.componentContext}` : "They are using an interactive guide built from this expert's knowledge."}

LAYER 4 - USER SITUATION:
${options.userContext ? `About the user: ${JSON.stringify(options.userContext)}` : "No specific context provided."}`

  return { expert, expertKnowledge, preamble }
}
