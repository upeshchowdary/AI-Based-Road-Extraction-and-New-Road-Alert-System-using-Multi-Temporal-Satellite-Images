import { ArrowRight } from 'lucide-react'
import { AnimatePresence, motion } from 'motion/react'
import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router'
import { toast } from 'sonner'
import { PriorityMark, StatusDot } from '@/components/alerts/AlertParts'
import { Sparkline } from '@/components/charts/Charts'
import { RwMap } from '@/components/map/LazyMap'
import { Panel, Skeleton } from '@/components/ui/primitives'
import { EmptyState, ErrorState, ListSkeleton, PageHeader } from '@/components/ui/States'
import { useAlerts } from '@/lib/appStore'
import { cn } from '@/lib/cn'
import { DATA, useJson, type DemoAlert, type ZoneMeta } from '@/lib/data'
import { dateLabel, dateShort, fmtKm } from '@/lib/format'
import { useReducedMotion } from '@/lib/motionPref'

const ARRIVAL_MS = 9000

function Kpi({ label, value, sub, spark, labels, format }: { label: string; value: string; sub?: string; spark?: number[]; labels?: string[]; format?: (v: number) => string }) {
  return (
    <Panel className="p-4">
      <p className="text-[12px] text-muted">{label}</p>
      <div className="mt-1 flex items-end justify-between gap-3">
        <AnimatePresence mode="popLayout" initial={false}>
          <motion.p key={value} initial={{ y: 8, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: -8, opacity: 0 }} transition={{ duration: 0.25 }} className="t-mono text-[22px] leading-none whitespace-nowrap text-fg tabular sm:text-[24px]">
            {value}
          </motion.p>
        </AnimatePresence>
        {spark && labels && <Sparkline values={spark} labels={labels} format={format} className="hidden w-24 sm:block" />}
      </div>
      {sub && <p className="mt-2 text-[12px] text-muted">{sub}</p>}
    </Panel>
  )
}

