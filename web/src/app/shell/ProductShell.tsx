/**
 * One product, one navigation (docs/ui/redesign_v2.md).
 * A slim glass rail: Map · Alerts · Results · Data · Docs. Pages own their headers; the map page is
 * full-bleed. No fake controls: every item here does something real.
 */
import { Command } from 'cmdk'
import { BookOpen, Database, FlaskConical, Map as MapIcon, Moon, PanelLeftClose, PanelLeftOpen, Search, Sun, TriangleAlert } from 'lucide-react'
import { Dialog } from 'radix-ui'
import { Suspense, useEffect, useMemo, useState, type ComponentType } from 'react'
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router'
import { LogoMark } from '@/components/brand/Brand'
import { AppToaster } from '@/components/ui/AppToaster'
import { Kbd } from '@/components/ui/primitives'
import { Tooltip } from '@/components/ui/Tooltip'
import { useAlerts } from '@/lib/appStore'
import { cn } from '@/lib/cn'
import { fmtKm } from '@/lib/format'
import { usePrefs } from '@/lib/store'
import { useResolvedTheme } from '@/lib/theme'
import { useMediaQuery } from '@/lib/useMediaQuery'

type Item = { to: string; label: string; hint: string; icon: ComponentType<{ className?: string; strokeWidth?: number }> }

export const NAV: Item[] = [
  { to: '/map', label: 'Map', hint: 'Satellite, our seasons, 3D, search', icon: MapIcon },
  { to: '/alerts', label: 'Alerts', hint: 'New roads to review', icon: TriangleAlert },
  { to: '/results', label: 'Results', hint: 'Accuracy with confidence intervals', icon: FlaskConical },
  { to: '/data', label: 'Data', hint: 'Runs, GPU budget, data health', icon: Database },
  { to: '/docs', label: 'Docs', hint: 'How to run and use it', icon: BookOpen },
]

export const SHORTCUTS: [string[], string][] = [
  [['Ctrl', 'K'], 'Search pages and alerts'],
  [['['], 'Collapse / expand the sidebar'],
  [['J', 'K'], 'Next / previous alert (Alerts)'],
  [['Enter'], 'Open alert'],
  [['A', 'R', 'F'], 'Accept / reject / flag alert'],
  [['Esc'], 'Close panel or dialog'],
]

