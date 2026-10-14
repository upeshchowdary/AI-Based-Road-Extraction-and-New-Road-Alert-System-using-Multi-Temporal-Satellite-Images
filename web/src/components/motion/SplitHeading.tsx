import { useGSAP } from '@gsap/react'
import { gsap } from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { SplitText } from 'gsap/SplitText'
import { createElement, useRef, type ReactNode } from 'react'
import { useReducedMotion } from '@/lib/motionPref'

gsap.registerPlugin(SplitText, ScrollTrigger)

/** Line-by-line masked reveal when the heading enters. Reduced motion → plain text. */
export function SplitHeading({
  as = 'h2',
  className,
  children,
  start = 'top 82%',
  id,
}: {
  as?: 'h1' | 'h2' | 'h3' | 'p'
  className?: string
  children: ReactNode
  start?: string
  id?: string
}) {
  const ref = useRef<HTMLElement>(null)
  const reduced = useReducedMotion()
  useGSAP(
    () => {
      if (reduced || !ref.current) return
      const split = SplitText.create(ref.current, { type: 'lines', mask: 'lines', linesClass: 'rw-line' })
      gsap.from(split.lines, {
        yPercent: 108,
        duration: 1.15,
        ease: 'expo.out',
        stagger: 0.1,
        scrollTrigger: { trigger: ref.current, start, once: true },
      })
      return () => split.revert()
    },
    { dependencies: [reduced] },
  )
  return createElement(as, { ref, className, id }, children)
}



/** Counts up to a value once, when visible. Reduced motion → final value. */
export function Counter({ value, decimals = 0, className, format }: { value: number; decimals?: number; className?: string; format?: (v: number) => string }) {
  const ref = useRef<HTMLSpanElement>(null)
  const reduced = useReducedMotion()
  const fmt = format ?? ((v: number) => v.toLocaleString('en-IN', { minimumFractionDigits: decimals, maximumFractionDigits: decimals }))
  useGSAP(
    () => {
      const el = ref.current
      if (!el) return
      if (reduced) {
        el.textContent = fmt(value)
        return
      }
      const o = { v: 0 }
      el.textContent = fmt(0)
      gsap.to(o, {
        v: value,
        duration: 1.6,
        ease: 'power3.out',
        scrollTrigger: { trigger: el, start: 'top 90%', once: true },
        onUpdate: () => {
          el.textContent = fmt(o.v)
        },
      })
    },
    { dependencies: [value, reduced] },
  )
  return (
    <span ref={ref} className={className}>
      {fmt(value)}
    </span>
  )
}
