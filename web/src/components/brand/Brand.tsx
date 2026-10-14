import { FlaskConical } from 'lucide-react'
import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { cn } from '@/lib/cn'
import { utcClock } from '@/lib/format'
import { Hint } from '@/components/ui/primitives'

/** Mark: an orbit ring crossed by a road that turns amber where it is new. */
export function LogoMark({ className, title }: { className?: string; title?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={cn('size-7', className)} role={title ? 'img' : undefined} aria-hidden={title ? undefined : true}>
      {title && <title>{title}</title>}
      <circle cx="16" cy="16" r="13.25" fill="none" stroke="currentColor" strokeOpacity="0.55" strokeWidth="1.25" />
      <path d="M5.2 22.6 C 9.4 20.2, 12.1 18.6, 15.2 16.2" fill="none" stroke="var(--road-existing)" strokeWidth="2.2" strokeLinecap="round" />
      <path d="M15.2 16.2 C 18.6 13.6, 21.4 10.4, 24.4 7.6" fill="none" stroke="var(--signal)" strokeWidth="2.2" strokeLinecap="round" />
      <circle cx="24.4" cy="7.6" r="2.1" fill="var(--signal)" />
    </svg>
  )
}

export function Wordmark({ className }: { className?: string }) {
  return (
    <span className={cn('inline-flex items-center gap-2.5 text-fg', className)}>
      <LogoMark />
      <span className="text-[17px] font-semibold tracking-[-0.02em]">RoadWatch</span>
    </span>
  )
}

/** Thin corner brackets — the survey-instrument frame. Slots hold real readouts only. */
export function HUDFrame({
  className,
  children,
  tl,
  tr,
  bl,
  br,
  inset = 16,
}: {
  className?: string
  children?: ReactNode
  tl?: ReactNode
  tr?: ReactNode
  bl?: ReactNode
  br?: ReactNode
  inset?: number
}) {
  const arm = 18
  const c = 'pointer-events-none absolute border-sentinel/60'
  return (
    <div className={cn('relative', className)}>
      {children}
      <span aria-hidden className={cn(c, 'border-t border-l')} style={{ top: inset, left: inset, width: arm, height: arm }} />
      <span aria-hidden className={cn(c, 'border-t border-r')} style={{ top: inset, right: inset, width: arm, height: arm }} />
      <span aria-hidden className={cn(c, 'border-b border-l')} style={{ bottom: inset, left: inset, width: arm, height: arm }} />
      <span aria-hidden className={cn(c, 'border-b border-r')} style={{ bottom: inset, right: inset, width: arm, height: arm }} />
      {tl && <div className="t-mono absolute text-muted" style={{ top: inset + 4, left: inset + arm + 10 }}>{tl}</div>}
      {tr && <div className="t-mono absolute text-right text-muted" style={{ top: inset + 4, right: inset + arm + 10 }}>{tr}</div>}
      {bl && <div className="t-mono absolute text-muted" style={{ bottom: inset + 4, left: inset + arm + 10 }}>{bl}</div>}
      {br && <div className="t-mono absolute text-right text-muted" style={{ bottom: inset + 4, right: inset + arm + 10 }}>{br}</div>}
    </div>
  )
}

/** A thin luminous line — a satellite pass. Position/animate it from the parent. */
export function ScanLine({ orientation = 'vertical', className, style }: { orientation?: 'vertical' | 'horizontal'; className?: string; style?: React.CSSProperties }) {
  const v = orientation === 'vertical'
  return (
    <div aria-hidden className={cn('pointer-events-none absolute', v ? 'inset-y-0 w-px' : 'inset-x-0 h-px', className)} style={style}>
      <div className={cn('absolute bg-sentinel', v ? 'inset-y-0 left-0 w-px' : 'inset-x-0 top-0 h-px')} />
      <div
        className={cn('absolute opacity-70', v ? 'inset-y-0 -left-6 w-12' : 'inset-x-0 -top-6 h-12')}
        style={{
          background: v
            ? 'linear-gradient(90deg, transparent, color-mix(in oklab, var(--sentinel) 22%, transparent), transparent)'
            : 'linear-gradient(180deg, transparent, color-mix(in oklab, var(--sentinel) 22%, transparent), transparent)',
        }}
      />
    </div>
  )
}

/** Deterministic pseudo-topographic contour lines (no random noise — same every render). */
function contourPaths(w: number, h: number, seed: number) {
  const hills = [
    { x: w * 0.22, y: h * 0.38, s: 1 },
    { x: w * 0.78, y: h * 0.7, s: 0.8 },
  ]
  const paths: string[] = []
  for (const [hi, hill] of hills.entries()) {
    for (let k = 1; k <= 13; k++) {
      const r0 = (k * Math.min(w, h)) / 15 * hill.s
      let d = ''
      const N = 96
      for (let i = 0; i <= N; i++) {
        const t = (i / N) * Math.PI * 2
        const r =
          r0 *
          (1 +
            0.13 * Math.sin(3 * t + k * 0.35 + seed + hi) +
            0.07 * Math.sin(5 * t - k * 0.22 + seed * 2) +
            0.035 * Math.sin(9 * t + k * 0.5))
        const x = hill.x + r * Math.cos(t) * 1.35
        const y = hill.y + r * Math.sin(t)
        d += `${i ? 'L' : 'M'}${x.toFixed(1)},${y.toFixed(1)}`
      }
      paths.push(d + 'Z')
    }
  }
  return paths
}

export function ContourBg({ className, seed = 1, drift = false, opacity = 0.5 }: { className?: string; seed?: number; drift?: boolean; opacity?: number }) {
  const paths = useMemo(() => contourPaths(1600, 1000, seed), [seed])
  return (
    <svg
      aria-hidden
      viewBox="0 0 1600 1000"
      preserveAspectRatio="xMidYMid slice"
      className={cn('pointer-events-none absolute inset-0 h-full w-full', drift && 'rw-contour-drift', className)}
      style={{ opacity }}
    >
      <g fill="none" stroke="var(--line-strong)" strokeWidth="1" vectorEffect="non-scaling-stroke">
        {paths.map((d, i) => (
          <path key={i} d={d} strokeOpacity={i % 5 === 4 ? 0.9 : 0.45} />
        ))}
      </g>
    </svg>
  )
}

export function DemoBadge({ className, note }: { className?: string; note?: string }) {
  return (
    <Hint
      align="end"
      className={className}
      content={
        note ??
        'Demo data: real OpenStreetMap road geometry with invented scores, dates and statuses. RoadWatch model results replace it after evaluation.'
      }
    >
      <span
        tabIndex={0}
        className="inline-flex h-6 items-center gap-1.5 rounded-chip border border-dashed border-signal/60 bg-bg0/70 px-2 text-[12px] font-medium whitespace-nowrap text-signal-ink backdrop-blur"
      >
        <FlaskConical className="size-3.5" strokeWidth={1.75} aria-hidden />
        Demo data
      </span>
    </Hint>
  )
}

export function UtcClock({ className }: { className?: string }) {
  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), 1000)
    return () => window.clearInterval(id)
  }, [])
  return (
    <time dateTime={now.toISOString()} className={cn('t-mono tabular', className)}>
      {utcClock(now)} UTC
    </time>
  )
}
