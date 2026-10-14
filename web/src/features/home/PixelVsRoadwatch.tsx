import { useState } from 'react'
import { DemoBadge } from '@/components/brand/Brand'
import { Segmented } from '@/components/ui/primitives'
import { cn } from '@/lib/cn'
import { DATA, useJson, type HeroPaths, type ZoneMeta } from '@/lib/data'
import { fmtInt } from '@/lib/format'
import { useJoinedPaths } from './RoadReveal'

type Mode = 'pixel' | 'roadwatch'

/** H4 — the signature differentiator, on a real before/after pair. */
export function PixelVsRoadwatch() {
  const [mode, setMode] = useState<Mode>('pixel')
  const meta = useJson<ZoneMeta>(DATA.zoneMeta).data
  const paths = useJson<HeroPaths>(DATA.heroPaths).data
  const joined = useJoinedPaths(paths)
  const blobs = meta?.hero.pixeldiff_blobs ?? 0
  const svg = { viewBox: '0 0 1100 1100', preserveAspectRatio: 'xMidYMid slice', className: 'absolute inset-0 size-full' } as const

  return (
    <section aria-labelledby="h4-title" className="section-y border-t border-line bg-bg0">
      <div className="container-rw">
        <div className="grid gap-10 lg:grid-cols-12 lg:items-end">
          <div className="lg:col-span-7">
            <h2 id="h4-title" className="t-h1 text-fg">
              Why not just compare two images?
            </h2>
          </div>
          <p className="t-lead text-muted lg:col-span-5">
            Everything changes between two satellite photos: crops, water, sandbars, shadows. Only roads matter.
          </p>
        </div>

        <div className="mt-12 overflow-hidden rounded-panel border border-line">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line bg-surface px-4 py-3">
            <Segmented
              label="Comparison method"
              value={mode}
              onChange={setMode}
              options={[
                { value: 'pixel', label: 'Pixel difference' },
                { value: 'roadwatch', label: 'RoadWatch' },
              ]}
            />
            <span className="t-mono text-[12px] text-muted">Pre-monsoon 2022 → pre-monsoon 2024 · 11 × 11 km · Vijayawada</span>
          </div>
          <div className="relative aspect-[4/5] sm:aspect-[16/10]">
            <svg {...svg} aria-hidden>
              <image href={DATA.heroImage('2024_pre_monsoon')} width="1100" height="1100" />
            </svg>
            {/* pixel difference: real change-vector result on these two composites */}
            <svg {...svg} aria-hidden className={cn(svg.className, 'transition-opacity duration-1000', mode === 'pixel' ? 'opacity-100' : 'opacity-0')}>
              <image href={DATA.heroPixelDiff} width="1100" height="1100" />
            </svg>
            {/* RoadWatch: calm map, existing roads dim, the new road in amber */}
            <div className={cn('absolute inset-0 transition-opacity duration-1000', mode === 'roadwatch' ? 'opacity-100' : 'opacity-0')}>
              <div className="absolute inset-0 bg-[#05070c]/55" />
              <svg {...svg} aria-hidden>
                <defs>
                  <filter id="h4-glow" x="-30%" y="-30%" width="160%" height="160%">
                    <feGaussianBlur stdDeviation="6" />
                  </filter>
                </defs>
                <g fill="none" stroke="#9fb3c8" strokeLinecap="round" strokeOpacity="0.4">
                  <path d={joined.secondary} strokeWidth="1" />
                  <path d={joined.major} strokeWidth="1.6" />
                </g>
                <g fill="none" stroke="#ffb547" strokeLinecap="round">
                  {paths?.new.map((p, i) => <path key={`g${i}`} d={p.d} strokeWidth="13" strokeOpacity="0.45" filter="url(#h4-glow)" />)}
                  {paths?.new.map((p, i) => <path key={i} d={p.d} strokeWidth="3.4" />)}
                </g>
              </svg>
            </div>

            <div className="absolute top-4 left-4 max-w-[calc(100%-32px)] rounded-card border border-[#e8edf5]/15 bg-[#05070c]/80 p-4 text-[#e8edf5] backdrop-blur-md sm:top-6 sm:left-6 sm:p-5" aria-live="polite">
              {mode === 'pixel' ? (
                <>
                  <p className="t-h2 tabular">{fmtInt(blobs)}</p>
                  <p className="mt-1 text-[15px] text-[#e8edf5]/80">changed regions flagged</p>
                  <p className="mt-3 max-w-xs text-[12px] leading-snug text-[#e8edf5]/60">
                    Real result: change-vector analysis on these two composites, threshold mean + 2σ, regions ≥ 4 pixels.
                  </p>
                </>
              ) : (
                <>
                  <p className="t-h2 tabular text-[#ffb547]">1</p>
                  <p className="mt-1 text-[15px] text-[#e8edf5]/80">new road</p>
                  <div className="mt-3 flex max-w-xs items-start gap-2">
                    <p className="text-[12px] leading-snug text-[#e8edf5]/60">
                      Reference geometry from OpenStreetMap. RoadWatch’s own detection replaces it after evaluation.
                    </p>
                  </div>
                  <DemoBadge className="mt-3" note="The single new road is the OpenStreetMap geometry of the Vijayawada West Bypass, not yet a RoadWatch model output." />
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
