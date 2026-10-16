import { Check, Flag, X } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router'
import { PriorityMark, StatusChip, stageLabel } from '@/components/alerts/AlertParts'
import { RejectDialog, useReviewAction } from '@/components/alerts/ReviewActions'
import { Button } from '@/components/ui/Button'
import { Kbd } from '@/components/ui/primitives'
import { EmptyState, ErrorState, ListSkeleton, PageHeader } from '@/components/ui/States'
import { useAlerts } from '@/lib/appStore'
import { cn } from '@/lib/cn'
import type { AlertStatus, DemoAlert } from '@/lib/data'
import { dateShort, fmtKm } from '@/lib/format'

const VIEWS = [
  { id: 'review', label: 'Needs review', f: (a: DemoAlert) => a.status === 'pending' },
  { id: 'high', label: 'High priority', f: (a: DemoAlert) => a.priority === 'high' },
  { id: 'field', label: 'Field checks', f: (a: DemoAlert) => a.status === 'flagged' },
  { id: 'all', label: 'All', f: () => true },
] as const

const sel = 'h-8 rounded-[8px] border border-line bg-surface px-2.5 text-[13px] text-fg outline-none hover:border-line-strong focus:border-sentinel'

export default function AlertsInbox() {
  const { alerts, dates, demo, loading, error, retry } = useAlerts()
  const nav = useNavigate()
  const [params, setParams] = useSearchParams()
  const view = (params.get('view') ?? 'review') as (typeof VIEWS)[number]['id']
  const [priority, setPriority] = useState('any')
  const [stage, setStage] = useState('any')
  const [district, setDistrict] = useState('any')
  const [date, setDate] = useState('any')
  const [sensor, setSensor] = useState('any')
  const [minScore, setMinScore] = useState(0)
  const [cursor, setCursor] = useState(0)
  const [checked, setChecked] = useState<Set<string>>(new Set())
  const [rejecting, setRejecting] = useState<string[] | null>(null)
  const review = useReviewAction()
  const rows = useRef<(HTMLTableRowElement | null)[]>([])

  const original = useMemo(() => Object.fromEntries((alerts ?? []).map((a) => [a.id, a.status])) as Record<string, AlertStatus>, [alerts])
  const list = useMemo(() => {
    const v = VIEWS.find((x) => x.id === view) ?? VIEWS[0]
    return (alerts ?? [])
      .filter(v.f)
      .filter((a) => priority === 'any' || a.priority === priority)
      .filter((a) => stage === 'any' || a.stage === stage)
      .filter((a) => district === 'any' || a.district === district)
      .filter((a) => date === 'any' || a.first_seen === date)
      .filter((a) => sensor === 'any' || a.sensor === sensor)
      .filter((a) => a.score >= minScore)
      .sort((a, b) => (a.priority === 'high' ? 0 : 1) - (b.priority === 'high' ? 0 : 1) || b.score - a.score)
  }, [alerts, view, priority, stage, district, date, sensor, minScore])

  useEffect(() => {
    setCursor((c) => Math.min(c, Math.max(0, list.length - 1)))
  }, [list.length])

  // J/K move · Enter open · A accept · R reject · F flag
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement
      if (t.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(t.tagName) || e.ctrlKey || e.metaKey || e.altKey || rejecting) return
      const cur = list[cursor]
      const k = e.key.toLowerCase()
      if (k === 'j') setCursor((c) => Math.min(list.length - 1, c + 1))
      else if (k === 'k') setCursor((c) => Math.max(0, c - 1))
      else if (e.key === 'Enter' && cur) nav(`/alerts/${cur.id}`)
      else if (k === 'a' && cur) review([cur.id], 'accepted', original)
      else if (k === 'f' && cur) review([cur.id], 'flagged', original)
      else if (k === 'r' && cur) setRejecting([cur.id])
      else return
      e.preventDefault()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [list, cursor, nav, review, original, rejecting])

  // block body: scrollIntoView may return a Promise, which must not become the effect cleanup
  useEffect(() => {
    rows.current[cursor]?.scrollIntoView({ block: 'nearest' })
  }, [cursor])

  const districts = [...new Set((alerts ?? []).map((a) => a.district))]
  const sensors = [...new Set((alerts ?? []).map((a) => a.sensor))]
  const allChecked = list.length > 0 && list.every((a) => checked.has(a.id))
  const bulk = [...checked].filter((id) => list.some((a) => a.id === id))
  const counts = Object.fromEntries(VIEWS.map((v) => [v.id, (alerts ?? []).filter(v.f).length]))

  return (
    <div className="flex h-full flex-col">
      <PageHeader
        title="Alerts"
        demo={demo}
        description={demo ? 'Review new-road candidates. Your decisions become training labels.' : `${alerts?.length ?? 0} new-road candidates from RoadWatch change detection (2022 → 2026). Review them: your decisions become training labels.`}
        actions={
          <span className="hidden items-center gap-1.5 text-[12px] text-muted md:flex">
            <Kbd>J</Kbd>
            <Kbd>K</Kbd> move <Kbd>Enter</Kbd> open <Kbd>A</Kbd> accept <Kbd>R</Kbd> reject <Kbd>F</Kbd> flag
          </span>
        }
      />
      <div className="flex flex-wrap items-center gap-2 border-b border-line px-5 py-3 lg:px-6">
        <div role="tablist" aria-label="Saved views" className="flex flex-wrap gap-1">
          {VIEWS.map((v) => (
            <button
              key={v.id}
              role="tab"
              type="button"
              aria-selected={view === v.id}
              onClick={() => {
                setParams({ view: v.id })
                setCursor(0)
              }}
              className="h-8 rounded-[8px] px-3 text-[13px] text-muted transition-colors hover:text-fg aria-selected:bg-surface2 aria-selected:text-fg"
            >
              {v.label} <span className="t-mono ml-1 text-[11px] text-muted">{counts[v.id]}</span>
            </button>
          ))}
        </div>
        <span className="mx-1 hidden h-5 w-px bg-line md:block" />
        {new Set((alerts ?? []).map((a) => a.priority)).size > 1 && (<>
        <label className="sr-only" htmlFor="f-pri">Priority</label>
        <select id="f-pri" className={sel} value={priority} onChange={(e) => setPriority(e.target.value)}>
          <option value="any">Any priority</option>
          <option value="high">High</option>
          <option value="normal">Normal</option>
          <option value="low">Low</option>
        </select>
        </>)}
        {(alerts ?? []).some((a) => a.stage) && (<>
        <label className="sr-only" htmlFor="f-stage">Stage</label>
        <select id="f-stage" className={sel} value={stage} onChange={(e) => setStage(e.target.value)}>
          <option value="any">Any stage</option>
          {['cleared', 'earthwork', 'gravel', 'paved'].map((s) => (
            <option key={s} value={s}>
              {stageLabel(s as DemoAlert['stage'])}
            </option>
          ))}
        </select>
        </>)}
        <label className="sr-only" htmlFor="f-dist">District</label>
        <select id="f-dist" className={sel} value={district} onChange={(e) => setDistrict(e.target.value)}>
          <option value="any">Any district</option>
          {districts.map((d) => (
            <option key={d}>{d}</option>
          ))}
        </select>
        <label className="sr-only" htmlFor="f-date">First seen</label>
        <select id="f-date" className={sel} value={date} onChange={(e) => setDate(e.target.value)}>
          <option value="any">Any date</option>
          {dates.map((d) => (
            <option key={d.id} value={d.id}>
              {d.label}
            </option>
          ))}
        </select>
        {sensors.length > 1 && (<>
        <label className="sr-only" htmlFor="f-sensor">Sensor</label>
        <select id="f-sensor" className={sel} value={sensor} onChange={(e) => setSensor(e.target.value)}>
          <option value="any">Any sensor</option>
          {sensors.map((s) => (
            <option key={s}>{s}</option>
          ))}
        </select>
        </>)}
        <label className="flex items-center gap-2 text-[13px] text-muted">
          Score ≥
          <input type="range" min={0} max={0.9} step={0.05} value={minScore} onChange={(e) => setMinScore(+e.target.value)} className="w-24 accent-[var(--sentinel)]" aria-label="Minimum score" />
          <span className="t-mono w-8 text-fg">{minScore.toFixed(2)}</span>
        </label>
      </div>

      {bulk.length > 0 && (
        <div className="flex items-center gap-2 border-b border-line bg-surface2/60 px-5 py-2 lg:px-6" role="region" aria-label="Bulk actions">
          <span className="text-[13px] text-fg">{bulk.length} selected</span>
          <Button size="sm" variant="verified" onClick={() => (review(bulk, 'accepted', original), setChecked(new Set()))}>
            <Check className="size-3.5" strokeWidth={2} /> Accept
          </Button>
          <Button size="sm" variant="danger" onClick={() => setRejecting(bulk)}>
            <X className="size-3.5" strokeWidth={2} /> Reject
          </Button>
          <Button size="sm" variant="outline" onClick={() => (review(bulk, 'flagged', original), setChecked(new Set()))}>
            <Flag className="size-3.5" strokeWidth={1.75} /> Flag
          </Button>
          <button type="button" className="ml-auto text-[13px] text-muted hover:text-fg" onClick={() => setChecked(new Set())}>
            Clear selection
          </button>
        </div>
      )}

      <div className="scrollbar-thin min-h-0 flex-1 overflow-auto">
        {error ? (
          <ErrorState what="alerts" onRetry={retry} />
        ) : loading && !alerts ? (
          <ListSkeleton rows={10} />
        ) : !list.length ? (
          <EmptyState
            title={view === 'review' ? 'Inbox zero' : 'No alerts match'}
            body={view === 'review' ? 'Every alert has been reviewed. New ones arrive after the next data date.' : 'Loosen a filter or switch the saved view.'}
            action={
              <Button size="sm" variant="subtle" onClick={() => (setPriority('any'), setStage('any'), setDistrict('any'), setDate('any'), setSensor('any'), setMinScore(0), setParams({ view: 'all' }))}>
                Show all alerts
              </Button>
            }
          />
        ) : (
          <table className="w-full border-collapse md:min-w-[860px] text-left text-[13px]">
            <caption className="sr-only">Alerts, {list.length} rows. Use J and K to move, Enter to open.</caption>
            <thead className="sticky top-0 z-10 bg-bg0">
              <tr className="border-b border-line text-[12px] text-muted">
                <th className="w-10 py-2.5 pl-5 lg:pl-6">
                  <input type="checkbox" aria-label="Select all" checked={allChecked} onChange={() => setChecked(allChecked ? new Set() : new Set(list.map((a) => a.id)))} className="accent-[var(--sentinel)]" />
                </th>
                <th className="py-2.5 font-normal">Alert</th>
                <th className="py-2.5 font-normal max-md:hidden">Length</th>
                <th className="py-2.5 font-normal max-md:pr-4">Score</th>
                <th className="py-2.5 font-normal max-md:hidden">Stage</th>
                <th className="py-2.5 font-normal max-md:hidden">First seen</th>
                <th className="py-2.5 font-normal max-md:hidden">Priority</th>
                <th className="py-2.5 pr-5 font-normal max-md:hidden lg:pr-6">Status</th>
              </tr>
            </thead>
            <tbody>
              {list.map((a, i) => (
                <tr
                  key={a.id}
                  ref={(el) => void (rows.current[i] = el)}
                  aria-selected={i === cursor}
                  onClick={() => nav(`/alerts/${a.id}`)}
                  onMouseMove={() => i !== cursor && setCursor(i)}
                  className={cn('cursor-pointer border-b border-line transition-colors', i === cursor ? 'bg-surface2' : 'hover:bg-surface/60')}
                >
                  <td className="relative py-2.5 pl-5 lg:pl-6" onClick={(e) => e.stopPropagation()}>
                    {i === cursor && <span className="absolute inset-y-0 left-0 w-0.5 bg-sentinel" aria-hidden />}
                    <input
                      type="checkbox"
                      aria-label={`Select ${a.id}`}
                      checked={checked.has(a.id)}
                      onChange={() => setChecked((s) => {
                        const n = new Set(s)
                        if (n.has(a.id)) n.delete(a.id)
                        else n.add(a.id)
                        return n
                      })}
                      className="accent-[var(--sentinel)]"
                    />
                  </td>
                  <td className="py-2.5">
                    <div className="text-fg">
                      {a.name ?? `New road · ${fmtKm(a.length_km, 2)}`}
                      {a.zone && <span className="ml-2 rounded-chip border border-line px-1.5 py-px text-[11px] text-muted">Zone {a.zone}</span>}
                    </div>
                    <div className="t-mono text-[11px] text-muted">
                      {a.id} · {a.district}
                    </div>
                  </td>
                  <td className="t-mono py-2.5 text-fg max-md:hidden">{fmtKm(a.length_km, 2)}</td>
                  <td className="py-2.5 max-md:pr-4">
                    <div className="flex items-center gap-2">
                      <span className="t-mono text-fg">{a.score.toFixed(2)}</span>
                      <span className="h-1 w-12 overflow-hidden rounded-full bg-surface2">
                        <span className="block h-full bg-signal" style={{ width: `${a.score * 100}%` }} />
                      </span>
                    </div>
                  </td>
                  <td className="py-2.5 text-fg max-md:hidden">{stageLabel(a.stage)}</td>
                  <td className="py-2.5 text-fg max-md:hidden">{dateShort(a.first_seen)}</td>
                  <td className="py-2.5 max-md:hidden">
                    <PriorityMark priority={a.priority} />
                  </td>
                  <td className="py-2.5 pr-5 max-md:hidden lg:pr-6">
                    <StatusChip status={a.status} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
      <RejectDialog
        open={Boolean(rejecting)}
        onOpenChange={(o) => !o && setRejecting(null)}
        count={rejecting?.length ?? 0}
        onConfirm={(reason) => {
          if (rejecting) review(rejecting, 'rejected', original, reason)
          setChecked(new Set())
        }}
      />
    </div>
  )
}