export default function CommandCenter() {
  const { alerts: all, dates: alertDates, loading, error, retry } = useAlerts()
  const meta = useJson<ZoneMeta>(DATA.zoneMeta).data
  const quality = useJson<{ composites: number; abstained: number }>(DATA.quality).data
  // composite dates with real scene counts come from the zone metadata
  const dates = meta?.dates ?? alertDates
  const reduced = useReducedMotion()
  const nav = useNavigate()
  const [hover, setHover] = useState<string | null>(null)
  const [arrived, setArrived] = useState(false)

  // Simulated arrival (demo): one pending alert is held back, then "arrives" as a live event would.
  const heldId = useMemo(() => all?.filter((a) => a.status === 'pending' && !a.featured).at(-1)?.id, [all])
  useEffect(() => {
    if (!heldId) return
    const t = window.setTimeout(() => {
      setArrived(true)
      const a = all?.find((x) => x.id === heldId)
      if (a)
        toast('New alert · demo', {
          description: `${a.id} · ${a.district} · ${fmtKm(a.length_km, 2)} · score ${a.score.toFixed(2)}`,
          action: { label: 'Open', onClick: () => nav(`/app/alerts/${a.id}`) },
        })
    }, ARRIVAL_MS)
    return () => window.clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [heldId])

  const alerts = useMemo(() => all?.filter((a) => arrived || a.id !== heldId), [all, arrived, heldId])
  const idx = (id: string) => dates.findIndex((d) => d.id === id)
  const feed = useMemo(() => [...(alerts ?? [])].sort((a, b) => idx(b.first_seen) - idx(a.first_seen) || b.score - a.score), [alerts, dates]) // eslint-disable-line react-hooks/exhaustive-deps

  const k = useMemo(() => {
    if (!alerts || !dates.length) return null
    const perDate = dates.map((d) => alerts.filter((a) => a.first_seen === d.id))
    const recent = alerts.filter((a) => idx(a.first_seen) >= dates.length - 2)
    const reviewed = alerts.filter((a) => a.status === 'accepted' || a.status === 'rejected')
    const rejected = alerts.filter((a) => a.status === 'rejected')
    return {
      labels: dates.map((d) => dateShort(d.id)),
      countSpark: perDate.map((x) => x.length),
      kmSpark: perDate.map((x) => +x.reduce((s, a) => s + a.length_km, 0).toFixed(1)),
      newCount: recent.length,
      newKm: recent.reduce((s, a) => s + a.length_km, 0),
      pending: alerts.filter((a) => a.status === 'pending').length,
      far: reviewed.length ? rejected.length / reviewed.length : 0,
    }
  }, [alerts, dates]) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="flex min-h-full flex-col">
      <PageHeader
        title="Command Center"
        description={`NTR + Krishna pilot · ${dates.length} seasonal composites, ${dates[0] ? dateLabel(dates[0].id) : ''} – ${dates.at(-1) ? dateLabel(dates.at(-1)!.id) : ''}`}
      />
      {error ? (
        <ErrorState what="alerts" onRetry={retry} />
      ) : (
        <div className="grid flex-1 gap-3 p-3 lg:grid-cols-[260px_minmax(0,1fr)_320px] lg:grid-rows-[minmax(520px,calc(100dvh-196px))_auto] lg:p-4">
          {/* KPIs */}
          <section aria-label="Key numbers" className="scrollbar-thin grid grid-cols-2 content-start gap-3 lg:min-h-0 lg:grid-cols-1 lg:overflow-y-auto lg:pr-1">
            {!k || loading ? (
              Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-[96px] rounded-card" />)
            ) : (
              <>
                <Kpi label="New roads, last two dates" value={String(k.newCount)} spark={k.countSpark} labels={k.labels} sub="First seen per date" />
                <Kpi label="New road length" value={fmtKm(k.newKm)} spark={k.kmSpark} labels={k.labels} format={(v) => `${v} km`} />
                <Kpi label="Pending review" value={String(k.pending)} sub="Oldest first in the inbox" />
                <Kpi label="False-alert rate" value={`${Math.round(k.far * 100)}%`} sub="Rejected ÷ reviewed, this browser" />
                <Kpi label="Unreliable composites" value={quality ? `${((quality.abstained / quality.composites) * 100).toFixed(1)}%` : '—'} sub={quality ? `${quality.abstained} of ${quality.composites} tile-dates abstained (cloud) · real` : ''} />
                <Kpi label="Latest data" value={dates.at(-1) ? dateShort(dates.at(-1)!.id) : '—'} sub={dates.at(-1) ? `${dates.at(-1)!.scenes} Sentinel-2 scenes · real` : ''} />
              </>
            )}
          </section>

          {/* Map */}
          <section aria-label="Alert map" className="relative min-h-[420px] overflow-hidden rounded-card border border-line lg:min-h-0">
            <RwMap
              meta={meta}
              dateId={dates.at(-1)?.id ?? '2024_pre_monsoon'}
              base="s2"
              alerts={alerts}
              selectedId={hover}
              onSelect={(id) => id && nav(`/app/alerts/${id}`)}
              initial={{ center: [80.78, 16.42], zoom: 9.2 }}
              ariaLabel="Map of alerts in the pilot area"
            />
            <div className="t-mono pointer-events-none absolute bottom-3 left-3 rounded-chip bg-bg0/80 px-2 py-1 text-[11px] text-muted backdrop-blur">
              Imagery: zone A only · roads © OpenStreetMap
            </div>
          </section>

          {/* Feed */}
          <section aria-label="Alert feed" className="flex min-h-[360px] flex-col overflow-hidden rounded-card border border-line bg-surface lg:min-h-0">
            <div className="flex items-center justify-between border-b border-line px-4 py-3">
              <h2 className="text-[14px] font-medium text-fg">Live feed</h2>
              <Link to="/app/alerts" className="flex items-center gap-1 text-[13px] text-sentinel-ink hover:underline">
                Inbox <ArrowRight className="size-3.5" strokeWidth={1.75} aria-hidden />
              </Link>
            </div>
            {loading && !alerts ? (
              <ListSkeleton />
            ) : !feed.length ? (
              <EmptyState title="No alerts yet" body="When a new road persists across two dates, it shows up here." />
            ) : (
              <ul className="scrollbar-thin flex-1 overflow-y-auto">
                <AnimatePresence initial={false}>
                  {feed.map((a: DemoAlert) => (
                    <motion.li
                      key={a.id}
                      layout={!reduced}
                      initial={{ opacity: 0, backgroundColor: 'color-mix(in oklab, var(--signal) 12%, transparent)' }}
                      animate={{ opacity: 1, backgroundColor: 'rgba(0,0,0,0)' }}
                      transition={{ duration: 0.25, backgroundColor: { duration: 2.5 } }}
                      className="border-b border-line last:border-0"
                    >
                      <Link
                        to={`/app/alerts/${a.id}`}
                        onPointerEnter={() => setHover(a.id)}
                        onPointerLeave={() => setHover(null)}
                        onFocus={() => setHover(a.id)}
                        onBlur={() => setHover(null)}
                        className="block px-4 py-3 transition-colors hover:bg-surface2"
                      >
                        <div className="flex items-center gap-2">
                          <span className="t-mono text-[12px] text-muted">{a.id}</span>
                          {arrived && a.id === heldId && <span className="rounded-[4px] bg-signal px-1.5 text-[11px] font-medium text-on-signal">New</span>}
                          <span className="ml-auto">
                            <PriorityMark priority={a.priority} />
                          </span>
                        </div>
                        <p className="mt-1 truncate text-[14px] text-fg">{a.name ?? `New road · ${a.district}`}</p>
                        <div className="mt-1.5 flex items-center gap-2 text-[12px] whitespace-nowrap text-muted">
                          <span className="t-mono">{fmtKm(a.length_km, 2)}</span>·<span>{dateShort(a.first_seen)}</span>·<span className="t-mono">{a.score.toFixed(2)}</span>
                          <span className="ml-auto">
                            <StatusDot status={a.status} />
                          </span>
                        </div>
                      </Link>
                    </motion.li>
                  ))}
                </AnimatePresence>
              </ul>
            )}
          </section>

          {/* Timeline */}
          <section aria-label="Data timeline" className="rounded-card border border-line bg-surface p-4 lg:col-span-3">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h2 className="text-[14px] font-medium text-fg">Data timeline</h2>
              <p className="text-[12px] text-muted">Bars: share of zone A pixels with valid data (real). Dots: alerts first seen (demo).</p>
            </div>
            <ol className="mt-4 grid grid-cols-3 gap-2 sm:grid-cols-5 lg:grid-cols-9">
              {dates.map((d) => {
                const n = (alerts ?? []).filter((a) => a.first_seen === d.id).length
                return (
                  <li key={d.id} className="min-w-0">
                    <div className="h-2 overflow-hidden rounded-full bg-surface2" title="Valid pixels 100%">
                      <div className="h-full w-full bg-verified/70" />
                    </div>
                    <div className="mt-2 flex items-center justify-between gap-2 text-[12px]">
                      <span className="truncate text-fg">{dateShort(d.id)}</span>
                      <span className="t-mono text-muted">{d.scenes} sc</span>
                    </div>
                    <div className="mt-1.5 flex flex-wrap gap-1" role="img" aria-label={`${n} alerts first seen`}>
                      {Array.from({ length: n }).map((_, i) => (
                        <span key={i} className={cn('size-1.5 rounded-full bg-signal')} />
                      ))}
                    </div>
                  </li>
                )
              })}
            </ol>
          </section>
        </div>
      )}
    </div>
  )
}
