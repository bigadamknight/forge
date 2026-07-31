// Interaction Registry
// Declares what each interactive surface (component, page, form) looks like,
// what actions the AI can perform, and how to summarize them for prompts.
// Pure TypeScript — no React dependencies.

// ---- Generalized Interaction Types ----

export type InteractionScope = 'component' | 'page' | 'form'

export interface InteractionActionDescriptor {
  name: string
  description: string
  params: Record<string, string>
}

export interface InteractionDescriptor {
  /** What kind of interactive surface this is */
  scope: InteractionScope
  /** Human-readable label for this interaction context */
  label: string
  /** Build a contextual update string for voice mode */
  summarize: (state: Record<string, any>) => string
  /** Available actions the AI can perform */
  actions: InteractionActionDescriptor[]
}

// ---- Component-specific types (convenience aliases) ----

export type ComponentActionDescriptor = InteractionActionDescriptor

export interface ComponentDescriptor {
  /** Build a contextual update string for voice mode */
  summarize: (config: Record<string, any>) => string
  /** Build a prompt-ready summary line for voice session setup */
  promptSummary: (config: Record<string, any>) => string
  /** Available actions for this component type */
  actions: ComponentActionDescriptor[]
}

// ---- Registry ----

export const COMPONENT_INTERACTIONS: Record<string, ComponentDescriptor> = {
  checklist: {
    summarize: (c) =>
      `Items: ${(c.items || []).map((i: any) =>
        `${i.id}="${i.text}" ${(c.checkedIds || []).includes(i.id) ? '[CHECKED]' : '[unchecked]'}`
      ).join(', ')}`,
    promptSummary: (c) =>
      `Items: ${(c.items || []).map((i: any) => `${i.id}="${i.text}"`).join(', ')}\n  Checked: [${(c.checkedIds || []).join(', ')}]`,
    actions: [{
      name: 'toggle_checklist_items',
      description: 'When the user mentions completing, checking off, or having done checklist items',
      params: { component_id: 'Component ID', item_ids: 'Comma-separated item IDs', checked: 'true/false' },
    }],
  },

  question_flow: {
    summarize: (c) =>
      `Questions: ${(c.questions || []).map((q: any) =>
        `${q.id}="${q.text}" (${q.inputType}${q.options ? ': ' + q.options.join('/') : ''})`
      ).join('; ')}`,
    promptSummary: (c) =>
      `Questions: ${(c.questions || []).map((q: any) =>
        `${q.id}="${q.text}" (${q.inputType}${q.options ? ': ' + q.options.join('/') : ''})`
      ).join('; ')}`,
    actions: [{
      name: 'answer_question',
      description: 'When the user answers a question in a question flow. For select questions, match their words to the closest option.',
      params: { component_id: 'Component ID', question_id: 'Question ID', answer: 'The answer text or selected option' },
    }],
  },

  decision_tree: {
    summarize: (c) =>
      `Nodes: ${(c.nodes || []).map((n: any) =>
        `${n.id}="${n.question}" [${(n.options || []).map((o: any, i: number) => `${i}:"${o.label}"`).join(', ')}]`
      ).join('; ')}`,
    promptSummary: (c) =>
      `Nodes: ${(c.nodes || []).map((n: any) =>
        `${n.id}="${n.question}" [${(n.options || []).map((o: any, i: number) => `${i}:"${o.label}"`).join(', ')}]`
      ).join('; ')}`,
    actions: [{
      name: 'select_decision_option',
      description: 'When the user chooses a path in a decision tree',
      params: { component_id: 'Component ID', node_id: 'Node ID', option_index: 'Zero-based option index' },
    }],
  },

  step_by_step: {
    summarize: (c) =>
      `Steps: ${(c.steps || []).map((s: any) =>
        `${s.id}="${s.title}" ${(c.completedSteps || []).includes(s.id) ? '[DONE]' : '[pending]'}`
      ).join(', ')}`,
    promptSummary: (c) =>
      `Steps: ${(c.steps || []).map((s: any) => `${s.id}="${s.title}"`).join(', ')}\n  Completed: [${(c.completedSteps || []).join(', ')}]`,
    actions: [{
      name: 'complete_step',
      description: "When the user says they've completed a step",
      params: { component_id: 'Component ID', step_id: 'Step ID', completed: 'true/false' },
    }],
  },

  calculator: {
    summarize: (c) =>
      `Inputs: ${(c.inputs || []).map((i: any) =>
        `${i.id}="${i.label}" (${i.type})`
      ).join(', ')}`,
    promptSummary: (c) =>
      `Inputs: ${(c.inputs || []).map((i: any) => `${i.id}="${i.label}" (${i.type})`).join(', ')}`,
    actions: [{
      name: 'set_calculator_value',
      description: 'When the user provides a number for a calculator input',
      params: { component_id: 'Component ID', input_id: 'Input ID', value: 'Numeric value' },
    }],
  },

  quiz: {
    summarize: (c) =>
      `Questions: ${(c.questions || []).map((q: any) =>
        `${q.id}="${q.text}" [${(q.options || []).map((o: any) => `${o.id}:"${o.text}"${o.correct ? '(correct)' : ''}`).join(', ')}]`
      ).join('; ')}`,
    promptSummary: (c) =>
      `Questions: ${(c.questions || []).map((q: any) =>
        `${q.id}="${q.text}" [${(q.options || []).map((o: any) => `${o.id}:"${o.text}"`).join(', ')}]`
      ).join('; ')}`,
    actions: [{
      name: 'answer_quiz',
      description: 'When the user answers a quiz question',
      params: { component_id: 'Component ID', question_id: 'Question ID', option_id: 'Selected option ID' },
    }],
  },

  curriculum: {
    summarize: (c) =>
      `Modules: ${(c.modules || []).map((m: any) =>
        `${m.id}="${m.title}" (${m.estimatedTime || 'no time est.'})`
      ).join(', ')}`,
    promptSummary: (c) =>
      `Modules: ${(c.modules || []).map((m: any) => `${m.id}="${m.title}"`).join(', ')}`,
    actions: [{
      name: 'expand_curriculum_module',
      description: 'When the user wants to explore a curriculum module. This loads detailed content for that module.',
      params: { component_id: 'Component ID', module_id: 'Module ID' },
    }],
  },

  info_card: {
    summarize: (c) =>
      `Variant: ${c.variant}. Content: ${c.content}${c.details ? ` Details: ${c.details}` : ''}`,
    promptSummary: () => '',
    actions: [],
  },

  custom: {
    summarize: (c) =>
      `Sections: ${(c.sections || []).map((s: any) =>
        `"${s.heading}" (${s.variant})${s.content ? `: ${s.content.slice(0, 100)}` : ''}${s.items ? `: ${s.items.slice(0, 5).join(', ')}` : ''}`
      ).join('; ')}`,
    promptSummary: () => '',
    actions: [],
  },

  task_board: {
    summarize: (c) =>
      `Tasks: ${(c.tasks || []).map((t: any) =>
        `"${t.text}" (${t.frequency})${t.category ? ` [${t.category}]` : ''}`
      ).join(', ')}`,
    promptSummary: () => '',
    actions: [],
  },
}

