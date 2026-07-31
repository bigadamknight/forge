const API_BASE = '/api'

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  })
  if (!res.ok) {
    const error = await res.json().catch(() => ({ error: res.statusText }))
    throw new Error(error.error || res.statusText)
  }
  return res.json()
}

// ============ Types ============

export interface Workspace {
  id: string
  title: string
  description: string | null
  toolConfig: unknown
  knowledgeBase: unknown
  metadata: Record<string, unknown> | null
  createdAt: string
  updatedAt: string
  // Populated on detail fetch
  interviews?: Forge[]
  // Populated on list fetch
  interviewCount?: number
  latestStatus?: string
  expertName?: string | null
  domain?: string | null
}

export interface Forge {
  id: string
  workspaceId: string
  title: string
  expertName: string | null
  expertBio: string | null
  domain: string | null
  targetAudience: string | null
  depth: string
  status: string
  interviewConfig: InterviewConfig | null
  metadata: Record<string, unknown> | null
  createdAt: string
  updatedAt: string
  completedAt: string | null
}

export interface InterviewConfig {
  sections: Array<{
    title: string
    goal: string
    questions: Array<{ text: string; goal: string }>
  }>
  estimatedDurationMinutes: number
  domainContext: string
  extractionPriorities: string[]
}

export interface InterviewSection {
  id: string
  forgeId: string
  title: string
  goal: string | null
  orderIndex: number
  summary: unknown
  status: string
  round?: number
  questions: InterviewQuestion[]
}

export interface InterviewQuestion {
  id: string
  sectionId: string
  text: string
  goal: string | null
  orderIndex: number
  validationResult: unknown
  status: string
  messages: Message[]
}

export interface Message {
  id: string
  questionId: string
  role: string
  content: string
  createdAt: string
}

export interface Extraction {
  id: string
  forgeId: string
  sectionId: string | null
  questionId: string | null
  type: string
  content: string
  confidence: number | null
  tags: string[] | null
  createdAt: string
}

export interface InterviewState {
  forge: Forge
  sections: InterviewSection[]
  extractions: Extraction[]
  currentRound?: number
}

// ============ Workspace API ============

export function getWorkspaces(): Promise<Workspace[]> {
  return request('/workspaces')
}

export function getWorkspace(id: string): Promise<Workspace> {
  return request(`/workspaces/${id}`)
}

export function createWorkspace(title?: string): Promise<{ workspace: Workspace; interview: Forge }> {
  return request('/workspaces', {
    method: 'POST',
    body: JSON.stringify({ title }),
  })
}

export function deleteWorkspace(id: string): Promise<void> {
  return request(`/workspaces/${id}`, { method: 'DELETE' })
}

export function updateWorkspaceExtractionTypes(workspaceId: string, customExtractionTypes: unknown[]): Promise<Workspace> {
  return request(`/workspaces/${workspaceId}/extraction-types`, {
    method: 'PUT',
    body: JSON.stringify({ customExtractionTypes }),
  })
}

// ============ Forge (Interview) API ============

export function getForges(): Promise<Forge[]> {
  return request('/forges')
}

export function getForge(id: string): Promise<Forge> {
  return request(`/forges/${id}`)
}

export function getPlanningNodes(data: {
  expertName: string
  domain: string
  targetAudience?: string
}): Promise<{ nodes: string[] }> {
  return request('/forges/planning-text', {
    method: 'POST',
    body: JSON.stringify(data),
  })
}

export function seedExtractions(forgeId: string): Promise<{ seeded: number }> {
  return request(`/forges/${forgeId}/seed-extractions`, { method: 'POST' })
}

export function deleteForge(id: string): Promise<void> {
  return request(`/forges/${id}`, { method: 'DELETE' })
}

export function planInterview(forgeId: string): Promise<Forge> {
  return request(`/forges/${forgeId}/plan-interview`, { method: 'POST' })
}

// ============ Interview API ============

export function getInterviewState(forgeId: string): Promise<InterviewState> {
  return request(`/forges/${forgeId}/interview`)
}

export function generateOpening(forgeId: string): Promise<{ message: Message; opening: string }> {
  return request(`/forges/${forgeId}/interview/opening`, { method: 'POST' })
}

export function advanceQuestion(forgeId: string): Promise<{ sectionId?: string; questionId?: string; complete?: boolean }> {
  return request(`/forges/${forgeId}/interview/next`, { method: 'POST' })
}

export function completeInterview(forgeId: string): Promise<Forge> {
  return request(`/forges/${forgeId}/interview/complete`, { method: 'POST' })
}

export function getExtractions(forgeId: string): Promise<Extraction[]> {
  return request(`/forges/${forgeId}/extractions`)
}

