import { ArrowUpRight } from 'lucide-react'
import { ContourBg } from '@/components/brand/Brand'
import { Counter, SplitHeading } from '@/components/motion/SplitHeading'
import { DATA, useJson, type ZoneMeta } from '@/lib/data'

/** H2 — only cited facts or our own measurements. */
export function Problem() {
  const meta = useJson<ZoneMeta>(DATA.zoneMeta).data
  const facts = [
    {
      value: 5,
      unit: 'days',
      text: 'between Sentinel-2 passes over the same place. The pictures keep coming; maps are updated by hand.',
      source: { label: 'ESA · Sentinel-2 mission', href: 'https://sentiwiki.copernicus.eu/web/s2-mission' },
    },
    {
      value: meta?.reference_new_road.length_km_in_zone ?? 24.9,
      decimals: 1,
      unit: 'km',
      text: 'of new six-lane highway crossed one 20 km zone near Vijayawada between our 2022 and 2024 composites.',
      source: { label: 'Our zone A composites · OSM way 1316819410', href: 'https://www.openstreetmap.org/way/1316819410' },
    },
    {
      value: 1.63,
      decimals: 2,
      unit: 'lakh km²',
      text: 'of Andhra Pradesh to watch — about 6,200 Sentinel-2 tiles every date. Too much to check by eye.',
      source: { label: 'OSM boundary, relation 2022095', href: 'https://www.openstreetmap.org/relation/2022095' },
    },
  ]
  return (
    <section aria-labelledby="problem-title" className="section-y relative overflow-hidden border-t border-line bg-bg0">
      <ContourBg seed={2} opacity={0.4} />
      <div className="container-rw relative">
        <SplitHeading as="h2" className="t-display max-w-5xl text-fg">
          <span id="problem-title">
            Maps go stale. <span className="text-muted">Roads don’t wait.</span>
          </span>
        </SplitHeading>
        <ol className="mt-20 grid gap-px overflow-hidden rounded-panel border border-line bg-line md:grid-cols-3">
          {facts.map((f) => (
            <li key={f.unit} className="flex flex-col bg-bg0 p-7 md:p-9">
              <p className="flex items-baseline gap-2 text-fg">
                <Counter value={f.value} decimals={f.decimals} className="t-h1 tabular" />
                <span className="text-[17px] text-muted">{f.unit}</span>
              </p>
              <p className="mt-4 flex-1 text-[15px] leading-relaxed text-muted">{f.text}</p>
              <a
                href={f.source.href}
                target="_blank"
                rel="noreferrer"
                className="mt-6 inline-flex items-center gap-1 self-start text-[13px] text-sentinel-ink underline-offset-4 hover:underline"
              >
                {f.source.label}
                <ArrowUpRight className="size-3.5" strokeWidth={1.75} aria-hidden />
              </a>
            </li>
          ))}
        </ol>
      </div>
    </section>
  )
}
