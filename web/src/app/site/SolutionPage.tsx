import { ArrowRight, ChevronDown } from 'lucide-react'
import { Accordion } from 'radix-ui'
import { Navigate, useParams } from 'react-router'
import { AlertCard } from '@/components/alerts/AlertCard'
import { HBars } from '@/components/charts/Charts'
import { DemoBadge } from '@/components/brand/Brand'
import { PageIntro, Section } from '@/components/site/PageIntro'
import { SOLUTIONS, Vignette } from '@/components/site/SiteNav'
import { ButtonLink } from '@/components/ui/Button'
import { DATA, useJson, type AlertsFile } from '@/lib/data'

type Slug = (typeof SOLUTIONS)[number]['slug']

const CONTENT: Record<Slug, { problem: string; quote: string; steps: [string, string][]; faq: [string, string][]; output: 'alert' | 'audit' | 'connect' }> = {
  security: {
    problem: 'New tracks appear near borders, forests and sensitive sites faster than anyone can check imagery by hand. By the time a map is updated, the road has been in use for months.',
    quote: '“We need to know about a new road while it is still earthwork, not after it is paved.”',
    steps: [
      ['Draw priority zones', 'Mark the areas that matter. Alerts inside them jump the queue.'],
      ['Screen every season', 'Sentinel-2 and Sentinel-1 cover the whole state; radar sees through monsoon cloud.'],
      ['Verify what looks new', 'High-resolution imagery confirms geometry and stage.'],
      ['Get the alert with proof', 'Telegram or email, with before/after chips and a confidence breakdown.'],
    ],
    faq: [
      ['Does sensitive imagery leave the system?', 'No. The optional AI features receive alert text and metadata only, never imagery of priority zones, and offline mode turns external services off.'],
      ['How early can a road be detected?', 'Cleared corridors and earthwork are often visible at 10 m. Narrow tracks need the high-resolution tier.'],
      ['What about clouds?', 'Cloudy tiles abstain rather than guess; radar (Sentinel-1) fills monsoon dates.'],
    ],
    output: 'alert',
  },
  'rural-road-audit': {
    problem: 'Sanctioned rural roads are reported as built, but checking every kilometre on the ground is slow and expensive.',
    quote: '“Show me how much of the sanctioned length actually exists, and since when.”',
    steps: [
      ['Upload the sanctioned road', 'A GeoSadak shapefile, GeoPackage or GeoJSON.'],
      ['Match to detected roads', 'RoadWatch matches the alignment to its road graph across dates.'],
      ['Measure', 'Detected length, gaps, first-seen date and construction stage per segment.'],
      ['Download the report', 'A PDF with before/after chips for every segment.'],
    ],
    faq: [
      ['Is the result proof of fraud?', 'No. It is evidence for a field check: what the imagery shows, with dates and confidence.'],
      ['How narrow a road can it see?', 'At 10 m, roads narrower than about 5 m are unreliable; the high-resolution tier covers village roads in pilot zones.'],
      ['Can I export the result?', 'Yes — PDF for people, GeoPackage and Shapefile for QGIS.'],
    ],
    output: 'audit',
  },
  planning: {
    problem: 'Planners need to know where the network has grown and which villages gained access, but maps lag years behind construction.',
    quote: '“Which villages did last year’s roads actually connect?”',
    steps: [
      ['Pick an area and dates', 'District, mandal or a drawn polygon; any two dates.'],
      ['See the new network', 'New roads in amber over the existing network.'],
      ['Measure connectivity', 'Villages newly connected and travel-time change, on the road graph.'],
      ['Export for planning', 'GeoPackage, Shapefile, GeoJSON and a summary report.'],
    ],
    faq: [
      ['Where do village locations come from?', 'OpenStreetMap places, with census codes where available.'],
      ['Is travel time exact?', 'It is a network estimate from road class and surface, good for comparison between dates.'],
      ['Can it cover all of Andhra Pradesh?', 'Yes — the statewide tier is planned for the second semester (CP2).'],
    ],
    output: 'connect',
  },
}

