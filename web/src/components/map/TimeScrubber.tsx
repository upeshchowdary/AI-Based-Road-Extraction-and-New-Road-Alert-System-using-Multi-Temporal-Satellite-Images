import { Pause, Play } from 'lucide-react'
import { useEffect, useRef, type KeyboardEvent, type PointerEvent } from 'react'
import { cn } from '@/lib/cn'
import type { DateInfo } from '@/lib/data'
import { dateShort } from '@/lib/format'

/**
 * Date scrubber: drag, click a tick, or use ←/→/Home/End. Optional play/pause.
 * The thumb is the scan-line motif: a thin luminous vertical bar.
 */
export function TimeScrubber({
  dates,
  index,
  onChange,
  playing,
  onPlayingChange,
  label = 'Date',
  className,
  compact = false,
}: {
  dates: DateInfo[]
  index: number
  onChange: (i: number) => void
  playing?: boolean
  onPlayingChange?: (p: boolean) => void
  label?: string
  className?: string
  compact?: boolean
}) {
  const track = useRef<HTMLDivElement>(null)
  const dragging = useRef(false)
  const n = dates.length
  const frac = n > 1 ? index / (n - 1) : 0

  useEffect(() => {
    if (!playing || !onPlayingChange) return
    const id = window.setInterval(() => {
      onChange(index >= n - 1 ? 0 : index + 1)
    }, 1400)
    return () => window.clearInterval(id)
  }, [playing, index, n, onChange, onPlayingChange])

  const fromPointer = (e: PointerEvent) => {
    const r = track.current?.getBoundingClientRect()
    if (!r) return
    const f = Math.min(1, Math.max(0, (e.clientX - r.left) / r.width))
    onChange(Math.round(f * (n - 1)))
  }
  const onKey = (e: KeyboardEvent) => {
    const map: Record<string, number> = { ArrowRight: 1, ArrowUp: 1, ArrowLeft: -1, ArrowDown: -1 }
    if (e.key in map) {
      e.preventDefault()
      onChange(Math.min(n - 1, Math.max(0, index + map[e.key])))
      onPlayingChange?.(false)
    } else if (e.key === 'Home') {
      e.preventDefault()
      onChange(0)
    } else if (e.key === 'End') {
      e.preventDefault()
      onChange(n - 1)
    }
  }

  return (
    <div className={cn('flex items-center gap-4', className)}>
      {onPlayingChange && (
        <button
          type="button"
          onClick={() => onPlayingChange(!playing)}
          aria-label={playing ? 'Pause time-lapse' : 'Play time-lapse'}
          className="grid size-10 shrink-0 place-items-center rounded-full border border-line-strong text-fg transition-colors hover:border-sentinel/60"
        >
          {playing ? <Pause className="size-4" strokeWidth={1.75} /> : <Play className="ml-0.5 size-4" strokeWidth={1.75} />}
        </button>
      )}
      <div className="min-w-0 flex-1">
        <div
          ref={track}
          role="slider"
          tabIndex={0}
          aria-label={label}
          aria-valuemin={0}
          aria-valuemax={n - 1}
          aria-valuenow={index}
          aria-valuetext={dates[index]?.label}
          onKeyDown={onKey}
          onPointerDown={(e) => {
            dragging.current = true
            ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
            onPlayingChange?.(false)
            fromPointer(e)
          }}
          onPointerMove={(e) => dragging.current && fromPointer(e)}
          onPointerUp={() => (dragging.current = false)}
          className="relative h-10 cursor-pointer touch-none rounded-[6px]"
        >
          <div className="absolute inset-x-0 top-1/2 h-px -translate-y-1/2 bg-line-strong" />
          <div className="absolute top-1/2 left-0 h-px -translate-y-1/2 bg-sentinel transition-[width] duration-300 ease-ui" style={{ width: `${frac * 100}%` }} />
          {dates.map((d, i) => (
            <span
              key={d.id}
              className={cn('absolute top-1/2 size-2 -translate-x-1/2 -translate-y-1/2 rounded-full border', i <= index ? 'border-sentinel bg-sentinel' : 'border-line-strong bg-bg0')}
              style={{ left: `${n > 1 ? (i / (n - 1)) * 100 : 0}%` }}
            />
          ))}
          <span
            className="absolute top-0 bottom-0 w-[3px] -translate-x-1/2 rounded-full bg-sentinel shadow-[0_0_12px_var(--sentinel)] transition-[left] duration-300 ease-ui"
            style={{ left: `${frac * 100}%` }}
            aria-hidden
          />
        </div>
        {!compact && (
          <div className="relative mt-1 h-5">
            {dates.map((d, i) => (
              <span
                key={d.id}
                className={cn(
                  't-mono absolute -translate-x-1/2 text-[11px] whitespace-nowrap',
                  i === 0 && 'translate-x-0',
                  i === n - 1 && '-translate-x-full',
                  i === index ? 'text-fg' : 'text-muted',
                )}
                style={{ left: `${n > 1 ? (i / (n - 1)) * 100 : 0}%` }}
              >
                {dateShort(d.id)}
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
