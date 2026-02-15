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

export interface Forge {
  id: string
  title: string
  expertName: string
  expertBio: string | null
  domain: string
  targetAudience: string | null
  depth: string
  status: string
  interviewConfig: InterviewConfig | null
  toolConfig: unknown
  knowledgeBase: unknown
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
}

// ============ Forge API ============

export function getForges(): Promise<Forge[]> {
  return request('/forges')
}

export function getForge(id: string): Promise<Forge> {
  return request(`/forges/${id}`)
}

export function createForge(data: {
  title: string
  expertName: string
  expertBio?: string
  domain: string
  targetAudience?: string
  depth?: string
}): Promise<Forge> {
  return request('/forges', {
    method: 'POST',
    body: JSON.stringify(data),
  })
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

// ============ Tool API ============

export function generateTool(forgeId: string): Promise<Forge> {
  return request(`/forges/${forgeId}/generate-tool`, { method: 'POST' })
}

// ============ Tool Plan Types ============

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

export function planTool(forgeId: string): Promise<ToolPlan> {
  return request(`/forges/${forgeId}/plan-tool`, { method: 'POST' })
}

// ============ SSE Stream for Tool Generation ============

export type GenerateEvent =
  | { type: 'plan'; title: string; componentCount: number; components: { type: string; title: string }[] }
  | { type: 'component'; index: number; total: number; title: string; componentType: string }
  | { type: 'operations_start' }
  | { type: 'operations_complete' }
  | { type: 'complete' }
  | { type: 'error'; message: string }

export function generateToolStream(
  forgeId: string,
  onEvent: (event: GenerateEvent) => void,
  onDone: () => void,
  onError: (error: string) => void,
  confirmedPlan?: ToolPlan
): AbortController {
  return streamSSE(
    `${API_BASE}/forges/${forgeId}/generate-tool-stream`,
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
  forge: {
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

export function getToolConfig(forgeId: string): Promise<ToolConfigResponse> {
  return request(`/forges/${forgeId}/tool`)
}

export function updateToolConfig(
  forgeId: string,
  layout: Array<Record<string, unknown>>
): Promise<{ ok: boolean }> {
  return request(`/forges/${forgeId}/tool-config`, {
    method: 'PATCH',
    body: JSON.stringify({ layout }),
  })
}

export function askExpert(
  forgeId: string,
  question: string,
  userContext?: Record<string, unknown>,
  componentContext?: string
): Promise<{ answer: string }> {
  return request(`/forges/${forgeId}/tool/ask`, {
    method: 'POST',
    body: JSON.stringify({ question, userContext, componentContext }),
  })
}

export function getToolVoiceSession(forgeId: string): Promise<{
  agentId: string
  prompt: string
  firstMessage: string
}> {
  return request(`/forges/${forgeId}/tool/voice-session`, { method: 'POST' })
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
  forgeId: string,
  message: string,
  activeComponentId: string | null,
  layout: Array<Record<string, unknown>>,
  userContext?: Record<string, unknown>
): Promise<RefineResult> {
  return request(`/forges/${forgeId}/tool/refine`, {
    method: 'POST',
    body: JSON.stringify({ message, activeComponentId, layout, userContext }),
  })
}

// ============ Documents API ============

export interface Document {
  id: string
  forgeId: string
  type: 'text' | 'url'
  title: string
  content: string
  extractedContent: string | null
  createdAt: string
}

export function getDocuments(forgeId: string): Promise<Document[]> {
  return request(`/forges/${forgeId}/documents`)
}

export function addDocument(
  forgeId: string,
  data: { type: 'text' | 'url'; title: string; content: string }
): Promise<Document> {
  return request(`/forges/${forgeId}/documents`, {
    method: 'POST',
    body: JSON.stringify(data),
  })
}

export function updateDocument(
  forgeId: string,
  docId: string,
  data: { title?: string; content?: string }
): Promise<Document> {
  return request(`/forges/${forgeId}/documents/${docId}`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  })
}

export function deleteDocument(forgeId: string, docId: string): Promise<{ deleted: boolean }> {
  return request(`/forges/${forgeId}/documents/${docId}`, {
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
