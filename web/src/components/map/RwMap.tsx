import 'maplibre-gl/dist/maplibre-gl.css'
import type { FeatureCollection, Point, Polygon } from 'geojson'
import { Map as MapLibreMap, setWorkerUrl, type ImageSource, type LngLatLike, type Map as MlMap, type MapGeoJSONFeature } from 'maplibre-gl'
import workerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?url'
import { useEffect, useMemo, useRef, useState } from 'react'
import { cn } from '@/lib/cn'
import { DATA, useJson, type DemoAlert, type ZoneMeta } from '@/lib/data'
import { alertsToGeo, demoPriority } from '@/lib/demoLayers'
import { useReducedMotion } from '@/lib/motionPref'
import { useResolvedTheme } from '@/lib/theme'
import { buildStyle, hatchImage, type BaseImagery, type LayerVisibility, DEFAULT_VISIBILITY, type MapTheme } from './nightSurveyStyle'

// MapLibre v6 loads its worker from a sibling file; point it at the copy Vite serves/bundles.
setWorkerUrl(workerUrl)

export interface RwMapProps {
  className?: string
  meta?: ZoneMeta
  dateId: string
  base: BaseImagery
  visible?: LayerVisibility
  alerts?: DemoAlert[]
  showDemoLayers?: boolean
  selectedId?: string | null
  onSelect?: (id: string | null) => void
  onCursor?: (lngLat: { lng: number; lat: number } | null) => void
  onZoom?: (z: number) => void
  onReady?: (map: MlMap) => void
  initial?: { center: LngLatLike; zoom: number; bearing?: number }
  /** Second map in a before/after swipe: follows the leader's camera. */
  follow?: MlMap | null
  interactive?: boolean
  ariaLabel?: string
  /** User-drawn shape (Explorer / Zones). */
  draw?: FeatureCollection
  /** Extra priority zones (e.g. user-drawn) instead of the demo zone. */
  priority?: FeatureCollection<Polygon>
}

function zoneLabelPoints(zones: FeatureCollection<Polygon> | undefined): FeatureCollection<Point> {
  return {
    type: 'FeatureCollection',
    features: (zones?.features ?? []).map((f) => {
      const ring = f.geometry.coordinates[0]
      const x = Math.min(...ring.map((c) => c[0]))
      const y = Math.max(...ring.map((c) => c[1]))
      return { type: 'Feature', properties: f.properties, geometry: { type: 'Point', coordinates: [x, y] } }
    }),
  }
}

