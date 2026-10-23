import type { FeatureCollection } from 'geojson'
import type { Map as MlMap } from 'maplibre-gl'
import { CircleHelp, Columns2, Layers, ListTree, Minus, PanelLeftClose, Plus, X } from 'lucide-react'
import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router'
import { AlertSummary } from '@/components/alerts/AlertSummary'
import { PriorityMark } from '@/components/alerts/AlertParts'
import { DemoBadge } from '@/components/brand/Brand'
import { BaseMapPicker } from '@/components/map/BaseMapPicker'
import { MapLegend } from '@/components/map/MapLegend'
import { MapSearch } from '@/components/map/MapSearch'
import { BASE_INFO, DEFAULT_VISIBILITY, type BaseImagery, type LayerVisibility, type ZoneImage } from '@/components/map/nightSurveyStyle'
import { RwMap } from '@/components/map/LazyMap'
import { SwipeDivider } from '@/components/map/SwipeDivider'
import { TimeScrubber } from '@/components/map/TimeScrubber'
import { ButtonLink } from '@/components/ui/Button'
import { Segmented } from '@/components/ui/primitives'
import { Switch } from '@/components/ui/Switch'
import { Tour, type TourStep } from '@/components/ui/Tour'
import { cn } from '@/lib/cn'
import { API, DATA, useJson, type AlertsFile, type DateInfo, type ZoneImageMeta, type ZoneSeason } from '@/lib/data'
import { bboxOf } from '@/lib/demoLayers'
import { dateLabel, dateShort, fmtKm, fmtLat, fmtLon } from '@/lib/format'
import { useReducedMotion } from '@/lib/motionPref'
import { usePrefs } from '@/lib/store'
import { useMediaQuery } from '@/lib/useMediaQuery'

const TOUR: TourStep[] = [
  { target: 'map', title: 'The whole world, in detail', body: 'Satellite imagery with road and place names everywhere. Zoom out to the globe, zoom in to street level. Use the search box to jump to any place.' },
  { target: 'layers', title: 'Layers', body: 'Amber is new, steel is existing, hatched is unreliable. Every class has its own line style as well as colour.' },
  { target: 'date', title: 'Our own seasons, 2022 → 2026', body: 'Choose “Our seasons” and a zone (A, B, C) to see RoadWatch Sentinel-2 composites. Drag the scan bar (or ← →) to step through dates.' },
  { target: 'compare', title: 'Before / after', body: 'Turn on the swipe, then drag the divider to compare two dates side by side.' },
  { target: 'alerts', title: 'Alerts with proof', body: 'Click an orange road or dot — or pick one from this list — to see its before/after evidence.' },
]

type Panel = 'layers' | 'alerts'

const ZONE_CENTER: Record<'A' | 'B' | 'C', [number, number]> = { A: [80.594, 16.54], B: [81.144, 16.19], C: [80.784, 16.54] }

// vaul is only needed on phones; load it there
const MobileSheets = lazy(() => import('./ExploreMobileSheets'))

