import { ArrowUpRight, Menu, X } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { Link, NavLink, useLocation } from 'react-router'
import { Wordmark } from '@/components/brand/Brand'
import { ButtonLink } from '@/components/ui/Button'
import { cn } from '@/lib/cn'
import { useReducedMotion } from '@/lib/motionPref'

export const SOLUTIONS = [
  {
    slug: 'security',
    title: 'Security analysts',
    line: 'New roads near sensitive areas, flagged first.',
  },
  {
    slug: 'rural-road-audit',
    title: 'Rural road auditors',
    line: 'Sanctioned length vs what was actually built.',
  },
  {
    slug: 'planning',
    title: 'Planners',
    line: 'Which villages a new road connects, and how much closer.',
  },
] as const

/** Tiny map vignettes for the mega-menu and audience cards. Abstract, no data claims. */
export function Vignette({ kind, className, animate = false }: { kind: (typeof SOLUTIONS)[number]['slug']; className?: string; animate?: boolean }) {
  return (
    <svg viewBox="0 0 160 100" preserveAspectRatio="xMidYMid slice" className={cn('block', className)} aria-hidden>
      <rect width="160" height="100" fill="var(--bg-1)" />
      <g stroke="var(--line-strong)" strokeWidth="0.75" fill="none" opacity="0.8">
        <path d="M-5 70 C 30 60, 50 82, 90 70 S 140 50, 170 58" />
        <path d="M-5 84 C 34 74, 56 96, 96 84 S 140 66, 170 72" />
      </g>
      <g stroke="var(--road-existing)" strokeWidth="1.6" fill="none" strokeLinecap="round" opacity="0.75">
        <path d="M0 40 L60 46 L110 30 L160 34" />
        <path d="M60 46 L52 100" />
        <path d="M110 30 L118 0" />
      </g>
      {kind === 'security' && (
        <>
          <path d="M96 52 L140 46 L150 84 L104 92 Z" fill="color-mix(in oklab, var(--priority) 14%, transparent)" stroke="var(--priority)" strokeWidth="1" strokeDasharray="3 2" className={animate ? 'rw-vig-pulse' : undefined} />
          <path d="M84 38 C 96 52, 112 60, 128 70" stroke="var(--signal)" strokeWidth="2.2" fill="none" strokeLinecap="round" pathLength={1} className={animate ? 'rw-vig-draw' : undefined} />
        </>
      )}
      {kind === 'rural-road-audit' && (
        <>
          <path d="M20 80 C 50 70, 70 66, 140 62" stroke="var(--text-muted)" strokeWidth="1.4" strokeDasharray="4 3" fill="none" />
          <path d="M20 80 C 50 70, 70 66, 104 64" stroke="var(--signal)" strokeWidth="2.2" fill="none" strokeLinecap="round" pathLength={1} className={animate ? 'rw-vig-draw' : undefined} />
          <circle cx="104" cy="64" r="2.4" fill="var(--signal)" />
          <circle cx="140" cy="62" r="2.4" fill="none" stroke="var(--text-muted)" />
        </>
      )}
      {kind === 'planning' && (
        <>
          {[
            [28, 72],
            [70, 84],
            [124, 74],
            [138, 52],
          ].map(([x, y], i) => (
            <circle key={i} cx={x} cy={y} r="3" fill="var(--bg-1)" stroke="var(--verified)" strokeWidth="1.4" />
          ))}
          <path d="M60 46 C 66 62, 70 70, 70 84 M70 84 C 96 82, 112 78, 124 74 L138 52" stroke="var(--signal)" strokeWidth="2" fill="none" strokeLinecap="round" pathLength={1} className={animate ? 'rw-vig-draw' : undefined} />
        </>
      )}
    </svg>
  )
}

const LINKS = [
  { to: '/explore', label: 'Map' },
  { to: '/research', label: 'Results' },
  { to: '/docs', label: 'Docs' },
]

