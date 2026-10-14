import { ArrowRight, ArrowUpRight } from 'lucide-react'
import { Link } from 'react-router'
import { ContourBg, ScanLine } from '@/components/brand/Brand'
import { Magnetic } from '@/components/motion/Magnetic'
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
    <section aria-labelledby="aud-title" className="section-y border-t border-line bg-bg1">
      <div className="container-rw">
        <h2 id="aud-title" className="t-h1 max-w-2xl text-fg">
          Who it’s for
        </h2>
        <ul className="mt-14 flex flex-col gap-3 lg:h-[520px] lg:flex-row">
          {SOLUTIONS.map((s) => (
            <li key={s.slug} className="group min-w-0 lg:flex-1 lg:transition-[flex-grow] lg:duration-700 lg:ease-out-expo lg:hover:flex-[1.7] lg:focus-within:flex-[1.7]">
              <Link
                to={`/solutions/${s.slug}`}
                className="flex h-full flex-col overflow-hidden rounded-panel border border-line bg-surface transition-colors duration-300 hover:border-line-strong"
              >
                <div className="relative overflow-hidden border-b border-line lg:flex-1">
                  <Vignette kind={s.slug} className="aspect-[16/10] h-full w-full object-cover lg:aspect-auto" animate />
                </div>
                <div className="p-6">
                  <div className="flex items-start justify-between gap-4">
                    <h3 className="t-h3 text-fg">{s.title}</h3>
                    <ArrowUpRight className="mt-1 size-5 shrink-0 text-muted transition-transform duration-300 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 group-hover:text-fg" strokeWidth={1.5} aria-hidden />
                  </div>
                  <p className="mt-2 text-[15px] text-muted">{s.line}</p>
                  <ul className="mt-4 space-y-1.5 text-[14px] text-fg lg:max-h-0 lg:overflow-hidden lg:opacity-0 lg:transition-[max-height,opacity] lg:duration-500 lg:group-focus-within:max-h-40 lg:group-focus-within:opacity-100 lg:group-hover:max-h-40 lg:group-hover:opacity-100">
                    {AUDIENCE_DETAIL[s.slug].map((d) => (
                      <li key={d} className="flex items-center gap-2">
                        <span className="h-px w-3 bg-sentinel" aria-hidden />
                        {d}
                      </li>
                    ))}
                  </ul>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </section>
  )
}

/* ---------------------------------------------------------------- H8 · results you can check */
export const KPIS = [
  { id: 'KPI-1', name: 'Road extraction accuracy', measure: 'IoU / F1, APLS on road graphs', target: '≥ reference + 3 points' },
  { id: 'KPI-2', name: 'New-road detection', measure: 'Precision and recall', target: '≥ reference + 3 points' },
  { id: 'KPI-3', name: 'False-alert rate', measure: 'vs pixel-difference baseline', target: '≥ 5% relative improvement' },
  { id: 'KPI-4', name: 'Independent-area coverage', measure: 'Held-out regions validated', target: '≥ 95%' },
  { id: 'KPI-5', name: 'Cross-region gap', measure: 'Performance gap between regions', target: '≤ 0.80 × reference' },
  { id: 'KPI-6', name: 'Registration error', measure: 'Alignment in pixels', target: '≤ 0.80 × reference' },
]

export function Results() {
  return (
    <section aria-labelledby="res-title" className="section-y border-t border-line bg-bg0">
      <div className="container-rw">
        <div className="grid gap-8 lg:grid-cols-12 lg:items-end">
          <div className="lg:col-span-7">
            <h2 id="res-title" className="t-h1 text-fg">
              Results you can check
            </h2>
            <p className="t-lead mt-5 max-w-xl text-muted">
              Every number here will be measured on held-out regions the model never saw, with 95% confidence intervals. Evaluation runs
              after training; until then this section shows the targets, not results.
            </p>
          </div>
          <div className="lg:col-span-5 lg:text-right">
            <Link to="/research" className="inline-flex items-center gap-1.5 text-sentinel-ink underline-offset-4 hover:underline">
              Method, datasets and limits
              <ArrowRight className="size-4" strokeWidth={1.75} aria-hidden />
            </Link>
          </div>
        </div>

        <ul className="mt-12 grid gap-px overflow-hidden rounded-panel border border-line bg-line sm:grid-cols-2 lg:grid-cols-3">
          {KPIS.map((k) => (
            <li key={k.id} className="flex flex-col bg-bg0 p-6">
              <div className="flex items-center justify-between">
                <span className="t-mono text-muted">{k.id}</span>
                <span className="rounded-chip border border-dashed border-line-strong px-2 py-0.5 text-[12px] text-muted">Pending evaluation</span>
              </div>
              <h3 className="mt-5 text-[19px] font-medium text-fg">{k.name}</h3>
              <p className="mt-1 text-[14px] text-muted">{k.measure}</p>
              <p className="mt-6 text-[13px] text-muted">
                Target <span className="t-mono text-fg">{k.target}</span>
              </p>
            </li>
          ))}
        </ul>

        <figure className="mt-6 rounded-panel border border-line p-6">
          <figcaption className="flex flex-wrap items-baseline justify-between gap-2">
            <span className="text-[15px] text-fg">False alerts per 100 km² — pixel difference vs RoadWatch</span>
            <span className="text-[13px] text-muted">Bars fill in when the held-out evaluation runs.</span>
          </figcaption>
          <div className="mt-5 space-y-3" aria-hidden>
            {['Pixel-difference baseline', 'RoadWatch'].map((l) => (
              <div key={l} className="grid grid-cols-[180px_1fr] items-center gap-4 text-[13px] text-muted max-sm:grid-cols-1 max-sm:gap-1.5">
                <span>{l}</span>
                <div className="h-6 rounded-[4px] border border-dashed border-line-strong" />
              </div>
            ))}
          </div>
        </figure>
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
    <section aria-labelledby="od-title" className="border-t border-line bg-bg1 py-20">
      <div className="container-rw">
        <div className="flex flex-wrap items-baseline justify-between gap-4">
          <h2 id="od-title" className="t-h3 text-fg">
            Built on open data
          </h2>
          <p className="text-[14px] text-muted">Origin: Smart India Hackathon problem SIH1564, issued by NTRO.</p>
        </div>
        <ul className="mt-8 grid border-t border-line sm:grid-cols-2 lg:grid-cols-3">
          {SOURCES.map((s) => (
            <li key={s.name} className="border-b border-line">
              <a href={s.href} target="_blank" rel="noreferrer" className="group flex h-full flex-col gap-1 py-5 pr-6">
                <span className="flex items-center gap-1.5 text-[16px] font-medium text-fg">
                  {s.name}
                  <ArrowUpRight className="size-3.5 text-muted transition-colors group-hover:text-fg" strokeWidth={1.75} aria-hidden />
                </span>
                <span className="text-[14px] text-muted">{s.role}</span>
                <span className="t-mono text-[12px] text-muted">{s.licence}</span>
              </a>
            </li>
          ))}
        </ul>
      </div>
    </section>
  )
}

/* ---------------------------------------------------------------- H10 · final CTA */
export function FinalCta() {
  return (
    <section aria-labelledby="cta-title" className="relative overflow-hidden border-t border-line bg-bg0 py-[clamp(112px,13vw,200px)]">
      <ContourBg seed={7} drift opacity={0.55} />
      <ScanLine className="rw-cta-scan" />
      <div className="container-rw relative">
        <SplitHeading as="h2" className="t-display max-w-5xl text-balance text-fg">
          <span id="cta-title">
            Watch the map <span className="t-serif">rewrite itself.</span>
          </span>
        </SplitHeading>
        <div className="mt-12 flex flex-wrap items-center gap-3">
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
      </div>
    </section>
  )
}
