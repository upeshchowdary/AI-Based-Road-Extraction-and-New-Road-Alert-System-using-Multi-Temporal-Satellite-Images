import { CloudOff, LockKeyhole, RefreshCw, TriangleAlert } from 'lucide-react'
import { useState, type ReactNode } from 'react'
import { DemoBadge } from '@/components/brand/Brand'
import { cn } from '@/lib/cn'
import { Button } from './Button'
import { Skeleton } from './primitives'

/** Every app screen has these states (UI_PROMPT.md 7.0). Written to direct, not to apologise. */

function Illo({ kind }: { kind: 'empty' | 'error' | 'offline' | 'locked' }) {
  return (
    <svg viewBox="0 0 120 72" className="h-16 w-28" aria-hidden>
      <rect x="1" y="1" width="118" height="70" rx="8" fill="var(--bg-1)" stroke="var(--line-strong)" />
      <path d="M10 56 C 34 46, 56 50, 80 36 S 110 22, 118 20" stroke="var(--line-strong)" fill="none" />
      <path d="M10 64 C 30 58, 60 66, 90 52 S 112 44, 118 44" stroke="var(--line)" fill="none" />
      {kind === 'empty' && <path d="M34 40 L60 28 L86 34" stroke="var(--road-existing)" strokeWidth="2" strokeDasharray="4 3" fill="none" />}
      {kind === 'error' && <path d="M44 20 L76 52 M76 20 L44 52" stroke="var(--priority)" strokeWidth="2" strokeLinecap="round" />}
      {kind === 'offline' && <path d="M40 46 Q60 22 80 46" stroke="var(--abstain)" strokeWidth="2" fill="none" strokeDasharray="3 3" />}
      {kind === 'locked' && <rect x="50" y="26" width="20" height="18" rx="3" fill="none" stroke="var(--text-muted)" strokeWidth="2" />}
      <line x1="60" y1="1" x2="60" y2="71" stroke="var(--sentinel)" strokeOpacity="0.6" />
    </svg>
  )
}

export function EmptyState({ title, body, action, className }: { title: string; body: string; action?: ReactNode; className?: string }) {
  return (
    <div className={cn('flex flex-col items-center justify-center gap-3 px-6 py-14 text-center', className)}>
      <Illo kind="empty" />
      <h2 className="mt-2 text-[15px] font-medium text-fg">{title}</h2>
      <p className="max-w-sm text-[14px] text-muted">{body}</p>
      {action && <div className="mt-2">{action}</div>}
    </div>
  )
}

export function ErrorState({ what, onRetry, className }: { what: string; onRetry?: () => void; className?: string }) {
  return (
    <div role="alert" className={cn('flex flex-col items-center justify-center gap-3 px-6 py-14 text-center', className)}>
      <Illo kind="error" />
      <h2 className="mt-2 flex items-center gap-2 text-[15px] font-medium text-fg">
        <TriangleAlert className="size-4 text-priority" strokeWidth={1.75} aria-hidden />
        Couldn’t load {what}
      </h2>
      <p className="max-w-sm text-[14px] text-muted">Check your connection, then retry. Cached data stays available in offline mode.</p>
      {onRetry && (
        <Button size="sm" variant="subtle" onClick={onRetry} className="mt-2">
          <RefreshCw className="size-3.5" strokeWidth={1.75} aria-hidden />
          Retry
        </Button>
      )}
    </div>
  )
}

export function OfflineState({ feature, className }: { feature: string; className?: string }) {
  return (
    <div className={cn('flex flex-col items-center justify-center gap-3 px-6 py-14 text-center', className)}>
      <Illo kind="offline" />
      <h2 className="mt-2 flex items-center gap-2 text-[15px] font-medium text-fg">
        <CloudOff className="size-4 text-muted" strokeWidth={1.75} aria-hidden />
        {feature} needs a connection
      </h2>
      <p className="max-w-sm text-[14px] text-muted">Offline mode is on. Maps, alerts and reviews keep working from the local cache; turn offline mode off in the top bar to use this.</p>
    </div>
  )
}

export function PermissionNote({ children }: { children: ReactNode }) {
  return (
    <div className="flex items-start gap-2.5 rounded-card border border-line bg-surface2/60 px-3 py-2.5 text-[13px] text-muted">
      <LockKeyhole className="mt-0.5 size-4 shrink-0" strokeWidth={1.75} aria-hidden />
      <span>{children}</span>
    </div>
  )
}

export function ListSkeleton({ rows = 6 }: { rows?: number }) {
  return (
    <div className="space-y-2 p-4" aria-busy="true" aria-label="Loading">
      {Array.from({ length: rows }).map((_, i) => (
        <Skeleton key={i} className="h-11 w-full" />
      ))}
    </div>
  )
}

function Description({ text }: { text: string }) {
  const [open, setOpen] = useState(false)
  const long = text.length > 160
  return (
    <>
      <p className={cn('mt-1 text-[14px] text-muted', long && !open && 'max-md:line-clamp-3')}>{text}</p>
      {long && (
        <button type="button" aria-expanded={open} onClick={() => setOpen((o) => !o)} className="mt-1 text-[13px] text-sentinel-ink underline-offset-4 hover:underline md:hidden">
          {open ? 'Show less' : 'Show more'}
        </button>
      )}
    </>
  )
}

export function PageHeader({ title, description, actions, demo = true }: { title: string; description?: string; actions?: ReactNode; demo?: boolean }) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-4 border-b border-line px-5 py-4 lg:px-6">
      <div className="min-w-0">
        <div className="flex items-center gap-3">
          <h1 className="text-[20px] font-medium tracking-[-0.01em] text-fg">{title}</h1>
          {demo && <DemoBadge />}
        </div>
        {/* phones: three lines, the full text on tap (long notes otherwise fill half the screen) */}
        {description && <Description text={description} />}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  )
}
