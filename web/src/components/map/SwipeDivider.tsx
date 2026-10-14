import { ChevronLeft, ChevronRight } from 'lucide-react'
import { useRef, type KeyboardEvent } from 'react'
import { cn } from '@/lib/cn'

/**
 * Before/after divider — the scan-line motif. Drag it, or focus and use ←/→ (Shift = bigger steps).
 * `pos` is 0–100 (% from the left).
 */
export function SwipeDivider({
  pos,
  onChange,
  beforeLabel,
  afterLabel,
  className,
}: {
  pos: number
  onChange: (p: number) => void
  beforeLabel: string
  afterLabel: string
  className?: string
}) {
  const host = useRef<HTMLDivElement>(null)
  const drag = useRef(false)
  const set = (clientX: number) => {
    const r = host.current?.parentElement?.getBoundingClientRect()
    if (!r) return
    onChange(Math.min(98, Math.max(2, ((clientX - r.left) / r.width) * 100)))
  }
  const onKey = (e: KeyboardEvent) => {
    const step = e.shiftKey ? 10 : 2
    if (e.key === 'ArrowLeft') onChange(Math.max(2, pos - step))
    else if (e.key === 'ArrowRight') onChange(Math.min(98, pos + step))
    else if (e.key === 'Home') onChange(2)
    else if (e.key === 'End') onChange(98)
    else return
    e.preventDefault()
  }
  return (
    <div ref={host} className={cn('pointer-events-none absolute inset-0 z-10', className)}>
      <span className="t-mono pointer-events-none absolute top-[84px] rounded-chip bg-[#05070c]/75 px-2 py-1 text-[11px] text-[#e8edf5]/90 backdrop-blur" style={{ right: `calc(${100 - pos}% + 12px)` }}>
        {beforeLabel}
      </span>
      <span className="t-mono pointer-events-none absolute top-[84px] rounded-chip bg-[#05070c]/75 px-2 py-1 text-[11px] text-[#e8edf5]/90 backdrop-blur" style={{ left: `calc(${pos}% + 12px)` }}>
        {afterLabel}
      </span>
      <div className="absolute inset-y-0 w-px -translate-x-1/2 bg-sentinel shadow-[0_0_14px_2px_color-mix(in_oklab,var(--sentinel)_45%,transparent)]" style={{ left: `${pos}%` }} />
      <div
        role="slider"
        tabIndex={0}
        aria-label="Before/after divider"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(pos)}
        aria-valuetext={`${Math.round(pos)}% ${beforeLabel}, ${Math.round(100 - pos)}% ${afterLabel}`}
        onKeyDown={onKey}
        onPointerDown={(e) => {
          drag.current = true
          e.currentTarget.setPointerCapture(e.pointerId)
        }}
        onPointerMove={(e) => drag.current && set(e.clientX)}
        onPointerUp={() => (drag.current = false)}
        className="pointer-events-auto absolute top-1/2 grid h-11 w-11 -translate-x-1/2 -translate-y-1/2 cursor-ew-resize touch-none place-items-center rounded-full border border-sentinel bg-[#05070c]/85 text-sentinel backdrop-blur"
        style={{ left: `${pos}%` }}
      >
        <span className="flex">
          <ChevronLeft className="size-4" strokeWidth={1.75} />
          <ChevronRight className="-ml-1.5 size-4" strokeWidth={1.75} />
        </span>
      </div>
    </div>
  )
}
