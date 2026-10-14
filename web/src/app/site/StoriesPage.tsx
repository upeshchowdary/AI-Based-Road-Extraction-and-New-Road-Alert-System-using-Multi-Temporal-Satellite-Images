import { ArrowRight } from 'lucide-react'
import { Link } from 'react-router'
import { PageIntro, Section } from '@/components/site/PageIntro'
import { Chip } from '@/components/ui/primitives'
import { DATA } from '@/lib/data'

export const STORIES = [
  {
    slug: 'a-new-corridor',
    title: 'A new corridor crosses the Krishna',
    line: 'Nine seasons of Sentinel-2 over Vijayawada: earthwork, piers, a deck, a highway — and what grows beside it.',
    live: true,
  },
  { slug: 'through-the-monsoon', title: 'Seeing through the monsoon with radar', line: 'Sentinel-1 evidence for roads built while optical images are cloud-bound.', live: false },
  { slug: 'auditing-a-village-road', title: 'Auditing a village road', line: 'Sanctioned length against what the satellite shows, segment by segment.', live: false },
]

export default function StoriesPage() {
  return (
    <>
      <PageIntro docTitle="Stories" title="Stories" lead="Case stories told with the evidence: dates, before/after imagery and what the system saw. Only real data — a story appears when its evidence exists." />
      <Section className="border-b-0">
        <ul className="grid gap-4 md:grid-cols-3">
          {STORIES.map((s) => (
            <li key={s.slug}>
              {s.live ? (
                <Link to={`/stories/${s.slug}`} className="group flex h-full flex-col overflow-hidden rounded-panel border border-line bg-surface transition-colors hover:border-line-strong">
                  <div className="relative aspect-[4/3] overflow-hidden border-b border-line">
                    <img src={DATA.heroImage('2024_pre_monsoon')} alt="Sentinel-2 composite of the new bridge across the Krishna, pre-monsoon 2024" className="size-full object-cover transition-transform duration-700 ease-out-expo group-hover:scale-[1.03]" loading="lazy" />
                  </div>
                  <div className="flex flex-1 flex-col p-5">
                    <Chip tone="verified" className="self-start">
                      Real imagery
                    </Chip>
                    <h2 className="mt-3 text-[19px] font-medium text-fg">{s.title}</h2>
                    <p className="mt-2 flex-1 text-[14px] text-muted">{s.line}</p>
                    <span className="mt-4 inline-flex items-center gap-1.5 text-[14px] text-sentinel-ink">
                      Read the story <ArrowRight className="size-4" strokeWidth={1.75} aria-hidden />
                    </span>
                  </div>
                </Link>
              ) : (
                <div className="flex h-full flex-col rounded-panel border border-dashed border-line-strong p-5">
                  <Chip className="self-start">In preparation</Chip>
                  <h2 className="mt-3 text-[19px] font-medium text-fg">{s.title}</h2>
                  <p className="mt-2 text-[14px] text-muted">{s.line}</p>
                  <p className="mt-auto pt-6 text-[13px] text-muted">Published once the data and detections exist.</p>
                </div>
              )}
            </li>
          ))}
        </ul>
      </Section>
    </>
  )
}
