// Interaction Context — runtime registry for page/form interactions
// Components use the static COMPONENT_INTERACTIONS registry.
// Pages and forms register dynamically via useRegisterInteraction().

import { createContext, useContext, useCallback, useEffect, useRef, useSyncExternalStore } from 'react'
import type { InteractionDescriptor } from '@forge/shared'

// ---- Types ----

export interface RegisteredInteraction {
  id: string
  descriptor: InteractionDescriptor
  /** Current state snapshot for summarize() */
  state: Record<string, any>
  /** Optional action handlers (client-side only) */
  handlers?: Record<string, (params: any) => string | Promise<string>>
}

interface InteractionStore {
  interactions: Map<string, RegisteredInteraction>
  subscribe: (cb: () => void) => () => void
  getSnapshot: () => Map<string, RegisteredInteraction>
  register: (id: string, interaction: Omit<RegisteredInteraction, 'id'>) => void
  unregister: (id: string) => void
  updateState: (id: string, state: Record<string, any>) => void
}

function createInteractionStore(): InteractionStore {
  let interactions = new Map<string, RegisteredInteraction>()
  const listeners = new Set<() => void>()

  function notify() {
    // Create new Map reference so useSyncExternalStore detects the change
    interactions = new Map(interactions)
    for (const cb of listeners) cb()
  }

  return {
    get interactions() { return interactions },
    subscribe: (cb) => {
      listeners.add(cb)
      return () => listeners.delete(cb)
    },
    getSnapshot: () => interactions,
    register: (id, interaction) => {
      interactions.set(id, { id, ...interaction })
      notify()
    },
    unregister: (id) => {
      if (interactions.delete(id)) notify()
    },
    updateState: (id, state) => {
      const existing = interactions.get(id)
      if (existing) {
        interactions.set(id, { ...existing, state })
        notify()
      }
    },
  }
}

// ---- Context ----

const InteractionCtx = createContext<InteractionStore | null>(null)

export function InteractionProvider({ children }: { children: React.ReactNode }) {
  const storeRef = useRef<InteractionStore>()
  if (!storeRef.current) {
    storeRef.current = createInteractionStore()
  }
  return (
    <InteractionCtx.Provider value={storeRef.current}>
      {children}
    </InteractionCtx.Provider>
  )
}

function useStore(): InteractionStore {
  const store = useContext(InteractionCtx)
  if (!store) throw new Error('useInteractionContext must be used within InteractionProvider')
  return store
}

// ---- Hooks ----

/**
 * Read all registered interactions. Re-renders when registrations change.
 */
export function useInteractionContext(): Map<string, RegisteredInteraction> {
  const store = useStore()
  return useSyncExternalStore(store.subscribe, store.getSnapshot)
}

/**
 * Register a page/form interaction. Cleans up on unmount.
 * Call updateState() when local state changes to keep the summary current.
 */
export function useRegisterInteraction(
  id: string,
  descriptor: InteractionDescriptor,
  initialState: Record<string, any> = {},
  handlers?: Record<string, (params: any) => string | Promise<string>>,
) {
  const store = useStore()
  const registeredRef = useRef(false)

  // Register on first render (not in useEffect to avoid flash)
  if (!registeredRef.current) {
    store.register(id, { descriptor, state: initialState, handlers })
    registeredRef.current = true
  }

  const updateState = useCallback((state: Record<string, any>) => {
    store.updateState(id, state)
  }, [store, id])

  // Cleanup on unmount
  const idRef = useRef(id)
  idRef.current = id
  const storeRef = useRef(store)
  storeRef.current = store

  useEffect(() => {
    return () => storeRef.current.unregister(idRef.current)
  }, [])

  return { updateState }
}

/**
 * Build a contextual update string from all registered page interactions.
 * Useful for sending to the voice agent alongside component context.
 */
export function buildPageContextSummary(interactions: Map<string, RegisteredInteraction>): string {
  const parts: string[] = []
  for (const [, interaction] of interactions) {
    if (interaction.descriptor.scope === 'page' || interaction.descriptor.scope === 'form') {
      const summary = interaction.descriptor.summarize(interaction.state)
      if (summary) {
        parts.push(`[${interaction.descriptor.label}] ${summary}`)
      }
    }
  }
  return parts.join('\n')
}