// ---- Prompt helpers (used by both client and server) ----

/** Build prompt-ready component summary for voice session setup */
export function buildComponentPromptSummary(layout: Array<Record<string, any>>): string {
  return layout.map((c) => {
    const base = `- ${c.id} (${c.type}): "${c.title}"`
    const descriptor = COMPONENT_INTERACTIONS[c.type as string]
    if (!descriptor) return base
    const detail = descriptor.promptSummary(c)
    return detail ? `${base}\n  ${detail}` : base
  }).join('\n')
}

/** Build tool usage rules for the AI prompt, derived from action descriptors */
export function buildToolUsageRules(domain?: string): string {
  const rules: string[] = []

  for (const [, descriptor] of Object.entries(COMPONENT_INTERACTIONS)) {
    for (const action of descriptor.actions) {
      const paramList = Object.entries(action.params)
        .map(([k, v]) => `${k} (${v})`)
        .join(', ')
      rules.push(`- ${action.description}, call ${action.name}. Params: ${paramList}.`)
    }
  }

  rules.push('- When a section feels complete or the user wants to move on, call navigate_to_section.')
  rules.push(`- For general questions about ${domain || 'the topic'}, just answer conversationally using expert knowledge.`)
  rules.push('- Always use the exact component IDs and item/question/step IDs from the listing above.')
  rules.push('- After calling a tool, briefly confirm what you updated.')

  return rules.join('\n')
}

/** Get contextual update string for a component (used in voice mode) */
export function getComponentSummary(config: Record<string, any>): string {
  const descriptor = COMPONENT_INTERACTIONS[config.type as string]
  if (!descriptor) return ''
  return descriptor.summarize(config)
}

/** Get all registered action names */
export function getRegisteredActionNames(): string[] {
  const names: string[] = []
  for (const descriptor of Object.values(COMPONENT_INTERACTIONS)) {
    for (const action of descriptor.actions) {
      names.push(action.name)
    }
  }
  names.push('navigate_to_section')
  return names
}
