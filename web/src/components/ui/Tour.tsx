import { X } from 'lucide-react'
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { cn } from '@/lib/cn'
import { Button } from './Button'

export interface TourStep {
  target: string // data-tour value
  title: string
  body: string
}

/** Coach marks: a highlighted cut-out around each target. Esc closes; ←/→ move between steps. */
export function Tour({ steps, open, onClose }: { steps: TourStep[]; open: boolean; onClose: () => void }) {
  const [i, setI] = useState(0)
  const [rect, setRect] = useState<DOMRect | null>(null)
  const card = useRef<HTMLDivElement>(null)
  const step = steps[i]

  const measure = useCallback(() => {
    const el = document.querySelector<HTMLElement>(`[data-tour="${step?.target}"]`)
    setRect(el ? el.getBoundingClientRect() : null)
  }, [step])

  useLayoutEffect(() => {
    if (!open) return
    measure()
    window.addEventListener('resize', measure)
    return () => window.removeEventListener('resize', measure)
  }, [open, measure])

  useEffect(() => {
    if (!open) return
    card.current?.focus()
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
      if (e.key === 'ArrowRight') setI((v) => Math.min(steps.length - 1, v + 1))
      if (e.key === 'ArrowLeft') setI((v) => Math.max(0, v - 1))
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose, steps.length])

  useEffect(() => {
    if (open) setI(0)
  }, [open])

  if (!open || !step) return null
  const pad = 8
  const r = rect ?? new DOMRect(window.innerWidth / 2 - 120, window.innerHeight / 2 - 60, 240, 120)
  const hole = { left: r.left - pad, top: r.top - pad, width: r.width + pad * 2, height: r.height + pad * 2 }
  // place the card next to the target, inside the viewport
  const cw = Math.min(340, window.innerWidth - 32)
  const below = hole.top + hole.height + 16 + 190 < window.innerHeight
  const right = hole.left + hole.width + 16 + cw < window.innerWidth
  let left = right && r.width < window.innerWidth * 0.5 ? hole.left + hole.width + 16 : hole.left
  let top = right && r.width < window.innerWidth * 0.5 ? hole.top : below ? hole.top + hole.height + 16 : hole.top - 16 - 190
  if (r.width > window.innerWidth * 0.6 && r.height > window.innerHeight * 0.6) {
    left = window.innerWidth / 2 - cw / 2
    top = window.innerHeight / 2 - 95
  }
  left = Math.min(window.innerWidth - cw - 16, Math.max(16, left))
  top = Math.min(window.innerHeight - 210, Math.max(16, top))

  return (
    <div className="fixed inset-0 z-[70]" role="dialog" aria-modal="true" aria-labelledby="tour-title">
      {/* geometry changes are instant: animating size/position would register as layout shift */}
      <div className="pointer-events-none absolute rounded-[10px] border border-sentinel" style={{ ...hole, boxShadow: '0 0 0 9999px var(--scrim)' }} />
      <div
        ref={card}
        tabIndex={-1}
        className="absolute top-0 left-0 rounded-card border border-line-strong bg-surface p-5 shadow-[var(--shadow-panel)] outline-none transition-transform duration-300 ease-out-expo"
        style={{ transform: `translate(${left}px, ${top}px)`, width: cw }}
      >
        <div className="flex items-start justify-between gap-3">
          <p className="t-mono text-[12px] text-sentinel-ink">
            {i + 1} / {steps.length}
          </p>
          <button type="button" onClick={onClose} aria-label="Close tour" className="-m-1 rounded-[6px] p-1 text-muted hover:text-fg">
            <X className="size-4" strokeWidth={1.75} />
          </button>
        </div>
        <h2 id="tour-title" className="mt-2 text-[17px] font-medium text-fg">
          {step.title}
        </h2>
        <p className="mt-1.5 text-[14px] leading-relaxed text-muted">{step.body}</p>
        <div className="mt-4 flex items-center justify-between">
          <div className="flex gap-1" aria-hidden>
            {steps.map((_, k) => (
              <span key={k} className={cn('h-1 w-4 rounded-full', k <= i ? 'bg-sentinel' : 'bg-line-strong')} />
            ))}
          </div>
          <div className="flex gap-2">
            {i > 0 && (
              <Button size="sm" variant="ghost" onClick={() => setI(i - 1)}>
                Back
              </Button>
            )}
            {i < steps.length - 1 ? (
              <Button size="sm" variant="subtle" onClick={() => setI(i + 1)}>
                Next
              </Button>
            ) : (
              <Button size="sm" variant="subtle" onClick={onClose}>
                Start exploring
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
