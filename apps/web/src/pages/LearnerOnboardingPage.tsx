import { useParams } from 'react-router-dom'
import { GraduationCap, Loader2 } from 'lucide-react'
import { useLearnerProfile } from '../hooks/useLearnerProfile'
import { GoalPicker, TimePicker, FocusPicker } from '../components/learn/OnboardingPickers'

export default function LearnerOnboardingPage() {
  const { workspaceId } = useParams<{ workspaceId: string }>()
  const {
    goal, setGoal,
    dailyMinutes, setDailyMinutes,
    focusAreas, handleToggleFocusArea,
    preferenceText, setPreferenceText,
    availableFocusAreas, knowledgeCount,
    planning, planStatus, error,
    handleStart,
  } = useLearnerProfile(workspaceId!)

  return (
    <div className="min-h-screen flex items-center justify-center py-12">
      <div className="w-full max-w-2xl px-6">
        <div className="flex items-center gap-3 justify-center mb-2">
          <GraduationCap className="w-8 h-8 text-orange-400" />
          <h1 className="text-2xl font-bold text-white">Your learning, your way</h1>
        </div>
        <p className="text-center text-sm text-slate-400 mb-10">
          Customize your path based on your goals and schedule.
          {knowledgeCount !== null && ` Built from ${knowledgeCount} pieces of expert knowledge.`}
        </p>

        <div className="space-y-8">
          <section>
            <h2 className="text-sm font-medium text-slate-300 mb-3">What's your goal?</h2>
            <GoalPicker value={goal} onChange={setGoal} />
          </section>

          <section>
            <h2 className="text-sm font-medium text-slate-300 mb-3">How much time can you commit?</h2>
            <TimePicker value={dailyMinutes} onChange={setDailyMinutes} />
          </section>

          {availableFocusAreas.length > 0 && (
            <section>
              <h2 className="text-sm font-medium text-slate-300 mb-3">
                What do you want to focus on? <span className="text-slate-500 font-normal">(select any)</span>
              </h2>
              <FocusPicker
                options={availableFocusAreas}
                selected={focusAreas}
                onToggle={handleToggleFocusArea}
              />
            </section>
          )}

          <section>
            <h2 className="text-sm font-medium text-slate-300 mb-3">
              How do you learn best? <span className="text-slate-500 font-normal">(optional)</span>
            </h2>
            <input
              type="text"
              value={preferenceText}
              onChange={(e) => setPreferenceText(e.target.value)}
              placeholder='e.g. "Explain with football analogies" or "Always give me a TLDR first"'
              className="w-full px-4 py-3 bg-slate-800 border border-slate-700 text-white placeholder-slate-500 focus:border-orange-500/50 focus:outline-none transition-colors text-sm"
            />
          </section>

          {error && <p className="text-red-400 text-sm">{error}</p>}

          <button
            onClick={handleStart}
            disabled={planning}
            className="w-full flex items-center justify-center gap-2 px-6 py-3 bg-orange-600 hover:bg-orange-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors font-medium text-white"
          >
            {planning ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                {planStatus || 'Designing your path...'}
              </>
            ) : (
              'Start Learning'
            )}
          </button>
        </div>
      </div>
    </div>
  )
}
