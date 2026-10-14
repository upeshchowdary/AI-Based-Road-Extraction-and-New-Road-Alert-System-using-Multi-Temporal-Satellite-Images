import { useRef, type ReactNode } from 'react'
import { useReducedMotion } from '@/lib/motionPref'

/** Pulls its child gently toward the pointer (desktop, motion on). */
export function Magnetic({ children, strength = 0.28 }: { children: ReactNode; strength?: number }) {
  const ref = useRef<HTMLSpanElement>(null)
  const reduced = useReducedMotion()
  if (reduced) return <>{children}</>
  return (
    <span
      ref={ref}
      className="inline-flex transition-transform duration-500 ease-out-expo will-change-transform"
      onPointerMove={(e) => {
        if (e.pointerType !== 'mouse' || !ref.current) return
        const r = ref.current.getBoundingClientRect()
        const x = (e.clientX - (r.left + r.width / 2)) * strength
        const y = (e.clientY - (r.top + r.height / 2)) * strength
        ref.current.style.transitionDuration = '120ms'
        ref.current.style.transform = `translate3d(${x}px, ${y}px, 0)`
      }}
      onPointerLeave={() => {
        if (!ref.current) return
        ref.current.style.transitionDuration = '600ms'
        ref.current.style.transform = 'translate3d(0,0,0)'
      }}
    >
      {children}
    </span>
  )
}
