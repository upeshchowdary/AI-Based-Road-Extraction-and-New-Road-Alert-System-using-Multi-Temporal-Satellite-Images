import { ChevronDown } from 'lucide-react'
import { Accordion } from 'radix-ui'
import { useMemo, useState } from 'react'
import { PageIntro, Section } from '@/components/site/PageIntro'
import { Chip, Segmented } from '@/components/ui/primitives'
import { cn } from '@/lib/cn'
import { useReducedMotion } from '@/lib/motionPref'

/* ------------------------------------------------------------ architecture with flowing data */
const NODES = [
  { id: 's2', x: 40, y: 40, w: 170, t: 'Sentinel-2 / Sentinel-1', s: 'every season, 10 m' },
  { id: 'screen', x: 300, y: 40, w: 190, t: 'Tier 1 · statewide screening', s: 'S-model on ~6,200 tiles' },
  { id: 'cand', x: 580, y: 40, w: 170, t: 'Change candidates', s: 'graph diff + persistence' },
  { id: 'hr', x: 300, y: 190, w: 190, t: 'Tier 2 · high-res verification', s: 'HR model, pilot zones' },
  { id: 'alert', x: 580, y: 190, w: 170, t: 'Alerts with proof', s: 'score, chips, stage' },
  { id: 'osm', x: 40, y: 190, w: 170, t: 'OSM + history', s: 'labels and change labels' },
]
const EDGES: [string, string][] = [
  ['s2', 'screen'],
  ['screen', 'cand'],
  ['cand', 'hr'],
  ['hr', 'alert'],
  ['osm', 'hr'],
  ['osm', 'screen'],
]

function Architecture() {
  const reduced = useReducedMotion()
  const by = Object.fromEntries(NODES.map((n) => [n.id, n]))
  const path = (a: string, b: string) => {
    const A = by[a]
    const B = by[b]
    const ax = A.x + A.w / 2
    const ay = A.y + 30
    const bx = B.x + B.w / 2
    const by_ = B.y + 30
    if (Math.abs(ay - by_) < 5) return `M${A.x + A.w},${ay} L${B.x},${by_}`
    return `M${ax},${ay + 30} C${ax},${(ay + by_) / 2 + 20} ${bx},${(ay + by_) / 2 - 20} ${bx},${by_ - 30}`
  }
  return (
    <figure className="overflow-x-auto rounded-panel border border-line bg-bg1 p-4">
      <svg viewBox="0 0 790 280" className="min-w-[720px]" role="img" aria-labelledby="arch-t">
        <title id="arch-t">Architecture: Sentinel imagery feeds statewide screening, which produces change candidates; candidates are verified with high-resolution imagery and become alerts. OpenStreetMap supplies labels to both models.</title>
        {EDGES.map(([a, b], i) => {
          const d = path(a, b)
          return (
            <g key={i}>
              <path id={`e${i}`} d={d} fill="none" stroke="var(--line-strong)" strokeWidth="1.5" />
              {!reduced &&
                [0, 1, 2].map((k) => (
                  <circle key={k} r="3" fill={b === 'alert' ? 'var(--signal)' : 'var(--sentinel)'}>
                    <animateMotion dur="3.2s" repeatCount="indefinite" begin={`${k * 1.07 + i * 0.3}s`}>
                      <mpath href={`#e${i}`} />
                    </animateMotion>
                  </circle>
                ))}
            </g>
          )
        })}
        {NODES.map((n) => (
          <g key={n.id}>
            <rect x={n.x} y={n.y} width={n.w} height="60" rx="10" fill="var(--surface)" stroke={n.id === 'alert' ? 'var(--signal)' : 'var(--line-strong)'} />
            <text x={n.x + 14} y={n.y + 26} fontSize="13" fill="var(--text)" fontFamily="var(--font-sans)" fontWeight="500">
              {n.t}
            </text>
            <text x={n.x + 14} y={n.y + 45} fontSize="11.5" fill="var(--text-muted)" fontFamily="var(--font-sans)">
              {n.s}
            </text>
          </g>
        ))}
      </svg>
    </figure>
  )
}

