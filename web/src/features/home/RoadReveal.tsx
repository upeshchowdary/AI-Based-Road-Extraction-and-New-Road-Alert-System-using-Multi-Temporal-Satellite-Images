import { forwardRef, useImperativeHandle, useMemo, useRef } from 'react'
import { ScaleBar } from '@/components/map/ScaleBar'
import { useElementSize } from '@/lib/useElementSize'
import { ScanLine } from '@/components/brand/Brand'
import { DATA, type HeroPaths, type ZoneMeta } from '@/lib/data'
import { cn } from '@/lib/cn'
import { fmtLat, fmtLon } from '@/lib/format'

export interface RoadRevealHandles {
  root: HTMLDivElement | null
  after: HTMLDivElement | null
  scan: HTMLDivElement | null
  newRoads: SVGPathElement[]
  newGlow: SVGPathElement[]
  labels: HTMLDivElement | null
}

/** Joins thousands of OSM segments into one <path> per class (fast to paint). */
export function useJoinedPaths(paths: HeroPaths | undefined) {
  return useMemo(() => {
    const by: Record<string, string> = { major: '', secondary: '', minor: '' }
    for (const p of paths?.existing ?? []) by[p.c] += p.d
    return by
  }, [paths])
}

const SVG_PROPS = {
  viewBox: '0 0 1100 1100',
  preserveAspectRatio: 'xMidYMid slice',
  className: 'absolute inset-0 h-full w-full',
  'aria-hidden': true,
} as const

/**
 * Stage 4 of the hero: real Sentinel-2 composites of zone A (2022 → 2024 of 2022–2026), real OSM roads in steel,
 * and the new Vijayawada West Bypass drawn in amber. All layers share one viewBox so they stay aligned.
 */
export const RoadReveal = forwardRef<
  RoadRevealHandles,
  { meta: ZoneMeta | undefined; paths: HeroPaths | undefined; className?: string; staticMode?: boolean }
>(function RoadReveal({ meta, paths, className, staticMode = false }, ref) {
  const root = useRef<HTMLDivElement>(null)
  const after = useRef<HTMLDivElement>(null)
  const scan = useRef<HTMLDivElement>(null)
  const labels = useRef<HTMLDivElement>(null)
  const newRoads = useRef<SVGPathElement[]>([])
  const newGlow = useRef<SVGPathElement[]>([])
  useImperativeHandle(ref, () => ({
    get root() {
      return root.current
    },
    get after() {
      return after.current
    },
    get scan() {
      return scan.current
    },
    get labels() {
      return labels.current
    },
    get newRoads() {
      return newRoads.current.filter(Boolean)
    },
    get newGlow() {
      return newGlow.current.filter(Boolean)
    },
  }))
  const joined = useJoinedPaths(paths)
  const size = useElementSize(root)
  // The 1100-px crop (10 m/px) is scaled to cover the viewport ("slice"), so metres per screen px:
  const mpp = size.w ? (meta?.resolution_m ?? 10) / Math.max(size.w / 1100, size.h / 1100) : 0

  return (
    <div ref={root} className={cn('absolute inset-0 overflow-hidden bg-bg0', className)}>
      {/* before: pre-monsoon 2022 */}
      <svg {...SVG_PROPS}>
        <image href={DATA.heroImage('2022_pre_monsoon')} width="1100" height="1100" />
      </svg>
      {/* after: pre-monsoon 2024 + existing roads, revealed behind the scan line */}
      <div ref={after} className="absolute inset-0" style={staticMode ? undefined : { clipPath: 'inset(0 100% 0 0)' }}>
        <svg {...SVG_PROPS}>
          <image href={DATA.heroImage('2024_pre_monsoon')} width="1100" height="1100" />
          <rect width="1100" height="1100" fill="#05070c" opacity="0.28" />
          <g fill="none" stroke="#9fb3c8" strokeLinecap="round" strokeLinejoin="round">
            <path d={joined.minor} strokeWidth="0.6" strokeOpacity="0.38" />
            <path d={joined.secondary} strokeWidth="1.1" strokeOpacity="0.7" />
            <path d={joined.major} strokeWidth="1.7" strokeOpacity="0.9" />
          </g>
        </svg>
      </div>
      {/* new road (amber), drawn after the scan */}
      <svg {...SVG_PROPS}>
        <defs>
          <filter id="rw-glow" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="5" />
          </filter>
        </defs>
        <g fill="none" strokeLinecap="round" strokeLinejoin="round">
          {paths?.new.map((p, i) => (
            <path
              key={`g${i}`}
              ref={(el) => {
                if (el) newGlow.current[i] = el
              }}
              d={p.d}
              pathLength={1}
              stroke="#ffb547"
              strokeOpacity="0.55"
              strokeWidth="11"
              filter="url(#rw-glow)"
              strokeDasharray={1}
              strokeDashoffset={staticMode ? 0 : 1}
            />
          ))}
          {paths?.new.map((p, i) => (
            <path
              key={`n${i}`}
              ref={(el) => {
                if (el) newRoads.current[i] = el
              }}
              d={p.d}
              pathLength={1}
              stroke="#ffb547"
              strokeWidth="3.2"
              strokeDasharray={1}
              strokeDashoffset={staticMode ? 0 : 1}
            />
          ))}
        </g>
      </svg>
      {!staticMode && (
        <div ref={scan} className="pointer-events-none absolute inset-0" style={{ transform: 'translateX(-100%)' }}>
          <ScanLine className="right-0" />
        </div>
      )}
      {/* HUD: real crop centre + scale */}
      <div ref={labels} className="pointer-events-none absolute inset-x-0 bottom-0 flex items-end justify-between gap-4 p-5 sm:p-8">
        <div className="t-mono flex flex-col gap-1 text-[12px] text-[#e8edf5]/85">
          {meta && (
            <span>
              {fmtLat(meta.hero.center_lonlat[1])} {fmtLon(meta.hero.center_lonlat[0])}
            </span>
          )}
          <span className="text-[#e8edf5]/60">Sentinel-2 L2A · 10 m · B4 B3 B2</span>
        </div>
        <ScaleBar metersPerPx={mpp} className="text-[#e8edf5]/85" />
      </div>
    </div>
  )
})