export function RwMap({
  className,
  meta,
  dateId,
  base,
  visible = DEFAULT_VISIBILITY,
  alerts,
  showDemoLayers = true,
  selectedId,
  onSelect,
  onCursor,
  onZoom,
  onReady,
  initial = { center: [80.58, 16.54], zoom: 11.2 },
  follow,
  interactive = true,
  ariaLabel = 'Map',
  draw,
  priority,
}: RwMapProps) {
  const el = useRef<HTMLDivElement>(null)
  const mapRef = useRef<MlMap | null>(null)
  const [map, setMap] = useState<MlMap | null>(null)
  const theme = useResolvedTheme()
  const reduced = useReducedMotion()
  const zones = useJson<FeatureCollection<Polygon>>(DATA.zones).data
  const dateRef = useRef(dateId)
  dateRef.current = dateId
  const cb = useRef({ onSelect, onCursor, onZoom })
  cb.current = { onSelect, onCursor, onZoom }

  // Real abstain decisions from the Sentinel-2 build (tile registry), shown for the displayed date.
  const abstainAll = useJson<FeatureCollection<Polygon>>(DATA.abstain).data
  const abstain = useMemo<FeatureCollection<Polygon> | undefined>(
    () => (abstainAll ? { type: 'FeatureCollection', features: abstainAll.features.filter((f) => f.properties?.date === dateId) } : undefined),
    [abstainAll, dateId],
  )

  const geo = useMemo(() => alertsToGeo(alerts ?? []), [alerts])
  const styleData = useMemo(
    () => ({
      alerts: geo.lines,
      points: geo.points,
      abstain,
      priority: priority ?? (showDemoLayers ? demoPriority : undefined),
      zoneLabels: zoneLabelPoints(zones),
      draw,
    }),
    [geo, abstain, showDemoLayers, zones, draw, priority],
  )

  // create once
  useEffect(() => {
    if (!el.current) return
    const m = new MapLibreMap({
      container: el.current,
      style: buildStyle({ theme, meta, dateId: dateRef.current, base, visible, data: styleData }),
      center: initial.center,
      zoom: initial.zoom,
      bearing: initial.bearing ?? 0,
      attributionControl: false,
      interactive,
      dragRotate: false,
      pitchWithRotate: false,
      maxPitch: 0,
      fadeDuration: 150,
    })
    m.getCanvas().setAttribute('aria-label', ariaLabel)
    m.touchZoomRotate.disableRotation()
    m.on('styleimagemissing', (e) => {
      if (e.id.startsWith('hatch-') && !m.hasImage(e.id)) m.addImage(e.id, hatchImage(e.id.slice(6) as MapTheme))
    })
    const clickable = ['rw-alert-pt', 'rw-new', 'rw-new-pending', 'rw-new-glow']
    m.on('click', (e) => {
      const hits = m.queryRenderedFeatures(e.point, { layers: clickable.filter((l) => m.getLayer(l)) }) as MapGeoJSONFeature[]
      cb.current.onSelect?.(hits.length ? String(hits[0].properties.id) : null)
    })
    for (const l of clickable) {
      m.on('mouseenter', l, () => (m.getCanvas().style.cursor = 'pointer'))
      m.on('mouseleave', l, () => (m.getCanvas().style.cursor = ''))
    }
    m.on('mousemove', (e) => cb.current.onCursor?.(e.lngLat))
    m.on('mouseout', () => cb.current.onCursor?.(null))
    m.on('zoom', () => cb.current.onZoom?.(m.getZoom()))
    m.once('load', () => {
      setMap(m)
      onReady?.(m)
      cb.current.onZoom?.(m.getZoom())
    })
    mapRef.current = m
    return () => {
      m.remove()
      mapRef.current = null
      setMap(null)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // declarative style: theme, base, visibility and data are diffed; nothing reloads
  useEffect(() => {
    if (!map) return
    map.setStyle(buildStyle({ theme, meta, dateId: dateRef.current, base, visible, data: styleData }), { diff: true })
  }, [map, theme, meta, base, visible, styleData])

  // date change: swap the image in place (no style rebuild, no flicker)
  useEffect(() => {
    if (!map) return
    const src = map.getSource('rw-s2') as ImageSource | undefined
    if (src && meta) src.updateImage({ url: DATA.zoneImage(dateId), coordinates: meta.corners_lonlat })
  }, [map, dateId, meta])

  // selection highlight
  useEffect(() => {
    if (!map || !selectedId) return
    for (const s of ['alerts', 'alert-points']) map.setFeatureState({ source: s, id: selectedId }, { selected: true })
    return () => {
      if (!map.getStyle()) return
      for (const s of ['alerts', 'alert-points']) {
        if (map.getSource(s)) map.setFeatureState({ source: s, id: selectedId }, { selected: false })
      }
    }
  }, [map, selectedId, styleData])

  // Gentle pulse rings on alert points (off under reduced motion). Each frame repaints the map, so it
  // starts only after the map has settled, runs at ~15 fps and pauses while moving or when hidden.
  useEffect(() => {
    if (!map || reduced) return
    let raf = 0
    let last = 0
    let moving = false
    const loop = (t: number) => {
      raf = requestAnimationFrame(loop)
      if (moving || document.hidden || t - last < 66) return
      last = t
      const k = (t % 2200) / 2200
      if (map.getLayer('rw-alert-pulse')) {
        map.setPaintProperty('rw-alert-pulse', 'circle-radius', 6 + k * 16)
        map.setPaintProperty('rw-alert-pulse', 'circle-stroke-opacity', 0.8 * (1 - k))
      }
    }
    const onMove = () => {
      moving = true
    }
    const onEnd = () => {
      moving = false
    }
    const start = window.setTimeout(() => {
      raf = requestAnimationFrame(loop)
    }, 2500)
    map.on('movestart', onMove)
    map.on('moveend', onEnd)
    return () => {
      window.clearTimeout(start)
      cancelAnimationFrame(raf)
      map.off('movestart', onMove)
      map.off('moveend', onEnd)
    }
  }, [map, reduced])

  // follower map (before/after swipe): mirror the leader's camera
  useEffect(() => {
    if (!map || !follow) return
    const sync = () => map.jumpTo({ center: follow.getCenter(), zoom: follow.getZoom(), bearing: follow.getBearing(), pitch: follow.getPitch() })
    sync()
    follow.on('move', sync)
    return () => {
      follow.off('move', sync)
    }
  }, [map, follow])

  // maplibre-gl.css (unlayered) sets .maplibregl-map { position: relative }, which beats Tailwind's
  // layered utilities — so the map element itself is sized by width/height inside a positioned wrapper.
  return (
    <div className={cn('absolute inset-0', className)} data-lenis-prevent={interactive ? true : undefined}>
      <div ref={el} className="h-full w-full" />
    </div>
  )
}

export default RwMap
