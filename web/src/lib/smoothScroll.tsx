import { gsap } from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { ReactLenis, useLenis } from 'lenis/react'
import { useEffect, type ReactNode } from 'react'
import { useLocation } from 'react-router'
import { useReducedMotion } from './motionPref'

gsap.registerPlugin(ScrollTrigger)

/**
 * Inner bridge component that connects Lenis scroll updates to GSAP ScrollTrigger.
 * Uses the reactive useLenis callback so it never misses frames.
 */
function LenisBridge() {
  useLenis(() => {
    ScrollTrigger.update()
  })

  const lenis = useLenis()
  const { pathname, hash } = useLocation()

  useEffect(() => {
    if (!lenis) return
    if (hash) {
      const el = document.getElementById(hash.slice(1))
      if (el) {
        lenis.scrollTo(el, { immediate: true })
        return
      }
    }
    lenis.scrollTo(0, { immediate: true })
    requestAnimationFrame(() => ScrollTrigger.refresh())
  }, [lenis, pathname, hash])

  return null
}

/**
 * SmoothScroll provider.
 * Uses native scroll for reduced motion or non-Lenis pages.
 * On enabled pages, ReactLenis runs with autoRaf enabled for guaranteed, glitch-free scrolling.
 */
export function SmoothScroll({
  children,
  enableLenis = false,
}: {
  children: ReactNode
  enableLenis?: boolean
}) {
  const reduced = useReducedMotion()
  const { pathname, hash } = useLocation()

  // Native scroll restoration for pages where Lenis is disabled
  useEffect(() => {
    if (enableLenis && !reduced) return
    if (hash) {
      const el = document.getElementById(hash.slice(1))
      if (el) {
        el.scrollIntoView()
        return
      }
    }
    window.scrollTo(0, 0)
    requestAnimationFrame(() => ScrollTrigger.refresh())
  }, [pathname, hash, enableLenis, reduced])

  if (reduced || !enableLenis) {
    return <>{children}</>
  }

  return (
    <ReactLenis
      root
      options={{
        autoRaf: true,
        lerp: 0.15, // 0.1 trailed the wheel noticeably (with the hero's scrub on top it felt sticky)
        wheelMultiplier: 1.0,
        touchMultiplier: 1.2,
        anchors: true,
      }}
    >
      <LenisBridge />
      {children}
    </ReactLenis>
  )
}