export default function ExplorePage() {
  const [zone, setZone] = useState<'A' | 'B' | 'C'>('A')
  const seasonsRes = useJson<{ seasons: ZoneSeason[] }>(API.zoneSeasons(zone))
  const alertsFile = useJson<AlertsFile>(DATA.demoAlerts)
  // flagged alerts (probably not new: scripts/alert_flags.py) stay off the map unless asked for
  const [showFlagged, setShowFlagged] = useState(false)
  const allAlerts = alertsFile.data?.alerts
  const nFlagged = allAlerts?.filter((a) => a.flags?.length).length ?? 0
  const alerts = useMemo(() => (showFlagged ? allAlerts : allAlerts?.filter((a) => !a.flags?.length)), [allAlerts, showFlagged])
  const dates = useMemo<DateInfo[]>(
    () => (seasonsRes.data?.seasons ?? []).map((s) => ({ id: s.id, label: s.label, month: s.id.includes('pre') ? 'Apr' : 'Nov' })),
    [seasonsRes.data],
  )
  const reduced = useReducedMotion()
  const mobile = useMediaQuery('(max-width: 767px)')
  const tourDone = usePrefs((s) => s.tourDone)
  const setTourDone = usePrefs((s) => s.setTourDone)

  const [dateIdx, setDateIdx] = useState(-1) // -1 = latest, resolved once dates load
  const [beforeIdx, setBeforeIdx] = useState(0)
  const [base, setBase] = useState<BaseImagery>('satellite')
  const [vis, setVis] = useState<LayerVisibility>(DEFAULT_VISIBILITY)
  const [compare, setCompare] = useState(false)
  const [swipe, setSwipe] = useState(50)
  const [selected, setSelected] = useState<string | null>(null)
  const [panel, setPanel] = useState<Panel>('layers')
  const [panelHidden, setPanelHidden] = useState(false) // desktop: give the whole map to the user
  const [cursor, setCursor] = useState<{ lng: number; lat: number } | null>(null)
  const [zoom, setZoom] = useState(11.2)
  const [leader, setLeader] = useState<MlMap | null>(null)
  const [sheetOpen, setSheetOpen] = useState(false)
  const [tour, setTour] = useState(false)
  const [playing, setPlaying] = useState(false)
  const [threeD, setThreeD] = useState(false)
  const flown = useRef(false)

  useEffect(() => {
    document.title = 'Map — RoadWatch'
  }, [])

  const di = dateIdx < 0 || dateIdx >= dates.length ? dates.length - 1 : dateIdx
  const dateId = dates[di]?.id ?? '2026_pre_monsoon'
  const beforeId = dates[beforeIdx]?.id ?? '2022_pre_monsoon'
  const showOurs = base === 's2' || compare
  const afterMeta = useJson<ZoneImageMeta>(showOurs && dates.length ? API.zoneImageMeta(zone, dateId) : null).data
  const beforeMeta = useJson<ZoneImageMeta>(compare && dates.length ? API.zoneImageMeta(zone, beforeId) : null).data
  const toImage = (m?: ZoneImageMeta): ZoneImage | null => (m ? { url: m.image, corners: m.corners_lonlat } : null)
  const predicted = useJson<FeatureCollection>(showOurs ? API.predicted(zone, dateId) : null).data
  const sel = useMemo(() => alerts?.find((a) => a.id === selected) ?? null, [alerts, selected])

  // First visit: a short establishing move from the state to zone A, then the tour.
  const onReady = useCallback(
    (m: MlMap) => {
      setLeader(m)
      if (flown.current) return
      flown.current = true
      if (!reduced) {
        m.jumpTo({ center: [78.9, 21.5], zoom: 2.6 })
        m.flyTo({ center: [80.62, 16.51], zoom: mobile ? 11.2 : 12, duration: 4200, essential: false })
      }
      if (!usePrefs.getState().tourDone) window.setTimeout(() => setTour(true), reduced ? 300 : 2600)
    },
    [reduced, mobile],
  )

  const select = useCallback(
    (id: string | null) => {
      setSelected(id)
      if (!id || !leader || !alerts) return
      const a = alerts.find((x) => x.id === id)
      if (!a) return
      const pad = mobile ? { top: 80, bottom: 320, left: 40, right: 40 } : { top: 120, bottom: 120, left: 420, right: 480 }
      leader.fitBounds(bboxOf(a.geometry.coordinates), { padding: pad, maxZoom: 14.5, duration: reduced ? 0 : 900 })
      if (mobile) setSheetOpen(false)
    },
    [leader, alerts, mobile, reduced],
  )

  const toggle = (k: keyof LayerVisibility) => (v: boolean) => setVis((s) => ({ ...s, [k]: v }))

  const controls = (
    <div className="space-y-6">
      <div data-tour="layers">
        <h2 className="text-[13px] font-medium text-fg">Layers</h2>
        <ul className="mt-3 space-y-2.5">
          {(
            [
              ['newRoads', 'New roads', <span key="n" className="h-0.5 w-5 bg-signal" />],
              ['existing', 'Existing roads (OSM)', <span key="e" className="h-0.5 w-5 bg-steel" />],
              ['abstain', 'Unreliable tiles (abstained)', <span key="a" className="hatch h-3 w-5 rounded-[2px] border border-abstain" />],
              ['zones', 'High-res zones A–C', <span key="z" className="h-3 w-5 rounded-[2px] border border-dotted border-sentinel" />],
              ['predicted', 'Roads extracted by RoadWatch', <span key="m" className="h-0.5 w-5 bg-[#38f2a8]" />],
              ['labels', 'Place & road names', <span key="l" className="text-[11px] font-semibold text-fg">Aa</span>],
            ] as const
          ).map(([k, label, sw]) => (
            <li key={k}>
              <label className="flex cursor-pointer items-center justify-between gap-3 text-[14px] text-fg">
                <span className="flex items-center gap-2.5">
                  <span className="grid w-5 place-items-center" aria-hidden>
                    {sw}
                  </span>
                  {label}
                </span>
                <Switch checked={vis[k]} onCheckedChange={toggle(k)} label={label} />
              </label>
            </li>
          ))}
        </ul>
      </div>

      <div>
        <h2 className="text-[13px] font-medium text-fg">Base map</h2>
        <div className="mt-3">
          <BaseMapPicker
            value={base}
            onChange={(v) => {
              setBase(v)
              // our composites only exist for the pilot zones: take the user there
              if (v === 's2') leader?.flyTo({ center: ZONE_CENTER[zone], zoom: 12, duration: 1800 })
            }}
          />
          {base === 's2' && (
            <div className="mt-3 flex items-center gap-3">
              <span className="text-[12px] text-muted">Zone</span>
              <Segmented
                size="sm"
                label="Zone"
                value={zone}
                onChange={(z) => {
                  setZone(z)
                  setDateIdx(-1)
                  leader?.flyTo({ center: ZONE_CENTER[z], zoom: 12, duration: 1400 })
                }}
                options={[
                  { value: 'A', label: 'A', title: 'Vijayawada West Bypass' },
                  { value: 'B', label: 'B', title: 'Machilipatnam port' },
                  { value: 'C', label: 'C', title: 'Gannavaram–Nunna' },
                ]}
              />
            </div>
          )}
          <p className="mt-2 text-[12px] text-muted">
            {BASE_INFO[base].title} · {BASE_INFO[base].resolution}
          </p>
        </div>
      </div>

      <div data-tour="date">
        <div className="flex items-baseline justify-between">
          <h2 className="text-[13px] font-medium text-fg">{compare ? 'After' : 'Date'}</h2>
          <span className="text-[13px] text-fg">
            {dateLabel(dateId)} <span className="t-mono text-[11px] text-muted">· zone {zone}{afterMeta ? ` · ${afterMeta.scenes.length} scenes` : ''}</span>
          </span>
        </div>
        <TimeScrubber compact dates={dates} index={di} onChange={setDateIdx} playing={playing} onPlayingChange={reduced ? undefined : setPlaying} label="Imagery date" className="mt-2" />
        {base !== 's2' && <p className="mt-1 text-[12px] text-muted">Dates apply to “Our seasons” (RoadWatch composites of zones A–C).</p>}
      </div>

      <div data-tour="compare" className="rounded-card border border-line p-3">
        <label className="flex cursor-pointer items-center justify-between gap-3 text-[14px] text-fg">
          <span className="flex items-center gap-2">
            <Columns2 className="size-4 text-muted" strokeWidth={1.75} aria-hidden />
            Before / after swipe
          </span>
          <Switch
            checked={compare}
            onCheckedChange={(v) => {
              setCompare(v)
              if (v) setBase('s2')
              setPlaying(false)
            }}
            label="Before/after swipe"
          />
        </label>
        {compare && (
          <div className="mt-3">
            <div className="flex items-baseline justify-between text-[12px]">
              <span className="text-muted">Before</span>
              <span className="text-fg">{dateLabel(beforeId)}</span>
            </div>
            <TimeScrubber compact dates={dates} index={beforeIdx} onChange={setBeforeIdx} label="Before date" className="mt-1" />
          </div>
        )}
      </div>
    </div>
  )

  const list = (
    <div>
      <div className="flex items-center justify-between">
        <h2 className="text-[13px] font-medium text-fg">{alerts?.length ?? 0} alerts</h2>
        {alertsFile.data?.demo !== false && <DemoBadge />}
      </div>
      {nFlagged > 0 && (
        <label className="mt-1 flex items-center gap-1.5 text-[12px] text-muted">
          <input type="checkbox" checked={showFlagged} onChange={(e) => setShowFlagged(e.target.checked)} />
          Show {nFlagged} flagged (probably not new)
        </label>
      )}
      <ul className="-mx-2 mt-2 space-y-0.5">
        {(alerts ?? []).map((a) => (
          <li key={a.id}>
            <button
              type="button"
              onClick={() => select(a.id)}
              aria-pressed={selected === a.id}
              className="flex w-full items-center gap-3 rounded-[8px] px-2 py-2 text-left transition-colors hover:bg-surface2 aria-pressed:bg-surface2"
            >
              <span className={cn('size-2 shrink-0 rounded-full', a.priority === 'high' ? 'bg-priority' : 'bg-signal')} aria-hidden />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[14px] text-fg">{a.name ?? `${a.district} · ${fmtKm(a.length_km, 2)}`}</span>
                <span className="t-mono block text-[11px] text-muted">
                  {a.id} · {dateShort(a.first_seen)} · {a.score.toFixed(2)}
                </span>
              </span>
              {a.priority === 'high' && <PriorityMark priority="high" />}
            </button>
          </li>
        ))}
      </ul>
    </div>
  )

  const panelBody = (
    <>
      <div className="flex border-b border-line px-1">
        <div className="flex flex-1" role="tablist" aria-label="Panel">
        {(
          [
            ['layers', 'Layers', Layers],
            ['alerts', 'Alerts', ListTree],
          ] as const
        ).map(([k, l, Icon]) => (
          <button
            key={k}
            role="tab"
            type="button"
            data-tour={k === 'alerts' ? 'alerts' : undefined}
            aria-selected={panel === k}
            onClick={() => setPanel(k)}
            className="relative flex h-11 flex-1 items-center justify-center gap-2 text-[13px] text-muted transition-colors aria-selected:text-fg"
          >
            <Icon className="size-4" strokeWidth={1.75} aria-hidden />
            {l}
            {panel === k && <span className="absolute inset-x-4 -bottom-px h-px bg-sentinel" />}
          </button>
        ))}
        </div>
        {!mobile && (
          <button type="button" onClick={() => setPanelHidden(true)} aria-label="Hide panel" title="Hide panel" className="grid w-10 shrink-0 place-items-center text-muted transition-colors hover:text-fg">
            <PanelLeftClose className="size-4" strokeWidth={1.75} aria-hidden />
          </button>
        )}
      </div>
      <div className="scrollbar-thin min-h-0 flex-1 overflow-y-auto p-4" role="tabpanel">
        {panel === 'layers' ? controls : list}
      </div>
    </>
  )

  return (
    <div className="absolute inset-0 overflow-hidden bg-bg0">
      <a href="#explore-panel" className="skip-link">
        Skip to map controls
      </a>
      <h1 className="sr-only">RoadWatch live demo map</h1>

      {/* maps */}
      <div className="absolute inset-0" data-tour="map">
        <RwMap
          zoneImage={toImage(compare ? beforeMeta : afterMeta)}
          predicted={predicted}
          base={compare ? 's2' : base}
          threeD={threeD && !compare}
          visible={vis}
          alerts={alerts}
          selectedId={selected}
          onSelect={select}
          onCursor={setCursor}
          onZoom={setZoom}
          onReady={onReady}
          initial={{ center: [80.62, 16.51], zoom: mobile ? 11.2 : 12 }}
          ariaLabel="World map with satellite imagery, place names and RoadWatch layers"
        />
        {compare && leader && (
          <div className="absolute inset-0" style={{ clipPath: `inset(0 0 0 ${swipe}%)` }}>
            <RwMap zoneImage={toImage(afterMeta)} predicted={predicted} base="s2" visible={vis} alerts={alerts} selectedId={selected} onSelect={select} follow={leader} interactive={false} ariaLabel="After imagery" />
          </div>
        )}
        {compare && leader && <SwipeDivider pos={swipe} onChange={setSwipe} beforeLabel={dateShort(beforeId)} afterLabel={dateShort(dateId)} />}
      </div>

      {/* top bar */}
      <header className="pointer-events-none absolute inset-x-0 top-0 z-30 flex items-start justify-between gap-3 p-3 sm:p-4">
        <MapSearch map={leader} className="pointer-events-auto" />
        <button
          type="button"
          onClick={() => (setPanel('alerts'), setPanelHidden(false))}
          title={alertsFile.data?.demo !== false ? 'Alerts are demo data' : `RoadWatch change detection, S2 model v1 — screening candidates; ${nFlagged} flagged as probably not new are hidden`}
          className="pointer-events-auto hidden h-11 items-center gap-2.5 rounded-card border border-line bg-surface px-3.5 text-[13px] text-fg shadow-[var(--shadow-panel)] transition-colors hover:border-line-strong lg:flex"
        >
          <span className="size-2 rounded-full" style={{ background: '#f76707' }} aria-hidden />
          <span className="t-mono">{alerts?.length ?? 0}</span> likely new-road alerts
          <span className="text-muted">·</span>
          {alertsFile.data?.demo !== false ? <DemoBadge /> : <span className="text-muted">S2 model v1</span>}
        </button>
        <div className="pointer-events-auto flex items-center gap-2">
          <button
            type="button"
            onClick={() => setTour(true)}
            className="grid size-11 place-items-center rounded-card border border-line bg-surface text-muted shadow-[var(--shadow-panel)] hover:text-fg"
            aria-label="Show guided tour"
          >
            <CircleHelp className="size-[18px]" strokeWidth={1.75} />
          </button>
        </div>
      </header>

      {/* desktop side panel */}
      {!mobile && panelHidden && (
        <button
          type="button"
          onClick={() => setPanelHidden(false)}
          className="rw-fade-in absolute top-[76px] left-4 z-20 flex h-11 items-center gap-2 rounded-card border border-line bg-surface px-3.5 text-[13px] text-fg shadow-[var(--shadow-panel)] transition-colors hover:border-line-strong"
        >
          <Layers className="size-4" strokeWidth={1.75} aria-hidden />
          Layers & alerts
        </button>
      )}
      {!mobile && !panelHidden && (
        <aside id="explore-panel" aria-label="Map controls" className="absolute top-[76px] bottom-[60px] left-4 z-20 flex w-[340px] flex-col overflow-hidden rounded-panel border border-line bg-surface shadow-[var(--shadow-panel)]">
          {panelBody}
        </aside>
      )}

      {/* legend + zoom */}
      <div className={cn('absolute z-20 flex items-end gap-2', mobile ? 'top-[76px] right-3' : 'right-4 bottom-[60px]')}>
        {!mobile && (
          <div className="rounded-card border border-line bg-surface p-3 shadow-[var(--shadow-panel)]">
            <MapLegend visible={vis} />
          </div>
        )}
        <div className="flex flex-col overflow-hidden rounded-card border border-line bg-surface shadow-[var(--shadow-panel)]">
          <button
            type="button"
            aria-label={threeD ? 'Switch to 2D map' : 'Switch to 3D: terrain and buildings'}
            aria-pressed={threeD}
            title={threeD ? '2D' : '3D terrain + buildings (right-drag or Ctrl+drag to tilt/rotate)'}
            onClick={() => {
              setThreeD((v) => !v)
              setCompare(false)
            }}
            className={cn('grid size-10 place-items-center text-[12px] font-semibold tracking-wide hover:bg-surface2', threeD ? 'bg-sentinel/20 text-sentinel-ink' : 'text-muted hover:text-fg')}
          >
            {threeD ? '2D' : '3D'}
          </button>
          <span className="h-px bg-line" />
          <button type="button" aria-label="Zoom in" onClick={() => leader?.zoomIn()} className="grid size-10 place-items-center text-muted hover:bg-surface2 hover:text-fg">
            <Plus className="size-4" strokeWidth={1.75} />
          </button>
          <span className="h-px bg-line" />
          <button type="button" aria-label="Zoom out" onClick={() => leader?.zoomOut()} className="grid size-10 place-items-center text-muted hover:bg-surface2 hover:text-fg">
            <Minus className="size-4" strokeWidth={1.75} />
          </button>
        </div>
      </div>

      {/* HUD */}
      <div className="t-mono pointer-events-none absolute right-4 bottom-4 left-4 z-20 flex items-center justify-between gap-4 text-[11px] text-muted sm:text-[12px]">
        <div className={cn('flex flex-wrap items-center gap-x-4 gap-y-1 rounded-chip bg-surface/90 px-2.5 py-1.5 shadow-[var(--shadow-panel)]', !mobile && !panelHidden && 'ml-[356px]')}>
          <span className={mobile ? 'hidden' : undefined}>
            {cursor ? (
              <>
                <span className="text-fg">{fmtLat(cursor.lat, 4)}</span> <span className="text-fg">{fmtLon(cursor.lng, 4)}</span>
              </>
            ) : (
              'Move over the map'
            )}
          </span>
          <span>
            z <span className="text-fg">{zoom.toFixed(1)}</span>
          </span>
          <span>{showOurs ? (compare ? `${dateShort(beforeId)} | ${dateShort(dateId)}` : `Zone ${zone} · ${dateLabel(dateId)}`) : BASE_INFO[base].label}</span>
          <span className="hidden lg:inline">{BASE_INFO[compare ? 's2' : base].resolution}</span>
        </div>
        <details className="pointer-events-auto relative">
          <summary className="cursor-pointer list-none rounded-chip bg-surface/90 px-2.5 py-1.5 shadow-[var(--shadow-panel)] hover:text-fg">Attribution</summary>
          <p className="absolute right-0 bottom-9 w-72 rounded-card border border-line bg-surface p-3 font-sans text-[12px] leading-relaxed text-muted">
            Satellite imagery © Esri, Maxar, Earthstar Geographics and the GIS User Community. © OpenFreeMap © OpenStreetMap contributors (ODbL). Contains modified
            Copernicus Sentinel data 2022–2026 (RoadWatch composites).
            {base === 'eox' && ' Sentinel-2 cloudless 2024 by EOX IT Services GmbH (CC BY-NC-SA 4.0).'}{' '}
            <Link to="/attributions" className="text-sentinel-ink underline">
              All attributions
            </Link>
          </p>
        </details>
      </div>

      {/* desktop alert sheet */}
      {!mobile && sel && (
        <aside
          key={sel.id}
          aria-label="Alert detail"
          className="rw-sheet-in scrollbar-thin absolute top-[76px] right-4 bottom-[60px] z-30 w-[400px] overflow-y-auto rounded-panel border border-line-strong bg-surface p-5 shadow-[var(--shadow-panel)]"
        >
          <button type="button" onClick={() => setSelected(null)} aria-label="Close alert" className="absolute top-4 right-4 rounded-[6px] p-1 text-muted hover:bg-surface2 hover:text-fg">
            <X className="size-4" strokeWidth={1.75} />
          </button>
          <AlertSummary
            alert={sel}
            dates={dates}
            actions={
              <div className="flex gap-2 border-t border-line pt-4">
                <ButtonLink to={`/alerts/${sel.id}`} variant="subtle" size="md" className="flex-1">
                  Open in app
                </ButtonLink>
              </div>
            }
          />
        </aside>
      )}

      {/* mobile: controls + alert in bottom sheets */}
      {mobile && (
        <>
          <div className="absolute inset-x-3 bottom-14 z-20 flex gap-2">
            <button type="button" onClick={() => setSheetOpen(true)} className="flex h-11 flex-1 items-center justify-center gap-2 rounded-card border border-line bg-surface text-[14px] text-fg shadow-[var(--shadow-panel)]">
              <Layers className="size-4" strokeWidth={1.75} aria-hidden />
              Layers & alerts
            </button>
          </div>
          <Suspense fallback={null}>
            <MobileSheets panelOpen={sheetOpen} onPanelOpenChange={setSheetOpen} panel={panelBody} alert={sel} dates={dates} onCloseAlert={() => setSelected(null)} />
          </Suspense>
        </>
      )}

      <Tour
        steps={mobile ? TOUR.filter((s) => s.target === 'map') : TOUR}
        open={tour}
        onClose={() => {
          setTour(false)
          if (!tourDone) setTourDone(true)
        }}
      />
    </div>
  )
}
