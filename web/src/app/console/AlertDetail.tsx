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
import { API, useJson, type AlertEvidence, type AlertStatus, type DemoAlert } from '@/lib/data'
import { dateLabel, dateShort, fmtKm, fmtLat, fmtLon } from '@/lib/format'

type View = 'swipe' | 'side' | 'radar'
type Chip = AlertEvidence['chips'][number]

const STATE_LABEL: Record<string, string> = { seen: 'Seen', absent: 'Not present', abstain: 'Cloudy — no decision' }

/** One season's image chip with the alert drawn the way the map draws it (white casing, orange dash). */
function ChipImage({ chip, overlay, label }: { chip: Chip; overlay: boolean; label?: string }) {
  const s = chip.size_px
  return (
    <svg viewBox={`0 0 ${s} ${s}`} preserveAspectRatio="xMidYMid meet" className="absolute inset-0 size-full" role="img" aria-label={label ?? `Sentinel-2 composite, ${dateLabel(chip.season)}`}>
      <image href={chip.image} width={s} height={s} preserveAspectRatio="none" />
      {overlay && (
        <>
          <path d={chip.path} fill="none" stroke="#fff" strokeOpacity={0.9} strokeWidth={5} strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
          <path d={chip.path} fill="none" stroke="#f76707" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" strokeDasharray="7 4" vectorEffect="non-scaling-stroke" />
        </>
      )}
    </svg>
  )
}

function DateTag({ season, role }: { season: string; role: string }) {
  return (
    <span className="absolute top-3 left-3 rounded-chip bg-surface/90 px-2 py-1 text-[11px] text-fg shadow-[var(--shadow-panel)]">
      <span className="text-muted">{role} · </span>
      {dateShort(season)}
    </span>
  )
}

function Evidence({ ev, before, after, view }: { ev: AlertEvidence; before: Chip; after: Chip; view: View }) {
  const [pos, setPos] = useState(50)
  if (view === 'radar')
    return (
      <EmptyState
        className="h-full"
        title="Radar chip not built yet"
        body="Sentinel-1 radar evidence (for cloudy, monsoon dates) is added with the SAR data build in CP2. Optical evidence is on the other tabs."
      />
    )
  if (view === 'side')
    return (
      <div className="grid h-full grid-cols-2 gap-px bg-line">
        {[before, after].map((c, i) => (
          <div key={c.season + i} className="relative overflow-hidden bg-surface2">
            <ChipImage chip={c} overlay={i === 1} />
            <DateTag season={c.season} role={i === 0 ? 'Before' : 'After'} />
          </div>
        ))}
      </div>
    )
  return (
    <div className="relative h-full overflow-hidden bg-surface2">
      <ChipImage chip={before} overlay={false} />
      <div className="absolute inset-0" style={{ clipPath: `inset(0 0 0 ${pos}%)` }}>
        <ChipImage chip={after} overlay label={`After: ${dateLabel(after.season)}, new road outlined`} />
      </div>
      <SwipeDivider pos={pos} onChange={setPos} beforeLabel={dateShort(before.season)} afterLabel={dateShort(after.season)} className="[&>span]:!top-3" />
      <span className="t-mono pointer-events-none absolute right-3 bottom-3 rounded-chip bg-surface/90 px-2 py-0.5 text-[10px] text-muted">
        {ev.attribution} · {Math.round((after.size_px * ev.m_per_px) / 10) * 10} m across
      </span>
    </div>
  )
}

/** Default comparison: last clear date before the road appeared vs the latest date it is seen. */
function defaultPair(ev: AlertEvidence): [string, string] {
  // chips arrive in time order; season ids do not sort as strings (post < pre)
  const c = ev.chips
  const firstIdx = Math.max(0, c.findIndex((x) => x.season === ev.first_seen))
  const before = [...c.slice(0, firstIdx)].reverse().find((x) => x.state !== 'abstain') ?? c[0]
  const after = [...c].reverse().find((x) => x.state === 'seen') ?? c[c.length - 1]
  return [before.season, after.season]
}
function explanation(a: DemoAlert) {
  const seen = a.persistence.filter((p) => p === 'seen').length
  return `A ${fmtKm(a.length_km, 2)} ${a.surface ? `${a.surface} ` : ''}road appears in ${a.district} from ${dateLabel(a.first_seen)} and is seen on ${seen} of ${a.persistence.length} dates. It joins the existing network (connectivity ${a.factors.connectivity.toFixed(2)}), and imagery quality on those dates is good (${a.factors.quality.toFixed(2)}). ${a.stage ? `Current stage: ${stageLabel(a.stage).toLowerCase()}.` : 'Construction stage is not estimated yet.'}`
}