export default function SolutionPage() {
  const { slug } = useParams()
  const s = SOLUTIONS.find((x) => x.slug === slug)
  const alerts = useJson<AlertsFile>(DATA.demoAlerts).data
  if (!s) return <Navigate to="/404" replace />
  const c = CONTENT[s.slug]
  const featured = alerts?.alerts.find((a) => a.featured)
  return (
    <>
      <PageIntro docTitle={s.title} title={s.title} lead={s.line}>
        <div className="mt-10 max-w-2xl overflow-hidden rounded-panel border border-line">
          <Vignette kind={s.slug} animate className="aspect-[16/7] w-full" />
        </div>
      </PageIntro>
      <Section title="The problem">
        <div className="grid gap-8 lg:grid-cols-2">
          <p className="t-lead text-muted">{c.problem}</p>
          <blockquote className="t-h3 border-l-2 border-sentinel pl-6 text-fg">
            {c.quote}
            <footer className="mt-3 text-[13px] text-muted">Paraphrased need, not a customer quote.</footer>
          </blockquote>
        </div>
      </Section>
      <Section title="How it works for you">
        <ol className="grid gap-3 md:grid-cols-4">
          {c.steps.map(([t, d], i) => (
            <li key={t} className="rounded-panel border border-line bg-surface p-5">
              <span className="t-mono text-sentinel-ink">{i + 1}</span>
              <h3 className="mt-3 text-[17px] font-medium text-fg">{t}</h3>
              <p className="mt-2 text-[14px] text-muted">{d}</p>
            </li>
          ))}
        </ol>
      </Section>
      <Section title="Sample output">
        <div className="flex flex-wrap items-start gap-6">
          {c.output === 'alert' && featured && alerts && <AlertCard alert={featured} dates={alerts.dates} className="w-[360px]" />}
          {c.output === 'audit' && (
            <div className="w-full max-w-md rounded-panel border border-line bg-surface p-5">
              <div className="flex items-center justify-between">
                <p className="text-[15px] font-medium text-fg">Audit · village road</p>
                <DemoBadge />
              </div>
              <HBars className="mt-4" format={(v) => `${v} km`} max={6} rows={[{ label: 'Sanctioned', value: 6.0 }, { label: 'Detected', value: 4.2, color: 'var(--signal)' }]} />
              <p className="mt-3 text-[13px] text-muted">70% of sanctioned length visible · first seen post-monsoon 2023</p>
            </div>
          )}
          {c.output === 'connect' && (
            <div className="w-full max-w-md rounded-panel border border-line bg-surface p-5">
              <div className="flex items-center justify-between">
                <p className="text-[15px] font-medium text-fg">Travel time to market (min)</p>
                <DemoBadge />
              </div>
              <HBars className="mt-4" format={(v) => `${v} min`} rows={[{ label: 'Before', value: 34 }, { label: 'After', value: 23, color: 'var(--signal)' }]} />
            </div>
          )}
          <p className="max-w-sm text-[14px] text-muted">Sample built from demo data. Real outputs appear after evaluation on held-out regions.</p>
        </div>
      </Section>
      <Section title="Questions">
        <Accordion.Root type="single" collapsible className="max-w-3xl divide-y divide-line border-y border-line">
          {c.faq.map(([q, a]) => (
            <Accordion.Item key={q} value={q}>
              <Accordion.Header>
                <Accordion.Trigger className="group flex w-full items-center justify-between gap-4 py-5 text-left text-[17px] text-fg">
                  {q}
                  <ChevronDown className="size-4 shrink-0 text-muted transition-transform duration-300 group-data-[state=open]:rotate-180" strokeWidth={1.75} aria-hidden />
                </Accordion.Trigger>
              </Accordion.Header>
              <Accordion.Content className="pb-5 text-[15px] text-muted">{a}</Accordion.Content>
            </Accordion.Item>
          ))}
        </Accordion.Root>
        <div className="mt-12 flex flex-wrap gap-3">
          <ButtonLink to="/explore" variant="signal" size="lg">
            Explore live demo <ArrowRight className="size-4" strokeWidth={1.75} aria-hidden />
          </ButtonLink>
          <ButtonLink to="/contact" variant="ghost" size="lg">
            Talk to the team
          </ButtonLink>
        </div>
      </Section>
    </>
  )
}
