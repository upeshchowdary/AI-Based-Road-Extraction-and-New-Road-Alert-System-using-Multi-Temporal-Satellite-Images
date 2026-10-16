import { ArrowRight, ArrowUpRight } from 'lucide-react'
import { Link } from 'react-router'
import { ContourBg } from '@/components/brand/Brand'
import { Magnetic } from '@/components/motion/Magnetic'
import { ScrollReveal } from '@/components/motion/ScrollReveal'
import { SplitHeading } from '@/components/motion/SplitHeading'
import { ButtonLink } from '@/components/ui/Button'
import { API, useJson } from '@/lib/data'

/* ---------------------------------------------------------------- H8 · results you can check */
export const KPIS = [
  { id: 'KPI-1', name: 'Road extraction accuracy', measure: 'IoU / F1, APLS on road graphs', target: '≥ ref + 3 pts' },
  { id: 'KPI-2', name: 'New-road detection', measure: 'Precision and recall', target: '≥ ref + 3 pts' },
  { id: 'KPI-3', name: 'False-alert rate', measure: 'vs pixel-difference baseline', target: '≥ 5% rel. gain' },
  { id: 'KPI-4', name: 'Independent-area coverage', measure: 'Held-out regions validated', target: '≥ 95%' },
  { id: 'KPI-5', name: 'Cross-region gap', measure: 'Performance gap between regions', target: '≤ 0.80 × ref' },
  { id: 'KPI-6', name: 'Registration error', measure: 'Alignment in pixels', target: '≤ 0.80 × ref' },
]

type Ci = { value: number; lo: number; hi: number; n: number }
type KpiRun = { run: string; splits: Record<string, { iou: Ci; f1: Ci }> }
const MEASURED = [
  { run: 's2_model_full_s0', title: 'Andhra Pradesh, Sentinel-2 10 m', detail: 'Tier-1 model on the frozen spatial holdout, zones A–C' },
  { run: 'baseline_a_full_s0', title: 'High-resolution 0.5 m imagery', detail: 'Baseline A on the DeepGlobe test split' },
]
const NEXT = KPIS.slice(1).map((k) => ({ ...k, when: k.id === 'KPI-2' ? 'Early check below' : 'CP2' }))

export function Results() {
  const res = useJson<{ kpis: KpiRun[] }>(API.kpis)
  const runs = res.data?.kpis ?? []
  return (
    <section aria-labelledby="res-title" className="section-y overflow-hidden border-t border-line bg-bg0">
      <div className="container-rw">
        <div className="grid gap-8 lg:grid-cols-12 lg:items-end">
          <div className="lg:col-span-7">
            <SplitHeading as="h2" className="t-h1 text-fg" id="res-title">
              Results you can check
            </SplitHeading>
            <ScrollReveal delay={100}>
              <p className="t-lead mt-5 max-w-xl text-muted">
                Measured on regions the model never saw in training, with 95% bootstrap confidence intervals. Numbers below are read live from the evaluated runs.
              </p>
            </ScrollReveal>
          </div>
          <div className="lg:col-span-5 lg:text-right">
            <Link to="/results" className="inline-flex items-center gap-1.5 text-sentinel-ink underline-offset-4 hover:underline">
              Method, datasets and limits
              <ArrowRight className="size-4" strokeWidth={1.75} aria-hidden />
            </Link>
          </div>
        </div>

        <ScrollReveal variant="stagger" as="ul" className="mt-12 grid gap-4 md:grid-cols-2">
          {MEASURED.map((m) => {
            const t = runs.find((r) => r.run === m.run)?.splits.test
            return (
              <li key={m.run} className="flex flex-col rounded-panel border border-line bg-surface p-7 shadow-[var(--shadow-panel)]">
                <div className="flex items-center justify-between gap-3">
                  <span className="t-mono text-[11px] tracking-widest text-muted uppercase">KPI-1 · road extraction</span>
                  <span className="rounded-chip bg-sentinel/10 px-2 py-0.5 text-[11px] font-medium text-sentinel-ink">Measured</span>
                </div>
                <h3 className="mt-5 text-[17px] leading-snug font-semibold text-fg">{m.title}</h3>
                <p className="mt-1 text-[13px] text-muted">{m.detail}</p>
                <dl className="mt-auto grid grid-cols-2 gap-6 pt-8">
                  {(['iou', 'f1'] as const).map((k) => (
                    <div key={k}>
                      <dt className="text-[12px] text-muted">{k === 'iou' ? 'IoU' : 'F1'}</dt>
                      <dd className="mt-1">
                        <span className="text-[40px] leading-none font-semibold tracking-tight text-fg tabular-nums">{t ? t[k].value.toFixed(2) : '—'}</span>
                        {t && (
                          <span className="t-mono mt-2 block text-[11px] text-muted">
                            95% CI {t[k].lo.toFixed(3)}–{t[k].hi.toFixed(3)} · n={t[k].n}
                          </span>
                        )}
                      </dd>
                    </div>
                  ))}
                </dl>
              </li>
            )
          })}
        </ScrollReveal>

        <ScrollReveal delay={120}>
          <div className="mt-4 grid gap-6 rounded-panel border border-line bg-surface p-7 md:grid-cols-[1fr_auto] md:items-center">
            <div>
              <span className="t-mono text-[11px] tracking-widest text-muted uppercase">KPI-2 · new-road detection · early check</span>
              <p className="mt-3 max-w-2xl text-[15px] leading-relaxed text-fg">
                Change detection over 2022–2026 raised <strong className="font-semibold">413 new-road alerts</strong> in the three pilot zones. On one known new road, the
                Vijayawada West Bypass, it recovered <strong className="font-semibold">43%</strong> of the length within 40 m. Precision is not measured yet: that needs the
                reviewed alerts.
              </p>
            </div>
            <ButtonLink to="/alerts" variant="subtle" size="md">
              Review the alerts
              <ArrowRight className="size-4" strokeWidth={1.75} aria-hidden />
            </ButtonLink>
          </div>
        </ScrollReveal>

        <ul className="mt-10 grid gap-x-8 border-t border-line sm:grid-cols-2 lg:grid-cols-5">
          {NEXT.map((k) => (
            <li key={k.id} className="border-b border-line py-4 lg:border-b-0">
              <span className="t-mono text-[11px] text-muted">{k.id}</span>
              <p className="mt-1 text-[14px] font-medium text-fg">{k.name}</p>
              <p className="mt-0.5 text-[12px] text-muted">
                {k.when === 'CP2' ? 'Not measured yet · CP2' : k.when}
              </p>
            </li>
          ))}
        </ul>
      </div>
    </section>
  )
}
/* ---------------------------------------------------------------- H9 · built on open data */
export const SOURCES = [
  { name: 'Copernicus Sentinel-2', role: 'Optical imagery, 10 m', licence: 'Copernicus open data terms', href: 'https://sentinels.copernicus.eu/' },
  { name: 'Copernicus Sentinel-1', role: 'Radar through clouds', licence: 'Copernicus open data terms', href: 'https://sentinels.copernicus.eu/' },
  { name: 'Microsoft Planetary Computer', role: 'Free STAC access to Sentinel data', licence: 'Data under source terms', href: 'https://planetarycomputer.microsoft.com/' },
  { name: 'OpenStreetMap', role: 'Road labels, boundaries, edit history', licence: 'ODbL 1.0', href: 'https://www.openstreetmap.org/copyright' },
  { name: 'Microsoft Road Detections', role: 'Extra road labels', licence: 'ODbL 1.0', href: 'https://github.com/microsoft/RoadDetections' },
  { name: 'NASA Visible Earth', role: 'Blue Marble and Black Marble globe', licence: 'Public domain', href: 'https://visibleearth.nasa.gov/' },
]

