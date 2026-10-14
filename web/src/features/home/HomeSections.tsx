import { ArrowRight, ArrowUpRight } from 'lucide-react'
import { Link } from 'react-router'
import { ContourBg, ScanLine } from '@/components/brand/Brand'
import { Magnetic } from '@/components/motion/Magnetic'
import { ScrollReveal } from '@/components/motion/ScrollReveal'
import { SplitHeading } from '@/components/motion/SplitHeading'
import { SOLUTIONS, Vignette } from '@/components/site/SiteNav'
import { ButtonLink } from '@/components/ui/Button'

/* ---------------------------------------------------------------- H7 · who it's for */
const AUDIENCE_DETAIL: Record<string, string[]> = {
  security: ['Priority zones you draw', 'High-priority alerts first', 'Before/after proof for every alert'],
  'rural-road-audit': ['Upload a GeoSadak shapefile', 'Sanctioned vs detected length', 'First-seen date per segment'],
  planning: ['Villages newly connected', 'Travel-time change', 'Exports for QGIS'],
}

export function Audiences() {
  return (
    <section aria-labelledby="aud-title" className="section-y border-t border-line bg-bg1 overflow-hidden">
      <div className="container-rw">
        <ScrollReveal>
          <span className="rw-chip mb-5">For every use case</span>
        </ScrollReveal>
        <SplitHeading as="h2" className="t-h1 max-w-2xl text-fg mt-3" id="aud-title">
          Who it&apos;s for
        </SplitHeading>
        <ScrollReveal variant="stagger" as="ul" className="mt-14 flex flex-col gap-4 lg:h-[540px] lg:flex-row">
          {SOLUTIONS.map((s) => (
            <li key={s.slug} className="group min-w-0 lg:flex-1 lg:transition-[flex-grow] lg:duration-700 lg:ease-out-expo lg:hover:flex-[1.7] lg:focus-within:flex-[1.7]">
              <Link
                to="/explore"
                className="rw-border-glow flex h-full flex-col overflow-hidden rounded-panel border border-line bg-surface transition-all duration-300 hover:border-line-strong hover:bg-surface-2 rw-card-lift"
              >
                <div className="relative overflow-hidden border-b border-line lg:flex-1">
                  <Vignette kind={s.slug} className="aspect-[16/10] h-full w-full object-cover lg:aspect-auto" animate />
                  {/* Gradient overlay on image */}
                  <div className="absolute inset-0 bg-gradient-to-t from-surface/60 to-transparent opacity-0 transition-opacity duration-500 group-hover:opacity-100" />
                </div>
                <div className="p-6">
                  <div className="flex items-start justify-between gap-4">
                    <h3 className="t-h3 text-fg">{s.title}</h3>
                    <ArrowUpRight className="mt-1 size-5 shrink-0 text-muted transition-all duration-300 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 group-hover:text-signal" strokeWidth={1.5} aria-hidden />
                  </div>
                  <p className="mt-2 text-[15px] text-muted">{s.line}</p>
                  <ul className="mt-4 space-y-2 text-[14px] text-fg lg:max-h-0 lg:overflow-hidden lg:opacity-0 lg:transition-[max-height,opacity] lg:duration-500 lg:group-focus-within:max-h-40 lg:group-focus-within:opacity-100 lg:group-hover:max-h-40 lg:group-hover:opacity-100">
                    {AUDIENCE_DETAIL[s.slug].map((d) => (
                      <li key={d} className="flex items-center gap-2.5">
                        <span className="h-px w-4 bg-gradient-to-r from-sentinel to-signal opacity-80" aria-hidden />
                        {d}
                      </li>
                    ))}
                  </ul>
                </div>
              </Link>
            </li>
          ))}
        </ScrollReveal>
      </div>
    </section>
  )
}

/* ---------------------------------------------------------------- H8 · results you can check */
export const KPIS = [
  { id: 'KPI-1', name: 'Road extraction accuracy', measure: 'IoU / F1, APLS on road graphs', target: '≥ ref + 3 pts' },
  { id: 'KPI-2', name: 'New-road detection', measure: 'Precision and recall', target: '≥ ref + 3 pts' },
  { id: 'KPI-3', name: 'False-alert rate', measure: 'vs pixel-difference baseline', target: '≥ 5% rel. gain' },
  { id: 'KPI-4', name: 'Independent-area coverage', measure: 'Held-out regions validated', target: '≥ 95%' },
  { id: 'KPI-5', name: 'Cross-region gap', measure: 'Performance gap between regions', target: '≤ 0.80 × ref' },
  { id: 'KPI-6', name: 'Registration error', measure: 'Alignment in pixels', target: '≤ 0.80 × ref' },
]

