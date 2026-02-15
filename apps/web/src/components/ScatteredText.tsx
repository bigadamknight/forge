import { useRef, useEffect } from 'react'
import gsap from 'gsap'
import { ScrambleTextPlugin } from 'gsap/ScrambleTextPlugin'

gsap.registerPlugin(ScrambleTextPlugin)

interface Props {
  phrases: string[]
  className?: string
}

export default function ScatteredText({ phrases, className = '' }: Props) {
  const textRef = useRef<HTMLDivElement>(null)
  const tweenRef = useRef<gsap.core.Tween | null>(null)

  // Stabilise phrases reference to prevent re-triggering on every render
  const phrasesKey = phrases.join('|')

  useEffect(() => {
    if (!textRef.current || phrases.length === 0) return

    const el = textRef.current
    el.textContent = phrases[0]
    let phraseIndex = 0

    const animateNext = () => {
      phraseIndex = (phraseIndex + 1) % phrases.length

      tweenRef.current = gsap.to(el, {
        scrambleText: {
          text: phrases[phraseIndex],
          chars: 'upperAndLowerCase',
          revealDelay: 0.5,
          tweenLength: true,
        },
        duration: 4,
        ease: 'power2.inOut',
        overwrite: 'auto',
        onComplete: () => {
          gsap.delayedCall(2, animateNext)
        },
      })
    }

    const initialDelay = gsap.delayedCall(2, animateNext)

    return () => {
      initialDelay.kill()
      tweenRef.current?.kill()
      gsap.killTweensOf(el)
    }
  }, [phrasesKey])

  return (
    <div
      ref={textRef}
      className={className}
      style={{ overflow: 'visible' }}
    >
      {phrases[0]}
    </div>
  )
}
