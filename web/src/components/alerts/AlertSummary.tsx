import type { ReactNode } from 'react'
import { DemoBadge } from '@/components/brand/Brand'
import type { DateInfo, DemoAlert } from '@/lib/data'
import { dateLabel, fmtKm, fmtLat, fmtLon } from '@/lib/format'
import { ConfidenceBreakdown, PersistenceDots, PriorityMark, StageTracker, StatusChip } from './AlertParts'

export function alertCentre(a: DemoAlert) {
  const c = a.geometry.coordinates
  return c[Math.floor(c.length / 2)]
}

/** Read-only alert detail used by the public Explore sheet and the app's side panels. */
export function AlertSummary({ alert, dates, actions }: { alert: DemoAlert; dates: DateInfo[]; actions?: ReactNode }) {
  const [lon, lat] = alertCentre(alert)
  return (
    <div className="space-y-6">
      <div>
        <div className="flex flex-wrap items-center gap-2">
          <StatusChip status={alert.status} />
          <PriorityMark priority={alert.priority} />
          {alert.demo !== false && <DemoBadge className="ml-auto" />}
        </div>
        <h2 className="mt-3 text-[20px] leading-snug font-medium text-fg">{alert.name ?? 'New road candidate'}</h2>
        <p className="t-mono mt-1 text-[12px] text-muted">
          {alert.id} · {fmtLat(lat, 4)} {fmtLon(lon, 4)} · {alert.district}
        </p>
      </div>

      <dl className="grid grid-cols-3 gap-3 rounded-card border border-line p-3">
        <div>
          <dt className="text-[12px] text-muted">Length</dt>
          <dd className="t-mono mt-0.5 text-fg">{fmtKm(alert.length_km, 2)}</dd>
        </div>
        <div>
          <dt className="text-[12px] text-muted">Width</dt>
          <dd className="t-mono mt-0.5 text-fg">{alert.width_m != null ? `≈ ${alert.width_m.toFixed(0)} m` : '—'}</dd>
        </div>
        <div>
          <dt className="text-[12px] text-muted">Surface</dt>
          <dd className="t-mono mt-0.5 text-fg capitalize">{alert.surface ?? '—'}</dd>
        </div>
      </dl>

      <section aria-label="Construction stage">
        <h3 className="mb-2 text-[13px] text-muted">Construction stage</h3>
        <StageTracker stage={alert.stage} />
      </section>

      <section aria-label="Persistence">
        <div className="flex items-center justify-between">
          <h3 className="text-[13px] text-muted">Seen on</h3>
          <PersistenceDots values={alert.persistence} dates={dates} />
        </div>
        <p className="mt-2 text-[13px] text-muted">
          First seen <span className="text-fg">{dateLabel(alert.first_seen)}</span> · {alert.persistence.filter((p) => p === 'seen').length} of{' '}
          {alert.persistence.length} dates · {alert.sensor}
        </p>
      </section>

      <section aria-label="Confidence">
        <ConfidenceBreakdown factors={alert.factors} score={alert.score} />
      </section>

      {actions}
    </div>
  )
}
