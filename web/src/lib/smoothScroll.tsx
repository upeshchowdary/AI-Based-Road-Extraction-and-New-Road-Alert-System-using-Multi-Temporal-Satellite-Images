import { gsap } from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { ReactLenis, type LenisRef } from 'lenis/react'
import { useEffect, useRef, type ReactNode } from 'react'
import { useLocation } from 'react-router'
import { useReducedMotion } from './motionPref'

gsap.registerPlugin(ScrollTrigger)

/**
 * Lenis smooth scroll synced to the GSAP ticker — public pages only (UI_PROMPT.md 2.1).
 * Disabled entirely for reduced motion; maps opt out with data-lenis-prevent.
 */
export function SmoothScroll({ children }: { children: ReactNode }) {
  const reduced = useReducedMotion()
  const ref = useRef<LenisRef>(null)
  const { pathname, hash } = useLocation()

  useEffect(() => {
    if (reduced) return
    const lenis = ref.current?.lenis
    if (!lenis) return
    const update = (time: number) => lenis.raf(time * 1000)
    lenis.on('scroll', ScrollTrigger.update)
    gsap.ticker.add(update)
    gsap.ticker.lagSmoothing(0)
    return () => {
      gsap.ticker.remove(update)
      lenis.off('scroll', ScrollTrigger.update)
    }
  }, [reduced])

  // New page → top (or anchor). Lenis owns scroll position when active.
  useEffect(() => {
    const lenis = ref.current?.lenis
    if (hash) {
      const el = document.getElementById(hash.slice(1))
      if (el) {
        if (lenis) lenis.scrollTo(el, { immediate: true })
        else el.scrollIntoView()
        return
      }
    }
    if (lenis) lenis.scrollTo(0, { immediate: true })
    else window.scrollTo(0, 0)
    requestAnimationFrame(() => ScrollTrigger.refresh())
  }, [pathname, hash])

  if (reduced) return <>{children}</>
  return (
    <ReactLenis root ref={ref} options={{ autoRaf: false, lerp: 0.11, wheelMultiplier: 0.95, anchors: true }}>
      {children}
    </ReactLenis>
  )
}
