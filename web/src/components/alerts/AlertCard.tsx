import { forwardRef } from 'react'
import { DemoBadge } from '@/components/brand/Brand'
import type { DateInfo, DemoAlert } from '@/lib/data'
import { cn } from '@/lib/cn'
import { dateLabel, fmtKm } from '@/lib/format'
import { ConfidenceBreakdown, PersistenceDots, stageLabel } from './AlertParts'

/** The proof card: what appeared, how long, how sure, since when. */
export const AlertCard = forwardRef<
  HTMLDivElement,
  { alert: DemoAlert; dates: DateInfo[]; className?: string; lengthNote?: string; showBreakdown?: boolean }
>(function AlertCard({ alert, dates, className, lengthNote, showBreakdown = true }, ref) {
  return (
    <div
      ref={ref}
      className={cn(
        'w-[320px] max-w-[calc(100vw-32px)] rounded-card border border-line-strong bg-surface/90 p-4 shadow-[var(--shadow-panel)] backdrop-blur-md',
        className,
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 text-[13px] font-medium text-signal-ink">
            <svg viewBox="0 0 16 4" className="h-1 w-4" aria-hidden>
              <path d="M1 2 H15" stroke="var(--signal)" strokeWidth="2.5" strokeLinecap="round" />
            </svg>
            New road
          </div>
          <div className="mt-1 text-[15px] leading-snug font-medium text-fg">{alert.name ?? `Candidate ${alert.id}`}</div>
        </div>
        <DemoBadge className="shrink-0" />
      </div>
      <dl className="mt-4 grid grid-cols-3 gap-3 border-y border-line py-3">
        <div>
          <dt className="text-[12px] text-muted">Length</dt>
          <dd className="t-mono mt-0.5 text-fg">{fmtKm(alert.length_km)}</dd>
        </div>
        <div>
          <dt className="text-[12px] text-muted">First seen</dt>
          <dd className="t-mono mt-0.5 text-fg">{dateLabel(alert.first_seen).replace('-monsoon', '')}</dd>
        </div>
        <div>
          <dt className="text-[12px] text-muted">Stage</dt>
          <dd className="t-mono mt-0.5 text-fg">{stageLabel(alert.stage)}</dd>
        </div>
      </dl>
      <div className="mt-3 flex items-center justify-between">
        <span className="text-[12px] text-muted">Persistence</span>
        <PersistenceDots values={alert.persistence} dates={dates} />
      </div>
      {showBreakdown && (
        <div className="mt-3">
          <ConfidenceBreakdown factors={alert.factors} score={alert.score} compact />
        </div>
      )}
      {lengthNote && <p className="mt-3 text-[12px] leading-snug text-muted">{lengthNote}</p>}
    </div>
  )
})