function Rail({ collapsed, onSearch }: { collapsed: boolean; onSearch: () => void }) {
  const toggle = usePrefs((s) => s.toggleRail)
  const setTheme = usePrefs((s) => s.setTheme)
  const theme = useResolvedTheme()
  // badge = the default "Likely new roads" list (flagged alerts wait in their own view)
  const pending = useAlerts().alerts?.filter((a) => a.status === 'pending' && !a.flags?.length).length
  const row = cn(
    'group relative flex h-10 items-center gap-3 rounded-[10px] text-[13.5px] text-muted transition-[color,background-color] duration-200 hover:bg-surface2 hover:text-fg',
    collapsed ? 'justify-center' : 'px-3',
  )
  const wrap = (label: string, el: React.ReactNode) => (collapsed ? <Tooltip content={label} side="right">{el}</Tooltip> : el)
  return (
    <nav
      aria-label="Product"
      className={cn(
        'relative z-30 flex h-full shrink-0 flex-col border-r border-line bg-bg1 transition-[width] duration-300 ease-out-expo',
        collapsed ? 'w-[68px]' : 'w-[232px]',
      )}
    >
      <div className={cn('flex h-16 items-center', collapsed ? 'justify-center' : 'gap-2.5 px-4')}>
        <Link to="/" aria-label="RoadWatch home" className="rounded-[8px] transition-transform duration-300 hover:rotate-[-8deg]">
          <LogoMark className="size-7" />
        </Link>
        {!collapsed && (
          <div className="leading-tight">
            <div className="text-[15px] font-semibold tracking-[-0.02em] text-fg">RoadWatch</div>
            <div className="t-mono text-[10.5px] tracking-wide text-muted">AP · PILOT</div>
          </div>
        )}
      </div>

      <div className="px-3 pb-2">
        {wrap(
          'Search (Ctrl K)',
          <button type="button" onClick={onSearch} className={cn(row, 'w-full border border-line bg-surface')}>
            <Search className="size-[17px] shrink-0" strokeWidth={1.6} />
            {!collapsed && (
              <>
                <span className="flex-1 text-left">Search</span>
                <Kbd>Ctrl K</Kbd>
              </>
            )}
          </button>,
        )}
      </div>

      <ul className="flex-1 space-y-1 px-3 pt-2">
        {NAV.map((n) => (
          <li key={n.to}>
            {wrap(
              n.label,
              <NavLink to={n.to} className={cn(row, 'aria-[current=page]:bg-surface aria-[current=page]:text-fg aria-[current=page]:shadow-[var(--shadow-panel)]')}>
                <span className="absolute top-2.5 bottom-2.5 left-0 w-[3px] rounded-full bg-sentinel opacity-0 transition-opacity group-aria-[current=page]:opacity-100" aria-hidden />
                <n.icon className="size-[18px] shrink-0" strokeWidth={1.6} />
                {!collapsed && <span className="flex-1 truncate">{n.label}</span>}
                {!collapsed && n.to === '/alerts' && pending ? (
                  <span className="t-mono rounded-full bg-signal/15 px-2 text-[11px] text-signal-ink">{pending}</span>
                ) : null}
              </NavLink>,
            )}
          </li>
        ))}
      </ul>

      <div className="space-y-1 border-t border-line p-3">
        {wrap(
          theme === 'dark' ? 'Light theme' : 'Dark theme',
          <button type="button" onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')} className={cn(row, 'w-full')} aria-label="Toggle theme">
            {theme === 'dark' ? <Sun className="size-[18px]" strokeWidth={1.6} /> : <Moon className="size-[18px]" strokeWidth={1.6} />}
            {!collapsed && <span className="flex-1 text-left">{theme === 'dark' ? 'Light' : 'Dark'} theme</span>}
          </button>,
        )}
        {wrap(
          collapsed ? 'Expand' : 'Collapse',
          <button type="button" onClick={toggle} className={cn(row, 'w-full')} aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}>
            {collapsed ? <PanelLeftOpen className="size-[18px]" strokeWidth={1.6} /> : <PanelLeftClose className="size-[18px]" strokeWidth={1.6} />}
            {!collapsed && (
              <>
                <span className="flex-1 text-left">Collapse</span>
                <Kbd>[</Kbd>
              </>
            )}
          </button>,
        )}
      </div>
    </nav>
  )
}

