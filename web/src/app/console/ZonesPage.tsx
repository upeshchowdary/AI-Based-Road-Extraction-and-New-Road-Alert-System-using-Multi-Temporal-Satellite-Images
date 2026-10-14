import type { FeatureCollection, Polygon } from 'geojson'
import type { Map as MlMap, MapMouseEvent } from 'maplibre-gl'
import { PenLine, Trash2 } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { toast } from 'sonner'
import { alertCentre } from '@/components/alerts/AlertSummary'
import { RwMap } from '@/components/map/LazyMap'
import { Button } from '@/components/ui/Button'
import { Kbd, Panel } from '@/components/ui/primitives'
import { Switch } from '@/components/ui/Switch'
import { EmptyState, PageHeader } from '@/components/ui/States'
import { useAlerts } from '@/lib/appStore'
import { DATA, useJson, type LngLat, type ZoneMeta } from '@/lib/data'
import { demoPriority } from '@/lib/demoLayers'
import { inPolygon, polygonAreaKm2 } from '@/lib/geoMath'

interface Zone {
  id: string
  name: string
  level: 'high' | 'medium'
  ring: LngLat[]
  notify: { telegram: boolean; email: boolean }
}

const SEED: Zone[] = demoPriority.features.map((f) => ({
  id: String(f.id),
  name: String(f.properties?.name ?? 'Zone'),
  level: 'high',
  ring: f.geometry.coordinates[0] as LngLat[],
  notify: { telegram: true, email: true },
}))

