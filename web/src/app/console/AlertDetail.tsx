import { ArrowLeft, Check, Download, Flag, FilePlus2, Radar, Sparkles, X } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import { toast } from 'sonner'
import { ConfidenceBreakdown, PersistenceDots, PriorityMark, StageTracker, StatusChip, stageLabel } from '@/components/alerts/AlertParts'
import { alertCentre } from '@/components/alerts/AlertSummary'
import { RejectDialog, useReviewAction } from '@/components/alerts/ReviewActions'
import { DemoBadge } from '@/components/brand/Brand'
import { RwMap } from '@/components/map/LazyMap'
import { SwipeDivider } from '@/components/map/SwipeDivider'
import { Button } from '@/components/ui/Button'
import { Panel, Segmented, Skeleton } from '@/components/ui/primitives'
import { EmptyState, ErrorState } from '@/components/ui/States'
import { useAlerts, useReview } from '@/lib/appStore'
import { cn } from '@/lib/cn'
import { DATA, useJson, type AlertStatus, type DemoAlert, type ZoneMeta } from '@/lib/data'
import { dateLabel, dateShort, fmtKm, fmtLat, fmtLon } from '@/lib/format'
import { cropAround } from '@/lib/zoneProject'

type View = 'swipe' | 'side' | 'radar'

function Evidence({ alert, meta, view }: { alert: DemoAlert; meta: ZoneMeta; view: View }) {
  const [pos, setPos] = useState(50)
  const crop = useMemo(() => cropAround(meta, alert.geometry.coordinates), [meta, alert])
  const firstIdx = meta.dates.findIndex((d) => d.id === alert.first_seen)
  const before = meta.dates[Math.max(0, firstIdx - 1)]
  const after = meta.dates[meta.dates.length - 1]
  if (view === 'radar')
    return (
      <EmptyState
        className="h-full"
        title="Radar chip not built yet"
        body="Sentinel-1 radar evidence (for cloudy, monsoon dates) is added with the SAR data build in CP2. Optical evidence is on the other tabs."
      />
    )
  if (!crop)
    return (
      <EmptyState
        className="h-full"
        title="No imagery chip for this location yet"
        body="Before/after chips are cut during evaluation. In this UI build, imagery exists for zone A (Vijayawada) only — see the location map below."
      />
    )
  const Img = ({ dateId, overlay }: { dateId: string; overlay: boolean }) => (
    <svg viewBox={`${crop.x} ${crop.y} ${crop.size} ${crop.size}`} preserveAspectRatio="xMidYMid slice" className="absolute inset-0 size-full" role="img" aria-label={`Sentinel-2 composite, ${dateLabel(dateId)}`}>
      <image href={DATA.zoneImage(dateId)} width={meta.size_px[0]} height={meta.size_px[1]} />
      {overlay && <path d={crop.path} fill="none" stroke="#ffb547" strokeWidth={crop.size / 160} strokeLinecap="round" strokeDasharray={`${crop.size / 60} ${crop.size / 90}`} />}
    </svg>
  )
  if (view === 'side')
    return (
      <div className="grid h-full grid-cols-2 gap-px bg-line">
        {[before, after].map((d, i) => (
          <div key={d.id} className="relative overflow-hidden bg-bg1">
            <Img dateId={d.id} overlay={i === 1} />
            <span className="t-mono absolute top-3 left-3 rounded-chip bg-[#05070c]/75 px-2 py-1 text-[11px] text-[#e8edf5]/90">{dateShort(d.id)}</span>
          </div>
        ))}
      </div>
    )
  return (
    <div className="relative h-full overflow-hidden bg-bg1">
      <Img dateId={before.id} overlay={false} />
      <div className="absolute inset-0" style={{ clipPath: `inset(0 0 0 ${pos}%)` }}>
        <Img dateId={after.id} overlay />
      </div>
      <SwipeDivider pos={pos} onChange={setPos} beforeLabel={dateShort(before.id)} afterLabel={dateShort(after.id)} className="[&>span]:!top-3" />
    </div>
  )
}

function explanation(a: DemoAlert) {
  const seen = a.persistence.filter((p) => p === 'seen').length
  return `A ${fmtKm(a.length_km, 2)} ${a.surface ? `${a.surface} ` : ''}road appears in ${a.district} from ${dateLabel(a.first_seen)} and is seen on ${seen} of ${a.persistence.length} dates. It joins the existing network (connectivity ${a.factors.connectivity.toFixed(2)}), and imagery quality on those dates is good (${a.factors.quality.toFixed(2)}). ${a.stage ? `Current stage: ${stageLabel(a.stage).toLowerCase()}.` : 'Construction stage is not estimated yet.'}`
}

