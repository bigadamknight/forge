// Page-level interaction descriptors
// Each page registers one of these via useRegisterInteraction()

import type { InteractionDescriptor } from '@forge/shared'

export const HOME_PAGE: InteractionDescriptor = {
  scope: 'page',
  label: 'Home',
  summarize: (state) => {
    const count = state.workspaceCount ?? 0
    return `Workspace list. ${count} workspace${count !== 1 ? 's' : ''}.${state.isLoading ? ' Loading...' : ''}`
  },
  actions: [],
}

export const NEW_WORKSPACE_PAGE: InteractionDescriptor = {
  scope: 'page',
  label: 'New Workspace',
  summarize: (state) => {
    if (state.creating) return 'Creating workspace...'
    return `New workspace form.${state.title ? ` Title: "${state.title}"` : ' Title empty.'}`
  },
  actions: [],
}

export const INTERVIEW_PAGE_INTRO: InteractionDescriptor = {
  scope: 'page',
  label: 'Expert Intro',
  summarize: (state) => {
    const parts = [`Expert intro conversation. Mode: ${state.mode || 'choosing'}.`]
    if (state.expertName) parts.push(`Expert: ${state.expertName}.`)
    if (state.profileFieldCount) parts.push(`${state.profileFieldCount} profile fields captured.`)
    if (state.profileReady) parts.push('Profile complete, ready to plan interview.')
    return parts.join(' ')
  },
  actions: [],
}

export const INTERVIEW_PAGE_ACTIVE: InteractionDescriptor = {
  scope: 'page',
  label: 'Interview',
  summarize: (state) => {
    const parts = [`Interview in progress. Mode: ${state.mode || 'choosing'}.`]
    if (state.expertName) parts.push(`Expert: ${state.expertName}.`)
    if (state.currentSection) parts.push(`Section: "${state.currentSection}".`)
    if (state.currentQuestion) parts.push(`Question: "${state.currentQuestion}".`)
    if (state.extractionCount) parts.push(`${state.extractionCount} extractions so far.`)
    if (state.interviewComplete) parts.push('Interview complete.')
    return parts.join(' ')
  },
  actions: [],
}

export const DOCUMENT_UPLOAD_PAGE: InteractionDescriptor = {
  scope: 'form',
  label: 'Document Upload',
  summarize: (state) => {
    const parts = [`Document upload form. Input mode: ${state.inputMode || 'text'}.`]
    if (state.documentCount) parts.push(`${state.documentCount} document${state.documentCount !== 1 ? 's' : ''} added.`)
    if (state.title) parts.push(`Current title: "${state.title}".`)
    return parts.join(' ')
  },
  actions: [],
}

export const WORKSPACE_PAGE_EARLY: InteractionDescriptor = {
  scope: 'page',
  label: 'Workspace Setup',
  summarize: (state) => {
    const parts = [`Workspace setup. Profile status: ${state.profileStatus || 'not_started'}.`]
    if (state.activePanel) parts.push(`Active panel: ${state.activePanel}.`)
    if (state.documentCount) parts.push(`${state.documentCount} documents.`)
    if (state.extractionCount) parts.push(`${state.extractionCount} knowledge extractions.`)
    return parts.join(' ')
  },
  actions: [],
}

export const WORKSPACE_PAGE_TOOL: InteractionDescriptor = {
  scope: 'page',
  label: 'Workspace',
  summarize: (state) => {
    const parts = [`Workspace with tool: "${state.toolTitle || 'Untitled'}".`]
    if (state.activePanel) parts.push(`Active panel: ${state.activePanel}.`)
    if (state.activeComponentTitle) parts.push(`Viewing: "${state.activeComponentTitle}".`)
    if (state.overallProgress !== undefined) parts.push(`Progress: ${state.overallProgress}%.`)
    if (state.tabCount) parts.push(`${state.tabCount} sections.`)
    return parts.join(' ')
  },
  actions: [],
}

export const TOOL_USER_PAGE: InteractionDescriptor = {
  scope: 'page',
  label: 'Tool User',
  summarize: (state) => {
    const parts = [`Using tool: "${state.toolTitle || 'Untitled'}".`]
    if (state.activePanel) parts.push(`Active panel: ${state.activePanel}.`)
    if (state.activeComponentTitle) parts.push(`Viewing: "${state.activeComponentTitle}".`)
    if (state.overallProgress !== undefined) parts.push(`Progress: ${state.overallProgress}%.`)
    return parts.join(' ')
  },
  actions: [],
}
