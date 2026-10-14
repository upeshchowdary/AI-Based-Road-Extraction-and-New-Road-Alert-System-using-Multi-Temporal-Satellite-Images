import { ArrowUpRight, Orbit } from 'lucide-react'
import { ContourBg } from '@/components/brand/Brand'
import { Counter, SplitHeading } from '@/components/motion/SplitHeading'
import { ScrollReveal } from '@/components/motion/ScrollReveal'
import { DATA, useJson, type ZoneMeta } from '@/lib/data'

/**
 * Visual graphic for Card 1: 5-Day Sentinel-2 Orbital Revisit cycle
 */
function OrbitRevisitGraphic() {
  return (
    <div className="relative mb-6 h-28 w-full overflow-hidden rounded-[8px] border border-line-strong/60 bg-bg0/60 p-2.5">
      <div className="flex items-center justify-between text-[11px] font-mono text-sentinel-ink">
        <span>S2A/B CONSTELLATION</span>
        <span className="flex items-center gap-1.5 text-verified">
          <span className="size-1.5 animate-pulse rounded-full bg-verified" />
          5-DAY REVISIT
        </span>
      </div>
      <div className="mt-3 flex items-center justify-between gap-1.5 px-1">
        {[1, 2, 3, 4, 5].map((d) => (
          <div key={d} className="flex flex-1 flex-col items-center gap-1.5">
            <div
              className={`h-9 w-full rounded-[4px] border transition-all duration-300 flex items-center justify-center ${
                d === 5
                  ? 'border-sentinel/70 bg-sentinel/15 shadow-[0_0_12px_rgba(79,209,232,0.25)]'
                  : 'border-line bg-surface/50'
              }`}
            >
              {d === 5 ? (
                <Orbit className="size-4 text-sentinel animate-spin" style={{ animationDuration: '9s' }} />
              ) : (
                <span className="text-[10px] font-mono text-muted/60">T+{d}</span>
              )}
            </div>
            <span className="text-[10px] font-mono text-muted">Day {d}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

/**
 * Visual graphic for Card 2: 24.9 km highway corridor extraction
 */
function CorridorGraphic() {
  return (
    <div className="relative mb-6 h-28 w-full overflow-hidden rounded-[8px] border border-line-strong/60 bg-bg0/60 p-2.5">
      <div className="flex items-center justify-between text-[11px] font-mono text-signal-ink">
        <span>NH16 WEST BYPASS</span>
        <span className="text-fg">24.9 KM CORRIDOR</span>
      </div>
      <svg viewBox="0 0 260 60" className="mt-1 h-16 w-full" aria-hidden>
        {/* Existing road network */}
        <path d="M10 48 Q 60 45, 120 40 T 250 35" stroke="var(--road-existing)" strokeWidth="1.5" strokeOpacity="0.4" fill="none" />
        <path d="M90 42 L 80 12" stroke="var(--road-existing)" strokeWidth="1.2" strokeOpacity="0.3" fill="none" />
        <path d="M170 38 L 185 10" stroke="var(--road-existing)" strokeWidth="1.2" strokeOpacity="0.3" fill="none" />

        {/* New 6-lane highway in glowing amber */}
        <path
          d="M20 18 Q 80 20, 140 28 T 240 45"
          stroke="var(--signal)"
          strokeWidth="10"
          strokeOpacity="0.25"
          fill="none"
          strokeLinecap="round"
        />
        <path
          d="M20 18 Q 80 20, 140 28 T 240 45"
          stroke="var(--signal)"
          strokeWidth="2.5"
          fill="none"
          strokeLinecap="round"
          strokeDasharray="4 2"
        />
        {/* Krishna river crossing marker */}
        <circle cx="140" cy="28" r="4" fill="var(--bg-0)" stroke="var(--signal)" strokeWidth="1.5" />
      </svg>
    </div>
  )
}

/**
 * Visual graphic for Card 3: 1.63 lakh km² statewide satellite grid
 */
function StatewideGridGraphic() {
  return (
    <div className="relative mb-6 h-28 w-full overflow-hidden rounded-[8px] border border-line-strong/60 bg-bg0/60 p-2.5">
      <div className="flex items-center justify-between text-[11px] font-mono text-sentinel-ink">
        <span>ANDHRA PRADESH GRID</span>
        <span className="text-muted">6,200 TILES</span>
      </div>
      <div className="mt-2.5 grid grid-cols-12 gap-1 px-1">
        {Array.from({ length: 36 }).map((_, i) => (
          <div
            key={i}
            className={`h-3 rounded-[1.5px] transition-colors duration-500 ${
              i === 14 || i === 15 || i === 22 || i === 23
                ? 'bg-signal/80 shadow-[0_0_6px_rgba(255,181,71,0.4)]'
                : i % 3 === 0
                ? 'bg-sentinel/30'
                : 'bg-surface2/60'
            }`}
          />
        ))}
      </div>
      <div className="mt-2 flex items-center justify-between text-[10px] font-mono text-muted">
        <span>10m GSD RESOLUTION</span>
        <span className="text-signal-ink">ZONE A ACTIVE</span>
      </div>
    </div>
  )
}

/** H2 — facts and measurements with aerospace telemetry visualization. */
export function Problem() {
  const meta = useJson<ZoneMeta>(DATA.zoneMeta).data
  const facts = [
    {
      value: 5,
      unit: 'days',
      title: 'Satellite Revisit Cadence',
      text: 'between Sentinel-2 passes over the same place. The pictures keep coming; maps are updated by hand.',
      source: { label: 'ESA · Sentinel-2 mission', href: 'https://sentiwiki.copernicus.eu/web/s2-mission' },
      graphic: <OrbitRevisitGraphic />,
    },
    {
      value: meta?.reference_new_road.length_km_in_zone ?? 24.9,
      decimals: 1,
      unit: 'km',
      title: 'High-Speed Construction',
      text: 'of new six-lane highway crossed one 20 km zone near Vijayawada between our 2022 and 2024 composites.',
      source: { label: 'Our zone A composites · OSM way 1316819410', href: 'https://www.openstreetmap.org/way/1316819410' },
      graphic: <CorridorGraphic />,
    },
    {
      value: 1.63,
      decimals: 2,
      unit: 'lakh km²',
      title: 'Statewide Monitoring Scale',
      text: 'of Andhra Pradesh to watch — about 6,200 Sentinel-2 tiles every date. Too much to check by eye.',
      source: { label: 'OSM boundary, relation 2022095', href: 'https://www.openstreetmap.org/relation/2022095' },
      graphic: <StatewideGridGraphic />,
    },
  ]

  return (
    <section aria-labelledby="problem-title" className="section-y relative overflow-hidden border-t border-line bg-bg0">
      <ContourBg seed={2} opacity={0.45} />
      <div className="container-rw relative">
        <ScrollReveal variant="fade-up">
          <div className="flex items-center gap-2 mb-4">
            <span className="rw-chip">01 / The Challenge</span>
            <span className="h-px w-12 bg-line-strong" />
            <span className="text-[12px] font-mono text-muted">STATEWIDE RECONNAISSANCE</span>
          </div>
          <SplitHeading as="h2" className="t-display max-w-5xl text-fg">
            <span id="problem-title">
              Maps go stale. <span className="rw-gradient-amber">Roads don’t wait.</span>
            </span>
          </SplitHeading>
          <p className="mt-4 t-lead max-w-2xl text-muted">
            Ground truth shifts faster than cartographers can survey. The only scalable solution is autonomous orbit-to-vector change detection.
          </p>
        </ScrollReveal>

        <div className="mt-16 grid gap-6 md:grid-cols-3">
          {facts.map((f, i) => (
            <ScrollReveal
              key={f.unit}
              variant="fade-up"
              delay={i * 120}
              className="rw-border-glow rw-card-lift flex flex-col justify-between rounded-panel border border-line-strong/70 bg-gradient-to-b from-white/[0.04] to-transparent p-7 backdrop-blur-md md:p-8"
            >
              <div>
                {f.graphic}
                <p className="text-[13px] font-mono tracking-wider uppercase text-sentinel-ink">{f.title}</p>
                <div className="mt-2 flex items-baseline gap-2.5 text-fg">
                  <Counter value={f.value} decimals={f.decimals} className="t-h1 tabular font-semibold" />
                  <span className="text-[18px] font-mono text-muted">{f.unit}</span>
                </div>
                <p className="mt-4 text-[14px] leading-relaxed text-muted">{f.text}</p>
              </div>

              <div className="mt-8 border-t border-line/60 pt-4">
                <a
                  href={f.source.href}
                  target="_blank"
                  rel="noreferrer"
                  className="group inline-flex items-center gap-1.5 text-[12px] font-mono text-sentinel-ink hover:text-fg transition-colors"
                >
                  <span>{f.source.label}</span>
                  <ArrowUpRight className="size-3.5 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" strokeWidth={2} aria-hidden />
                </a>
              </div>
            </ScrollReveal>
          ))}
        </div>
      </div>
    </section>
  )
}
