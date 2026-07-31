// Client-side component interaction tools
// Wraps shared descriptors with actual handlers that update component state

import { COMPONENT_INTERACTIONS, getComponentSummary } from '@forge/shared'

export { getComponentSummary }

type FindComponent = (id: string) => Record<string, any> | undefined
type OnUpdate = (id: string, config: Record<string, any>) => void
type OnNavigate = (id: string) => void

// Action handlers keyed by action name
// Each returns the updated config (or null if not applicable)
const ACTION_HANDLERS: Record<string, (config: Record<string, any>, params: any) => Record<string, any> | null> = {
  toggle_checklist_items: (config, params) => {
    const itemIds = typeof params.item_ids === 'string'
      ? params.item_ids.split(',').map((s: string) => s.trim())
      : params.item_ids
    const currentChecked = new Set((config.checkedIds as string[]) || [])
    for (const id of itemIds) {
      if (params.checked) currentChecked.add(id)
      else currentChecked.delete(id)
    }
    return { ...config, checkedIds: [...currentChecked] }
  },

  answer_question: (config, params) => {
    const voiceAnswers = { ...((config._voiceAnswers as Record<string, unknown>) || {}), [params.question_id]: params.answer }
    return { ...config, _voiceAnswers: voiceAnswers }
  },

  select_decision_option: (config, params) => {
    const path = [...((config._selectedPath as any[]) || []), { nodeId: params.node_id, optionIndex: params.option_index }]
    return { ...config, _selectedPath: path }
  },

  complete_step: (config, params) => {
    const currentCompleted = new Set((config.completedSteps as string[]) || [])
    if (params.completed) currentCompleted.add(params.step_id)
    else currentCompleted.delete(params.step_id)
    return { ...config, completedSteps: [...currentCompleted] }
  },

  set_calculator_value: (config, params) => {
    const voiceValues = { ...((config._voiceValues as Record<string, number>) || {}), [params.input_id]: params.value }
    return { ...config, _voiceValues: voiceValues }
  },

  answer_quiz: (config, params) => {
    const quizAnswers = { ...((config._quizAnswers as Record<string, string[]>) || {}), [params.question_id]: [params.option_id] }
    return { ...config, _quizAnswers: quizAnswers }
  },

  expand_curriculum_module: (config, params) => {
    return { ...config, _expandModule: params.module_id }
  },
}

// Response builders for each action (what the tool returns to the AI)
const ACTION_RESPONSES: Record<string, (config: Record<string, any>, params: any) => string> = {
  toggle_checklist_items: (_config, params) => {
    const itemIds = typeof params.item_ids === 'string'
      ? params.item_ids.split(',').map((s: string) => s.trim())
      : params.item_ids
    return `Updated ${itemIds.length} items`
  },

  answer_question: (_config, params) => `Answered question ${params.question_id}`,

  select_decision_option: (config, params) => {
    const node = (config.nodes as any[])?.find((n: any) => n.id === params.node_id)
    const option = node?.options?.[params.option_index]
    if (option?.recommendation) return `Recommendation: ${option.recommendation}`
    return `Selected option ${params.option_index}`
  },

  complete_step: (_config, params) => `Step ${params.completed ? 'completed' : 'uncompleted'}`,

  set_calculator_value: (_config, params) => `Set ${params.input_id} to ${params.value}`,

  answer_quiz: (config, params) => {
    const question = (config.questions as any[])?.find((q: any) => q.id === params.question_id)
    const option = question?.options?.find((o: any) => o.id === params.option_id)
    if (option?.correct) return 'Correct!'
    return option?.explanation || 'Incorrect'
  },

  expand_curriculum_module: (config, params) => {
    const mod = (config.modules as any[])?.find((m: any) => m.id === params.module_id)
    return `Expanding module: ${mod?.title || params.module_id}`
  },
}

// Expected component type for each action
const ACTION_COMPONENT_TYPES: Record<string, string> = {}
for (const [type, descriptor] of Object.entries(COMPONENT_INTERACTIONS)) {
  for (const action of descriptor.actions) {
    ACTION_COMPONENT_TYPES[action.name] = type
  }
}

/**
 * Build all client tool handlers for the ElevenLabs voice conversation.
 * Widget mode gets all tools; panel mode should only use navigate_to_section.
 */
export function buildClientTools(
  findComponent: FindComponent,
  onUpdate: OnUpdate,
  onNavigate: OnNavigate,
): Record<string, (params: any) => string | Promise<string>> {
  const tools: Record<string, (params: any) => string | Promise<string>> = {}

  // Register all actions from the descriptor registry
  for (const [type, descriptor] of Object.entries(COMPONENT_INTERACTIONS)) {
    for (const action of descriptor.actions) {
      tools[action.name] = (params: any) => {
        const config = findComponent(params.component_id)
        if (!config || config.type !== type) return 'Component not found'

        const handler = ACTION_HANDLERS[action.name]
        if (!handler) return 'Unknown action'

        const updatedConfig = handler(config, params)
        if (updatedConfig) {
          onUpdate(params.component_id, updatedConfig)
        }

        const responder = ACTION_RESPONSES[action.name]
        return responder ? responder(config, params) : 'Done'
      }
    }
  }

  // Always include navigate
  tools.navigate_to_section = (params: any) => {
    onNavigate(params.component_id)
    return 'Navigated'
  }

  return tools
}
