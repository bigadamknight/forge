import { useRef, useEffect } from 'react'
import gsap from 'gsap'
import { SplitText } from 'gsap/SplitText'

gsap.registerPlugin(SplitText)

interface Props {
  lines: string[]
  subtitle?: string
  className?: string
}

export default function WordDrop({ lines, subtitle, className = '' }: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const subtitleRef = useRef<HTMLParagraphElement>(null)
  const linesKey = lines.join('|')

  useEffect(() => {
    if (!containerRef.current || lines.length === 0) return

    const lineEls = containerRef.current.querySelectorAll('[data-word-line]')
    const splits: InstanceType<typeof SplitText>[] = []
    const tl = gsap.timeline()

    lineEls.forEach((el) => {
      const split = SplitText.create(el, { type: 'words', wordsClass: 'word-pill' })
      splits.push(split)

      // Style word pills
      split.words.forEach((word: Element) => {
        const el = word as HTMLElement
        el.style.display = 'inline-block'
        el.style.border = '1.5px dashed rgb(249, 115, 22)'
        el.style.color = 'rgb(251, 146, 60)'
        el.style.borderRadius = '6px'
        el.style.padding = '4px 12px'
        el.style.margin = '4px'
      })

      // Each line's words drop in, then a gap before next line
      tl.from(split.words, {
        y: -100,
        opacity: 0,
        rotation: 'random(-80, 80)',
        stagger: 0.08,
        duration: 0.8,
        ease: 'back',
      })
      // Gap between lines
      tl.to({}, { duration: 0.3 })
    })

    // Fade in subtitle after all lines
    if (subtitleRef.current) {
      tl.fromTo(
        subtitleRef.current,
        { opacity: 0, y: 10 },
        { opacity: 1, y: 0, duration: 0.5 }
      )
    }

    return () => {
      tl.kill()
      splits.forEach((s) => s.revert())
    }
  }, [linesKey])

  return (
    <div className={className}>
      <div ref={containerRef} className="flex flex-col items-center gap-4">
        {lines.map((line, i) => (
          <div
            key={`${linesKey}-${i}`}
            data-word-line
            className="text-3xl md:text-5xl font-semibold whitespace-nowrap"
            style={{ overflow: 'visible' }}
          >
            {line}
          </div>
        ))}
      </div>
      {subtitle && (
        <p ref={subtitleRef} className="text-slate-500 text-sm text-center mt-6 opacity-0">
          {subtitle}
        </p>
      )}
    </div>
  )
}