export function updateExtraction(
  forgeId: string,
  extractionId: string,
  data: { content?: string; type?: string; tags?: string[]; confidence?: number }
): Promise<Extraction> {
  return request(`/forges/${forgeId}/extractions/${extractionId}`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  })
}

export function deleteExtraction(forgeId: string, extractionId: string): Promise<{ deleted: boolean }> {
  return request(`/forges/${forgeId}/extractions/${extractionId}`, {
    method: 'DELETE',
  })
}

// ============ SSE Stream Helper ============

function streamSSE<T>(
  url: string,
  options: RequestInit,
  onEvent: (event: T) => void,
  onDone: () => void,
  onError: (error: string) => void
): AbortController {
  const controller = new AbortController()

  fetch(url, { ...options, signal: controller.signal })
    .then(async (response) => {
      if (!response.ok) {
        const err = await response.json().catch(() => ({ error: 'Request failed' }))
        onError(err.error || 'Request failed')
        return
      }

      const reader = response.body?.getReader()
      if (!reader) return

      const decoder = new TextDecoder()
      let buffer = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop() || ''

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const data = JSON.parse(line.slice(6))
              onEvent(data)
            } catch {
              // Skip malformed lines
            }
          }
        }
      }

      onDone()
    })
    .catch((err) => {
      if (err.name !== 'AbortError') {
        onError(err.message)
      }
    })

  return controller
}

// ============ SSE Stream for Interview Messages ============

export function sendInterviewMessage(
  forgeId: string,
  content: string,
  onEvent: (event: SSEEvent) => void,
  onDone: () => void,
  onError: (error: string) => void
): AbortController {
  return streamSSE(
    `${API_BASE}/forges/${forgeId}/interview/message`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content }),
    },
    onEvent,
    onDone,
    onError
  )
}

export type SSEEvent =
  | { type: 'chunk'; content: string }
  | { type: 'done'; messageId: string }
  | { type: 'validation'; result: { meets_goal: boolean; confidence: number; explanation: string } }
  | { type: 'extraction'; items: Array<{ id: string; type: string; content: string; confidence: number; tags?: string[] }> }
  | { type: 'advance'; sectionId: string; questionId: string }
  | { type: 'interview_complete' }
  | { type: 'error'; message: string }

// ============ Intro Phase ============

export interface IntroFields {
  expertName: string | null
  domain: string | null
  targetAudience: string | null
}

export interface ExpertProfile {
  expertName: string | null
  domain: string | null
  targetAudience: string | null
  yearsExperience: string | null
  specializations: string[] | null
  uniqueApproach: string | null
  commonMistakes: string[] | null
  notableAchievements: string[] | null
  industriesOrContexts: string[] | null
  passionArea: string | null
  problemsTheySolve: string[] | null
}

export const EMPTY_EXPERT_PROFILE: ExpertProfile = {
  expertName: null,
  domain: null,
  targetAudience: null,
  yearsExperience: null,
  specializations: null,
  uniqueApproach: null,
  commonMistakes: null,
  notableAchievements: null,
  industriesOrContexts: null,
  passionArea: null,
  problemsTheySolve: null,
}

export type IntroSSEEvent =
  | { type: 'chunk'; content: string }
  | { type: 'done' }
  | { type: 'intro_extracted'; fields: IntroFields }
  | { type: 'profile_updated'; profile: ExpertProfile }
  | { type: 'error'; message: string }

export function generateIntroOpening(forgeId: string): Promise<{ content: string }> {
  return request(`/forges/${forgeId}/intro/opening`, { method: 'POST' })
}

export function sendIntroMessage(
  forgeId: string,
  content: string,
  onEvent: (event: IntroSSEEvent) => void,
  onDone: () => void,
  onError: (error: string) => void
): AbortController {
  return streamSSE(
    `${API_BASE}/forges/${forgeId}/intro/message`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content }),
    },
    onEvent,
    onDone,
    onError
  )
}

export function completeIntro(forgeId: string, depth: string): Promise<{ ok: boolean }> {
  return request(`/forges/${forgeId}/intro/complete`, {
    method: 'POST',
    body: JSON.stringify({ depth }),
  })
}

export function getIntroVoiceSession(forgeId: string): Promise<{
  agentId: string
  prompt: string
  firstMessage: string
  progress: string
}> {
  return request(`/forges/${forgeId}/intro/voice-session`, { method: 'POST' })
}

export function saveIntroVoiceMessage(
  forgeId: string,
  role: string,
  content: string
): Promise<{ saved: boolean; count: number }> {
  return request(`/forges/${forgeId}/intro/voice-message`, {
    method: 'POST',
    body: JSON.stringify({ role, content }),
  })
}

