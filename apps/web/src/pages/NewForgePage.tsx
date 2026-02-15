import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, Flame, Sparkles, Zap, Clock, BookOpen } from 'lucide-react'
import { Link } from 'react-router-dom'
import { usePlanningAnimation } from '../hooks/usePlanningAnimation'
import InterviewPlanningAnimation from '../components/InterviewPlanningAnimation'
import DevTools from '../components/DevTools'
import { DEPTH_PRESETS, type InterviewDepth } from '@forge/shared'

const DEPTH_ICONS = {
  quick: Zap,
  standard: Clock,
  deep: BookOpen,
} as const

export default function NewForgePage() {
  const navigate = useNavigate()
  const [expertName, setExpertName] = useState('')
  const [domain, setDomain] = useState('')
  const [expertBio, setExpertBio] = useState('')
  const [targetAudience, setTargetAudience] = useState('')
  const [depth, setDepth] = useState<InterviewDepth>('standard')

  const { state, handleStart, handleRetry } = usePlanningAnimation((forgeId) => {
    navigate(`/forge/${forgeId}/interview`)
  })

  const canSubmit = expertName.trim() && domain.trim() && expertBio.trim()
  const isPlanning = state.stage !== 'form'

  return (
    <div className="max-w-2xl mx-auto p-8">
      <Link to="/" className="flex items-center gap-2 text-slate-400 hover:text-white mb-8 transition-colors">
        <ArrowLeft className="w-4 h-4" />
        Back
      </Link>

      <div className="flex items-center gap-3 mb-8">
        <div className="p-2 bg-orange-500/20 ">
          <Flame className="w-6 h-6 text-orange-400" />
        </div>
        <div>
          <h1 className="text-2xl font-bold">New Forge</h1>
          <p className="text-slate-400 text-sm">Tell us about yourself and your expertise</p>
        </div>
      </div>

      <DevTools actions={[
        {
          label: 'Quick: Bilbo',
          fn: () => {
            setExpertName('Bilbo Baggins')
            setDomain('Destroying powerful jewellery')
            setExpertBio('Former ring-bearer with extensive experience in the disposal of cursed artefacts. Successfully led a fellowship-supported mission to destroy the One Ring in Mount Doom. Decades of firsthand knowledge in resisting magical corruption, navigating hostile territories, and working with cross-species teams.')
            setTargetAudience('Adventurers who find themselves unexpectedly responsible for dangerous magical items')
            setDepth('quick')
          },
        },
        {
          label: 'Standard: Samwise',
          fn: () => {
            setExpertName('Samwise Gamgee')
            setDomain('Growing food in challenging conditions')
            setExpertBio('Master gardener of the Shire with decades of experience cultivating crops in varied climates and difficult soil. Maintained productive gardens through drought, war, and magical corruption of the land. Expert in seed selection, composting, crop rotation, and feeding communities from small plots. Successfully restored the Shire after Saruman\'s industrialisation.')
            setTargetAudience('Smallholders and community gardeners wanting to maximise yield from limited space')
            setDepth('standard')
          },
        },
        {
          label: 'Deep: Gandalf',
          fn: () => {
            setExpertName('Gandalf the Grey')
            setDomain('Leading large-scale strategic coalitions')
            setExpertBio('Several thousand years of experience coordinating diverse factions toward common goals. Led the White Council, orchestrated the Quest of Erebor, and assembled the Fellowship of the Ring. Deep expertise in stakeholder management across races with conflicting interests, crisis leadership under existential threat, intelligence gathering, and knowing when to delegate versus intervene directly. Particular strength in identifying and developing unlikely leaders.')
            setTargetAudience('Senior leaders managing complex multi-stakeholder initiatives with high stakes and limited resources')
            setDepth('deep')
          },
        },
      ]} />

      {isPlanning ? (
        <InterviewPlanningAnimation state={state} onRetry={handleRetry} />
      ) : (
        <div className="space-y-6">
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">Your Name</label>
            <input
              type="text"
              value={expertName}
              onChange={(e) => setExpertName(e.target.value)}
              className="w-full px-4 py-3 bg-slate-800  border border-slate-700 focus:border-orange-500 focus:outline-none transition-colors"
              placeholder="e.g. Sarah Thompson"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">Your Area of Expertise</label>
            <input
              type="text"
              value={domain}
              onChange={(e) => setDomain(e.target.value)}
              className="w-full px-4 py-3 bg-slate-800  border border-slate-700 focus:border-orange-500 focus:outline-none transition-colors"
              placeholder="e.g. Running a community food bank"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">
              Brief Introduction
              <span className="text-slate-500 font-normal ml-2">Who are you, what do you know, and what do you want to share?</span>
            </label>
            <textarea
              value={expertBio}
              onChange={(e) => setExpertBio(e.target.value)}
              rows={4}
              className="w-full px-4 py-3 bg-slate-800  border border-slate-700 focus:border-orange-500 focus:outline-none transition-colors resize-none"
              placeholder="e.g. I've run a community food bank for 15 years, serving 500 families a week. I want to help other communities start their own food bank by sharing the operational knowledge I've built up."
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">
              Who is this tool for?
              <span className="text-slate-500 font-normal ml-2">(optional)</span>
            </label>
            <input
              type="text"
              value={targetAudience}
              onChange={(e) => setTargetAudience(e.target.value)}
              className="w-full px-4 py-3 bg-slate-800  border border-slate-700 focus:border-orange-500 focus:outline-none transition-colors"
              placeholder="e.g. Community organisers wanting to start a food bank"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-300 mb-3">Interview Depth</label>
            <div className="grid grid-cols-3 gap-3">
              {(Object.keys(DEPTH_PRESETS) as InterviewDepth[]).map((key) => {
                const preset = DEPTH_PRESETS[key]
                const Icon = DEPTH_ICONS[key]
                const isSelected = depth === key
                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setDepth(key)}
                    className={`p-4 border text-left transition-colors ${
                      isSelected
                        ? 'border-orange-500 bg-orange-500/10'
                        : 'border-slate-700 bg-slate-800 hover:border-slate-600'
                    }`}
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <Icon className={`w-4 h-4 ${isSelected ? 'text-orange-400' : 'text-slate-400'}`} />
                      <span className={`text-sm font-medium ${isSelected ? 'text-orange-300' : 'text-slate-300'}`}>
                        {preset.label}
                      </span>
                    </div>
                    <p className="text-xs text-slate-500">~{preset.estimatedMinutes} min</p>
                    <p className="text-xs text-slate-500 mt-1">{preset.description}</p>
                  </button>
                )
              })}
            </div>
          </div>

          <button
            onClick={() => handleStart({ expertName, domain, expertBio, targetAudience, depth })}
            disabled={!canSubmit}
            className="w-full flex items-center justify-center gap-2 px-6 py-3 bg-orange-600 hover:bg-orange-700 disabled:opacity-50 disabled:cursor-not-allowed  transition-colors font-medium text-lg"
          >
            <Sparkles className="w-5 h-5" />
            Design My Interview
          </button>
        </div>
      )}
    </div>
  )
}