export default function AlertDetail() {
  const { id } = useParams()
  const nav = useNavigate()
  const { alerts, dates, generatedUtc, modelId, loading, error, retry } = useAlerts()
  const evidence = useJson<AlertEvidence>(id ? API.alertEvidence(id) : null)
  const ev = evidence.data
  const [pick, setPick] = useState<{ id?: string; before?: string; after?: string }>({})
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
          <Button size="sm" variant="subtle" onClick={() => nav('/alerts')}>
            Back to alerts
          </Button>
        }
      />
    )

  const [lon, lat] = alertCentre(a)
  // comparison dates: defaults until the user picks dates in the filmstrip (reset when the alert changes)
  const [dBefore, dAfter] = ev?.chips.length ? defaultPair(ev) : ['', '']
  const picked = pick.id === a.id ? pick : {}
  const chipOf = (season?: string) => ev?.chips.find((c) => c.season === season)
  const before = chipOf(picked.before) ?? chipOf(dBefore)
  const after = chipOf(picked.after) ?? chipOf(dAfter)
  const order = (season?: string) => ev?.chips.findIndex((c) => c.season === season) ?? -1
  const choose = (season: string) =>
    setPick({ id: a.id, ...(before && order(season) <= order(before.season) ? { before: season, after: after?.season } : { before: before?.season, after: season }) })
  const exportGeoJSON = () => {
    const fc = { type: 'FeatureCollection', features: [{ type: 'Feature', properties: { id: a.id, length_km: a.length_km, stage: a.stage, score: a.score, first_seen: a.first_seen, status: a.status, demo: a.demo !== false }, geometry: a.geometry }] }
    const url = URL.createObjectURL(new Blob([JSON.stringify(fc, null, 2)], { type: 'application/geo+json' }))
    const link = document.createElement('a')
    link.href = url
    link.download = `${a.id}.geojson`
    link.click()
    URL.revokeObjectURL(url)
    toast('Exported GeoJSON', { description: `${a.id}.geojson · EPSG:4326` })
  }
  const created = a.demo === false && generatedUtc ? { at: generatedUtc, who: `Change detection v1 · ${modelId ?? 'S2 model'}` } : { at: '2026-10-14T10:00:00Z', who: 'Pipeline (demo)' }
  const auditLog = [{ ...created, action: `Alert created from ${dateLabel(a.first_seen)}`, note: undefined as string | undefined }, ...(log ?? [])]

  return (
    <div className="pb-10">
      <div className="flex flex-wrap items-start justify-between gap-4 border-b border-line px-5 py-4 lg:px-6">
        <div className="min-w-0">
          <Link to="/alerts" className="inline-flex items-center gap-1.5 text-[13px] text-muted hover:text-fg">
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
              <span className="t-mono text-[11px] text-muted">Sentinel-2 L2A · 10 m · RoadWatch seasonal composites</span>
            </div>
            <div className="relative aspect-[4/3] max-h-[62vh] w-full">
              {ev && before && after ? (
                <Evidence ev={ev} before={before} after={after} view={view} />
              ) : evidence.loading ? (
                <Skeleton className="absolute inset-0 rounded-none" />
              ) : (
                <EmptyState className="h-full" title="No imagery around this alert" body="Our composites cover pilot zones A–C. This alert lies outside them, or its zone has no image yet — see the location map below." />
              )}
            </div>
          </Panel>

          <Panel className="p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="text-[14px] font-medium text-fg">Seen across dates</h2>
              <PersistenceDots values={a.persistence} dates={dates} />
            </div>
            {ev?.chips.length ? (
              <>
                <p className="mt-1 text-[12px] text-muted">Click a date to compare it. Orange outline = the new road; hatched = cloudy, no decision.</p>
                <ol className="mt-3 grid grid-cols-3 gap-2 text-[12px] sm:grid-cols-5 xl:grid-cols-9">
                  {ev.chips.map((c) => {
                    const role = c.season === before?.season ? 'Before' : c.season === after?.season ? 'After' : null
                    return (
                      <li key={c.season}>
                        <button
                          type="button"
                          onClick={() => choose(c.season)}
                          aria-pressed={Boolean(role)}
                          aria-label={`${dateLabel(c.season)}: ${c.state ? STATE_LABEL[c.state] : 'no data'}${role ? ` (${role.toLowerCase()})` : ''}`}
                          className={cn(
                            'group w-full overflow-hidden rounded-[8px] border text-left transition-[border-color,box-shadow] duration-200',
                            role ? 'border-sentinel shadow-[0_0_0_2px_color-mix(in_oklab,var(--sentinel)_18%,transparent)]' : 'border-line hover:border-line-strong',
                          )}
                        >
                          <div className={cn('relative aspect-square bg-surface2', c.state === 'abstain' && 'hatch')}>
                            <ChipImage chip={c} overlay={c.state === 'seen'} />
                            {role && <span className="absolute top-1 left-1 rounded-chip bg-surface/90 px-1.5 py-px text-[10px] font-medium text-fg">{role}</span>}
                          </div>
                          <div className="px-2 py-1.5">
                            <div className="text-fg">{dateShort(c.season)}</div>
                            <div className={cn('mt-0.5', c.state === 'seen' ? 'text-signal-ink' : 'text-muted')}>{c.state ? STATE_LABEL[c.state] : '—'}</div>
                          </div>
                        </button>
                      </li>
                    )
                  })}
                </ol>
              </>
            ) : (
              <ol className="mt-4 grid grid-cols-3 gap-2 text-[12px] sm:grid-cols-5 xl:grid-cols-9">
                {dates.map((d, i) => (
                  <li key={d.id} className={cn('rounded-[8px] border px-2 py-2', a.persistence[i] === 'seen' ? 'border-signal/40 bg-signal/5' : a.persistence[i] === 'abstain' ? 'hatch border-abstain' : 'border-line')}>
                    <div className="text-fg">{dateShort(d.id)}</div>
                    <div className="mt-0.5 text-muted">{a.persistence[i] === 'seen' ? 'Seen' : a.persistence[i] === 'abstain' ? 'Unreliable' : 'Not present'}</div>
                  </li>
                ))}
              </ol>
            )}
          </Panel>

          <div className="grid gap-4 md:grid-cols-2">
            <Panel className="relative h-64 overflow-hidden">
              <RwMap base="satellite" alerts={[a]} selectedId={a.id} showDemoLayers={false} initial={{ center: [lon, lat], zoom: 13.2 }} ariaLabel={`Location of ${a.id}`} />
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
