import { useEffect, useSyncExternalStore } from 'react'
import { usePrefs } from './store'

const q = '(prefers-color-scheme: light)'

function subscribe(cb: () => void) {
  const mq = window.matchMedia(q)
  mq.addEventListener('change', cb)
  return () => mq.removeEventListener('change', cb)
}

export function useResolvedTheme(): 'dark' | 'light' {
  const pref = usePrefs((s) => s.theme)
  const sysLight = useSyncExternalStore(
    subscribe,
    () => window.matchMedia(q).matches,
    () => false,
  )
  if (pref === 'system') return sysLight ? 'light' : 'dark'
  return pref
}

/** Applies theme + motion preferences to <html> so CSS can react. */
export function useApplyPrefs() {
  const theme = useResolvedTheme()
  const motion = usePrefs((s) => s.motion)
  useEffect(() => {
    document.documentElement.dataset.theme = theme
    const meta = document.querySelector('meta[name="theme-color"]')
    meta?.setAttribute('content', theme === 'dark' ? '#05070C' : '#F6F4EF')
  }, [theme])
  useEffect(() => {
    if (motion === 'off') document.documentElement.dataset.motion = 'off'
    else delete document.documentElement.dataset.motion
  }, [motion])
}
