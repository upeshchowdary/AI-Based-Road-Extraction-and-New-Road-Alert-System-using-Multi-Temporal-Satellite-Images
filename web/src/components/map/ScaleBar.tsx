import { cn } from '@/lib/cn'

const NICE = [50, 100, 200, 250, 500, 1000, 2000, 2500, 5000, 10000, 20000, 50000, 100000, 200000, 500000]

/** A true scale bar: picks a round distance that is ~target px long at the current scale. */
export function ScaleBar({ metersPerPx, target = 96, className }: { metersPerPx: number; target?: number; className?: string }) {
  if (!metersPerPx || !Number.isFinite(metersPerPx)) return null
  const want = metersPerPx * target
  const m = NICE.reduce((a, b) => (Math.abs(b - want) < Math.abs(a - want) ? b : a))
  const px = m / metersPerPx
  const label = m >= 1000 ? `${m / 1000} km` : `${m} m`
  return (
    <div className={cn('flex flex-col items-end gap-1.5', className)}>
      <div className="h-1.5 border-x border-b border-current opacity-80" style={{ width: px }} aria-hidden />
      <span className="t-mono text-[12px]">{label}</span>
    </div>
  )
}