export function OpenData() {
  return (
    <section aria-labelledby="od-title" className="border-t border-line bg-bg1 py-24">
      <div className="container-rw">
        <ScrollReveal>
          <div className="flex flex-wrap items-baseline justify-between gap-4">
            <h2 id="od-title" className="t-h3 text-fg">
              Built on open data
            </h2>
            <p className="text-[14px] text-muted">Origin: Smart India Hackathon problem SIH1564, issued by NTRO.</p>
          </div>
        </ScrollReveal>
        <div className="rw-separator mt-8" />
        <ScrollReveal variant="stagger" as="ul" className="mt-0 grid border-b border-line sm:grid-cols-2 lg:grid-cols-3">
          {SOURCES.map((s) => (
            <li key={s.name} className="border-t border-line">
              <a href={s.href} target="_blank" rel="noreferrer" className="group flex h-full flex-col gap-1.5 py-6 pr-6 transition-all duration-300 hover:pl-2">
                <span className="flex items-center gap-1.5 text-[16px] font-medium text-fg">
                  {s.name}
                  <ArrowUpRight className="size-3.5 text-muted transition-all duration-300 group-hover:text-sentinel group-hover:translate-x-0.5 group-hover:-translate-y-0.5" strokeWidth={1.75} aria-hidden />
                </span>
                <span className="text-[14px] text-muted">{s.role}</span>
                <span className="t-mono text-[11px] text-muted opacity-70">{s.licence}</span>
              </a>
            </li>
          ))}
        </ScrollReveal>
      </div>
    </section>
  )
}

/* ---------------------------------------------------------------- H10 · final CTA */
export function FinalCta() {
  return (
    <section aria-labelledby="cta-title" className="relative overflow-hidden border-t border-line bg-bg0 py-[clamp(112px,13vw,200px)]">
      <ContourBg seed={7} drift opacity={0.7} />
      <div className="container-rw relative">
        <SplitHeading as="h2" className="t-display max-w-5xl text-balance leading-[0.9]">
          <span id="cta-title">
            Watch the map{' '}
            <span style={{ color: 'var(--signal)', fontFamily: 'var(--font-serif)', fontStyle: 'italic' }}>rewrite itself.</span>
          </span>
        </SplitHeading>

        <ScrollReveal delay={200}>
          <div className="mt-12 flex flex-wrap items-center gap-4">
            <Magnetic>
              <ButtonLink to="/map" variant="signal" size="lg">
                Open the map
                <ArrowRight className="size-4" strokeWidth={1.75} aria-hidden />
              </ButtonLink>
            </Magnetic>
            <ButtonLink to="/results" variant="ghost" size="lg">
              See the results
            </ButtonLink>
          </div>
        </ScrollReveal>
      </div>
    </section>
  )
}
