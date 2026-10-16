import 'maplibre-gl/dist/maplibre-gl.css'
import type { FeatureCollection, Point, Polygon } from 'geojson'
import {
  Map as MapLibreMap, NavigationControl, ScaleControl, setWorkerUrl,
  type ImageSource, type LngLatLike, type Map as MlMap, type MapGeoJSONFeature, type StyleSpecification,
} from 'maplibre-gl'
import workerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?url'
import { useEffect, useMemo, useRef, useState } from 'react'
import { cn } from '@/lib/cn'
import { DATA, useJson, type DemoAlert, type ZoneMeta } from '@/lib/data'
import { alertsToGeo, demoPriority } from '@/lib/demoLayers'
import { useReducedMotion } from '@/lib/motionPref'
import { useResolvedTheme } from '@/lib/theme'
import {
  buildStyle, DEFAULT_VISIBILITY, hatchImage, loadLiberty,
  type BaseImagery, type LayerVisibility, type MapTheme, type ZoneImage,
} from './nightSurveyStyle'

// MapLibre v6 loads its worker from a sibling file; point it at the copy Vite serves/bundles.
setWorkerUrl(workerUrl)

export interface RwMapProps {
  className?: string
  /** Our zone imagery overlay (url + 4 corners); used when base = 's2'. */
  zoneImage?: ZoneImage | null
  /** Legacy (console pages): static zone-A metadata + date id -> zone image. */
  meta?: ZoneMeta
  dateId?: string
  /** 'none' is the legacy name for the plain map -> streets. */
  base: BaseImagery | 'none'
  visible?: LayerVisibility
  alerts?: DemoAlert[]
  predicted?: FeatureCollection
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
  /** 3D mode: terrain + buildings + sky; tilt/rotate enabled (right-drag or Ctrl+drag). */
  threeD?: boolean
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
  zoneImage,
  meta,
  dateId,
  base: baseIn,
  visible = DEFAULT_VISIBILITY,
  alerts,
  predicted,
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
  threeD = false,
}: RwMapProps) {
  const base: BaseImagery = baseIn === 'none' ? 'streets' : baseIn
  const el = useRef<HTMLDivElement>(null)
  const [map, setMap] = useState<MlMap | null>(null)
  const [liberty, setLiberty] = useState<StyleSpecification | null>(null)
  const theme = useResolvedTheme()
  const reduced = useReducedMotion()
  const zones = useJson<FeatureCollection<Polygon>>(DATA.zones).data
  const cb = useRef({ onSelect, onCursor, onZoom })
  cb.current = { onSelect, onCursor, onZoom }

  // legacy props -> zone image (console pages still use the static zone-A snapshot)
  const image = useMemo<ZoneImage | null>(() => {
    if (zoneImage !== undefined) return zoneImage
    if (meta && dateId) return { url: DATA.zoneImage(dateId), corners: meta.corners_lonlat }
    return null
  }, [zoneImage, meta, dateId])
  const imageKey = image ? `${image.url}|${image.corners.flat().join(',')}` : ''
  const shownDate = useMemo(() => {
    if (dateId) return dateId
    const m = image?.url.match(/(\d{4}_(?:pre|post)_monsoon)/)
    return m?.[1]
  }, [dateId, image])

  // the full street style is fetched once, only when needed
  useEffect(() => {
    if (base !== 'streets' || liberty) return
    let live = true
    loadLiberty().then((s) => live && setLiberty(s), () => undefined)
    return () => {
      live = false
    }
  }, [base, liberty])

  // Real abstain decisions from the Sentinel-2 build (tile registry), shown for the displayed date.
  const abstainAll = useJson<FeatureCollection<Polygon>>(DATA.abstain).data
  const abstain = useMemo<FeatureCollection<Polygon> | undefined>(
    () => (abstainAll && shownDate ? { type: 'FeatureCollection', features: abstainAll.features.filter((f) => f.properties?.date === shownDate) } : undefined),
    [abstainAll, shownDate],
  )

  const geo = useMemo(() => alertsToGeo(alerts ?? []), [alerts])
  const styleData = useMemo(
    () => ({
      alerts: geo.lines,
      points: geo.points,
      abstain,
      predicted,
      priority: priority ?? (showDemoLayers ? demoPriority : undefined),
      zoneLabels: zoneLabelPoints(zones),
      draw,
    }),
    [geo, abstain, predicted, showDemoLayers, zones, draw, priority],
  )
  const styleRef = useRef({ theme, base, image, visible, styleData, liberty, threeD })
  styleRef.current = { theme, base, image, visible, styleData, liberty, threeD }

  // create once
  useEffect(() => {
    if (!el.current) return
    const s = styleRef.current
    const m = new MapLibreMap({
      container: el.current,
      style: buildStyle({ theme: s.theme, base: s.base, zoneImage: s.image, visible: s.visible, data: s.styleData, liberty: s.liberty, threeD: s.threeD }),
      center: initial.center,
      zoom: initial.zoom,
      bearing: initial.bearing ?? 0,
      minZoom: 0,
      maxZoom: 20,
      attributionControl: false,
      interactive,
      dragRotate: false, // enabled in 3D mode
      pitchWithRotate: true,
      maxPitch: 80,
      fadeDuration: 200,
    })
    m.getCanvas().setAttribute('aria-label', ariaLabel)
    m.touchZoomRotate.disableRotation()
    if (interactive) {
      m.addControl(new ScaleControl({ maxWidth: 110, unit: 'metric' }), 'bottom-right')
      // compass: shows tilt/rotation in 3D; click resets north and flattens
      m.addControl(new NavigationControl({ showZoom: false, showCompass: true, visualizePitch: true }), 'bottom-right')
    }
    m.on('styleimagemissing', (e) => {
      if (e.id.startsWith('hatch-') && !m.hasImage(e.id)) m.addImage(e.id, hatchImage(e.id.slice(6) as MapTheme))
    })
    const clickable = ['rw-alert-pt', 'rw-new', 'rw-new-pending', 'rw-new-glow']
    for (const l of ['rw-alert-cluster']) {
      m.on('mouseenter', l, () => (m.getCanvas().style.cursor = 'zoom-in'))
      m.on('mouseleave', l, () => (m.getCanvas().style.cursor = ''))
    }
    m.on('click', (e) => {
      const cl = m.getLayer('rw-alert-cluster') ? m.queryRenderedFeatures(e.point, { layers: ['rw-alert-cluster'] }) : []
      if (cl.length) {
        // zoom into a cluster instead of selecting
        const src = m.getSource('alert-points') as unknown as { getClusterExpansionZoom: (id: number) => Promise<number> }
        const g = cl[0].geometry as unknown as { coordinates: [number, number] }
        src.getClusterExpansionZoom(Number(cl[0].properties.cluster_id)).then((z) => m.easeTo({ center: g.coordinates, zoom: z + 0.3, duration: 700 }))
        return
      }
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
    return () => {
      m.remove()
      setMap(null)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // declarative style: theme, base, visibility, data diffed. A new zone image swaps in place below.
  const lastImageKey = useRef(imageKey)
  useEffect(() => {
    if (!map) return
    map.setStyle(buildStyle({ theme, base, zoneImage: image, visible, data: styleData, liberty, threeD }), { diff: true })
    lastImageKey.current = imageKey
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map, theme, base, visible, styleData, liberty, threeD])

  // 3D on/off: tilt the camera and allow rotate/tilt gestures only in 3D.
  // Runs only when the toggle changes — on first load it must not cancel the opening fly-in.
  const prev3d = useRef(threeD)
  useEffect(() => {
    if (!map || !interactive || prev3d.current === threeD) return
    prev3d.current = threeD
    if (threeD) {
      map.dragRotate.enable()
      map.touchZoomRotate.enableRotation()
      map.touchPitch.enable()
      map.easeTo({ pitch: 62, bearing: map.getBearing() || -18, zoom: Math.max(map.getZoom(), 14.5), duration: reduced ? 0 : 1600 })
    } else {
      map.dragRotate.disable()
      map.touchZoomRotate.disableRotation()
      map.touchPitch.disable()
      map.easeTo({ pitch: 0, bearing: 0, duration: reduced ? 0 : 900 })
    }
  }, [map, threeD, interactive, reduced])

  // date / zone change: swap the image in place (no style rebuild, no flicker)
  useEffect(() => {
    if (!map || imageKey === lastImageKey.current) return
    lastImageKey.current = imageKey
    const src = map.getSource('rw-s2') as ImageSource | undefined
    if (src && image) src.updateImage({ url: image.url, coordinates: image.corners })
    else map.setStyle(buildStyle({ theme, base, zoneImage: image, visible, data: styleData, liberty, threeD }), { diff: true })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map, imageKey])

  // selection highlight
  useEffect(() => {
    if (!map || !selectedId) return
    for (const s of ['alerts', 'alert-points']) if (map.getSource(s)) map.setFeatureState({ source: s, id: selectedId }, { selected: true })
    return () => {
      if (!map.getStyle()) return
      for (const s of ['alerts', 'alert-points']) {
        if (map.getSource(s)) map.setFeatureState({ source: s, id: selectedId }, { selected: false })
      }
    }
  }, [map, selectedId, styleData])

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
