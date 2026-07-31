import { useState, useEffect } from 'react'
import ReactMarkdown from 'react-markdown'
import {
  ChevronDown,
  ChevronRight,
  Clock,
  Loader2,
  CheckCircle,
  Lock,
  BookOpen,
} from 'lucide-react'
import { askExpert } from '../../lib/api'

interface CurriculumModule {
  id: string
  title: string
  description: string
  learningObjectives: string[]
  estimatedTime?: string
  prerequisites?: string[]
}

interface CurriculumConfig {
  id: string
  type: 'curriculum'
  title: string
  description: string
  modules: CurriculumModule[]
}

interface CurriculumProps {
  config: CurriculumConfig
  workspaceId: string
  onComplete?: (done: boolean) => void
  editMode?: boolean
  onConfigChange?: (config: CurriculumConfig) => void
}

const markdownComponents = {
  p: ({ children }: any) => <p className="mb-2 last:mb-0">{children}</p>,
  strong: ({ children }: any) => <strong className="font-semibold text-white">{children}</strong>,
  ul: ({ children }: any) => <ul className="list-disc list-inside mb-2 space-y-1">{children}</ul>,
  ol: ({ children }: any) => <ol className="list-decimal list-inside mb-2 space-y-1">{children}</ol>,
  li: ({ children }: any) => <li className="text-slate-300">{children}</li>,
  h3: ({ children }: any) => <h3 className="font-semibold text-white mt-3 mb-1">{children}</h3>,
  h4: ({ children }: any) => <h4 className="font-medium text-slate-200 mt-2 mb-1">{children}</h4>,
  code: ({ children, className }: any) => {
    const isBlock = className?.includes('language-')
    if (isBlock) {
      return <code className="block bg-slate-900 px-2 py-1.5 text-xs text-orange-300 overflow-x-auto mb-2">{children}</code>
    }
    return <code className="bg-slate-900 px-1 py-0.5 text-xs text-orange-300">{children}</code>
  },
}

function loadCachedContent(componentId: string): Record<string, string> {
  try {
    const raw = localStorage.getItem(`curriculum-${componentId}`)
    if (!raw) return {}
    return JSON.parse(raw)
  } catch {
    return {}
  }
}

function saveCachedContent(componentId: string, cache: Record<string, string>) {
  try {
    localStorage.setItem(`curriculum-${componentId}`, JSON.stringify(cache))
  } catch { /* quota exceeded */ }
}

