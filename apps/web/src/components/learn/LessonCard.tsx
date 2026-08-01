import ReactMarkdown from 'react-markdown'
import { BookOpen, Quote } from 'lucide-react'
import type { LessonCardContent } from '@forge/shared'

interface LessonCardProps {
  content: LessonCardContent
  onContinue: () => void
}

export default function LessonCard({ content, onContinue }: LessonCardProps) {
  return (
    <div className="bg-slate-800 border border-slate-700 p-6">
      <div className="flex items-center gap-2 mb-4">
        <BookOpen className="w-5 h-5 text-orange-400" />
        <h2 className="text-lg font-semibold text-white">{content.concept}</h2>
      </div>

      <div className="text-slate-300 text-sm leading-relaxed mb-4 prose-invert">
        <ReactMarkdown>{content.body}</ReactMarkdown>
      </div>

      {content.variant === 'comparison' && content.comparison && (
        <div className="grid grid-cols-2 gap-3 mb-4">
          {[
            { title: content.comparison.leftTitle, items: content.comparison.leftItems },
            { title: content.comparison.rightTitle, items: content.comparison.rightItems },
          ].map((col, i) => (
            <div key={i} className="bg-slate-900 border border-slate-700 p-4">
              <div className="font-medium text-white text-sm mb-2">{col.title}</div>
              <ul className="space-y-1.5">
                {col.items.map((item, j) => (
                  <li key={j} className="text-xs text-slate-300 flex gap-2">
                    <span className="text-orange-400">•</span>
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}

      {content.variant === 'table' && content.table && (
        <div className="mb-4 overflow-x-auto">
          <div className="text-xs text-slate-500 mb-2">{content.table.caption}</div>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-600">
                {content.table.headers.map((h, i) => (
                  <th key={i} className="text-left py-2 px-3 text-slate-400 font-medium text-xs">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {content.table.rows.map((row, i) => (
                <tr key={i} className="border-b border-slate-700/50">
                  {row.map((cell, j) => (
                    <td key={j} className="py-2 px-3 text-slate-300 text-xs">{cell}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {content.variant === 'quote' && content.quote && (
        <blockquote className="border-l-2 border-orange-500 pl-4 py-2 mb-4 bg-slate-900/50">
          <Quote className="w-4 h-4 text-orange-400 mb-2" />
          <p className="text-slate-200 text-sm italic">{content.quote.text}</p>
          <footer className="text-xs text-slate-500 mt-2">— {content.quote.attribution}</footer>
        </blockquote>
      )}

      <button
        onClick={onContinue}
        className="w-full px-6 py-3 bg-orange-600 hover:bg-orange-700 transition-colors font-medium text-white"
      >
        Got it — continue
      </button>
    </div>
  )
}
