import { useId, useState } from 'react'
import { cn } from '@/lib/cn'

/**
 * Sparkline: one series, no legend (the tile title names it). 2px line, ≥8px hover marker,
 * hover/focus tooltip per point. Colour is the series; text stays in text tokens.
 */
export function Sparkline({
  values,
  labels,
  className,
  color = 'var(--signal)',
  format = (v: number) => String(v),
  height = 36,
}: {
  values: number[]
  labels: string[]
  className?: string
  color?: string
  format?: (v: number) => string
  height?: number
}) {
  const [hover, setHover] = useState<number | null>(null)
  const id = useId()
  const w = 120
  const h = height
  const max = Math.max(1, ...values)
  const min = Math.min(0, ...values)
  const pts = values.map((v, i) => [(i / Math.max(1, values.length - 1)) * (w - 8) + 4, h - 4 - ((v - min) / (max - min || 1)) * (h - 10)] as const)
  const d = pts.map(([x, y], i) => `${i ? 'L' : 'M'}${x.toFixed(1)},${y.toFixed(1)}`).join('')
  return (
    <div className={cn('relative', className)}>
      <svg viewBox={`0 0 ${w} ${h}`} className="block h-9 w-full overflow-visible" preserveAspectRatio="none" role="img" aria-labelledby={id}>
        <title id={id}>{labels.map((l, i) => `${l}: ${format(values[i])}`).join(', ')}</title>
        <path d={`${d}L${pts[pts.length - 1][0]},${h}L${pts[0][0]},${h}Z`} fill={color} opacity="0.08" />
        <path d={d} fill="none" stroke={color} strokeWidth="2" vectorEffect="non-scaling-stroke" strokeLinejoin="round" strokeLinecap="round" />
        {pts.map(([x, y], i) => (
          <g key={i}>
            <rect x={x - w / values.length / 2} y={0} width={w / values.length} height={h} fill="transparent" onPointerEnter={() => setHover(i)} onPointerLeave={() => setHover(null)} />
            {hover === i && <circle cx={x} cy={y} r="4" fill={color} stroke="var(--surface)" strokeWidth="2" vectorEffect="non-scaling-stroke" />}
          </g>
        ))}
      </svg>
      {hover !== null && (
        <div
          className="pointer-events-none absolute -top-9 z-10 -translate-x-1/2 rounded-chip border border-line-strong bg-surface2 px-2 py-1 text-[11px] whitespace-nowrap text-fg"
          style={{ left: `${(pts[hover][0] / w) * 100}%` }}
        >
          <span className="text-muted">{labels[hover]}</span> <span className="t-mono">{format(values[hover])}</span>
        </div>
      )}
    </div>
  )
}

/** Horizontal bars, each directly labelled (identity never colour-alone). */
export function HBars({
  rows,
  max,
  format = (v: number) => String(v),
  className,
}: {
  rows: { label: string; value: number; color?: string; note?: string }[]
  max?: number
  format?: (v: number) => string
  className?: string
}) {
  const m = max ?? Math.max(1, ...rows.map((r) => r.value))
  const [hover, setHover] = useState<number | null>(null)
  return (
    <ul className={cn('space-y-2.5', className)}>
      {rows.map((r, i) => (
        <li key={r.label} className="grid grid-cols-[minmax(0,9rem)_1fr_auto] items-center gap-3 text-[13px]" onPointerEnter={() => setHover(i)} onPointerLeave={() => setHover(null)}>
          <span className="truncate text-muted">{r.label}</span>
          <span className="relative h-3 rounded-r-[4px]">
            <span
              className="absolute inset-y-0 left-0 rounded-r-[4px] transition-[width] duration-700 ease-out-expo"
              style={{ width: `${Math.max(0.5, (r.value / m) * 100)}%`, background: r.color ?? 'var(--road-existing)', opacity: hover === null || hover === i ? 1 : 0.55 }}
            />
          </span>
          <span className="t-mono text-fg">{format(r.value)}</span>
        </li>
      ))}
    </ul>
  )
}
