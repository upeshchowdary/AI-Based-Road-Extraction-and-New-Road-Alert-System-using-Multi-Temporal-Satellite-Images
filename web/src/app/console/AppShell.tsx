import { Command } from 'cmdk'
import {
  Activity,
  Bell,
  ChevronDown,
  CircleHelp,
  CloudOff,
  FileCheck2,
  FileDown,
  Gauge,
  Hexagon,
  Keyboard,
  LogOut,
  MessageSquareText,
  Monitor,
  Moon,
  MoreHorizontal,
  PanelLeftClose,
  PanelLeftOpen,
  Route,
  ScanLine,
  Search,
  Settings,
  Sun,
  TriangleAlert,
  Wifi,
} from 'lucide-react'
import { Dialog, DropdownMenu, Popover } from 'radix-ui'
import { Suspense, useEffect, useMemo, useState, type ComponentType } from 'react'
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router'
import { toast } from 'sonner'
import { AppToaster } from '@/components/ui/AppToaster'
import { DemoBadge, LogoMark } from '@/components/brand/Brand'
import { Kbd } from '@/components/ui/primitives'
import { Tooltip } from '@/components/ui/Tooltip'
import { useAlerts, useReview } from '@/lib/appStore'
import { cn } from '@/lib/cn'
import { dateShort, fmtKm } from '@/lib/format'
import { usePrefs } from '@/lib/store'
import { useMediaQuery } from '@/lib/useMediaQuery'

type Item = { to: string; label: string; icon: ComponentType<{ className?: string; strokeWidth?: number }>; end?: boolean }

export const NAV: Item[] = [
  { to: '/app', label: 'Command Center', icon: Gauge, end: true },
  { to: '/app/alerts', label: 'Alerts', icon: TriangleAlert },
  { to: '/app/explorer', label: 'Change Explorer', icon: ScanLine },
  { to: '/app/network', label: 'Road Network', icon: Route },
  { to: '/app/audit', label: 'PMGSY Audit', icon: FileCheck2 },
  { to: '/app/zones', label: 'Priority Zones', icon: Hexagon },
  { to: '/app/ask', label: 'Ask', icon: MessageSquareText },
  { to: '/app/reports', label: 'Reports', icon: FileDown },
  { to: '/app/system', label: 'System', icon: Activity },
  { to: '/app/settings', label: 'Settings', icon: Settings },
]

export const SHORTCUTS: [string[], string][] = [
  [['Ctrl', 'K'], 'Command palette'],
  [['?'], 'Keyboard shortcuts'],
  [['['], 'Collapse / expand the sidebar'],
  [['J'], 'Next alert (Alerts)'],
  [['K'], 'Previous alert (Alerts)'],
  [['Enter'], 'Open alert'],
  [['A'], 'Accept alert'],
  [['R'], 'Reject alert (asks for a reason)'],
  [['F'], 'Flag for field check'],
  [['Esc'], 'Close panel or dialog'],
]

