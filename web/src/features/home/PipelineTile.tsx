import { useMemo } from 'react'
import { ConfidenceBreakdown } from '@/components/alerts/AlertParts'
import { DATA, type DemoAlert, type HeroPaths } from '@/lib/data'
import { cn } from '@/lib/cn'
import { useJoinedPaths } from './RoadReveal'

/** A 6 km window of the hero crop around the new bridge (crop px = 10 m). */
const VB = '230 120 640 640'

function endpoints(paths: HeroPaths | undefined) {
  const pts: [number, number][] = []
  for (const p of paths?.existing ?? []) {
    if (p.c === 'minor') continue
    const segs = p.d.slice(1).split(' L')
    const a = segs[0].split(',').map(Number)
    const b = segs[segs.length - 1].split(',').map(Number)
    pts.push([a[0], a[1]], [b[0], b[1]])
  }
  return pts.filter(([x, y]) => x > 230 && x < 870 && y > 120 && y < 760)
}

/** Synthetic cloud shapes used only to illustrate masking (the real composite is cloud-free). */
const CLOUDS = [
  'M300 210 q40 -50 95 -20 q55 -25 80 25 q50 10 30 55 q-10 40 -70 30 q-40 30 -90 5 q-60 5 -55 -45 q-25 -30 10 -50 Z',
  'M640 560 q35 -40 85 -15 q45 -10 55 30 q30 30 -5 55 q-35 30 -80 10 q-50 15 -65 -25 q-25 -30 10 -55 Z',
]

const layer = 'absolute inset-0 transition-opacity duration-700 ease-out-expo'

