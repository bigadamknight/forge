/**
 * Shared typography and spacing tokens for toolkit components.
 * Import these instead of hardcoding Tailwind classes so we can
 * adjust sizes in one place.
 */

export const text = {
  /** Primary body / content text (16px) */
  body: 'text-base',
  /** Secondary content - slightly smaller (15px) */
  secondary: 'text-[15px]',
  /** Card/section headings (18px) */
  heading: 'text-lg',
  /** Component question / main prompt (20px) */
  title: 'text-xl',
  /** Labels, meta, badges (14px) */
  label: 'text-sm',
  /** Micro text - progress indicators, footnotes (12px) */
  micro: 'text-xs',
  /** Large result numbers (30px) */
  result: 'text-3xl',
} as const

export const input = {
  /** Standard text/number input */
  base: 'px-4 py-2.5 bg-slate-700/50 border border-slate-600/50 text-base text-white placeholder-slate-500 focus:border-orange-500 focus:outline-none transition-colors',
  /** Select dropdown */
  select: 'px-4 py-2.5 bg-slate-700/50 border border-slate-600/50 text-base text-white focus:border-orange-500 focus:outline-none transition-colors',
  /** Option button (select/multiselect choice) */
  option: 'w-full text-left px-4 py-3 text-base transition-all border',
  optionActive: 'bg-orange-500/20 border-orange-500/50 text-white',
  optionInactive: 'bg-slate-700/30 border-slate-600/30 text-slate-300 hover:bg-slate-700/50 hover:border-slate-500/50',
} as const

export const card = {
  /** Outer card padding */
  header: 'px-7 pt-6 pb-2',
  body: 'px-7 pb-7 pt-3',
  /** Inner panel padding (recommendation boxes, alerts) */
  panel: 'p-5',
} as const