/* ------------------------------------------------------------ graph matching visual */
function GraphDiff() {
  const [mode, setMode] = useState<'both' | 'match'>('both')
  const old = ['M20 150 L120 120 L220 130 L320 90', 'M120 120 L140 40', 'M220 130 L240 200']
  const fresh = 'M220 130 C 260 150, 300 175, 340 200 L 380 230'
  return (
    <div className="max-w-3xl rounded-panel border border-line bg-bg1 p-4">
      <Segmented
        size="sm"
        label="Graph view"
        value={mode}
        onChange={setMode}
        options={[
          { value: 'both', label: 'Two dates overlaid' },
          { value: 'match', label: 'After matching' },
        ]}
      />
      <svg viewBox="0 0 400 240" className="mt-4 w-full" role="img" aria-label="Road graphs from two dates. After matching, shared edges fade and the unmatched new edge glows amber.">
        <g fill="none" strokeLinecap="round">
          {old.map((d, i) => (
            <g key={i}>
              <path d={d} stroke="var(--sentinel)" strokeWidth="2" className="transition-opacity duration-700" opacity={mode === 'both' ? 0.9 : 0} transform="translate(3,3)" />
              <path d={d} stroke="var(--road-existing)" strokeWidth="2" className="transition-opacity duration-700" opacity={mode === 'both' ? 0.9 : 0.25} />
            </g>
          ))}
          <path d={fresh} stroke="var(--signal)" strokeWidth={mode === 'match' ? 3.5 : 2} className="transition-all duration-700" />
        </g>
        {[[20, 150], [120, 120], [220, 130], [320, 90], [140, 40], [240, 200], [380, 230]].map(([x, y]) => (
          <circle key={`${x}${y}`} cx={x} cy={y} r="3.5" fill="var(--bg-1)" stroke="var(--text-muted)" strokeWidth="1.2" />
        ))}
      </svg>
      <p className="mt-2 text-[13px] text-muted">
        {mode === 'both' ? 'Steel: date 1. Cyan: date 2 (slightly offset, as real registration is).' : 'Edges that match within a buffer, direction and topology fade. The one that doesn’t is a candidate.'}
      </p>
    </div>
  )
}

/* ------------------------------------------------------------ persistence rule demo */
function PersistenceDemo() {
  const dates = ['Nov 22', 'Apr 23', 'Nov 23', 'Apr 24']
  const [seen, setSeen] = useState([true, false, false, false])
  const fireAt = useMemo(() => {
    let n = 0
    for (let i = 0; i < seen.length; i++) if (seen[i] && ++n === 2) return i
    return -1
  }, [seen])
  return (
    <div className="rounded-panel border border-line bg-bg1 p-5">
      <p className="text-[14px] text-fg">Click dates to mark where the candidate is seen.</p>
      <ol className="mt-4 grid grid-cols-4 gap-2">
        {dates.map((d, i) => (
          <li key={d}>
            <button
              type="button"
              aria-pressed={seen[i]}
              onClick={() => setSeen((s) => s.map((v, k) => (k === i ? !v : v)))}
              className={cn('w-full rounded-[10px] border p-3 text-left transition-colors', seen[i] ? 'border-signal/50 bg-signal/10' : 'border-line hover:border-line-strong')}
            >
              <span className="t-mono text-[12px] text-muted">{d}</span>
              <span className="mt-1 block text-[14px] text-fg">{seen[i] ? 'Seen' : 'Not seen'}</span>
              {i === fireAt && <span className="mt-2 inline-flex rounded-[4px] bg-signal px-1.5 text-[11px] font-medium text-on-signal">Alert fires</span>}
            </button>
          </li>
        ))}
      </ol>
      <p className="mt-3 text-[13px] text-muted" aria-live="polite">
        {fireAt < 0 ? 'Seen once: no alert. One sighting is often mud, a harvested field or a shadow.' : `Alert fires at the second sighting (${dates[fireAt]}).`}
      </p>
    </div>
  )
}

/* ------------------------------------------------------------ abstain demo */
function AbstainDemo() {
  const [cloud, setCloud] = useState(25)
  const limit = 60
  const abstain = cloud > limit
  return (
    <div className="rounded-panel border border-line bg-bg1 p-5">
      <label htmlFor="cloud" className="flex items-center justify-between text-[14px] text-fg">
        Cloud over the tile
        <span className="t-mono text-muted">{cloud}%</span>
      </label>
      <input id="cloud" type="range" min={0} max={100} value={cloud} onChange={(e) => setCloud(+e.target.value)} className="mt-2 w-full accent-[var(--sentinel)]" />
      <div className="mt-4 flex items-center gap-4">
        <div className={cn('relative grid size-28 place-items-center overflow-hidden rounded-[10px] border', abstain ? 'hatch border-abstain' : 'border-line-strong bg-surface')}>
          <svg viewBox="0 0 100 100" className="absolute inset-0 size-full" aria-hidden>
            <path d="M10 80 C 40 60, 60 45, 92 20" stroke="var(--road-existing)" strokeWidth="3" fill="none" opacity={abstain ? 0.3 : 1} />
            <ellipse cx="50" cy="50" rx={cloud / 1.6} ry={cloud / 2.4} fill="var(--surface-2)" opacity="0.92" />
          </svg>
          {abstain && <span className="relative rounded-[4px] border border-abstain bg-bg0 px-1.5 py-0.5 text-[11px] text-fg">Unreliable</span>}
        </div>
        <p className="text-[14px] text-muted" aria-live="polite">
          {abstain ? `Above ${limit}%: the tile abstains. No alert, no guess — it waits for a clearer date or radar.` : `Below ${limit}%: masked pixels are ignored and the rest is analysed.`}
        </p>
      </div>
    </div>
  )
}

