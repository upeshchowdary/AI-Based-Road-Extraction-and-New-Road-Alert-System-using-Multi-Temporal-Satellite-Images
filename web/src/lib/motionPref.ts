import { useSyncExternalStore } from 'react'
import { usePrefs } from './store'

const query = '(prefers-reduced-motion: reduce)'

function subscribe(cb: () => void) {
  const mq = window.matchMedia(query)
  mq.addEventListener('change', cb)
  return () => mq.removeEventListener('change', cb)
}

export function useSystemReducedMotion() {
  return useSyncExternalStore(
    subscribe,
    () => window.matchMedia(query).matches,
    () => false,
  )
}

/** True when motion should be reduced: system setting, or the site motion toggle is off. */
export function useReducedMotion() {
  const pref = usePrefs((s) => s.motion)
  const system = useSystemReducedMotion()
  if (pref === 'off') return true
  if (pref === 'on') return false
  return system
}

/** Non-hook read for imperative code (GSAP setup). */
export function reducedMotionNow() {
  const pref = usePrefs.getState().motion
  if (pref === 'off') return true
  if (pref === 'on') return false
  return window.matchMedia(query).matches
}