function Rail({ collapsed }: { collapsed: boolean }) {
  const toggle = usePrefs((s) => s.toggleRail)
  const pending = useAlerts().alerts?.filter((a) => a.status === 'pending').length
  return (
    <nav aria-label="App" className={cn('flex h-full flex-col border-r border-line bg-bg1 transition-[width] duration-200 ease-ui', collapsed ? 'w-[60px]' : 'w-[232px]')}>
      <div className={cn('flex h-14 items-center border-b border-line', collapsed ? 'justify-center' : 'gap-2.5 px-4')}>
        <Link to="/" aria-label="RoadWatch website" className="rounded-[6px]">
          <LogoMark className="size-6" />
        </Link>
        {!collapsed && <span className="text-[15px] font-semibold tracking-[-0.02em] text-fg">RoadWatch</span>}
      </div>
      <ul className="scrollbar-thin flex-1 space-y-0.5 overflow-y-auto p-2">
        {NAV.map((n) => {
          const link = (
            <NavLink
              to={n.to}
              end={n.end}
              className={cn(
                'group relative flex h-9 items-center gap-3 rounded-[8px] text-[13.5px] text-muted transition-colors duration-150 hover:bg-surface2 hover:text-fg aria-[current=page]:bg-surface2 aria-[current=page]:text-fg',
                collapsed ? 'justify-center' : 'px-2.5',
              )}
            >
              <span className="absolute top-2 bottom-2 left-0 w-0.5 rounded-full bg-sentinel opacity-0 group-aria-[current=page]:opacity-100" aria-hidden />
              <n.icon className="size-[18px] shrink-0" strokeWidth={1.5} />
              {!collapsed && <span className="flex-1 truncate">{n.label}</span>}
              {!collapsed && n.to === '/app/alerts' && pending ? <span className="t-mono rounded-[4px] bg-surface px-1.5 text-[11px] text-fg">{pending}</span> : null}
            </NavLink>
          )
          return <li key={n.to}>{collapsed ? <Tooltip content={n.label} side="right">{link}</Tooltip> : link}</li>
        })}
      </ul>
      <div className="border-t border-line p-2">
        <button
          type="button"
          onClick={toggle}
          aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          className={cn('flex h-9 w-full items-center gap-3 rounded-[8px] text-[13px] text-muted hover:bg-surface2 hover:text-fg', collapsed ? 'justify-center' : 'px-2.5')}
        >
          {collapsed ? <PanelLeftOpen className="size-[18px]" strokeWidth={1.5} /> : <PanelLeftClose className="size-[18px]" strokeWidth={1.5} />}
          {!collapsed && (
            <>
              <span className="flex-1 text-left">Collapse</span>
              <Kbd>[</Kbd>
            </>
          )}
        </button>
      </div>
    </nav>
  )
}

function TopBar({ onPalette, onShortcuts }: { onPalette: () => void; onShortcuts: () => void }) {
  const aoi = useReview((s) => s.aoi)
  const setAoi = useReview((s) => s.setAoi)
  const offline = usePrefs((s) => s.offline)
  const setOffline = usePrefs((s) => s.setOffline)
  const theme = usePrefs((s) => s.theme)
  const setTheme = usePrefs((s) => s.setTheme)
  const { alerts, dates } = useAlerts()
  const nav = useNavigate()
  const recent = useMemo(() => [...(alerts ?? [])].filter((a) => a.status === 'pending').sort((a, b) => b.score - a.score).slice(0, 5), [alerts])
  const menu = 'z-50 min-w-48 rounded-card border border-line-strong bg-surface2 p-1 shadow-[var(--shadow-panel)]'
  const mi = 'flex h-9 cursor-pointer items-center gap-2.5 rounded-[6px] px-2.5 text-[13px] text-fg outline-none data-[highlighted]:bg-surface'

  return (
    <header className="flex h-14 shrink-0 items-center gap-2 border-b border-line bg-bg1/80 px-3 backdrop-blur lg:px-4">
      <DropdownMenu.Root>
        <DropdownMenu.Trigger className="flex h-9 items-center gap-2 rounded-[8px] border border-line px-3 text-[13px] text-fg hover:border-line-strong">
          <span className="text-muted">Area</span>
          {aoi === 'pilot' ? 'NTR + Krishna pilot' : 'Andhra Pradesh'}
          <ChevronDown className="size-3.5 text-muted" strokeWidth={1.75} />
        </DropdownMenu.Trigger>
        <DropdownMenu.Portal>
          <DropdownMenu.Content sideOffset={6} align="start" className={menu}>
            <DropdownMenu.RadioGroup value={aoi} onValueChange={(v) => setAoi(v as 'pilot' | 'ap')}>
              <DropdownMenu.RadioItem value="pilot" className={mi}>
                NTR + Krishna pilot <span className="t-mono ml-auto text-[11px] text-muted">7,152 km²</span>
              </DropdownMenu.RadioItem>
              <DropdownMenu.RadioItem value="ap" className={mi}>
                Andhra Pradesh <span className="t-mono ml-auto text-[11px] text-muted">CP2</span>
              </DropdownMenu.RadioItem>
            </DropdownMenu.RadioGroup>
          </DropdownMenu.Content>
        </DropdownMenu.Portal>
      </DropdownMenu.Root>

      <div className="hidden h-9 items-center gap-2 rounded-[8px] border border-line px-3 text-[13px] text-fg md:flex" aria-label="Date range">
        <span className="text-muted">Dates</span>
        {dates.length ? `${dateShort(dates[0].id)} – ${dateShort(dates[dates.length - 1].id)}` : '—'}
      </div>

      <button type="button" onClick={onPalette} className="ml-1 flex h-9 min-w-0 flex-1 items-center gap-2 rounded-[8px] border border-line bg-bg0/50 px-3 text-[13px] text-muted hover:border-line-strong md:max-w-sm">
        <Search className="size-4 shrink-0" strokeWidth={1.75} aria-hidden />
        <span className="truncate">Search alerts, places, pages…</span>
        <span className="ml-auto hidden gap-1 sm:flex">
          <Kbd>Ctrl</Kbd>
          <Kbd>K</Kbd>
        </span>
      </button>

      <div className="ml-auto flex items-center gap-1">
        <Tooltip content="Model in use — training runs are in progress (see System)">
          <Link to="/app/system" className="t-mono hidden h-7 items-center gap-1.5 rounded-chip border border-line px-2 text-[12px] text-fg hover:border-line-strong lg:inline-flex">
            <span className="size-1.5 rounded-full bg-signal" aria-hidden />
            v1-lean
          </Link>
        </Tooltip>
        <DemoBadge className="hidden xl:inline-flex" />
        <Tooltip content={offline ? 'Offline mode on — using the local cache. Click to go online.' : 'Online. Click to test offline mode.'}>
          <button
            type="button"
            onClick={() => {
              setOffline(!offline)
              toast(offline ? 'Back online' : 'Offline mode on', { description: offline ? 'External services are available again.' : 'Maps and reviews keep working from the cache. Ask is paused.' })
            }}
            aria-pressed={offline}
            aria-label="Offline mode"
            className={cn('inline-flex size-9 items-center justify-center rounded-[8px] hover:bg-surface2', offline ? 'text-signal-ink' : 'text-muted hover:text-fg')}
          >
            {offline ? <CloudOff className="size-[18px]" strokeWidth={1.5} /> : <Wifi className="size-[18px]" strokeWidth={1.5} />}
          </button>
        </Tooltip>
        <Popover.Root>
          <Popover.Trigger aria-label="Notifications" className="relative inline-flex size-9 items-center justify-center rounded-[8px] text-muted hover:bg-surface2 hover:text-fg">
            <Bell className="size-[18px]" strokeWidth={1.5} />
            {recent.length > 0 && <span className="absolute top-2 right-2 size-1.5 rounded-full bg-signal" aria-hidden />}
          </Popover.Trigger>
          <Popover.Portal>
            <Popover.Content sideOffset={6} align="end" className="z-50 w-80 rounded-card border border-line-strong bg-surface2 shadow-[var(--shadow-panel)]">
              <div className="flex items-center justify-between border-b border-line px-3 py-2.5">
                <span className="text-[13px] font-medium text-fg">Needs review</span>
                <DemoBadge />
              </div>
              <ul className="p-1">
                {recent.map((a) => (
                  <li key={a.id}>
                    <Popover.Close asChild>
                      <button type="button" onClick={() => nav(`/app/alerts/${a.id}`)} className="flex w-full items-center gap-3 rounded-[6px] px-2.5 py-2 text-left hover:bg-surface">
                        <span className={cn('size-2 rounded-full', a.priority === 'high' ? 'bg-priority' : 'bg-signal')} aria-hidden />
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-[13px] text-fg">{a.name ?? `New road · ${a.district}`}</span>
                          <span className="t-mono text-[11px] text-muted">
                            {a.id} · {fmtKm(a.length_km, 2)} · {a.score.toFixed(2)}
                          </span>
                        </span>
                      </button>
                    </Popover.Close>
                  </li>
                ))}
              </ul>
            </Popover.Content>
          </Popover.Portal>
        </Popover.Root>
        <button type="button" onClick={onShortcuts} aria-label="Keyboard shortcuts" className="hidden size-9 items-center justify-center rounded-[8px] text-muted hover:bg-surface2 hover:text-fg sm:inline-flex">
          <CircleHelp className="size-[18px]" strokeWidth={1.5} />
        </button>
        <DropdownMenu.Root>
          <DropdownMenu.Trigger aria-label="Account" className="ml-1 grid size-8 place-items-center rounded-full border border-line-strong bg-surface text-[12px] font-medium text-fg">
            DA
          </DropdownMenu.Trigger>
          <DropdownMenu.Portal>
            <DropdownMenu.Content sideOffset={6} align="end" className={menu}>
              <div className="px-2.5 py-2">
                <p className="text-[13px] text-fg">Demo analyst</p>
                <p className="text-[12px] text-muted">Read-only demo account</p>
              </div>
              <DropdownMenu.Separator className="my-1 h-px bg-line" />
              <DropdownMenu.RadioGroup value={theme} onValueChange={(v) => setTheme(v as 'dark' | 'light' | 'system')}>
                <DropdownMenu.RadioItem value="dark" className={mi}>
                  <Moon className="size-4" strokeWidth={1.5} /> Dark
                </DropdownMenu.RadioItem>
                <DropdownMenu.RadioItem value="light" className={mi}>
                  <Sun className="size-4" strokeWidth={1.5} /> Light
                </DropdownMenu.RadioItem>
                <DropdownMenu.RadioItem value="system" className={mi}>
                  <Monitor className="size-4" strokeWidth={1.5} /> System
                </DropdownMenu.RadioItem>
              </DropdownMenu.RadioGroup>
              <DropdownMenu.Separator className="my-1 h-px bg-line" />
              <DropdownMenu.Item className={mi} onSelect={onShortcuts}>
                <Keyboard className="size-4" strokeWidth={1.5} /> Shortcuts
              </DropdownMenu.Item>
              <DropdownMenu.Item className={mi} onSelect={() => nav('/app/sign-in')}>
                <LogOut className="size-4" strokeWidth={1.5} /> Sign out
              </DropdownMenu.Item>
            </DropdownMenu.Content>
          </DropdownMenu.Portal>
        </DropdownMenu.Root>
      </div>
    </header>
  )
}

function Palette({ open, onOpenChange, onShortcuts }: { open: boolean; onOpenChange: (o: boolean) => void; onShortcuts: () => void }) {
  const nav = useNavigate()
  const { alerts } = useAlerts()
  const setTheme = usePrefs((s) => s.setTheme)
  const offline = usePrefs((s) => s.offline)
  const setOffline = usePrefs((s) => s.setOffline)
  const go = (fn: () => void) => {
    onOpenChange(false)
    fn()
  }
  const item = 'flex h-10 cursor-pointer items-center gap-3 rounded-[6px] px-3 text-[14px] text-fg data-[selected=true]:bg-surface'
  return (
    <Command.Dialog
      open={open}
      onOpenChange={onOpenChange}
      label="Command palette"
      overlayClassName="fixed inset-0 z-50 bg-black/50"
      contentClassName="fixed top-[14vh] left-1/2 z-50 w-[min(640px,calc(100vw-32px))] -translate-x-1/2 overflow-hidden rounded-panel border border-line-strong bg-surface2 shadow-[var(--shadow-panel)]"
    >
      <div className="flex items-center gap-3 border-b border-line px-4">
        <Search className="size-4 text-muted" strokeWidth={1.75} aria-hidden />
        <Command.Input placeholder="Type a page, an alert ID or a district…" className="h-12 flex-1 bg-transparent text-[15px] text-fg outline-none placeholder:text-muted" />
        <Kbd>Esc</Kbd>
      </div>
      <Command.List className="scrollbar-thin max-h-[52vh] overflow-y-auto p-2">
        <Command.Empty className="px-3 py-8 text-center text-[14px] text-muted">Nothing matches. Try an alert ID like RW-24001.</Command.Empty>
        <Command.Group heading="Go to" className="text-[12px] text-muted [&_[cmdk-group-heading]]:px-3 [&_[cmdk-group-heading]]:py-2">
          {NAV.map((n) => (
            <Command.Item key={n.to} value={`go ${n.label}`} onSelect={() => go(() => nav(n.to))} className={item}>
              <n.icon className="size-4 text-muted" strokeWidth={1.5} />
              {n.label}
            </Command.Item>
          ))}
          <Command.Item value="go public site home" onSelect={() => go(() => nav('/'))} className={item}>
            <LogoMark className="size-4" />
            Public website
          </Command.Item>
        </Command.Group>
        <Command.Group heading="Alerts" className="text-[12px] text-muted [&_[cmdk-group-heading]]:px-3 [&_[cmdk-group-heading]]:py-2">
          {(alerts ?? []).map((a) => (
            <Command.Item key={a.id} value={`${a.id} ${a.district} ${a.name ?? ''} ${a.stage}`} onSelect={() => go(() => nav(`/app/alerts/${a.id}`))} className={item}>
              <span className={cn('size-2 rounded-full', a.priority === 'high' ? 'bg-priority' : 'bg-signal')} aria-hidden />
              <span className="t-mono text-[13px]">{a.id}</span>
              <span className="truncate text-muted">
                {a.name ?? a.district} · {fmtKm(a.length_km, 2)}
              </span>
            </Command.Item>
          ))}
        </Command.Group>
        <Command.Group heading="Actions" className="text-[12px] text-muted [&_[cmdk-group-heading]]:px-3 [&_[cmdk-group-heading]]:py-2">
          <Command.Item value="theme dark" onSelect={() => go(() => setTheme('dark'))} className={item}>
            <Moon className="size-4 text-muted" strokeWidth={1.5} /> Switch to dark theme
          </Command.Item>
          <Command.Item value="theme light" onSelect={() => go(() => setTheme('light'))} className={item}>
            <Sun className="size-4 text-muted" strokeWidth={1.5} /> Switch to light theme
          </Command.Item>
          <Command.Item value="offline mode toggle" onSelect={() => go(() => setOffline(!offline))} className={item}>
            <CloudOff className="size-4 text-muted" strokeWidth={1.5} /> {offline ? 'Turn offline mode off' : 'Turn offline mode on'}
          </Command.Item>
          <Command.Item value="keyboard shortcuts help" onSelect={() => go(onShortcuts)} className={item}>
            <Keyboard className="size-4 text-muted" strokeWidth={1.5} /> Keyboard shortcuts
          </Command.Item>
        </Command.Group>
      </Command.List>
    </Command.Dialog>
  )
}

function Shortcuts({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/50" />
        <Dialog.Content className="fixed top-1/2 left-1/2 z-50 w-[min(460px,calc(100vw-32px))] -translate-x-1/2 -translate-y-1/2 rounded-panel border border-line-strong bg-surface2 p-5 shadow-[var(--shadow-panel)]">
          <Dialog.Title className="text-[16px] font-medium text-fg">Keyboard shortcuts</Dialog.Title>
          <Dialog.Description className="mt-1 text-[13px] text-muted">Use Cmd instead of Ctrl on macOS.</Dialog.Description>
          <dl className="mt-4 divide-y divide-line">
            {SHORTCUTS.map(([keys, label]) => (
              <div key={label} className="flex items-center justify-between py-2 text-[14px]">
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
  const tabs = [NAV[0], NAV[1], NAV[2]]
  return (
    <nav aria-label="App" className="grid grid-cols-4 border-t border-line bg-bg1 pb-[env(safe-area-inset-bottom)]">
      {tabs.map((n) => (
        <NavLink key={n.to} to={n.to} end={n.end} className="flex h-14 flex-col items-center justify-center gap-1 text-[11px] text-muted aria-[current=page]:text-fg">
          <n.icon className="size-5" strokeWidth={1.5} />
          {n.label.split(' ')[0]}
        </NavLink>
      ))}
      <DropdownMenu.Root>
        <DropdownMenu.Trigger className="flex h-14 flex-col items-center justify-center gap-1 text-[11px] text-muted">
          <MoreHorizontal className="size-5" strokeWidth={1.5} />
          More
        </DropdownMenu.Trigger>
        <DropdownMenu.Portal>
          <DropdownMenu.Content side="top" sideOffset={6} align="end" className="z-50 min-w-52 rounded-card border border-line-strong bg-surface2 p-1">
            {NAV.slice(3).map((n) => (
              <DropdownMenu.Item key={n.to} asChild>
                <NavLink to={n.to} className="flex h-10 items-center gap-3 rounded-[6px] px-3 text-[14px] text-fg outline-none data-[highlighted]:bg-surface">
                  <n.icon className="size-4 text-muted" strokeWidth={1.5} />
                  {n.label}
                </NavLink>
              </DropdownMenu.Item>
            ))}
          </DropdownMenu.Content>
        </DropdownMenu.Portal>
      </DropdownMenu.Root>
    </nav>
  )
}

export default function AppShell() {
  const collapsed = usePrefs((s) => s.railCollapsed)
  const toggleRail = usePrefs((s) => s.toggleRail)
  const offline = usePrefs((s) => s.offline)
  const [palette, setPalette] = useState(false)
  const [help, setHelp] = useState(false)
  const mobile = useMediaQuery('(max-width: 767px)')
  const { pathname } = useLocation()

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
      } else if (e.key === '[') {
        toggleRail()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [toggleRail])

  useEffect(() => {
    const n = NAV.find((x) => (x.end ? pathname === x.to : pathname.startsWith(x.to)))
    document.title = `${n?.label ?? 'App'} — RoadWatch`
  }, [pathname])

  return (
    <div className="flex h-dvh flex-col bg-bg0 text-fg md:flex-row">
      <a href="#app-main" className="skip-link">
        Skip to content
      </a>
      {!mobile && <Rail collapsed={collapsed} />}
      <div className="flex min-h-0 min-w-0 flex-1 flex-col">
        <TopBar onPalette={() => setPalette(true)} onShortcuts={() => setHelp(true)} />
        {offline && (
          <div role="status" className="flex items-center gap-2 border-b border-signal/30 bg-signal/10 px-4 py-1.5 text-[13px] text-signal-ink">
            <CloudOff className="size-4" strokeWidth={1.75} aria-hidden />
            Offline mode — working from the local cache. External services (Ask, notifications) are paused.
          </div>
        )}
        <main id="app-main" tabIndex={-1} className="min-h-0 flex-1 overflow-y-auto outline-none">
          <Suspense fallback={<div className="p-6 text-muted" aria-busy="true" />}>
            <Outlet />
          </Suspense>
        </main>
        {mobile && <MobileTabs />}
      </div>
      <Palette open={palette} onOpenChange={setPalette} onShortcuts={() => setHelp(true)} />
      <AppToaster />
      <Shortcuts open={help} onOpenChange={setHelp} />
    </div>
  )
}
