import { useRef, useEffect } from 'react'
import gsap from 'gsap'
import { AlertCircle, Check, RefreshCw } from 'lucide-react'
import ScatteredText from './ScatteredText'
import type { PlanningState } from '../hooks/usePlanningAnimation'

const PLANNING_PHRASES = [
  'Analysing your expertise',
  'Mapping knowledge areas',
  'Designing interview structure',
  'Identifying key topics',
  'Crafting the right questions',
]

interface Props {
  state: PlanningState
  onRetry: () => void
}

export default function InterviewPlanningAnimation({ state, onRetry }: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const contextRef = useRef<HTMLDivElement>(null)
  const sectionsRef = useRef<HTMLDivElement>(null)
  const completeRef = useRef<HTMLDivElement>(null)

  // Kill orb and animate domain context + section cards when skeleton arrives
  const sectionsVisible = state.stage === 'sections' || state.stage === 'questions' || state.stage === 'saving' || state.stage === 'complete'
  const didAnimateSections = useRef(false)

  useEffect(() => {
    if (!sectionsVisible || didAnimateSections.current) return
    if (!sectionsRef.current) return
    didAnimateSections.current = true

    // Fade in domain context
    if (contextRef.current) {
      gsap.fromTo(contextRef.current, { opacity: 0, y: 20 }, { opacity: 1, y: 0, duration: 0.5, ease: 'power2.out' })
    }

    // Stagger section cards
    const cards = sectionsRef.current.querySelectorAll('[data-section-card]')
    gsap.fromTo(
      cards,
      { opacity: 0, y: 40 },
      { opacity: 1, y: 0, duration: 0.4, stagger: 0.15, ease: 'power2.out', delay: 0.3 }
    )
  }, [sectionsVisible])

  // Animate questions as they arrive (per section)
  useEffect(() => {
    if (!sectionsRef.current) return

    for (const section of state.sections) {
      if (!section.questionsReady) continue
      const sectionEl = sectionsRef.current.querySelector(`[data-section="${section.index}"]`)
      if (!sectionEl || sectionEl.getAttribute('data-animated') === 'true') continue

      sectionEl.setAttribute('data-animated', 'true')

      // Fade out shimmer
      const shimmer = sectionEl.querySelector('[data-shimmer]')
      if (shimmer) {
        gsap.to(shimmer, { opacity: 0, height: 0, duration: 0.3, ease: 'power2.in' })
      }

      // Cascade questions in
      const questionEls = sectionEl.querySelectorAll('[data-question]')
      gsap.fromTo(
        questionEls,
        { opacity: 0, x: -20 },
        { opacity: 1, x: 0, duration: 0.3, stagger: 0.1, ease: 'power2.out', delay: 0.2 }
      )

      // Check icon on section header
      const checkIcon = sectionEl.querySelector('[data-check]')
      if (checkIcon) {
        gsap.fromTo(checkIcon, { scale: 0 }, { scale: 1, duration: 0.4, ease: 'back.out(2)', delay: 0.4 })
      }
    }
  }, [state.sections])

  // Complete animation
  useEffect(() => {
    if (state.stage !== 'complete') return

    if (completeRef.current) {
      gsap.fromTo(completeRef.current, { scale: 0, opacity: 0 }, { scale: 1, opacity: 1, duration: 0.5, ease: 'back.out(2)' })
    }

    // Subtle pulse on all section cards
    if (sectionsRef.current) {
      const cards = sectionsRef.current.querySelectorAll('[data-section-card]')
      gsap.to(cards, {
        boxShadow: '0 0 20px rgba(249, 115, 22, 0.15)',
        duration: 0.6,
        yoyo: true,
        repeat: 1,
      })
    }

    // Fade out container before navigation
    if (containerRef.current) {
      gsap.to(containerRef.current, { opacity: 0, y: -10, duration: 0.4, delay: 0.8 })
    }
  }, [state.stage])

  // Error stage
  if (state.stage === 'error') {
    return (
      <div className="text-center py-16">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-red-500/20 mb-4">
          <AlertCircle className="w-8 h-8 text-red-400" />
        </div>
        <p className="text-lg text-white mb-2">Something went wrong</p>
        <p className="text-slate-400 text-sm mb-6 max-w-md mx-auto">{state.errorMessage}</p>
        <button
          onClick={onRetry}
          className="inline-flex items-center gap-2 px-5 py-2.5 bg-slate-800 hover:bg-slate-700 border border-slate-600 transition-colors text-sm"
        >
          <RefreshCw className="w-4 h-4" />
          Try Again
        </button>
      </div>
    )
  }

  // Creating / Analysing - scattered text stage
  if (state.stage === 'creating' || state.stage === 'analysing') {
    return (
      <div className="fixed inset-0 flex flex-col items-center justify-center z-10">
        <ScatteredText
          phrases={PLANNING_PHRASES}
          className="text-5xl md:text-7xl font-semibold text-orange-400 mb-6 min-h-[4rem]"
        />
        <p className="text-slate-500 text-sm">
          {state.stage === 'creating' ? 'Preparing workspace' : 'This takes a moment'}
        </p>
      </div>
    )
  }

  // Sections / Questions / Saving / Complete
  return (
    <div ref={containerRef} className="space-y-6">
      {/* Domain context */}
      {state.domainContext && (
        <div ref={contextRef} className="border-l-2 border-orange-500 pl-4 py-2 opacity-0">
          <p className="text-slate-300 italic text-sm">{state.domainContext}</p>
          {state.extractionPriorities.length > 0 && (
            <div className="flex flex-wrap gap-2 mt-2">
              {state.extractionPriorities.map((p) => (
                <span key={p} className="px-2 py-0.5 bg-slate-800 border border-slate-700 text-xs text-slate-400">
                  {p}
                </span>
              ))}
            </div>
          )}
          {state.estimatedDuration && (
            <p className="text-xs text-slate-500 mt-2">Estimated duration: ~{state.estimatedDuration} minutes</p>
          )}
        </div>
      )}

      {/* Section cards */}
      <div ref={sectionsRef} className="space-y-4">
        {state.sections.map((section) => (
          <div
            key={section.index}
            data-section-card
            data-section={section.index}
            className="bg-slate-800/50 border border-slate-700 p-4 opacity-0"
          >
            {/* Section header */}
            <div className="flex items-center gap-3 mb-2">
              <span className="flex items-center justify-center w-7 h-7 bg-orange-500/20 text-orange-400 text-sm font-semibold shrink-0">
                {section.index + 1}
              </span>
              <div className="flex-1 min-w-0">
                <h3 className="text-white font-medium truncate">{section.title}</h3>
                <p className="text-slate-400 text-xs truncate">{section.goal}</p>
              </div>
              {section.questionsReady && (
                <div data-check className="shrink-0" style={{ transform: 'scale(0)' }}>
                  <Check className="w-5 h-5 text-green-400" />
                </div>
              )}
            </div>

            {/* Shimmer placeholder or questions */}
            {!section.questionsReady ? (
              <div data-shimmer className="space-y-2 mt-3">
                {[0, 1, 2].map((i) => (
                  <div
                    key={i}
                    className="h-3 rounded bg-gradient-to-r from-slate-800 via-slate-700 to-slate-800"
                    style={{
                      backgroundSize: '200% 100%',
                      animation: `shimmer 1.5s ease-in-out infinite ${i * 0.2}s`,
                      width: `${85 - i * 15}%`,
                    }}
                  />
                ))}
              </div>
            ) : (
              <div className="space-y-2 mt-3">
                {section.questions.map((q, qi) => (
                  <div
                    key={qi}
                    data-question
                    className="flex items-start gap-2 text-sm opacity-0"
                  >
                    <span className="text-slate-600 mt-1 shrink-0">&#8226;</span>
                    <span className="text-slate-300">{q.text}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Progress indicator */}
      {(state.stage === 'questions' || state.stage === 'saving') && state.sections.length > 0 && (
        <div className="flex items-center justify-center gap-2 text-sm text-slate-400">
          <div className="w-32 h-1 bg-slate-800 overflow-hidden">
            <div
              className="h-full bg-orange-500 transition-all duration-500 ease-out"
              style={{ width: `${(state.sectionsWithQuestions / state.sections.length) * 100}%` }}
            />
          </div>
          <span>{state.sectionsWithQuestions}/{state.sections.length} sections</span>
        </div>
      )}

      {/* Complete badge */}
      {state.stage === 'complete' && (
        <div ref={completeRef} className="flex items-center justify-center gap-2 py-4 opacity-0" style={{ transform: 'scale(0)' }}>
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-green-500/20 border border-green-500/30 text-green-400 font-medium">
            <Check className="w-5 h-5" />
            Interview plan ready
          </div>
        </div>
      )}
    </div>
  )
}
