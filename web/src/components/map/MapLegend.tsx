import { cn } from '@/lib/cn'

/** Legend: every class has a shape/pattern as well as a colour. */
export function MapLegend({ className, compact = false }: { className?: string; compact?: boolean }) {
  const row = 'flex items-center gap-2.5'
  return (
    <ul className={cn('space-y-2 text-[12px] text-fg', className)} aria-label="Map legend">
      <li className={row}>
        <svg viewBox="0 0 24 6" className="h-1.5 w-6 shrink-0" aria-hidden>
          <path d="M1 3 H23" stroke="var(--signal)" strokeWidth="3" strokeLinecap="round" />
        </svg>
        New road — reviewed
      </li>
      <li className={row}>
        <svg viewBox="0 0 24 6" className="h-1.5 w-6 shrink-0" aria-hidden>
          <path d="M1 3 H23" stroke="var(--signal)" strokeWidth="3" strokeDasharray="5 3" />
        </svg>
        New road — pending review
      </li>
      <li className={row}>
        <svg viewBox="0 0 24 6" className="h-1.5 w-6 shrink-0" aria-hidden>
          <path d="M1 3 H23" stroke="var(--road-existing)" strokeWidth="2" strokeLinecap="round" />
        </svg>
        Existing road (OSM)
      </li>
      <li className={row}>
        <span className="hatch h-3 w-6 shrink-0 rounded-[2px] border border-abstain" aria-hidden />
        Unreliable tile (abstained)
      </li>
      <li className={row}>
        <span className="h-3 w-6 shrink-0 rounded-[2px] border border-dashed border-priority bg-priority/10" aria-hidden />
        Priority zone
      </li>
      {!compact && (
        <>
          <li className={row}>
            <span className="h-3 w-6 shrink-0 rounded-[2px] border border-dotted border-sentinel" aria-hidden />
            High-res verification zone
          </li>
          <li className={row}>
            <span className="grid w-6 shrink-0 place-items-center" aria-hidden>
              <span className="size-2.5 rounded-full bg-priority ring-2 ring-bg0" />
            </span>
            High-priority alert
          </li>
        </>
      )}
    </ul>
  )
}