export function SiteNav({ overlay = false }: { overlay?: boolean }) {
  const [scrolled, setScrolled] = useState(false)
  const [mega, setMega] = useState(false)
  const [mobile, setMobile] = useState(false)
  const loc = useLocation()
  const megaRef = useRef<HTMLDivElement>(null)
  const reduced = useReducedMotion()

  useEffect(() => {
    const on = () => setScrolled(window.scrollY > 24)
    on()
    window.addEventListener('scroll', on, { passive: true })
    return () => window.removeEventListener('scroll', on)
  }, [])

  useEffect(() => {
    setMega(false)
    setMobile(false)
  }, [loc.pathname])

  useEffect(() => {
    if (!mega && !mobile) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setMega(false)
        setMobile(false)
      }
    }
    const onDown = (e: PointerEvent) => {
      if (mega && megaRef.current && !megaRef.current.contains(e.target as Node)) setMega(false)
    }
    window.addEventListener('keydown', onKey)
    window.addEventListener('pointerdown', onDown)
    return () => {
      window.removeEventListener('keydown', onKey)
      window.removeEventListener('pointerdown', onDown)
    }
  }, [mega, mobile])

  useEffect(() => {
    document.documentElement.style.overflow = mobile ? 'hidden' : ''
    return () => {
      document.documentElement.style.overflow = ''
    }
  }, [mobile])

  const solid = scrolled || !overlay || mega
  const link =
    'relative inline-flex h-8 items-center rounded-[6px] px-3 text-[13.5px] font-medium text-muted transition-all duration-200 hover:text-fg hover:bg-white/[0.05] aria-[current=page]:text-fg aria-[current=page]:bg-white/[0.08] aria-[current=page]:shadow-[inset_0_1px_0_rgba(255,255,255,0.1)]'

  return (
    <header
      className={cn(
        'fixed inset-x-0 top-0 z-40 transition-[background-color,border-color,backdrop-filter,box-shadow] duration-300',
        solid
          ? 'border-b border-line-strong/60 bg-[#05070c]/85 backdrop-blur-xl shadow-[0_4px_30px_rgba(0,0,0,0.6)]'
          : 'border-b border-transparent bg-transparent',
      )}
    >
      <div className="container-bleed flex h-16 items-center gap-6">
        <Link to="/" className="shrink-0 rounded-[6px]" aria-label="RoadWatch home">
          <Wordmark />
        </Link>

        <nav aria-label="Main" className="hidden flex-1 items-center gap-1 lg:flex">
          {LINKS.map((l) => (
            <NavLink key={l.to} to={l.to} className={link}>
              {l.label}
            </NavLink>
          ))}
        </nav>

        <div className="ml-auto flex items-center gap-3">
          <ButtonLink
            to="/app"
            variant="outline"
            size="sm"
            className="hidden sm:inline-flex border-line-strong hover:border-sentinel/60 hover:shadow-[0_0_15px_rgba(79,209,232,0.2)] hover:bg-sentinel/10"
          >
            Open app
            <ArrowUpRight className="size-3.5 text-sentinel" strokeWidth={2} aria-hidden />
          </ButtonLink>
          <button
            type="button"
            className="inline-flex size-10 items-center justify-center rounded-[8px] text-fg hover:bg-surface2 lg:hidden"
            aria-label={mobile ? 'Close menu' : 'Open menu'}
            aria-expanded={mobile}
            aria-controls="mobile-menu"
            onClick={() => setMobile((v) => !v)}
          >
            {mobile ? <X className="size-5" strokeWidth={1.5} /> : <Menu className="size-5" strokeWidth={1.5} />}
          </button>
        </div>
      </div>

      <div
        id="mobile-menu"
        inert={!mobile}
        className={cn(
          'fixed inset-x-0 top-16 bottom-0 z-40 overflow-y-auto bg-bg0 transition-[opacity,visibility] duration-200 lg:hidden',
          mobile ? 'visible opacity-100' : 'invisible opacity-0',
        )}
        data-lenis-prevent
      >
        <nav aria-label="Mobile" className="container-rw flex flex-col py-6">
          {[
            { to: '/', label: 'Home' },
            { to: '/explore', label: 'Map' },
            { to: '/research', label: 'Results' },
            { to: '/docs', label: 'Docs' },
          ].map((l, i) => (
            <div
              key={l.to}
              className={cn('transition-[opacity,translate] duration-500 ease-out-expo', mobile ? 'translate-y-0 opacity-100' : 'translate-y-3.5 opacity-0')}
              style={{ transitionDelay: mobile && !reduced ? `${30 + i * 40}ms` : '0ms' }}
            >
              <NavLink
                to={l.to}
                end
                className="flex items-baseline justify-between border-b border-line py-4 text-[26px] font-medium tracking-[-0.02em] text-fg aria-[current=page]:text-sentinel-ink"
              >
                {l.label}
              </NavLink>
            </div>
          ))}
          <ButtonLink to="/app" variant="signal" size="lg" className="mt-8">
            Open app
          </ButtonLink>
        </nav>
      </div>
    </header>
  )
}
