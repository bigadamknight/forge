import { CheckCircle, XCircle } from 'lucide-react'

interface FeedbackPanelProps {
  correct: boolean
  explanation: string
  onNext: () => void
}

export default function FeedbackPanel({ correct, explanation, onNext }: FeedbackPanelProps) {
  return (
    <div className={`mt-4 p-4 border ${correct ? 'border-emerald-600 bg-emerald-500/10' : 'border-red-600 bg-red-500/10'}`}>
      <div className="flex items-center gap-2 mb-2">
        {correct ? (
          <>
            <CheckCircle className="w-5 h-5 text-emerald-400" />
            <span className="font-medium text-emerald-300 text-sm">Correct</span>
          </>
        ) : (
          <>
            <XCircle className="w-5 h-5 text-red-400" />
            <span className="font-medium text-red-300 text-sm">Not quite</span>
          </>
        )}
      </div>
      <p className="text-sm text-slate-300 mb-4">{explanation}</p>
      <button
        onClick={onNext}
        className="w-full px-6 py-2.5 bg-orange-600 hover:bg-orange-700 transition-colors font-medium text-white text-sm"
      >
        Next
      </button>
    </div>
  )
}