export default function Curriculum({ config, workspaceId, onComplete, editMode, onConfigChange }: CurriculumProps) {
  const [expandedModules, setExpandedModules] = useState<Set<string>>(new Set())
  const [moduleContent, setModuleContent] = useState<Record<string, string>>(() => loadCachedContent(config.id))
  const [loadingModules, setLoadingModules] = useState<Set<string>>(new Set())

  const exploredCount = Object.keys(moduleContent).length
  const totalModules = config.modules.length

  useEffect(() => {
    if (exploredCount >= totalModules && totalModules > 0) {
      onComplete?.(true)
    }
  }, [exploredCount, totalModules])

  // Handle voice-triggered expansion via _expandModule signal
  useEffect(() => {
    const expandId = (config as any)._expandModule
    if (!expandId) return
    const mod = config.modules.find((m) => m.id === expandId)
    if (mod && !moduleContent[expandId] && !loadingModules.has(expandId)) {
      toggleModule(mod)
    }
  }, [(config as any)._expandModule])

  const isPrerequisiteMet = (mod: CurriculumModule): boolean => {
    if (!mod.prerequisites || mod.prerequisites.length === 0) return true
    return mod.prerequisites.every((preId) => moduleContent[preId] !== undefined)
  }

  const toggleModule = async (mod: CurriculumModule) => {
    if (expandedModules.has(mod.id)) {
      setExpandedModules((prev) => {
        const next = new Set(prev)
        next.delete(mod.id)
        return next
      })
      return
    }

    setExpandedModules((prev) => new Set(prev).add(mod.id))

    if (moduleContent[mod.id] || loadingModules.has(mod.id)) return

    setLoadingModules((prev) => new Set(prev).add(mod.id))

    try {
      const question = `Teach me about: ${mod.title}. ${mod.description}. Cover these learning objectives: ${mod.learningObjectives.join('; ')}. Provide detailed, practical content with examples where helpful.`
      const { answer } = await askExpert(workspaceId, question, undefined, `curriculum module: ${mod.title}`)

      setModuleContent((prev) => {
        const next = { ...prev, [mod.id]: answer }
        saveCachedContent(config.id, next)
        return next
      })
    } catch (err) {
      setModuleContent((prev) => {
        const next = { ...prev, [mod.id]: `*Failed to load content. Click to try again.*` }
        return next
      })
    } finally {
      setLoadingModules((prev) => {
        const next = new Set(prev)
        next.delete(mod.id)
        return next
      })
    }
  }

  const retryModule = (mod: CurriculumModule) => {
    setModuleContent((prev) => {
      const next = { ...prev }
      delete next[mod.id]
      saveCachedContent(config.id, next)
      return next
    })
    toggleModule(mod)
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div>
        <p className="text-sm text-slate-400">{config.description}</p>
        <div className="flex items-center gap-3 mt-2 text-xs text-slate-500">
          <span className="flex items-center gap-1">
            <BookOpen className="w-3.5 h-3.5" />
            {totalModules} modules
          </span>
          <span>
            {exploredCount} of {totalModules} explored
          </span>
        </div>
        {/* Progress bar */}
        <div className="h-1 bg-slate-700 mt-2 overflow-hidden">
          <div
            className="h-full bg-orange-500 transition-all duration-300"
            style={{ width: `${totalModules > 0 ? (exploredCount / totalModules) * 100 : 0}%` }}
          />
        </div>
      </div>

      {/* Module list */}
      <div className="space-y-2">
        {config.modules.map((mod, idx) => {
          const isExpanded = expandedModules.has(mod.id)
          const isLoading = loadingModules.has(mod.id)
          const content = moduleContent[mod.id]
          const hasContent = content !== undefined
          const prereqMet = isPrerequisiteMet(mod)
          const isFailed = content?.startsWith('*Failed')

          return (
            <div key={mod.id} className="border border-slate-700/50 bg-slate-800/20">
              <button
                onClick={() => prereqMet && toggleModule(mod)}
                disabled={!prereqMet}
                className={`w-full flex items-start gap-3 px-4 py-3 text-left transition-colors ${
                  prereqMet ? 'hover:bg-slate-700/30 cursor-pointer' : 'opacity-60 cursor-not-allowed'
                }`}
              >
                <div className="mt-0.5 shrink-0">
                  {!prereqMet ? (
                    <Lock className="w-4 h-4 text-slate-600" />
                  ) : hasContent && !isFailed ? (
                    <CheckCircle className="w-4 h-4 text-emerald-400" />
                  ) : isExpanded ? (
                    <ChevronDown className="w-4 h-4 text-slate-400" />
                  ) : (
                    <ChevronRight className="w-4 h-4 text-slate-400" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-slate-600 font-mono">{String(idx + 1).padStart(2, '0')}</span>
                    <span className="text-sm font-medium text-white">{mod.title}</span>
                  </div>
                  <p className="text-xs text-slate-500 mt-0.5">{mod.description}</p>
                  <div className="flex items-center gap-3 mt-1.5">
                    {mod.estimatedTime && (
                      <span className="flex items-center gap-1 text-xs text-slate-600">
                        <Clock className="w-3 h-3" />
                        {mod.estimatedTime}
                      </span>
                    )}
                    {mod.learningObjectives.length > 0 && (
                      <span className="text-xs text-slate-600">
                        {mod.learningObjectives.length} objective{mod.learningObjectives.length !== 1 ? 's' : ''}
                      </span>
                    )}
                  </div>
                </div>
                {isLoading && <Loader2 className="w-4 h-4 text-orange-400 animate-spin shrink-0 mt-0.5" />}
              </button>

              {isExpanded && (
                <div className="px-4 pb-4 border-t border-slate-700/30">
                  {/* Learning objectives */}
                  {mod.learningObjectives.length > 0 && (
                    <div className="pt-3 pb-2">
                      <p className="text-xs font-medium text-slate-500 mb-1">Learning objectives:</p>
                      <ul className="space-y-0.5">
                        {mod.learningObjectives.map((obj, i) => (
                          <li key={i} className="text-xs text-slate-400 flex items-start gap-1.5">
                            <span className="text-orange-400 mt-0.5 shrink-0">-</span>
                            {obj}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {/* Content */}
                  {isLoading && !content && (
                    <div className="flex items-center gap-2 text-slate-500 text-xs py-3">
                      <Loader2 className="w-3 h-3 animate-spin" />
                      Generating module content...
                    </div>
                  )}
                  {content && !isFailed && (
                    <div className="text-sm text-slate-200 leading-relaxed pt-2">
                      <ReactMarkdown components={markdownComponents}>{content}</ReactMarkdown>
                    </div>
                  )}
                  {isFailed && (
                    <div className="pt-2">
                      <button
                        onClick={() => retryModule(mod)}
                        className="text-xs text-orange-400 hover:text-orange-300 transition-colors"
                      >
                        Failed to load. Click to retry.
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
