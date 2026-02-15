import { useState, useRef, useCallback } from 'react'
import { createForge, planInterviewStream, type PlanInterviewEvent } from '../lib/api'

export type PlanningStage = 'form' | 'creating' | 'analysing' | 'sections' | 'questions' | 'saving' | 'complete' | 'error'

export interface PlanningSection {
  index: number
  title: string
  goal: string
  questions: Array<{ text: string; goal: string }>
  questionsReady: boolean
}

export interface PlanningState {
  stage: PlanningStage
  domainContext: string | null
  extractionPriorities: string[]
  estimatedDuration: number | null
  sections: PlanningSection[]
  forgeId: string | null
  errorMessage: string | null
  sectionsWithQuestions: number
}

const INITIAL_STATE: PlanningState = {
  stage: 'form',
  domainContext: null,
  extractionPriorities: [],
  estimatedDuration: null,
  sections: [],
  forgeId: null,
  errorMessage: null,
  sectionsWithQuestions: 0,
}

interface FormData {
  expertName: string
  domain: string
  expertBio: string
  targetAudience: string
  depth: string
}

export function usePlanningAnimation(onComplete: (forgeId: string) => void) {
  const [state, setState] = useState<PlanningState>(INITIAL_STATE)
  const abortRef = useRef<AbortController | null>(null)

  const handleEvent = useCallback((event: PlanInterviewEvent) => {
    switch (event.type) {
      case 'analysing':
        setState((s) => ({ ...s, stage: 'analysing' }))
        break

      case 'skeleton':
        setState((s) => ({
          ...s,
          stage: 'sections',
          domainContext: event.domainContext,
          extractionPriorities: event.extractionPriorities,
          estimatedDuration: event.estimatedDurationMinutes,
          sections: event.sections.map((sec) => ({
            index: sec.index,
            title: sec.title,
            goal: sec.goal,
            questions: [],
            questionsReady: false,
          })),
        }))
        break

      case 'questions':
        setState((s) => {
          const sections = s.sections.map((sec) =>
            sec.index === event.sectionIndex
              ? { ...sec, questions: event.questions, questionsReady: true }
              : sec
          )
          const readyCount = sections.filter((sec) => sec.questionsReady).length
          const allReady = readyCount === sections.length
          return {
            ...s,
            stage: allReady ? 'saving' : 'questions',
            sections,
            sectionsWithQuestions: readyCount,
          }
        })
        break

      case 'complete':
        setState((s) => ({ ...s, stage: 'complete', forgeId: event.forgeId }))
        break

      case 'error':
        setState((s) => ({ ...s, stage: 'error', errorMessage: event.message }))
        break
    }
  }, [])

  const handleStart = useCallback(async (formData: FormData) => {
    setState({ ...INITIAL_STATE, stage: 'creating' })

    try {
      const forge = await createForge({
        title: `${formData.domain} - ${formData.expertName}`,
        expertName: formData.expertName,
        expertBio: formData.expertBio,
        domain: formData.domain,
        targetAudience: formData.targetAudience,
        depth: formData.depth,
      })

      abortRef.current = planInterviewStream(
        forge.id,
        handleEvent,
        () => {
          // SSE stream done - trigger navigation after animation delay
          setState((s) => {
            if (s.stage === 'complete' && s.forgeId) {
              setTimeout(() => onComplete(s.forgeId!), 1200)
            }
            return s
          })
        },
        (error) => {
          setState((s) => ({ ...s, stage: 'error', errorMessage: error }))
        }
      )
    } catch (err) {
      setState((s) => ({
        ...s,
        stage: 'error',
        errorMessage: err instanceof Error ? err.message : 'Failed to create forge',
      }))
    }
  }, [handleEvent, onComplete])

  const handleRetry = useCallback(() => {
    if (abortRef.current) {
      abortRef.current.abort()
      abortRef.current = null
    }
    setState(INITIAL_STATE)
  }, [])

  return { state, handleStart, handleRetry }
}
