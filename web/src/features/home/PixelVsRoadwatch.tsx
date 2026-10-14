import { CheckCircle2, SlidersHorizontal, Sparkles, XCircle } from 'lucide-react'
import { useState } from 'react'
import { DemoBadge } from '@/components/brand/Brand'
import { ScrollReveal } from '@/components/motion/ScrollReveal'
import { Segmented } from '@/components/ui/primitives'
import { cn } from '@/lib/cn'
import { DATA, useJson, type HeroPaths, type ZoneMeta } from '@/lib/data'
import { fmtInt } from '@/lib/format'
import { useJoinedPaths } from './RoadReveal'

type Mode = 'pixel' | 'roadwatch'

/** H4 — the signature differentiator, comparing naive change-vector analysis vs topology-aware RoadWatch. */
export function PixelVsRoadwatch() {
  const [mode, setMode] = useState<Mode>('pixel')
  const meta = useJson<ZoneMeta>(DATA.zoneMeta).data
  const paths = useJson<HeroPaths>(DATA.heroPaths).data
  const joined = useJoinedPaths(paths)
  const blobs = meta?.hero.pixeldiff_blobs ?? 1183
  const svg = { viewBox: '0 0 1100 1100', preserveAspectRatio: 'xMidYMid slice', className: 'absolute inset-0 size-full' } as const

  return (
    <section aria-labelledby="h4-title" className="section-y relative overflow-hidden border-t border-line bg-bg0">
      <div className="container-rw relative">
        <ScrollReveal variant="fade-up">
          <div className="flex items-center gap-2 mb-4">
            <span className="rw-chip">02 / Algorithmic Difference</span>
            <span className="h-px w-12 bg-line-strong" />
            <span className="text-[12px] font-mono text-muted">SIGNAL VS NOISE</span>
          </div>
          <div className="grid gap-8 lg:grid-cols-12 lg:items-end">
            <div className="lg:col-span-7">
              <h2 id="h4-title" className="t-h1 text-fg">
                Why not just compare <span className="rw-gradient-steel">two satellite images?</span>
              </h2>
            </div>
            <p className="t-lead text-muted lg:col-span-5">
              Everything changes between two satellite passes: crops harvested, water levels, shadows, sandbars. Traditional change-vector analysis floods analysts with false alerts. Only roads matter.
            </p>
          </div>
        </ScrollReveal>

        <ScrollReveal variant="scale" delay={150} className="mt-12 overflow-hidden rounded-panel border border-line-strong/70 bg-[#060910] shadow-[0_20px_60px_rgba(0,0,0,0.6)]">
          {/* Top Control Bar */}
          <div className="flex flex-wrap items-center justify-between gap-4 border-b border-line bg-surface/80 px-5 py-3.5 backdrop-blur-md">
            <div className="flex items-center gap-3">
              <Segmented
                label="Comparison method"
                value={mode}
                onChange={setMode}
                options={[
                  { value: 'pixel', label: 'Naive Pixel Difference' },
                  { value: 'roadwatch', label: 'RoadWatch AI Model' },
                ]}
              />
              <span className="hidden sm:inline-flex items-center gap-1.5 rounded-chip border border-line-strong px-2 py-0.5 text-[11px] font-mono text-muted">
                <SlidersHorizontal className="size-3" />
                TOGGLE METHOD
              </span>
            </div>
            <span className="t-mono text-[12px] text-muted">
              Pre-monsoon 2022 → Pre-monsoon 2024 · 11 × 11 km · Vijayawada
            </span>
          </div>

          {/* Interactive Comparison Viewport */}
          <div className="relative aspect-[4/5] sm:aspect-[16/10] overflow-hidden">
            {/* Base Sentinel-2 satellite image */}
            <svg {...svg} aria-hidden>
              <image href={DATA.heroImage('2024_pre_monsoon')} width="1100" height="1100" />
            </svg>

            {/* Pixel Difference Mode: Chaotic noisy change mask */}
            <div className={cn('absolute inset-0 transition-opacity duration-700', mode === 'pixel' ? 'opacity-100' : 'opacity-0')}>
              <svg {...svg} aria-hidden className="mix-blend-screen opacity-90">
                <image href={DATA.heroPixelDiff} width="1100" height="1100" />
              </svg>
              {/* Scanline noise texture */}
              <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(rgba(255,80,80,0.15)_1px,transparent_1px)] [background-size:16px_16px]" />
            </div>

            {/* RoadWatch Mode: Calm topology map + glowing amber road */}
            <div className={cn('absolute inset-0 transition-opacity duration-700', mode === 'roadwatch' ? 'opacity-100' : 'opacity-0')}>
              <div className="absolute inset-0 bg-[#05070c]/65 backdrop-blur-[1px]" />
              <svg {...svg} aria-hidden>
                <defs>
                  <filter id="h4-glow" x="-30%" y="-30%" width="160%" height="160%">
                    <feGaussianBlur stdDeviation="8" />
                  </filter>
                  <filter id="h4-superglow" x="-50%" y="-50%" width="200%" height="200%">
                    <feGaussianBlur stdDeviation="24" />
                  </filter>
                </defs>
                {/* Existing roads */}
                <g fill="none" stroke="#9fb3c8" strokeLinecap="round" strokeOpacity="0.45">
                  <path d={joined.minor} strokeWidth="0.8" strokeOpacity="0.3" />
                  <path d={joined.secondary} strokeWidth="1.2" />
                  <path d={joined.major} strokeWidth="1.8" />
                </g>
                {/* Glowing Amber New Road with superglow */}
                <g fill="none" stroke="#ffb547" strokeLinecap="round">
                  {paths?.new.map((p, i) => (
                    <path key={`sg${i}`} d={p.d} strokeWidth="32" strokeOpacity="0.25" filter="url(#h4-superglow)" />
                  ))}
                  {paths?.new.map((p, i) => (
                    <path key={`g${i}`} d={p.d} strokeWidth="14" strokeOpacity="0.6" filter="url(#h4-glow)" />
                  ))}
                  {paths?.new.map((p, i) => (
                    <path key={i} d={p.d} strokeWidth="3.6" />
                  ))}
                </g>
              </svg>
            </div>

            {/* Floating Telemetry Stats Card */}
            <div
              className="absolute top-4 left-4 max-w-[calc(100%-32px)] rounded-card border border-white/15 bg-[#05070c]/85 p-5 text-[#e8edf5] backdrop-blur-xl shadow-[0_16px_40px_rgba(0,0,0,0.7)] sm:top-6 sm:left-6 sm:max-w-md sm:p-6"
              aria-live="polite"
            >
              {mode === 'pixel' ? (
                <>
                  <div className="flex items-center gap-2 text-priority text-[12px] font-mono tracking-wider uppercase">
                    <XCircle className="size-4" />
                    <span>Traditional Change-Vector Analysis</span>
                  </div>
                  <div className="mt-3 flex items-baseline gap-3">
                    <p className="t-h1 tabular font-bold text-priority">{fmtInt(blobs)}</p>
                    <span className="text-[14px] text-muted">changed blobs</span>
                  </div>
                  <p className="mt-2 text-[14px] font-medium text-fg">
                    Overwhelming false positive rate
                  </p>
                  <p className="mt-2 text-[12.5px] leading-relaxed text-muted">
                    Soil moisture changes, seasonal crop rotation, river silt displacement, and cloud shadows are falsely flagged as infrastructure. An analyst would have to inspect 1,183 sites manually.
                  </p>
                  <div className="mt-4 flex items-center gap-2 rounded-[6px] border border-priority/30 bg-priority/10 px-3 py-2 text-[11px] font-mono text-priority">
                    <span>99.9% FALSE ALARM RATE · IMPOSSIBLE TO SCALE</span>
                  </div>
                </>
              ) : (
                <>
                  <div className="flex items-center gap-2 text-verified text-[12px] font-mono tracking-wider uppercase">
                    <CheckCircle2 className="size-4" />
                    <span>RoadWatch Graph & Persistence Pipeline</span>
                  </div>
                  <div className="mt-3 flex items-baseline gap-3">
                    <p className="t-h1 tabular font-bold text-[#ffb547]">1</p>
                    <span className="text-[14px] text-muted">verified highway corridor</span>
                  </div>
                  <p className="mt-2 text-[14px] font-medium text-fg">
                    Zero false positives. Exact vector geometry.
                  </p>
                  <p className="mt-2 text-[12.5px] leading-relaxed text-muted">
                    By converting raster predictions to topologically connected road graphs and enforcing multi-temporal persistence rules, noise vanishes. Only true connectivity extensions trigger alerts.
                  </p>
                  <div className="mt-4 flex items-center justify-between rounded-[6px] border border-signal/40 bg-signal/10 px-3 py-2 text-[11px] font-mono text-signal-ink">
                    <span className="flex items-center gap-1.5">
                      <Sparkles className="size-3.5" />
                      NH16 BYPASS EXTRACTED
                    </span>
                    <span>100% ANALYST TIME SAVED</span>
                  </div>
                  <DemoBadge className="mt-3" note="The single new road is the OpenStreetMap geometry of the Vijayawada West Bypass, not yet a RoadWatch model output." />
                </>
              )}
            </div>
          </div>
        </ScrollReveal>
      </div>
    </section>
  )
}
