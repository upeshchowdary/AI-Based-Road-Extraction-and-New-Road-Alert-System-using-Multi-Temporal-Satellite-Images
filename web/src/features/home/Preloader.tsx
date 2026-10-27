import { useEffect, useState } from 'react'
import { LogoMark } from '@/components/brand/Brand'
import { DATA, preload } from '@/lib/data'
import { useReducedMotion } from '@/lib/motionPref'

const KEY = 'rw-preloaded'
const MAX_MS = 1200
const ASSETS = [
  DATA.zoneMeta,
  DATA.heroPaths,
  DATA.alertsSummary,
  DATA.apGlobe,
  DATA.heroImage('2022_pre_monsoon'),
  DATA.heroImage('2024_pre_monsoon'),
  '/textures/earth-day-2k.webp',
  '/textures/earth-night-2k.webp',
  '/textures/earth-water-2k.webp',
]

function seen() {
  try {
    return sessionStorage.getItem(KEY) === '1' || localStorage.getItem(KEY) === '1'
  } catch {
    return false
  }
}

/**
 * H0 — first visit only. The counter is the real number of hero assets loaded (never a timer).
 * Leaves after everything loads or after 1.2 s, whichever is first; the hero has its own poster.
 */
export function Preloader() {
  const reduced = useReducedMotion()
  const [show, setShow] = useState(() => !seen())
  const [leaving, setLeaving] = useState(false)
  const [done, setDone] = useState(0)

  useEffect(() => {
    if (!show) return
    document.documentElement.style.overflow = 'hidden'
    let finished = false
    const end = () => {
      if (finished) return
      finished = true
      try {
        localStorage.setItem(KEY, '1')
      } catch {
        /* storage blocked: the preloader simply shows again next time */
      }
      setLeaving(true)
      window.setTimeout(() => setShow(false), reduced ? 200 : 720)
    }
    const timer = window.setTimeout(end, MAX_MS)
    preload(ASSETS, (d) => setDone(d)).then(() => window.setTimeout(end, 180))
    return () => {
      window.clearTimeout(timer)
      document.documentElement.style.overflow = ''
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [show])

  useEffect(() => {
    if (!show || leaving) document.documentElement.style.overflow = ''
  }, [show, leaving])

  const frac = done / ASSETS.length
  const C = 2 * Math.PI * 46

  return (
    show && (
        <div
          role="status"
          aria-live="polite"
          aria-label={`Loading ${Math.round(frac * 100)} percent`}
          className="fixed inset-0 z-[60] grid place-items-center bg-bg0"
          style={{
            // exit: the screen wipes away left → right, like a scan pass
            clipPath: leaving && !reduced ? 'inset(0 0 0 100%)' : 'inset(0 0 0 0%)',
            opacity: leaving && reduced ? 0 : 1,
            transition: reduced ? 'opacity 200ms ease' : 'clip-path 700ms cubic-bezier(0.65, 0, 0.35, 1)',
          }}
        >
          <div className="relative grid size-32 place-items-center">
            <svg viewBox="0 0 100 100" className="absolute inset-0 size-full -rotate-90" aria-hidden>
              <circle cx="50" cy="50" r="46" fill="none" stroke="var(--line)" strokeWidth="1" />
              <circle
                cx="50"
                cy="50"
                r="46"
                fill="none"
                stroke="var(--sentinel)"
                strokeWidth="1.25"
                strokeDasharray={C}
                strokeDashoffset={C * (1 - frac)}
                style={{ transition: 'stroke-dashoffset 300ms cubic-bezier(0.33,1,0.68,1)' }}
              />
            </svg>
            <LogoMark className="size-10 text-fg" />
          </div>
          <p className="t-mono absolute bottom-10 left-1/2 -translate-x-1/2 text-muted tabular">
            {done}/{ASSETS.length} assets · {String(Math.round(frac * 100)).padStart(3, '0')}%
          </p>
        </div>
      )
  )
}