const PACKS = [
  ['A', 'Hard negatives', 'Add back the reserved empty tiles.', 'Fewer false alerts'],
  ['B', 'Full spectrum', 'Red-edge and SWIR bands, 16-bit storage.', 'Road vs bare soil and crops'],
  ['C', 'More dates', 'Monthly or quarterly instead of two a year.', 'Earlier alerts, better stages'],
  ['D', 'Full fine-tuning', 'Fine-tune the backbone instead of freezing it.', 'Higher extraction accuracy'],
  ['E', 'Skipped tiles', 'Tiles skipped by the cloud or pre-filter.', 'Fewer missed roads'],
  ['F', 'More high-res', 'Extra verification zones in the same area.', 'Narrow village roads'],
  ['G', 'Reviewed alerts', 'Your accept/reject decisions as labels.', 'Learns from real mistakes'],
  ['H', 'Full model statewide', 'Teacher model instead of the small student.', 'Best accuracy where quota allows'],
]

export default function PlatformPage() {
  return (
    <>
      <PageIntro docTitle="How it works" title="How RoadWatch works" lead="Two tiers. Free Sentinel imagery screens the whole state every season; high-resolution imagery verifies what looks new. Every step can explain itself." />
      <Section title="Two tiers, one pipeline" lead="Data moves left to right. Amber dots are alerts reaching a person.">
        <Architecture />
      </Section>
      <Section title="Two models" lead="Each is chosen by a documented trade-off: accuracy, robustness, GPU hours and speed.">
        <div className="grid gap-3 md:grid-cols-2">
          {[
            { t: 'S-model · statewide', d: 'Road segmentation on Sentinel-2 (B2, B3, B4, B8) at 10 m, trained on Andhra Pradesh chips with OpenStreetMap labels. Finds wide new roads and construction corridors.', tags: ['10 m', 'Sentinel-2', 'Data build in progress'] },
            { t: 'HR model · verification', d: 'U-Net / D-LinkNet (ResNet34) as Baseline A, compared with a DINOv3 satellite backbone. Exact geometry and narrow roads in the pilot zones.', tags: ['0.3–1 m', 'Baseline A', 'Timing run done'] },
          ].map((m) => (
            <article key={m.t} className="rounded-panel border border-line bg-surface p-6">
              <h3 className="t-h3 text-fg">{m.t}</h3>
              <p className="mt-3 text-muted">{m.d}</p>
              <div className="mt-5 flex flex-wrap gap-2">
                {m.tags.map((t) => (
                  <Chip key={t}>{t}</Chip>
                ))}
              </div>
            </article>
          ))}
        </div>
      </Section>
      <Section title="Change is found in the graph, not the pixels" lead="Roads from two dates become graphs and are matched. A new road must extend or connect like a real road does.">
        <GraphDiff />
      </Section>
      <Section title="Two rules that cut false alerts">
        <div className="grid gap-6 lg:grid-cols-2">
          <div>
            <h3 className="t-h3 text-fg">Persistence</h3>
            <p className="mt-2 mb-5 text-muted">A candidate must appear on at least two dates before anyone is alerted.</p>
            <PersistenceDemo />
          </div>
          <div>
            <h3 className="t-h3 text-fg">Abstain</h3>
            <p className="mt-2 mb-5 text-muted">Cloud, shadow, tree cover or bad alignment mark a tile unreliable instead of guessing.</p>
            <AbstainDemo />
          </div>
        </div>
      </Section>
      <Section title="Lean first, enhanced later" lead="The first build uses less data to save storage and GPU hours. Nothing cut is lost: each pack adds it back for the same area, evaluated on the same frozen test regions.">
        <Accordion.Root type="multiple" className="divide-y divide-line rounded-panel border border-line">
          {PACKS.map(([k, t, d, g]) => (
            <Accordion.Item key={k} value={k}>
              <Accordion.Header>
                <Accordion.Trigger className="group flex w-full items-center gap-4 px-5 py-4 text-left">
                  <span className="t-mono grid size-7 place-items-center rounded-[6px] bg-surface2 text-fg">{k}</span>
                  <span className="flex-1 text-[17px] text-fg">{t}</span>
                  <Chip>Planned</Chip>
                  <ChevronDown className="size-4 text-muted transition-transform duration-300 group-data-[state=open]:rotate-180" strokeWidth={1.75} aria-hidden />
                </Accordion.Trigger>
              </Accordion.Header>
              <Accordion.Content className="overflow-hidden px-5 pb-4 pl-16 text-[15px] text-muted data-[state=closed]:animate-none">
                {d} <span className="text-fg">Expected gain: {g}.</span>
              </Accordion.Content>
            </Accordion.Item>
          ))}
        </Accordion.Root>
      </Section>
    </>
  )
}
