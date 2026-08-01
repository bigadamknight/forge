import { Flag } from 'lucide-react'

interface CheckpointCardProps {
  onContinue: () => void
}

export default function CheckpointCard({ onContinue }: CheckpointCardProps) {
  return (
    <div className="bg-slate-800 border border-orange-500/40 p-8 text-center">
      <Flag className="w-8 h-8 text-orange-400 mx-auto mb-3" />
      <h2 className="text-lg font-semibold text-white mb-2">Milestone checkpoint</h2>
      <p className="text-sm text-slate-400 mb-6">Nice work — you've completed this milestone.</p>
      <button
        onClick={onContinue}
        className="px-8 py-3 bg-orange-600 hover:bg-orange-700 transition-colors font-medium text-white"
      >
        Keep going
      </button>
    </div>
  )
}
