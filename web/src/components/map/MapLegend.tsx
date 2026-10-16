import { cn } from '@/lib/cn'
import type { LayerVisibility } from './nightSurveyStyle'

// the exact colours the map draws (nightSurveyStyle PALETTES) — legend must match the map
const ORANGE = '#f76707'
const TEAL = '#2ec4b6'

/** Legend for the layers that are switched on. Every class has a shape as well as a colour. */
export function MapLegend({ className, visible }: { className?: string; visible?: LayerVisibility }) {
  const v = visible
  const row = 'flex items-center gap-2.5'
  const items: { key: keyof LayerVisibility | 'always'; el: React.ReactNode }[] = [
    {
      key: 'newRoads',
      el: (
        <>
          <span className="grid w-6 shrink-0 place-items-center" aria-hidden>
            <span className="grid size-4 place-items-center rounded-full text-[8px] font-bold text-white ring-2 ring-white" style={{ background: ORANGE }}>
              9
            </span>
          </span>
          New-road alerts (number = group)
        </>
      ),
    },
    {
      key: 'newRoads',
      el: (
        <>
          <svg viewBox="0 0 24 8" className="h-2 w-6 shrink-0" aria-hidden>
            <path d="M1 4 H23" stroke="#fff" strokeWidth="5" strokeLinecap="round" />
            <path d="M1 4 H23" stroke={ORANGE} strokeWidth="2.5" strokeDasharray="5 3" />
          </svg>
          New road, pending review
        </>
      ),
    },
    {
      key: 'predicted',
      el: (
        <>
          <svg viewBox="0 0 24 6" className="h-1.5 w-6 shrink-0" aria-hidden>
            <path d="M1 3 H23" stroke={TEAL} strokeWidth="3" strokeLinecap="round" />
          </svg>
          Road found by RoadWatch
        </>
      ),
    },
    {
      key: 'abstain',
      el: (
        <>
          <span className="hatch h-3 w-6 shrink-0 rounded-[2px] border border-abstain" aria-hidden />
          Cloudy tile — no decision
        </>
      ),
    },
    {
      key: 'zones',
      el: (
        <>
          <span className="h-3 w-6 shrink-0 rounded-[2px] border border-dotted" style={{ borderColor: TEAL }} aria-hidden />
          Study zones A · B · C
        </>
      ),
    },
    {
      key: 'priority',
      el: (
        <>
          <span className="h-3 w-6 shrink-0 rounded-[2px] border border-dashed border-priority bg-priority/10" aria-hidden />
          Priority zone (demo)
        </>
      ),
    },
  ]
  const shown = items.filter((i) => i.key === 'always' || !v || v[i.key as keyof LayerVisibility])
  if (!shown.length) return null
  return (
    <ul className={cn('space-y-2 text-[12px] text-fg', className)} aria-label="Map legend">
      {shown.map((i, n) => (
        <li key={n} className={row}>
          {i.el}
        </li>
      ))}
    </ul>
  )
}
