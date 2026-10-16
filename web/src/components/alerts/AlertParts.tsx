import { Check, Minus } from 'lucide-react'
import type { DateInfo, DemoAlert, Seen, Stage } from '@/lib/data'
import { cn } from '@/lib/cn'
import { dateShort } from '@/lib/format'
import { Hint } from '@/components/ui/primitives'

const FACTORS: { key: keyof DemoAlert['factors']; label: string; hint: string }[] = [
  { key: 'model', label: 'Model', hint: 'How sure the road model is that these pixels are road.' },
  { key: 'persistence', label: 'Persistence', hint: 'Seen again on later dates (needs at least 2).' },
  { key: 'connectivity', label: 'Connectivity', hint: 'Joins the existing network like a real road does.' },
  { key: 'quality', label: 'Data quality', hint: 'Clouds, shadow and registration on these dates.' },
]

/** Score = model × persistence × connectivity × data quality (PROJECT_PROMPT 7.4). */
export function ConfidenceBreakdown({ factors, score, compact = false }: { factors: DemoAlert['factors']; score: number; compact?: boolean }) {
  return (
    <div>
      <div className="flex items-baseline justify-between">
        <span className="text-[13px] text-muted">Alert score</span>
        <span className="t-mono text-[15px] text-fg">{score.toFixed(2)}</span>
      </div>
      <div className="mt-2 flex h-2 gap-0.5 overflow-hidden rounded-full" role="img" aria-label={`Score ${score.toFixed(2)}: ${FACTORS.map((f) => `${f.label} ${factors[f.key].toFixed(2)}`).join(', ')}`}>
        {FACTORS.map((f, i) => (
          <div key={f.key} className="relative flex-1 bg-surface2">
            <div
              className="absolute inset-y-0 left-0"
              style={{ width: `${factors[f.key] * 100}%`, background: i === 0 ? 'var(--signal)' : `color-mix(in oklab, var(--signal) ${80 - i * 16}%, var(--road-existing))` }}
            />
          </div>
        ))}
      </div>
      {!compact && (
        <ul className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1.5" aria-label="Score factors">
          {FACTORS.map((f, i) => (
            <li key={f.key}>
              {/* right column anchors right so the hint stays inside the panel */}
              <Hint content={f.hint} align={i % 2 ? 'end' : 'start'} className="flex">
                <span tabIndex={0} className="flex w-full items-baseline justify-between gap-2 rounded-[4px] text-[13px]">
                  <span className="text-muted">{f.label}</span>
                  <span className="t-mono text-fg">× {factors[f.key].toFixed(2)}</span>
                </span>
              </Hint>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

const SEEN_LABEL: Record<Seen, string> = { seen: 'Seen', absent: 'Not present', abstain: 'Unreliable (abstained)' }

/** One dot per date: filled = seen, empty = absent, hatched = abstained. Alert fires on the 2nd sighting. */
export function PersistenceDots({ values, dates, className }: { values: Seen[]; dates: DateInfo[]; className?: string }) {
  let seen = 0
  return (
    <ol className={cn('flex items-center gap-1.5', className)} aria-label="Persistence across dates">
      {values.map((v, i) => {
        if (v === 'seen') seen++
        const fires = v === 'seen' && seen === 2
        return (
          <li key={i}>
            <Hint content={`${dates[i]?.label ?? dateShort(dates[i]?.id ?? '')}: ${SEEN_LABEL[v]}${fires ? ' · alert fired' : ''}`}>
              <span
                tabIndex={0}
                role="img"
                aria-label={`${dates[i]?.label}: ${SEEN_LABEL[v]}`}
                className={cn(
                  'relative block size-3 rounded-full border',
                  v === 'seen' && 'border-signal bg-signal',
                  v === 'absent' && 'border-line-strong bg-transparent',
                  v === 'abstain' && 'hatch border-abstain',
                  fires && 'ring-2 ring-signal/35 ring-offset-1 ring-offset-surface',
                )}
              />
            </Hint>
          </li>
        )
      })}
    </ol>
  )
}

const STAGES: Stage[] = ['cleared', 'earthwork', 'gravel', 'paved']
const STAGE_LABEL: Record<Stage, string> = { cleared: 'Cleared', earthwork: 'Earthwork', gravel: 'Gravel', paved: 'Paved' }
export const stageLabel = (s: Stage | null) => (s ? STAGE_LABEL[s] : 'Not estimated')

export function StageTracker({ stage, className }: { stage: Stage | null; className?: string }) {
  if (!stage) return <p className={cn('text-[12px] text-muted', className)}>Construction stage: not estimated yet (planned)</p>
  const idx = STAGES.indexOf(stage)
  return (
    <ol className={cn('grid grid-cols-4 gap-1', className)} aria-label={`Construction stage: ${STAGE_LABEL[stage]}`}>
      {STAGES.map((s, i) => (
        <li key={s} className="min-w-0">
          <div className={cn('h-1 rounded-full', i <= idx ? 'bg-signal' : 'bg-surface2')} />
          <div className={cn('mt-1.5 flex items-center gap-1 truncate text-[12px]', i === idx ? 'text-fg' : 'text-muted')}>
            {i < idx ? <Check className="size-3 shrink-0" strokeWidth={2} aria-hidden /> : i === idx ? null : <Minus className="size-3 shrink-0 opacity-50" aria-hidden />}
            {STAGE_LABEL[s]}
          </div>
        </li>
      ))}
    </ol>
  )
}

export function StatusChip({ status }: { status: DemoAlert['status'] }) {
  const map = {
    pending: { c: 'border-sentinel/40 text-sentinel-ink', l: 'Pending review' },
    accepted: { c: 'border-verified/40 text-verified', l: 'Accepted' },
    rejected: { c: 'border-line-strong text-muted line-through decoration-1', l: 'Rejected' },
    flagged: { c: 'border-signal/40 text-signal-ink', l: 'Field check' },
  }[status]
  return <span className={cn('inline-flex h-6 items-center rounded-chip border px-2 text-[12px] font-medium whitespace-nowrap', map.c)}>{map.l}</span>
}

/** Compact status for dense lists: shape + word, never colour alone. */
export function StatusDot({ status }: { status: DemoAlert['status'] }) {
  const m = {
    pending: ['border border-sentinel', 'Pending', 'text-sentinel-ink'],
    accepted: ['bg-verified', 'Accepted', 'text-verified'],
    rejected: ['bg-abstain', 'Rejected', 'text-muted'],
    flagged: ['rotate-45 rounded-none bg-signal', 'Field check', 'text-signal-ink'],
  }[status]
  return (
    <span className={cn('inline-flex items-center gap-1.5 text-[12px]', m[2])}>
      <span className={cn('size-2 rounded-full', m[0])} aria-hidden />
      {m[1]}
    </span>
  )
}

export function PriorityMark({ priority }: { priority: DemoAlert['priority'] }) {
  if (priority === 'high')
    return (
      <span className="inline-flex items-center gap-1.5 text-[12px] font-medium text-priority">
        <span className="size-2 rotate-45 bg-priority" aria-hidden />
        High
      </span>
    )
  return <span className="text-[12px] text-muted">{priority === 'normal' ? 'Normal' : 'Low'}</span>
}