export default function ZonesPage() {
  const meta = useJson<ZoneMeta>(DATA.zoneMeta).data
  const { alerts } = useAlerts()
  const [zones, setZones] = useState<Zone[]>(SEED)
  const [map, setMap] = useState<MlMap | null>(null)
  const [drawing, setDrawing] = useState(false)
  const [pts, setPts] = useState<LngLat[]>([])
  const ptsRef = useRef<LngLat[]>([])
  ptsRef.current = pts

  useEffect(() => {
    if (!map || !drawing) return
    map.getCanvas().style.cursor = 'crosshair'
    map.doubleClickZoom.disable()
    const finish = (raw: LngLat[]) => {
      // a double-click also fires two clicks: drop repeated points
      const ring = raw.filter((p, i) => i === 0 || Math.hypot(p[0] - raw[i - 1][0], p[1] - raw[i - 1][1]) > 1e-6)
      if (ring.length < 3) return
      const z: Zone = { id: `pz-${Date.now()}`, name: `Zone ${zones.length + 1}`, level: 'high', ring: [...ring, ring[0]], notify: { telegram: false, email: true } }
      setZones((zs) => [...zs, z])
      setPts([])
      setDrawing(false)
      toast('Zone saved', { description: `${z.name} · ${polygonAreaKm2(z.ring).toFixed(1)} km² · stored in this browser` })
    }
    const onClick = (e: MapMouseEvent) => setPts((p) => [...p, [e.lngLat.lng, e.lngLat.lat]])
    const onDbl = (e: MapMouseEvent) => {
      e.preventDefault()
      finish(ptsRef.current)
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') (setPts([]), setDrawing(false))
      if (e.key === 'Enter') finish(ptsRef.current)
      if (e.key === 'Backspace') setPts((p) => p.slice(0, -1))
    }
    map.on('click', onClick)
    map.on('dblclick', onDbl)
    window.addEventListener('keydown', onKey)
    return () => {
      map.off('click', onClick)
      map.off('dblclick', onDbl)
      window.removeEventListener('keydown', onKey)
      map.getCanvas().style.cursor = ''
      map.doubleClickZoom.enable()
    }
  }, [map, drawing, zones.length])

  const zonesFc = useMemo<FeatureCollection<Polygon>>(
    () => ({ type: 'FeatureCollection', features: zones.map((z) => ({ type: 'Feature', id: z.id, properties: { name: z.name }, geometry: { type: 'Polygon', coordinates: [z.ring] } })) }),
    [zones],
  )
  const drawFc = useMemo<FeatureCollection | undefined>(
    () =>
      pts.length
        ? {
            type: 'FeatureCollection',
            features: [{ type: 'Feature', properties: {}, geometry: pts.length > 2 ? { type: 'Polygon', coordinates: [[...pts, pts[0]]] } : { type: 'LineString', coordinates: pts.length > 1 ? pts : [pts[0], pts[0]] } }],
          }
        : undefined,
    [pts],
  )
  const count = (z: Zone) => (alerts ?? []).filter((a) => inPolygon(alertCentre(a), z.ring)).length
  const update = (id: string, patch: Partial<Zone>) => setZones((zs) => zs.map((z) => (z.id === id ? { ...z, ...patch } : z)))

  return (
    <div className="flex h-full flex-col">
      <PageHeader
        title="Priority Zones"
        description="Draw sensitive areas. New roads inside them are raised as high priority."
        actions={
          <Button size="sm" variant={drawing ? 'subtle' : 'outline'} aria-pressed={drawing} onClick={() => (setDrawing((d) => !d), setPts([]))}>
            <PenLine className="size-3.5" strokeWidth={1.75} /> {drawing ? 'Cancel drawing' : 'Draw a zone'}
          </Button>
        }
      />
      <div className="grid min-h-0 flex-1 lg:grid-cols-[minmax(0,1fr)_380px]">
        <section aria-label="Zones map" className="relative min-h-[460px]">
          <RwMap meta={meta} dateId="2024_pre_monsoon" base="none" alerts={alerts} priority={zonesFc} draw={drawFc} onReady={setMap} initial={{ center: [81.05, 16.25], zoom: 9.6 }} ariaLabel="Priority zones map" />
          {drawing && (
            <div role="status" className="absolute top-3 left-1/2 flex -translate-x-1/2 items-center gap-2 rounded-card border border-line-strong bg-surface2 px-3 py-2 text-[13px] text-fg shadow-[var(--shadow-panel)]">
              Click to add points · double-click or <Kbd>Enter</Kbd> to finish · <Kbd>Backspace</Kbd> undo · <Kbd>Esc</Kbd> cancel
            </div>
          )}
        </section>
        <aside className="scrollbar-thin overflow-y-auto border-t border-line p-4 lg:border-t-0 lg:border-l">
          {!zones.length ? (
            <EmptyState title="No priority zones" body="Draw one around a border, forest or protected area to raise alerts inside it first." action={<Button size="sm" variant="subtle" onClick={() => setDrawing(true)}>Draw a zone</Button>} />
          ) : (
            <ul className="space-y-3">
              {zones.map((z) => (
                <li key={z.id}>
                  <Panel className="p-4">
                    <div className="flex items-start gap-2">
                      <input value={z.name} onChange={(e) => update(z.id, { name: e.target.value })} aria-label="Zone name" className="min-w-0 flex-1 rounded-[6px] border border-transparent bg-transparent px-1 py-0.5 text-[15px] font-medium text-fg outline-none hover:border-line focus:border-sentinel" />
                      <button type="button" aria-label={`Delete ${z.name}`} onClick={() => setZones((zs) => zs.filter((x) => x.id !== z.id))} className="rounded-[6px] p-1 text-muted hover:bg-surface2 hover:text-priority">
                        <Trash2 className="size-4" strokeWidth={1.5} />
                      </button>
                    </div>
                    <dl className="mt-2 grid grid-cols-2 gap-2 text-[13px]">
                      <div>
                        <dt className="text-muted">Area</dt>
                        <dd className="t-mono text-fg">{polygonAreaKm2(z.ring).toFixed(1)} km²</dd>
                      </div>
                      <div>
                        <dt className="text-muted">Alerts inside · demo</dt>
                        <dd className="t-mono text-fg">{count(z)}</dd>
                      </div>
                    </dl>
                    <label className="mt-3 flex items-center justify-between text-[13px] text-fg">
                      Priority
                      <select value={z.level} onChange={(e) => update(z.id, { level: e.target.value as Zone['level'] })} className="h-8 rounded-[8px] border border-line bg-surface px-2 text-[13px] text-fg">
                        <option value="high">High — alert immediately</option>
                        <option value="medium">Medium — daily digest</option>
                      </select>
                    </label>
                    <div className="mt-3 space-y-2 border-t border-line pt-3 text-[13px]">
                      <label className="flex items-center justify-between text-fg">
                        Telegram alert
                        <Switch checked={z.notify.telegram} onCheckedChange={(v) => update(z.id, { notify: { ...z.notify, telegram: v } })} label={`Telegram alerts for ${z.name}`} />
                      </label>
                      <label className="flex items-center justify-between text-fg">
                        Email alert
                        <Switch checked={z.notify.email} onCheckedChange={(v) => update(z.id, { notify: { ...z.notify, email: v } })} label={`Email alerts for ${z.name}`} />
                      </label>
                    </div>
                  </Panel>
                </li>
              ))}
            </ul>
          )}
          <p className="mt-4 text-[12px] text-muted">Zones are kept in this page for the UI build; the backend stores them in Supabase. Notification channels connect in Settings.</p>
        </aside>
      </div>
    </div>
  )
}
