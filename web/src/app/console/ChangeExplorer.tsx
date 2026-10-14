import type { FeatureCollection, LineString, MultiLineString } from 'geojson'
import type { Map as MlMap, MapMouseEvent } from 'maplibre-gl'
import { Crosshair, Eraser } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { DEFAULT_VISIBILITY } from '@/components/map/nightSurveyStyle'
import { RwMap } from '@/components/map/LazyMap'
import { SwipeDivider } from '@/components/map/SwipeDivider'
import { TimeScrubber } from '@/components/map/TimeScrubber'
import { Button } from '@/components/ui/Button'
import { Panel, Segmented } from '@/components/ui/primitives'
import { Switch } from '@/components/ui/Switch'
import { PageHeader } from '@/components/ui/States'
import { useAlerts } from '@/lib/appStore'
import { DATA, useJson, type LngLat, type ZoneMeta } from '@/lib/data'
import { dateLabel, dateShort, fmtKm } from '@/lib/format'
import { boxAreaKm2, inBox, lengthInBoxKm, type Box } from '@/lib/geoMath'
import { useReducedMotion } from '@/lib/motionPref'

type Mode = 'single' | 'swipe' | 'side'

const OPACITY_LAYERS = [
  { key: 'imagery', label: 'Imagery', layers: ['rw-s2'], prop: 'raster-opacity' },
  { key: 'existing', label: 'Existing roads', layers: ['roads-existing'], prop: 'line-opacity' },
  { key: 'newRoads', label: 'New roads', layers: ['rw-new', 'rw-new-pending'], prop: 'line-opacity' },
  { key: 'abstain', label: 'Unreliable (hatch)', layers: ['rw-abstain'], prop: 'fill-opacity' },
] as const