function Palette({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const nav = useNavigate()
  const { alerts } = useAlerts()
  const top = useMemo(() => [...(alerts ?? [])].sort((a, b) => b.score - a.score).slice(0, 60), [alerts])
  const go = (to: string) => {
    onOpenChange(false)
    nav(to)
  }
  const item = 'flex h-11 cursor-pointer items-center gap-3 rounded-[8px] px-3 text-[14px] text-fg data-[selected=true]:bg-surface2'
  const group = 'text-[12px] text-muted [&_[cmdk-group-heading]]:px-3 [&_[cmdk-group-heading]]:py-2'
  return (
    <Command.Dialog
      open={open}
      onOpenChange={onOpenChange}
      label="Search"
      overlayClassName="rw-fade-in fixed inset-0 z-50 bg-[rgba(21,24,29,0.32)]"
      contentClassName="rw-pop-in fixed top-[14vh] left-1/2 z-50 w-[min(640px,calc(100vw-32px))] -translate-x-1/2 overflow-hidden rounded-[18px] border border-line-strong bg-surface shadow-[var(--shadow-lift)]"
    >
      <div className="flex items-center gap-3 border-b border-line px-4">
        <Search className="size-4 text-muted" strokeWidth={1.75} aria-hidden />
        <Command.Input placeholder="Go to a page or an alert (e.g. RW-A001)…" className="h-14 flex-1 bg-transparent text-[15px] text-fg outline-none placeholder:text-muted" />
        <Kbd>Esc</Kbd>
      </div>
      <Command.List className="scrollbar-thin max-h-[56vh] overflow-y-auto p-2">
        <Command.Empty className="px-3 py-10 text-center text-[14px] text-muted">Nothing matches.</Command.Empty>
        <Command.Group heading="Pages" className={group}>
          {NAV.map((n) => (
            <Command.Item key={n.to} value={`page ${n.label} ${n.hint}`} onSelect={() => go(n.to)} className={item}>
              <n.icon className="size-4 text-muted" strokeWidth={1.6} />
              <span>{n.label}</span>
              <span className="ml-auto truncate text-[12px] text-muted">{n.hint}</span>
            </Command.Item>
          ))}
          <Command.Item value="page home landing" onSelect={() => go('/')} className={item}>
            <LogoMark className="size-4" />
            Home
          </Command.Item>
        </Command.Group>
        <Command.Group heading="Top alerts" className={group}>
          {top.map((a) => (
            <Command.Item key={a.id} value={`${a.id} ${a.district} ${a.zone ?? ''}`} onSelect={() => go(`/alerts/${a.id}`)} className={item}>
              <span className="size-2 rounded-full bg-signal" aria-hidden />
              <span className="t-mono text-[13px]">{a.id}</span>
              <span className="truncate text-muted">
                {a.district} · {fmtKm(a.length_km, 2)}
              </span>
              <span className="t-mono ml-auto text-[12px] text-muted">{a.score.toFixed(2)}</span>
            </Command.Item>
          ))}
        </Command.Group>
      </Command.List>
    </Command.Dialog>
  )
}

function Shortcuts({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="rw-fade-in fixed inset-0 z-50 bg-[rgba(21,24,29,0.32)]" />
        <Dialog.Content className="rw-pop-in fixed top-1/2 left-1/2 z-50 w-[min(460px,calc(100vw-32px))] -translate-x-1/2 -translate-y-1/2 rounded-[18px] border border-line-strong bg-surface p-6 shadow-[var(--shadow-panel)]">
          <Dialog.Title className="text-[16px] font-medium text-fg">Keyboard shortcuts</Dialog.Title>
          <dl className="mt-4 divide-y divide-line">
            {SHORTCUTS.map(([keys, label]) => (
              <div key={label} className="flex items-center justify-between py-2.5 text-[14px]">
                <dt className="text-fg">{label}</dt>
                <dd className="flex gap-1">
                  {keys.map((k) => (
                    <Kbd key={k}>{k}</Kbd>
                  ))}
                </dd>
              </div>
            ))}
          </dl>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}

function MobileTabs() {
  return (
    <nav aria-label="Product" className="grid grid-cols-5 border-t border-line bg-bg1 pb-[env(safe-area-inset-bottom)]">
      {NAV.map((n) => (
        <NavLink key={n.to} to={n.to} className="flex h-14 flex-col items-center justify-center gap-1 text-[11px] text-muted aria-[current=page]:text-fg">
          <n.icon className="size-5" strokeWidth={1.6} />
          {n.label}
        </NavLink>
      ))}
    </nav>
  )
}

export default function ProductShell() {
  const collapsed = usePrefs((s) => s.railCollapsed)
  const toggleRail = usePrefs((s) => s.toggleRail)
  const [palette, setPalette] = useState(false)
  const [help, setHelp] = useState(false)
  const mobile = useMediaQuery('(max-width: 767px)')
  const { pathname } = useLocation()
  const fullBleed = pathname.startsWith('/map')

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement
      const typing = t.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(t.tagName)
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        setPalette((v) => !v)
        return
      }
      if (typing || e.ctrlKey || e.metaKey || e.altKey) return
      if (e.key === '?') {
        e.preventDefault()
        setHelp(true)
      } else if (e.key === '[') toggleRail()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [toggleRail])

  useEffect(() => {
    const n = NAV.find((x) => pathname.startsWith(x.to))
    document.title = `${n?.label ?? 'RoadWatch'} — RoadWatch`
  }, [pathname])

  return (
    <div className="flex h-dvh flex-col bg-bg0 text-fg md:flex-row">
      <a href="#product-main" className="skip-link">
        Skip to content
      </a>
      {!mobile && <Rail collapsed={collapsed} onSearch={() => setPalette(true)} />}
      <main
        id="product-main"
        tabIndex={-1}
        className={cn('relative min-h-0 min-w-0 flex-1 outline-none', fullBleed ? 'overflow-hidden' : 'scrollbar-thin overflow-y-auto')}
      >
        <Suspense fallback={<div className="grid h-full place-items-center text-muted" aria-busy="true"><span className="rw-spinner" /></div>}>
          <div key={pathname.split('/')[1]} className={cn('rw-route-in', fullBleed && 'h-full')}>
            <Outlet />
          </div>
        </Suspense>
      </main>
      {mobile && <MobileTabs />}
      <Palette open={palette} onOpenChange={setPalette} />
      <Shortcuts open={help} onOpenChange={setHelp} />
      <AppToaster />
    </div>
  )
}