export function extractIntroVoiceMessage(
  forgeId: string,
  _content: string
): Promise<{ extractions: Array<{ id: string; type: string; content: string; confidence: number; tags: string[] }> }> {
  return request(`/forges/${forgeId}/intro/voice-extract`, {
    method: 'POST',
    body: JSON.stringify({ content: _content }),
  })
}

// ============ SSE Stream for Interview Planning ============

export type PlanInterviewEvent =
  | { type: 'analysing' }
  | { type: 'skeleton'; domainContext: string; extractionPriorities: string[]; estimatedDurationMinutes: number; sections: Array<{ index: number; title: string; goal: string }> }
  | { type: 'questions'; sectionIndex: number; questions: Array<{ text: string; goal: string }> }
  | { type: 'complete'; forgeId: string }
  | { type: 'error'; message: string }

export function planInterviewStream(
  forgeId: string,
  onEvent: (event: PlanInterviewEvent) => void,
  onDone: () => void,
  onError: (error: string) => void
): AbortController {
  return streamSSE(
    `${API_BASE}/forges/${forgeId}/plan-interview-stream`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    },
    onEvent,
    onDone,
    onError
  )
}

// ============ Tool API (workspace-scoped) ============

export interface ToolPlanComponent {
  type: string
  focus: string
  outline: string[]
}

export interface ToolPlan {
  title: string
  theme: {
    primaryColor: string
    accentColor: string
    icon: string
  }
  components: ToolPlanComponent[]
}

export function planTool(workspaceId: string): Promise<ToolPlan> {
  return request(`/workspaces/${workspaceId}/plan-tool`, { method: 'POST' })
}

export type GenerateEvent =
  | { type: 'plan'; title: string; componentCount: number; components: { type: string; title: string }[] }
  | { type: 'component'; index: number; total: number; title: string; componentType: string }
  | { type: 'operations_start' }
  | { type: 'operations_complete' }
  | { type: 'complete' }
  | { type: 'error'; message: string }

export function generateToolStream(
  workspaceId: string,
  onEvent: (event: GenerateEvent) => void,
  onDone: () => void,
  onError: (error: string) => void,
  confirmedPlan?: ToolPlan
): AbortController {
  return streamSSE(
    `${API_BASE}/workspaces/${workspaceId}/generate-tool-stream`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: confirmedPlan ? JSON.stringify({ plan: confirmedPlan }) : undefined,
    },
    onEvent,
    onDone,
    onError
  )
}

export interface ToolConfigResponse {
  workspace: {
    id: string
    title: string
    expertName: string
    domain: string
    targetAudience: string | null
  }
  toolConfig: {
    title: string
    description: string
    theme: { primaryColor: string; accentColor: string; icon: string }
    layout: Array<Record<string, unknown>>
    contextLayers: Array<{ level: number; name: string; type: string; content: string; priority: number }>
  }
}

export function getToolConfig(workspaceId: string): Promise<ToolConfigResponse> {
  return request(`/workspaces/${workspaceId}/tool`)
}

export function updateToolConfig(
  workspaceId: string,
  layout: Array<Record<string, unknown>>
): Promise<{ ok: boolean }> {
  return request(`/workspaces/${workspaceId}/tool-config`, {
    method: 'PATCH',
    body: JSON.stringify({ layout }),
  })
}

export function askExpert(
  workspaceId: string,
  question: string,
  userContext?: Record<string, unknown>,
  componentContext?: string
): Promise<{ answer: string }> {
  return request(`/workspaces/${workspaceId}/tool/ask`, {
    method: 'POST',
    body: JSON.stringify({ question, userContext, componentContext }),
  })
}

// ============ Structured Advice (SSE Stream) ============

export interface AdviceSection {
  title: string
  description: string
  content: string
}

export type AdviceEvent =
  | { type: 'outline'; sections: Array<{ title: string; description: string }> }
  | { type: 'section'; index: number; content: string }
  | { type: 'complete' }
  | { type: 'error'; message: string }

export function streamAdvice(
  workspaceId: string,
  question: string,
  userContext: Record<string, unknown> | undefined,
  componentContext: string | undefined,
  onEvent: (event: AdviceEvent) => void,
  onDone: () => void,
  onError: (error: string) => void
): AbortController {
  return streamSSE(
    `${API_BASE}/workspaces/${workspaceId}/tool/advice`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ question, userContext, componentContext }),
    },
    onEvent,
    onDone,
    onError
  )
}