export default function AlertDetail() {
  const { id } = useParams()
  const nav = useNavigate()
  const { alerts, dates, loading, error, retry } = useAlerts()
  const meta = useJson<ZoneMeta>(DATA.zoneMeta).data
  const log = useReview((s) => (id ? s.log[id] : undefined))
  const inReport = useReview((s) => (id ? s.report.includes(id) : false))
  const toggleReport = useReview((s) => s.toggleReport)
  const review = useReviewAction()
  const [view, setView] = useState<View>('swipe')
  const [rejecting, setRejecting] = useState(false)
  const a = alerts?.find((x) => x.id === id)
  const original = useMemo(() => Object.fromEntries((alerts ?? []).map((x) => [x.id, x.status])) as Record<string, AlertStatus>, [alerts])

  if (error) return <ErrorState what="this alert" onRetry={retry} />
  if (loading || !alerts)
    return (
      <div className="space-y-4 p-6" aria-busy="true">
        <Skeleton className="h-8 w-80" />
        <Skeleton className="h-[420px] w-full rounded-card" />
      </div>
    )
  if (!a)
    return (
      <EmptyState
        title={`Alert ${id} not found`}
        body="It may have been merged into another alert or withdrawn by a newer model. Search by ID with Ctrl K."
        action={
          <Button size="sm" variant="subtle" onClick={() => nav('/app/alerts')}>
            Back to alerts
          </Button>
        }
      />
    )

  const [lon, lat] = alertCentre(a)
  const exportGeoJSON = () => {
    const fc = { type: 'FeatureCollection', features: [{ type: 'Feature', properties: { id: a.id, length_km: a.length_km, stage: a.stage, score: a.score, first_seen: a.first_seen, status: a.status, demo: true }, geometry: a.geometry }] }
    const url = URL.createObjectURL(new Blob([JSON.stringify(fc, null, 2)], { type: 'application/geo+json' }))
    const link = document.createElement('a')
    link.href = url
    link.download = `${a.id}.geojson`
    link.click()
    URL.revokeObjectURL(url)
    toast('Exported GeoJSON', { description: `${a.id}.geojson · EPSG:4326` })
  }
  const auditLog = [{ at: '2026-10-14T10:00:00Z', who: 'Pipeline (demo)', action: `Alert created from ${dateLabel(a.first_seen)}`, note: undefined as string | undefined }, ...(log ?? [])]

  return (
    <div className="pb-10">
      <div className="flex flex-wrap items-start justify-between gap-4 border-b border-line px-5 py-4 lg:px-6">
        <div className="min-w-0">
          <Link to="/app/alerts" className="inline-flex items-center gap-1.5 text-[13px] text-muted hover:text-fg">
            <ArrowLeft className="size-3.5" strokeWidth={1.75} aria-hidden /> Alerts
          </Link>
          <div className="mt-2 flex flex-wrap items-center gap-3">
            <h1 className="text-[22px] font-medium tracking-[-0.01em] text-fg" style={{ viewTransitionName: 'alert-title' }}>
              {a.name ?? `New road · ${a.district}`}
            </h1>
            <StatusChip status={a.status} />
            <PriorityMark priority={a.priority} />
            {a.demo !== false && <DemoBadge />}
          </div>
          <p className="t-mono mt-1 text-[12px] text-muted">
            {a.id} · {fmtLat(lat)} {fmtLon(lon)} · {a.district} · {a.sensor}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="verified" size="sm" onClick={() => review([a.id], 'accepted', original)} disabled={a.status === 'accepted'}>
            <Check className="size-3.5" strokeWidth={2} /> Accept
          </Button>
          <Button variant="danger" size="sm" onClick={() => setRejecting(true)} disabled={a.status === 'rejected'}>
            <X className="size-3.5" strokeWidth={2} /> Reject
          </Button>
          <Button variant="outline" size="sm" onClick={() => review([a.id], 'flagged', original)} disabled={a.status === 'flagged'}>
            <Flag className="size-3.5" strokeWidth={1.75} /> Flag for field check
          </Button>
          <Button variant="outline" size="sm" onClick={exportGeoJSON}>
            <Download className="size-3.5" strokeWidth={1.75} /> GeoJSON
          </Button>
          <Button variant={inReport ? 'subtle' : 'outline'} size="sm" aria-pressed={inReport} onClick={() => (toggleReport(a.id), toast(inReport ? 'Removed from report' : 'Added to report', { description: 'Monthly KPI report · draft' }))}>
            <FilePlus2 className="size-3.5" strokeWidth={1.75} /> {inReport ? 'In report' : 'Add to report'}
          </Button>
        </div>
      </div>

      <div className="grid gap-4 p-4 lg:grid-cols-[minmax(0,1fr)_380px] lg:p-6">
        <div className="space-y-4">
          <Panel className="overflow-hidden">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line px-4 py-2.5">
              <Segmented
                size="sm"
                label="Evidence view"
                value={view}
                onChange={setView}
                options={[
                  { value: 'swipe', label: 'Before / after' },
                  { value: 'side', label: 'Side by side' },
                  { value: 'radar', label: <span className="inline-flex items-center gap-1.5"><Radar className="size-3.5" strokeWidth={1.75} /> Radar</span> },
                ]}
              />
              <span className="t-mono text-[11px] text-muted">Sentinel-2 L2A · 10 m · real composites</span>
            </div>
            <div className="relative aspect-[4/3] max-h-[62vh] w-full">{meta ? <Evidence alert={a} meta={meta} view={view} /> : <Skeleton className="absolute inset-0 rounded-none" />}</div>
          </Panel>

          <Panel className="p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="text-[14px] font-medium text-fg">Seen across dates</h2>
              <PersistenceDots values={a.persistence} dates={dates} />
            </div>
            <ol className="mt-4 grid grid-cols-3 gap-2 text-[12px] sm:grid-cols-5 xl:grid-cols-9">
              {dates.map((d, i) => (
                <li key={d.id} className={cn('rounded-[8px] border px-2 py-2', a.persistence[i] === 'seen' ? 'border-signal/40 bg-signal/5' : a.persistence[i] === 'abstain' ? 'hatch border-abstain' : 'border-line')}>
                  <div className="text-fg">{dateShort(d.id)}</div>
                  <div className="mt-0.5 text-muted">{a.persistence[i] === 'seen' ? 'Seen' : a.persistence[i] === 'abstain' ? 'Unreliable' : 'Not present'}</div>
                </li>
              ))}
            </ol>
          </Panel>

          <div className="grid gap-4 md:grid-cols-2">
            <Panel className="relative h-64 overflow-hidden">
              <RwMap meta={meta} dateId={dates.at(-1)?.id ?? '2024_pre_monsoon'} base="s2" alerts={[a]} selectedId={a.id} showDemoLayers={false} initial={{ center: [lon, lat], zoom: 13.2 }} ariaLabel={`Location of ${a.id}`} />
            </Panel>
            <Panel className="p-4">
              <div className="flex items-center justify-between">
                <h2 className="text-[14px] font-medium text-fg">Connectivity impact</h2>
                <DemoBadge />
              </div>
              <dl className="mt-4 grid grid-cols-2 gap-4">
                <div>
                  <dt className="text-[12px] text-muted">Villages newly connected</dt>
                  <dd className="t-mono mt-1 text-[22px] text-fg">{1 + (a.id.charCodeAt(5) % 3)}</dd>
                </div>
                <div>
                  <dt className="text-[12px] text-muted">Travel time to market</dt>
                  <dd className="t-mono mt-1 text-[22px] text-fg">−{8 + (a.id.charCodeAt(6) % 9)} min</dd>
                </div>
              </dl>
              <p className="mt-4 text-[12px] text-muted">Computed with OSMnx on the road graph once alerts are real. Values here are placeholders.</p>
            </Panel>
          </div>
        </div>

        <aside className="space-y-4">
          <Panel className="p-4">
            <ConfidenceBreakdown factors={a.factors} score={a.score} />
          </Panel>
          <Panel className="p-4">
            <h2 className="text-[14px] font-medium text-fg">Attributes</h2>
            <dl className="mt-3 grid grid-cols-2 gap-3 text-[13px]">
              <div>
                <dt className="text-muted">Length</dt>
                <dd className="t-mono text-fg">{fmtKm(a.length_km, 2)}</dd>
              </div>
              <div>
                <dt className="text-muted">Width</dt>
                <dd className="t-mono text-fg">{a.width_m != null ? `≈ ${a.width_m.toFixed(0)} m` : '—'}</dd>
              </div>
              <div>
                <dt className="text-muted">Surface</dt>
                <dd className="text-fg capitalize">{a.surface ?? '—'}</dd>
              </div>
              <div>
                <dt className="text-muted">First seen</dt>
                <dd className="text-fg">{dateLabel(a.first_seen)}</dd>
              </div>
            </dl>
            <div className="mt-4">
              <StageTracker stage={a.stage} />
            </div>
          </Panel>
          <Panel className="p-4">
            <div className="flex items-center justify-between gap-2">
              <h2 className="flex items-center gap-2 text-[14px] font-medium text-fg">
                <Sparkles className="size-4 text-muted" strokeWidth={1.75} aria-hidden /> Explanation
              </h2>
              <span className="rounded-chip border border-line px-2 py-0.5 text-[11px] text-muted">Template · AI version later</span>
            </div>
            <p className="mt-3 text-[14px] leading-relaxed text-muted">{explanation(a)}</p>
          </Panel>
          <Panel className="p-4">
            <h2 className="text-[14px] font-medium text-fg">Audit log</h2>
            <ol className="mt-3 space-y-3 border-l border-line pl-4">
              {auditLog.map((e, i) => (
                <li key={i} className="relative text-[13px]">
                  <span className="absolute top-1.5 -left-[21px] size-2 rounded-full border border-line-strong bg-bg0" aria-hidden />
                  <p className="text-fg">
                    {e.action} {e.note && <span className="text-muted">— {e.note}</span>}
                  </p>
                  <p className="t-mono text-[11px] text-muted">
                    {e.who} · {e.at.replace('T', ' ').slice(0, 16)} UTC
                  </p>
                </li>
              ))}
            </ol>
          </Panel>
        </aside>
      </div>
      <RejectDialog open={rejecting} onOpenChange={setRejecting} count={1} onConfirm={(reason) => review([a.id], 'rejected', original, reason)} />
    </div>
  )
}