export function PipelineTile({
  step,
  paths,
  alert,
  className,
}: {
  step: number
  paths?: HeroPaths
  alert?: DemoAlert
  className?: string
}) {
  const joined = useJoinedPaths(paths)
  const nodes = useMemo(() => endpoints(paths), [paths])
  const on = (s: number | number[]) => ((Array.isArray(s) ? s.includes(step) : s === step) ? 'opacity-100' : 'opacity-0')
  const svg = { viewBox: VB, preserveAspectRatio: 'xMidYMid slice', className: 'absolute inset-0 size-full' } as const

  return (
    <div
      className={cn(
        'relative aspect-square overflow-hidden rounded-panel border border-line-strong/80 bg-[#06080e] shadow-[0_20px_50px_rgba(0,0,0,0.6)]',
        className,
      )}
    >
      {/* 1 · the satellite image (always underneath) */}
      <svg {...svg} aria-hidden>
        <image href={DATA.heroImage('2024_pre_monsoon')} width="1100" height="1100" />
      </svg>

      {/* Darken for analysis steps */}
      <div
        className={cn(
          layer,
          'bg-[#05070c]',
          step === 0 ? 'opacity-0' : step === 2 || step === 3 ? 'opacity-85' : 'opacity-45',
        )}
      />

      {/* 2 · masked pixels are hatched, never guessed */}
      <svg {...svg} className={cn(svg.className, layer, on(1))} aria-hidden>
        <defs>
          <pattern id="pl-hatch" width="9" height="9" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
            <rect width="9" height="9" fill="rgba(107,116,134,0.35)" />
            <line x1="0" y1="0" x2="0" y2="9" stroke="#8c99b0" strokeWidth="2.5" />
          </pattern>
        </defs>
        {CLOUDS.map((d, i) => (
          <path key={i} d={d} fill="url(#pl-hatch)" stroke="#8c99b0" strokeWidth="1.5" strokeDasharray="4 3" />
        ))}
      </svg>

      {/* 3 · road mask: pixels light up */}
      <svg {...svg} className={cn(svg.className, layer, on(2))} aria-hidden shapeRendering="crispEdges">
        <g fill="none" stroke="#e8edf5" strokeLinecap="square">
          <path d={joined.minor} strokeWidth="1.6" strokeOpacity="0.55" />
          <path d={joined.secondary} strokeWidth="2.4" strokeOpacity="0.85" />
          <path d={joined.major} strokeWidth="3.2" />
          {paths?.new.map((p, i) => (
            <path key={i} d={p.d} strokeWidth="4.2" stroke="#ffda80" />
          ))}
        </g>
      </svg>

      {/* 4 · road graph: centre-lines + nodes */}
      <svg {...svg} className={cn(svg.className, layer, on(3))} aria-hidden>
        <g fill="none" stroke="#9fb3c8" strokeLinecap="round">
          <path d={joined.secondary} strokeWidth="1.2" />
          <path d={joined.major} strokeWidth="1.8" />
          {paths?.new.map((p, i) => (
            <path key={i} d={p.d} strokeWidth="2.2" stroke="#ffb547" />
          ))}
        </g>
        <g fill="#05070c" stroke="#4fd1e8" strokeWidth="1.6">
          {nodes.map(([x, y], i) => (
            <circle key={i} cx={x} cy={y} r="3.4" />
          ))}
        </g>
      </svg>

      {/* 5 · compare dates: matched roads dim, unmatched glow amber */}
      <div className={cn(layer, on([4, 5]))}>
        <svg {...svg} aria-hidden>
          <defs>
            <filter id="pl-glow" x="-30%" y="-30%" width="160%" height="160%">
              <feGaussianBlur stdDeviation="6" />
            </filter>
            <filter id="pl-superglow" x="-50%" y="-50%" width="200%" height="200%">
              <feGaussianBlur stdDeviation="18" />
            </filter>
          </defs>
          <g fill="none" stroke="#9fb3c8" strokeOpacity="0.35" strokeLinecap="round">
            <path d={joined.secondary} strokeWidth="1.2" />
            <path d={joined.major} strokeWidth="1.8" />
          </g>
          <g fill="none" stroke="#ffb547" strokeLinecap="round">
            {paths?.new.map((p, i) => (
              <path key={`sg${i}`} d={p.d} strokeWidth="24" strokeOpacity="0.3" filter="url(#pl-superglow)" />
            ))}
            {paths?.new.map((p, i) => (
              <path key={`g${i}`} d={p.d} strokeWidth="12" strokeOpacity="0.6" filter="url(#pl-glow)" />
            ))}
            {paths?.new.map((p, i) => (
              <path key={i} d={p.d} strokeWidth="3.8" />
            ))}
          </g>
        </svg>

        <div
          className={cn(
            'absolute top-4 left-4 flex flex-col gap-1.5 transition-opacity duration-500',
            step === 4 ? 'opacity-100' : 'opacity-0',
          )}
          aria-hidden
        >
          {['Pre-monsoon 2022', 'Pre-monsoon 2024'].map((d, i) => (
            <span
              key={d}
              className="t-mono rounded-chip border border-[#e8edf5]/25 bg-[#05070c]/80 px-2.5 py-1 text-[11px] text-[#e8edf5]/90 backdrop-blur-md shadow-sm"
              style={{ transform: `translateX(${i * 8}px)` }}
            >
              {d}
            </span>
          ))}
        </div>
      </div>

      {/* 6 · alert with its evidence */}
      {alert && (
        <div className={cn(layer, 'flex items-end p-5', on(5))}>
          <div className="w-full rounded-card border border-line-strong bg-[#05070c]/90 p-4.5 backdrop-blur-xl shadow-[0_12px_32px_rgba(0,0,0,0.8)]">
            <div className="flex items-center justify-between text-[13px]">
              <span className="font-medium text-signal-ink flex items-center gap-1.5">
                <span className="size-2 rounded-full bg-signal animate-pulse" />
                New road · {alert.length_km} km
              </span>
              <span className="t-mono text-[11px] text-muted">{alert.id} · verified</span>
            </div>
            <div className="mt-3">
              <ConfidenceBreakdown factors={alert.factors} score={alert.score} />
            </div>
          </div>
        </div>
      )}

      {/* Aerospace HUD overlay: corner brackets + coordinate telemetry */}
      <div aria-hidden className="pointer-events-none absolute inset-3">
        {(['top-0 left-0 border-t border-l', 'top-0 right-0 border-t border-r', 'bottom-0 left-0 border-b border-l', 'bottom-0 right-0 border-b border-r'] as const).map((c) => (
          <span key={c} className={cn('absolute size-3 border-sentinel/50', c)} />
        ))}
        <div className="absolute bottom-1 right-2 text-[10px] font-mono text-muted/70 tracking-wider">
          ZONE A · 10m GSD
        </div>
      </div>
    </div>
  )
}
