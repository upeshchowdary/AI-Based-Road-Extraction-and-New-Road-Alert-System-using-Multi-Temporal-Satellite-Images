import { useId, type HTMLAttributes, type ReactNode } from 'react'
import { cn } from '@/lib/cn'

export function Chip({
  tone = 'neutral',
  className,
  children,
  ...rest
}: HTMLAttributes<HTMLSpanElement> & {
  tone?: 'neutral' | 'signal' | 'sentinel' | 'verified' | 'priority' | 'abstain'
}) {
  const tones = {
    neutral: 'border-line text-muted bg-surface/60',
    signal: 'border-signal/40 text-signal-ink bg-signal/10',
    sentinel: 'border-sentinel/40 text-sentinel-ink bg-sentinel/10',
    verified: 'border-verified/40 text-verified bg-verified/10',
    priority: 'border-priority/40 text-priority bg-priority/10',
    abstain: 'border-abstain/50 text-muted hatch',
  }
  return (
    <span
      className={cn(
        'inline-flex h-6 items-center gap-1.5 rounded-chip border px-2 text-[12px] leading-none font-medium whitespace-nowrap',
        tones[tone],
        className,
      )}
      {...rest}
    >
      {children}
    </span>
  )
}

export function Kbd({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <kbd
      className={cn(
        'inline-flex h-5 min-w-5 items-center justify-center rounded-[4px] border border-line-strong bg-surface2 px-1',
        'font-mono text-[11px] text-muted',
        className,
      )}
    >
      {children}
    </kbd>
  )
}

/**
 * Lightweight hint (CSS only, no JS library): shows on hover and on keyboard focus.
 * Used on public pages so Radix isn't in their bundle. The child must be focusable.
 */
export function Hint({ content, children, className, align = 'center' }: { content: ReactNode; children: ReactNode; className?: string; align?: 'center' | 'start' | 'end' }) {
  const id = useId()
  return (
    <span className={cn('group/hint relative inline-flex', className)} aria-describedby={id}>
      {children}
      <span
        role="tooltip"
        id={id}
        className={cn(
          'pointer-events-none invisible absolute bottom-full z-50 mb-2 w-max max-w-64 rounded-chip border border-line-strong bg-surface2 px-2.5 py-1.5 text-left text-[12px] leading-snug font-normal text-fg opacity-0 shadow-[var(--shadow-panel)]',
          'transition-[opacity,visibility] delay-150 duration-150 group-focus-within/hint:visible group-focus-within/hint:opacity-100 group-hover/hint:visible group-hover/hint:opacity-100',
          align === 'center' && 'left-1/2 -translate-x-1/2',
          align === 'start' && 'left-0',
          align === 'end' && 'right-0',
        )}
      >
        {content}
      </span>
    </span>
  )
}

export function Segmented<T extends string>({
  value,
  onChange,
  options,
  label,
  size = 'md',
}: {
  value: T
  onChange: (v: T) => void
  options: { value: T; label: ReactNode; title?: string }[]
  label: string
  size?: 'sm' | 'md'
}) {
  return (
    <div role="radiogroup" aria-label={label} className="inline-flex rounded-[8px] border border-line bg-surface/70 p-0.5">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="radio"
          aria-checked={value === o.value}
          title={o.title}
          onClick={() => onChange(o.value)}
          className={cn(
            'inline-flex items-center gap-1.5 rounded-[6px] font-medium text-muted transition-colors duration-200',
            size === 'sm' ? 'h-7 px-2.5 text-[12px]' : 'h-8 px-3 text-[13px]',
            'hover:text-fg aria-checked:bg-surface2 aria-checked:text-fg aria-checked:shadow-[inset_0_0_0_1px_var(--line-strong)]',
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}

export function Skeleton({ className }: { className?: string }) {
  return <div aria-hidden className={cn('rw-skeleton rounded-chip bg-surface2', className)} />
}

export function Panel({ className, children, ...rest }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn('rounded-card border border-line bg-surface', className)} {...rest}>
      {children}
    </div>
  )
}
