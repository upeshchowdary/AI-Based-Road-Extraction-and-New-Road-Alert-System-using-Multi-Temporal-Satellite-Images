import { ArrowRight } from 'lucide-react'
import { useEffect, useState, type ReactNode } from 'react'
import { AlertCard } from '@/components/alerts/AlertCard'
import { ConfidenceBreakdown, PersistenceDots, PriorityMark, StageTracker, StatusChip, StatusDot } from '@/components/alerts/AlertParts'
import { DemoBadge, HUDFrame, LogoMark, ScanLine, UtcClock, Wordmark, ContourBg } from '@/components/brand/Brand'
import { HBars, Sparkline } from '@/components/charts/Charts'
import { MapLegend } from '@/components/map/MapLegend'
import { SwipeDivider } from '@/components/map/SwipeDivider'
import { TimeScrubber } from '@/components/map/TimeScrubber'
import { Button } from '@/components/ui/Button'
import { Chip, Kbd, Segmented, Skeleton } from '@/components/ui/primitives'
import { Switch } from '@/components/ui/Switch'
import { EmptyState, ErrorState, OfflineState } from '@/components/ui/States'
import { DATA, useJson, type AlertsFile } from '@/lib/data'
import NotFoundPage from './NotFoundPage'

const TOKENS = [
  ['--bg-0', 'Deep space / page'],
  ['--bg-1', 'Sections, app'],
  ['--surface', 'Cards, panels'],
  ['--surface-2', 'Raised, menus'],
  ['--line', 'Borders'],
  ['--text', 'Primary text'],
  ['--text-muted', 'Secondary text'],
  ['--road-existing', 'Existing roads'],
  ['--signal', 'New roads · primary CTA'],
  ['--sentinel', 'Focus, links, scan line'],
  ['--verified', 'Accepted'],
  ['--priority', 'High priority, errors'],
  ['--abstain', 'Unreliable (with hatch)'],
]

function Block({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="border-t border-line py-12">
      <h2 className="t-h3 text-fg">{title}</h2>
      <div className="mt-6">{children}</div>
    </section>
  )
}