export function Results() {
  return (
    <section aria-labelledby="res-title" className="section-y border-t border-line bg-bg0 overflow-hidden rw-ambient-amber">
      <div className="container-rw">
        <div className="grid gap-8 lg:grid-cols-12 lg:items-end">
          <div className="lg:col-span-7">
            <ScrollReveal>
              <span className="rw-chip mb-5">Measured on held-out regions</span>
            </ScrollReveal>
            <SplitHeading as="h2" className="t-h1 text-fg mt-3" id="res-title">
              Results you can check
            </SplitHeading>
            <ScrollReveal delay={100}>
              <p className="t-lead mt-5 max-w-xl text-muted">
                Every number measured on held-out regions the model never saw, with 95% confidence intervals.
                Evaluation runs after training; until then this section shows the targets.
              </p>
            </ScrollReveal>
          </div>
          <div className="lg:col-span-5 lg:text-right">
            <ScrollReveal delay={200}>
              <Link to="/research" className="inline-flex items-center gap-1.5 text-sentinel-ink underline-offset-4 hover:underline">
                Method, datasets and limits
                <ArrowRight className="size-4" strokeWidth={1.75} aria-hidden />
              </Link>
            </ScrollReveal>
          </div>
        </div>

        <ScrollReveal variant="stagger" as="ul" className="mt-12 grid gap-px overflow-hidden rounded-panel border border-line bg-line sm:grid-cols-2 lg:grid-cols-3">
          {KPIS.map((k) => (
            <li key={k.id} className="rw-border-glow flex flex-col bg-bg0 p-7 transition-colors duration-300 hover:bg-surface">
              <div className="flex items-center justify-between">
                <span className="t-mono text-[11px] text-muted tracking-widest uppercase">{k.id}</span>
                <span className="rounded-chip border border-dashed border-line-strong px-2 py-0.5 text-[11px] text-muted">
                  Pending evaluation
                </span>
              </div>
              <h3 className="mt-5 text-[17px] font-semibold text-fg leading-snug">{k.name}</h3>
              <p className="mt-1.5 text-[13px] text-muted">{k.measure}</p>
              <p className="mt-auto pt-6 text-[12px] text-muted">
                Target <span className="t-mono rw-text-amber">{k.target}</span>
              </p>
            </li>
          ))}
        </ScrollReveal>

        <ScrollReveal delay={150}>
          <figure className="mt-6 rounded-panel border border-line bg-surface p-7">
            <figcaption className="flex flex-wrap items-baseline justify-between gap-2">
              <span className="text-[15px] font-medium text-fg">False alerts per 100 km² — pixel difference vs RoadWatch</span>
              <span className="text-[13px] text-muted">Bars fill in when the held-out evaluation runs.</span>
            </figcaption>
            <div className="mt-6 space-y-4" aria-hidden>
              {['Pixel-difference baseline', 'RoadWatch'].map((l, i) => (
                <div key={l} className="grid grid-cols-[190px_1fr] items-center gap-4 text-[13px] max-sm:grid-cols-1 max-sm:gap-1.5">
                  <span className={i === 0 ? 'text-muted' : 'text-signal-ink font-medium'}>{l}</span>
                  <div className={`h-7 rounded-[4px] border ${i === 0 ? 'border-dashed border-line-strong' : 'border-dashed border-signal/40 bg-signal/5'}`} />
                </div>
              ))}
            </div>
          </figure>
        </ScrollReveal>
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
      <ScanLine className="rw-cta-scan" />

      {/* Ambient glow orbs */}
      <div
        aria-hidden
        className="pointer-events-none absolute -left-32 top-0 h-[600px] w-[600px] rounded-full opacity-[0.08]"
        style={{ background: 'radial-gradient(circle, #ffb547 0%, transparent 70%)' }}
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -right-32 bottom-0 h-[500px] w-[500px] rounded-full opacity-[0.07]"
        style={{ background: 'radial-gradient(circle, #4fd1e8 0%, transparent 70%)' }}
      />

      <div className="container-rw relative">
        <ScrollReveal>
          <span className="rw-chip mb-8">The road is out there</span>
        </ScrollReveal>
        <SplitHeading as="h2" className="t-display max-w-5xl text-balance leading-[0.9]">
          <span id="cta-title">
            Watch the map{' '}
            <span
              style={{
                background: 'linear-gradient(135deg, #ffb547 0%, #ff8c42 55%, #ffda80 100%)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                backgroundClip: 'text',
                fontFamily: 'var(--font-serif)',
                fontStyle: 'italic',
              }}
            >
              rewrite itself.
            </span>
          </span>
        </SplitHeading>

        <ScrollReveal delay={200}>
          <div className="mt-12 flex flex-wrap items-center gap-4">
            <Magnetic>
              <ButtonLink to="/explore" variant="signal" size="lg">
                Explore live demo
                <ArrowRight className="size-4" strokeWidth={1.75} aria-hidden />
              </ButtonLink>
            </Magnetic>
            <ButtonLink to="/research" variant="ghost" size="lg">
              Read the research
            </ButtonLink>
          </div>
        </ScrollReveal>
      </div>
    </section>
  )
}