export default function ChangeExplorer() {
  const meta = useJson<ZoneMeta>(DATA.zoneMeta).data
  const roads = useJson<FeatureCollection<LineString | MultiLineString>>(DATA.zoneRoads).data
  const { alerts } = useAlerts()
  const reduced = useReducedMotion()
  const dates = meta?.dates ?? []
  const [after, setAfter] = useState(-1) // -1 = latest
  const [before, setBefore] = useState(0)
  const [mode, setMode] = useState<Mode>('single')
  const [pos, setPos] = useState(50)
  const [playing, setPlaying] = useState(false)
  const [leader, setLeader] = useState<MlMap | null>(null)
  const [opacity, setOpacity] = useState<Record<string, number>>({ imagery: 1, existing: 0.6, newRoads: 1, abstain: 0.9 })
  const [show, setShow] = useState({ abstain: true })
  const [drawing, setDrawing] = useState(false)
  const [corner, setCorner] = useState<LngLat | null>(null)
  const [box, setBox] = useState<Box | null>(null)

  // layer opacity stack
  useEffect(() => {
    if (!leader) return
    const apply = () => {
      for (const l of OPACITY_LAYERS) for (const id of l.layers) if (leader.getLayer(id)) leader.setPaintProperty(id, l.prop, opacity[l.key])
    }
    apply()
    leader.on('styledata', apply)
    return () => {
      leader.off('styledata', apply)
    }
  }, [leader, opacity])

  // draw a rectangle: two clicks
  useEffect(() => {
    if (!leader || !drawing) return
    leader.getCanvas().style.cursor = 'crosshair'
    const onClick = (e: MapMouseEvent) => {
      const p: LngLat = [e.lngLat.lng, e.lngLat.lat]
      if (!corner) setCorner(p)
      else {
        setBox([Math.min(corner[0], p[0]), Math.min(corner[1], p[1]), Math.max(corner[0], p[0]), Math.max(corner[1], p[1])])
        setCorner(null)
        setDrawing(false)
      }
    }
    leader.on('click', onClick)
    return () => {
      leader.off('click', onClick)
      leader.getCanvas().style.cursor = ''
    }
  }, [leader, drawing, corner])

  const drawFc = useMemo<FeatureCollection | undefined>(() => {
    if (!box) return undefined
    const [x0, y0, x1, y1] = box
    return { type: 'FeatureCollection', features: [{ type: 'Feature', properties: {}, geometry: { type: 'Polygon', coordinates: [[[x0, y0], [x1, y0], [x1, y1], [x0, y1], [x0, y0]]] } }] }
  }, [box])

  const stats = useMemo(() => {
    if (!box) return null
    let osmKm = 0
    for (const f of roads?.features ?? []) {
      const lines = f.geometry.type === 'LineString' ? [f.geometry.coordinates] : f.geometry.coordinates
      for (const l of lines) osmKm += lengthInBoxKm(l as LngLat[], box)
    }
    const inside = (alerts ?? []).filter((a) => a.geometry.coordinates.some((c) => inBox(c, box)))
    return {
      area: boxAreaKm2(box),
      osmKm,
      roadsLoaded: Boolean(roads),
      alerts: inside.length,
      newKm: inside.reduce((s, a) => s + lengthInBoxKm(a.geometry.coordinates, box), 0),
    }
  }, [box, roads, alerts])

  const ai = after < 0 ? dates.length - 1 : after
  const afterId = dates[ai]?.id ?? '2026_pre_monsoon'
  const beforeId = dates[before]?.id ?? '2022_pre_monsoon'
  const vis = { ...DEFAULT_VISIBILITY, abstain: show.abstain }

  return (
    <div className="flex h-full flex-col">
      <PageHeader title="Change Explorer" description="Step through dates, compare any two, and measure an area." />
      <div className="grid min-h-0 flex-1 lg:grid-cols-[320px_minmax(0,1fr)]">
        <aside className="scrollbar-thin space-y-5 overflow-y-auto border-b border-line p-4 lg:border-r lg:border-b-0">
          <section>
            <h2 className="text-[13px] font-medium text-fg">Compare</h2>
            <div className="mt-2">
              <Segmented
                size="sm"
                label="Compare mode"
                value={mode}
                onChange={(m) => {
                  if ((m === 'side') !== (mode === 'side')) setLeader(null)
                  setMode(m)
                  setPlaying(false)
                }}
                options={[
                  { value: 'single', label: 'One date' },
                  { value: 'swipe', label: 'Swipe' },
                  { value: 'side', label: 'Side by side' },
                ]}
              />
            </div>
          </section>
          <section>
            <div className="flex items-baseline justify-between">
              <h2 className="text-[13px] font-medium text-fg">{mode === 'single' ? 'Date' : 'After'}</h2>
              <span className="text-[13px] text-fg">{dateLabel(afterId)}</span>
            </div>
            <TimeScrubber compact dates={dates} index={ai} onChange={setAfter} playing={playing} onPlayingChange={mode === 'single' && !reduced ? setPlaying : undefined} label="Date" className="mt-1" />
            {mode !== 'single' && (
              <>
                <div className="mt-3 flex items-baseline justify-between">
                  <h2 className="text-[13px] font-medium text-fg">Before</h2>
                  <span className="text-[13px] text-fg">{dateLabel(beforeId)}</span>
                </div>
                <TimeScrubber compact dates={dates} index={before} onChange={setBefore} label="Before date" className="mt-1" />
              </>
            )}
          </section>
          <section>
            <h2 className="text-[13px] font-medium text-fg">Layers</h2>
            <ul className="mt-3 space-y-3">
              {OPACITY_LAYERS.map((l) => (
                <li key={l.key}>
                  <div className="flex items-center justify-between text-[13px]">
                    <label htmlFor={`op-${l.key}`} className="text-fg">
                      {l.label}
                    </label>
                    <span className="t-mono text-[12px] text-muted">{Math.round(opacity[l.key] * 100)}%</span>
                  </div>
                  <input id={`op-${l.key}`} type="range" min={0} max={1} step={0.05} value={opacity[l.key]} onChange={(e) => setOpacity((o) => ({ ...o, [l.key]: +e.target.value }))} className="mt-1 w-full accent-[var(--sentinel)]" />
                </li>
              ))}
              <li className="flex items-center justify-between text-[13px] text-fg">
                Abstain hatch overlay
                <Switch checked={show.abstain} onCheckedChange={(v) => setShow({ abstain: v })} label="Abstain hatch overlay" />
              </li>
            </ul>
          </section>
          <section>
            <h2 className="text-[13px] font-medium text-fg">Measure an area</h2>
            <p className="mt-1 text-[13px] text-muted">{drawing ? (corner ? 'Click the opposite corner.' : 'Click the first corner on the map.') : 'Draw a rectangle to count roads and alerts inside it.'}</p>
            <div className="mt-2 flex gap-2">
              <Button size="sm" variant={drawing ? 'subtle' : 'outline'} aria-pressed={drawing} onClick={() => (setDrawing((d) => !d), setCorner(null))}>
                <Crosshair className="size-3.5" strokeWidth={1.75} /> {drawing ? 'Cancel' : 'Draw rectangle'}
              </Button>
              {box && (
                <Button size="sm" variant="ghost" onClick={() => setBox(null)}>
                  <Eraser className="size-3.5" strokeWidth={1.75} /> Clear
                </Button>
              )}
            </div>
            {stats && (
              <Panel className="mt-3 p-3">
                <dl className="grid grid-cols-2 gap-3 text-[13px]">
                  <div>
                    <dt className="text-muted">Area</dt>
                    <dd className="t-mono text-fg">{stats.area.toFixed(1)} km²</dd>
                  </div>
                  <div>
                    <dt className="text-muted">Existing roads (OSM)</dt>
                    <dd className="t-mono text-fg">{stats.roadsLoaded ? fmtKm(stats.osmKm) : '…'}</dd>
                  </div>
                  <div>
                    <dt className="text-muted">Alerts · demo</dt>
                    <dd className="t-mono text-fg">{stats.alerts}</dd>
                  </div>
                  <div>
                    <dt className="text-muted">New road · demo</dt>
                    <dd className="t-mono text-fg">{fmtKm(stats.newKm, 2)}</dd>
                  </div>
                </dl>
                <p className="mt-2 text-[11px] text-muted">OSM length counts zone A roads only.</p>
              </Panel>
            )}
          </section>
        </aside>

        <section className="relative min-h-[480px]">
          {mode === 'side' ? (
            <div className="absolute inset-0 grid grid-cols-2 gap-px bg-line">
              <div className="relative">
                <RwMap meta={meta} dateId={beforeId} base="s2" visible={vis} alerts={alerts} onReady={setLeader} draw={drawFc} ariaLabel={`Before: ${dateLabel(beforeId)}`} />
                <span className="t-mono absolute top-3 left-3 rounded-chip bg-[#05070c]/75 px-2 py-1 text-[11px] text-[#e8edf5]/90">{dateShort(beforeId)}</span>
              </div>
              <div className="relative">
                {leader && <RwMap meta={meta} dateId={afterId} base="s2" visible={vis} alerts={alerts} follow={leader} interactive={false} draw={drawFc} ariaLabel={`After: ${dateLabel(afterId)}`} />}
                <span className="t-mono absolute top-3 left-3 rounded-chip bg-[#05070c]/75 px-2 py-1 text-[11px] text-[#e8edf5]/90">{dateShort(afterId)}</span>
              </div>
            </div>
          ) : (
            <>
              <RwMap key="lead" meta={meta} dateId={mode === 'swipe' ? beforeId : afterId} base="s2" visible={vis} alerts={alerts} onReady={setLeader} draw={drawFc} ariaLabel="Change map" />
              {mode === 'swipe' && leader && (
                <>
                  <div className="absolute inset-0" style={{ clipPath: `inset(0 0 0 ${pos}%)` }}>
                    <RwMap meta={meta} dateId={afterId} base="s2" visible={vis} alerts={alerts} follow={leader} interactive={false} draw={drawFc} ariaLabel="After imagery" />
                  </div>
                  <SwipeDivider pos={pos} onChange={setPos} beforeLabel={dateShort(beforeId)} afterLabel={dateShort(afterId)} className="[&>span]:!top-3" />
                </>
              )}
            </>
          )}
        </section>
      </div>
    </div>
  )
}