export function getToolVoiceSession(workspaceId: string, mode: 'widget' | 'chat' = 'widget'): Promise<{
  agentId: string
  prompt: string
  firstMessage: string
}> {
  return request(`/workspaces/${workspaceId}/tool/voice-session`, {
    method: 'POST',
    body: JSON.stringify({ mode }),
  })
}

export interface RefineResult {
  response: string
  action?: {
    navigateToComponentId?: string
    updatedConfig?: Record<string, unknown>
    changeDescription: string
  }
}

export function refineTool(
  workspaceId: string,
  message: string,
  activeComponentId: string | null,
  layout: Array<Record<string, unknown>>,
  userContext?: Record<string, unknown>
): Promise<RefineResult> {
  return request(`/workspaces/${workspaceId}/tool/refine`, {
    method: 'POST',
    body: JSON.stringify({ message, activeComponentId, layout, userContext }),
  })
}

// ============ Documents API (workspace-scoped) ============

export interface Document {
  id: string
  workspaceId: string
  type: 'text' | 'url'
  title: string
  content: string
  extractedContent: string | null
  createdAt: string
}

export function getDocuments(workspaceId: string): Promise<Document[]> {
  return request(`/workspaces/${workspaceId}/documents`)
}

export function addDocument(
  workspaceId: string,
  data: { type: 'text' | 'url'; title: string; content: string }
): Promise<Document> {
  return request(`/workspaces/${workspaceId}/documents`, {
    method: 'POST',
    body: JSON.stringify(data),
  })
}

export function updateDocument(
  workspaceId: string,
  docId: string,
  data: { title?: string; content?: string }
): Promise<Document> {
  return request(`/workspaces/${workspaceId}/documents/${docId}`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  })
}

export function deleteDocument(workspaceId: string, docId: string): Promise<{ deleted: boolean }> {
  return request(`/workspaces/${workspaceId}/documents/${docId}`, {
    method: 'DELETE',
  })
}

// ============ Voice API ============

export function getVoiceSession(forgeId: string): Promise<{
  agentId: string
  prompt: string
  firstMessage: string
  progress: string
}> {
  return request(`/forges/${forgeId}/voice-session`, { method: 'POST' })
}

export function getVoiceProgress(forgeId: string): Promise<{ progress: string }> {
  return request(`/forges/${forgeId}/voice-agent/progress`)
}

export function saveVoiceMessage(
  forgeId: string,
  role: string,
  content: string
): Promise<{ saved: boolean; count: number }> {
  return request(`/forges/${forgeId}/voice-message`, {
    method: 'POST',
    body: JSON.stringify({ role, content }),
  })
}

export function extractVoiceMessage(
  forgeId: string,
  content: string
): Promise<{ extractions: Array<{ id: string; type: string; content: string; confidence: number; tags: string[] }> }> {
  return request(`/forges/${forgeId}/voice-extract`, {
    method: 'POST',
    body: JSON.stringify({ content }),
  })
}

// ============ Follow-up API ============

export function suggestFollowUps(forgeId: string): Promise<{ suggestions: Array<{ topic: string; reason: string }> }> {
  return request(`/forges/${forgeId}/suggest-followups`, { method: 'POST' })
}

export function startFollowUpStream(
  forgeId: string,
  topic: string,
  onEvent: (event: PlanInterviewEvent) => void,
  onDone: () => void,
  onError: (error: string) => void
): AbortController {
  return streamSSE(
    `${API_BASE}/forges/${forgeId}/follow-up`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ topic }),
    },
    onEvent,
    onDone,
    onError
  )
}

export function integrateKnowledge(workspaceId: string, forgeId: string): Promise<{
  proposals: Array<{
    type: 'update' | 'new'
    componentId?: string
    componentType?: string
    title: string
    description: string
    preview: Record<string, unknown>
  }>
}> {
  return request(`/workspaces/${workspaceId}/integrate-knowledge`, {
    method: 'POST',
    body: JSON.stringify({ forgeId }),
  })
}

export function applyToolUpdates(workspaceId: string, proposals: Array<Record<string, unknown>>): Promise<{ ok: boolean }> {
  return request(`/workspaces/${workspaceId}/apply-updates`, {
    method: 'POST',
    body: JSON.stringify({ proposals }),
  })
}

export function generateSingleComponent(
  workspaceId: string,
  component: { type: string; focus: string; outline: string[] }
): Promise<Record<string, unknown>> {
  return request(`/workspaces/${workspaceId}/generate-component`, {
    method: 'POST',
    body: JSON.stringify(component),
  })
}

export function createInterview(
  workspaceId: string,
  topic?: string
): Promise<Forge> {
  return request(`/workspaces/${workspaceId}/interviews`, {
    method: 'POST',
    body: JSON.stringify({ topic }),
  })
}