export default function DesignPage() {
  const alerts = useJson<AlertsFile>(DATA.demoAlerts).data
  const [seg, setSeg] = useState<'a' | 'b'>('a')
  const [sw, setSw] = useState(true)
  const [idx, setIdx] = useState(2)
  const [pos, setPos] = useState(50)
  useEffect(() => {
    document.title = 'Design system — RoadWatch'
  }, [])
  if (!import.meta.env.DEV) return <NotFoundPage />
  const a = alerts?.alerts.find((x) => x.featured)
  const dates = alerts?.dates ?? []
  return (
    <div className="container-rw pt-32 pb-24">
      <p className="t-mono text-muted">Development only</p>
      <h1 className="t-h1 mt-3 text-fg">Night Survey design system</h1>
      <p className="t-lead measure mt-4 text-muted">Tokens and components as they render now, in the current theme. Switch theme in the footer to check Paper Survey.</p>

      <Block title="Colour">
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          {TOKENS.map(([t, use]) => (
            <li key={t} className="overflow-hidden rounded-card border border-line">
              <div className={t === '--abstain' ? 'hatch h-16' : 'h-16'} style={{ background: t === '--abstain' ? undefined : `var(${t})` }} />
              <div className="p-3">
                <p className="t-mono text-[12px] text-fg">{t}</p>
                <p className="text-[12px] text-muted">{use}</p>
              </div>
            </li>
          ))}
        </ul>
      </Block>

      <Block title="Type">
        <div className="space-y-5">
          <p className="t-display text-fg">
            Display <span className="t-serif">accent</span>
          </p>
          <p className="t-h1 text-fg">Heading 1 — Geist 500</p>
          <p className="t-h2 text-fg">Heading 2</p>
          <p className="t-h3 text-fg">Heading 3</p>
          <p className="t-lead measure text-muted">Lead — RoadWatch reads satellite images of Andhra Pradesh and alerts you when a new road appears.</p>
          <p className="measure text-muted">Body — short sentences, plain verbs, sentence case. Line length under 75 characters.</p>
          <p className="t-mono text-fg">16.5323° N 80.5732° E · ALT 786 km · RW-24001</p>
        </div>
      </Block>

      <Block title="Brand">
        <div className="flex flex-wrap items-center gap-8">
          <Wordmark />
          <LogoMark className="size-12" />
          <UtcClock className="text-muted" />
          <div className="relative h-24 w-64 overflow-hidden rounded-card border border-line bg-bg1">
            <ScanLine className="rw-cta-scan" />
          </div>
          <HUDFrame className="h-32 w-72 rounded-card border border-line bg-bg1" tl="16.5323° N" br="10 m · B4 B3 B2" inset={10} />
          <div className="relative h-32 w-72 overflow-hidden rounded-card border border-line">
            <ContourBg opacity={0.9} />
          </div>
        </div>
      </Block>

      <Block title="Controls">
        <div className="flex flex-wrap items-center gap-3">
          <Button variant="signal">
            Primary <ArrowRight className="size-4" strokeWidth={1.75} />
          </Button>
          <Button variant="outline">Outline</Button>
          <Button variant="subtle">Subtle</Button>
          <Button variant="ghost">Ghost</Button>
          <Button variant="verified">Accept</Button>
          <Button variant="danger">Reject</Button>
          <Button disabled>Disabled</Button>
        </div>
        <div className="mt-6 flex flex-wrap items-center gap-4">
          <Chip>Neutral</Chip>
          <Chip tone="signal">Signal</Chip>
          <Chip tone="sentinel">Sentinel</Chip>
          <Chip tone="verified">Verified</Chip>
          <Chip tone="priority">Priority</Chip>
          <Chip tone="abstain">Abstain</Chip>
          <DemoBadge />
          <Kbd>Ctrl</Kbd>
          <Switch checked={sw} onCheckedChange={setSw} label="Example switch" />
          <Segmented label="Example" value={seg} onChange={setSeg} options={[{ value: 'a', label: 'One' }, { value: 'b', label: 'Two' }]} />
        </div>
        <div className="mt-6 max-w-xl">
          <TimeScrubber dates={dates} index={idx} onChange={setIdx} label="Example date" />
        </div>
      </Block>

      <Block title="Alerts">
        {a ? (
          <div className="flex flex-wrap items-start gap-8">
            <AlertCard alert={a} dates={dates} />
            <div className="w-80 space-y-6">
              <ConfidenceBreakdown factors={a.factors} score={a.score} />
              <PersistenceDots values={['absent', 'seen', 'abstain', 'seen', 'seen']} dates={dates} />
              <StageTracker stage="gravel" />
              <div className="flex flex-wrap gap-2">
                <StatusChip status="pending" />
                <StatusChip status="accepted" />
                <StatusChip status="rejected" />
                <StatusChip status="flagged" />
              </div>
              <div className="flex flex-wrap gap-4">
                <StatusDot status="pending" />
                <StatusDot status="accepted" />
                <StatusDot status="flagged" />
                <PriorityMark priority="high" />
              </div>
            </div>
          </div>
        ) : (
          <Skeleton className="h-64 w-80" />
        )}
      </Block>

      <Block title="Map pieces">
        <div className="flex flex-wrap items-start gap-8">
          <div className="rounded-card border border-line bg-surface p-4">
            <MapLegend />
          </div>
          <div className="relative aspect-[4/3] w-full max-w-md overflow-hidden rounded-card border border-line">
            <img src={DATA.heroImage('2022_pre_monsoon')} alt="Before, 2022" className="absolute inset-0 size-full object-cover" />
            <div className="absolute inset-0" style={{ clipPath: `inset(0 0 0 ${pos}%)` }}>
              <img src={DATA.heroImage('2024_pre_monsoon')} alt="After, 2024" className="absolute inset-0 size-full object-cover" />
            </div>
            <SwipeDivider pos={pos} onChange={setPos} beforeLabel="Apr 2022" afterLabel="Apr 2024" className="[&>span]:!top-3" />
          </div>
        </div>
      </Block>

      <Block title="Charts">
        <div className="grid max-w-3xl gap-8 sm:grid-cols-2">
          <div className="rounded-card border border-line bg-surface p-4">
            <p className="text-[12px] text-muted">Alerts first seen per date</p>
            <Sparkline values={[0, 9, 13, 12, 13]} labels={['Apr 22', 'Nov 22', 'Apr 23', 'Nov 23', 'Apr 24']} className="mt-6 w-full" />
          </div>
          <div className="rounded-card border border-line bg-surface p-4">
            <HBars rows={[{ label: 'Sanctioned', value: 6 }, { label: 'Detected', value: 4.2, color: 'var(--signal)' }]} format={(v) => `${v} km`} />
          </div>
        </div>
      </Block>

      <Block title="States">
        <div className="grid gap-4 lg:grid-cols-3">
          <div className="rounded-card border border-line bg-surface">
            <EmptyState title="Inbox zero" body="Every alert has been reviewed." />
          </div>
          <div className="rounded-card border border-line bg-surface">
            <ErrorState what="alerts" onRetry={() => undefined} />
          </div>
          <div className="rounded-card border border-line bg-surface">
            <OfflineState feature="Ask" />
          </div>
        </div>
      </Block>
    </div>
  )
}
