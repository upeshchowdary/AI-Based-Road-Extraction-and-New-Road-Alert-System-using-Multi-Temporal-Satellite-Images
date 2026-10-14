import { Check, Minus } from 'lucide-react'
import { useEffect, useState } from 'react'
import { PageIntro, Section } from '@/components/site/PageIntro'
import { Vignette } from '@/components/site/SiteNav'
import { cn } from '@/lib/cn'

const CAPS = [
  { id: 'graph', t: 'Graph-level change detection', d: 'Roads are compared as networks across dates. A new road must extend or connect like a real one, which rules out most field edges and canals.', v: 'planning' as const },
  { id: 'persist', t: 'Persistence rule', d: 'A candidate has to appear on two or more later dates before you’re alerted. Seasonal mud and crop patterns rarely survive.', v: 'rural-road-audit' as const },
  { id: 'abstain', t: 'Abstain mode', d: 'Cloud, shadow, tree cover or misregistration mark a tile unreliable — hatched on the map — instead of producing a guess.', v: 'security' as const },
  { id: 'monsoon', t: 'Monsoon-proof', d: 'Sentinel-1 radar sees through cloud, so roads built during the monsoon are not missed until November.', v: 'security' as const },
  { id: 'stages', t: 'Construction stages', d: 'Each alert tracks cleared → earthwork → gravel → paved, so you know whether work is starting or finished.', v: 'planning' as const },
  { id: 'audit', t: 'PMGSY audit', d: 'Upload a sanctioned road and get sanctioned vs detected length, first-seen dates and before/after chips as a PDF.', v: 'rural-road-audit' as const },
  { id: 'zones', t: 'Priority zones', d: 'Draw sensitive areas. New roads inside them are raised immediately and can notify by Telegram or email.', v: 'security' as const },
  { id: 'connect', t: 'Connectivity impact', d: 'See which villages a new road connects and how travel time changes, computed on the road graph.', v: 'planning' as const },
  { id: 'ask', t: 'Plain-English questions', d: 'Ask “new roads near Gannavaram since 2023”. The answer is a map and a table, with the query shown.', v: 'planning' as const },
  { id: 'offline', t: 'Offline mode', d: 'Once data is cached the whole stack runs without internet, and external services switch off.', v: 'security' as const },
  { id: 'exports', t: 'QGIS-ready exports', d: 'Shapefile, GeoPackage and GeoJSON in the right coordinate system.', v: 'rural-road-audit' as const },
]

type Cell = boolean | string
const ROWS: [string, Cell, Cell, Cell][] = [
  ['Covers a whole state every season', true, true, 'Slow'],
  ['Separates roads from crops, water and shadow', true, false, true],
  ['Says “unreliable” instead of guessing', true, false, 'Varies'],
  ['Needs a second date to confirm', true, false, false],
  ['Exact geometry for narrow village roads', 'With high-res', false, true],
  ['Before/after proof for every change', true, 'Images only', 'Manual'],
  ['Cost per update', 'Free imagery + compute', 'Low', 'High (people-hours)'],
]

function Mark({ v }: { v: Cell }) {
  if (v === true) return <Check className="size-4 text-verified" strokeWidth={2} aria-label="Yes" />
  if (v === false) return <Minus className="size-4 text-muted" strokeWidth={2} aria-label="No" />
  return <span className="text-[14px] text-muted">{v}</span>
}

export default function CapabilitiesPage() {
  const [active, setActive] = useState(CAPS[0].id)
  useEffect(() => {
    const io = new IntersectionObserver(
      (es) => {
        for (const e of es) if (e.isIntersecting) setActive(e.target.id)
      },
      { rootMargin: '-45% 0px -50% 0px' },
    )
    CAPS.forEach((c) => {
      const el = document.getElementById(c.id)
      if (el) io.observe(el)
    })
    return () => io.disconnect()
  }, [])
  return (
    <>
      <PageIntro docTitle="Capabilities" title="Capabilities" lead="Each one exists to cut a false alert or to prove a real one." />
      <section className="border-b border-line">
        <div className="container-rw grid gap-12 py-20 lg:grid-cols-[260px_minmax(0,1fr)]">
          <nav aria-label="Capabilities" className="hidden lg:block">
            <ol className="sticky top-28 space-y-1 border-l border-line">
              {CAPS.map((c) => (
                <li key={c.id}>
                  <a href={`#${c.id}`} aria-current={active === c.id ? 'true' : undefined} className={cn('-ml-px block border-l py-1.5 pl-4 text-[14px] transition-colors', active === c.id ? 'border-sentinel text-fg' : 'border-transparent text-muted hover:text-fg')}>
                    {c.t}
                  </a>
                </li>
              ))}
            </ol>
          </nav>
          <div className="space-y-6">
            {CAPS.map((c) => (
              <article key={c.id} id={c.id} className="grid scroll-mt-28 gap-6 rounded-panel border border-line bg-surface p-6 md:grid-cols-[1fr_240px] md:items-center">
                <div>
                  <h2 className="t-h3 text-fg">{c.t}</h2>
                  <p className="mt-3 text-muted">{c.d}</p>
                </div>
                <div className="overflow-hidden rounded-card border border-line">
                  <Vignette kind={c.v} animate className="aspect-[16/10] w-full" />
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>
      <Section title="Compared honestly" lead="Pixel differencing and manual mapping both have their place. This is where each one stands.">
        <div className="overflow-x-auto rounded-panel border border-line">
          <table className="w-full min-w-[680px] text-left">
            <caption className="sr-only">RoadWatch compared with pixel differencing and manual mapping</caption>
            <thead>
              <tr className="border-b border-line text-[13px] text-muted">
                <th className="p-4 font-normal">
                  <span className="sr-only">Capability</span>
                </th>
                <th className="p-4 font-medium text-fg">RoadWatch</th>
                <th className="p-4 font-normal">Pixel differencing</th>
                <th className="p-4 font-normal">Manual mapping</th>
              </tr>
            </thead>
            <tbody>
              {ROWS.map(([label, a, b, c]) => (
                <tr key={label} className="border-b border-line last:border-0">
                  <th scope="row" className="p-4 text-[15px] font-normal text-fg">
                    {label}
                  </th>
                  {[a, b, c].map((v, i) => (
                    <td key={i} className="p-4">
                      <Mark v={v} />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-3 text-[13px] text-muted">RoadWatch’s accuracy is measured on held-out regions after evaluation; see Research.</p>
      </Section>
    </>
  )
}
