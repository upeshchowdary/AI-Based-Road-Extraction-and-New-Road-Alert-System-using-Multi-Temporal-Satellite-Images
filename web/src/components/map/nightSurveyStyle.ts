/**
 * Map styles. Four base maps, one shared set of RoadWatch overlays:
 *   satellite — Esri World Imagery (sub-metre in many cities, up to z19) + OpenFreeMap labels/roads (hybrid)
 *   streets   — full OpenFreeMap "liberty" style (buildings, POIs, road names, house numbers)
 *   eox       — Sentinel-2 cloudless 2024 by EOX (10 m, newest yearly mosaic)
 *   s2        — our own seasonal Sentinel-2 composites for the selected zone, over satellite
 * Globe projection at low zoom (whole world), Mercator when zoomed in (MapLibre handles the switch).
 * International (admin_level 2) and disputed boundaries are deliberately not drawn.
 */
import type { FeatureCollection } from 'geojson'
import type { ExpressionSpecification, LayerSpecification, SourceSpecification, StyleSpecification } from 'maplibre-gl'
import { DATA } from '@/lib/data'

export type MapTheme = 'dark' | 'light'
export type BaseImagery = 'satellite' | 'streets' | 'eox' | 's2'

export const BASE_INFO: Record<BaseImagery, { label: string; title: string; resolution: string }> = {
  satellite: { label: 'Satellite', title: 'Esri World Imagery + OpenStreetMap labels', resolution: '≈0.3–1 m (varies)' },
  streets: { label: 'Streets', title: 'OpenFreeMap (OpenStreetMap) street map', resolution: 'vector' },
  eox: { label: 'S2 2024', title: 'Sentinel-2 cloudless 2024 by EOX', resolution: '10 m' },
  s2: { label: 'Our seasons', title: 'RoadWatch seasonal Sentinel-2 composites (zones A–C)', resolution: '10 m' },
}

interface Palette {
  label: string
  labelHalo: string
  road: string
  abstain: string
  signal: string
  sentinel: string
  priority: string
  predicted: string
  line: string
}

export const PALETTES: Record<MapTheme, Palette> = {
  // map overlays sit on imagery, so both themes use the same bright-but-not-neon set
  dark: {
    label: '#ffffff', labelHalo: '#101317', road: '#ffffff', abstain: '#c9ced6', signal: '#f76707',
    sentinel: '#2ec4b6', priority: '#e03131', predicted: '#2ec4b6', line: '#f1f3f5',
  },
  light: {
    label: '#ffffff', labelHalo: '#15181d', road: '#ffffff', abstain: '#c9ced6', signal: '#f76707',
    sentinel: '#2ec4b6', priority: '#e03131', predicted: '#2ec4b6', line: '#f1f3f5',
  },
}

const NAME: ExpressionSpecification = ['coalesce', ['get', 'name:en'], ['get', 'name_en'], ['get', 'name']]
const OMT_URL = 'https://tiles.openfreemap.org/planet'
const GLYPHS = 'https://tiles.openfreemap.org/fonts/{fontstack}/{range}.pbf'
const SPRITE = 'https://tiles.openfreemap.org/sprites/ofm_f384/ofm'
export const LIBERTY_URL = 'https://tiles.openfreemap.org/styles/liberty'
const DROP_FROM_LIBERTY = new Set(['boundary_2', 'boundary_disputed'])

export interface LayerVisibility {
  existing: boolean
  newRoads: boolean
  abstain: boolean
  priority: boolean
  zones: boolean
  predicted: boolean
  labels: boolean
}

export const DEFAULT_VISIBILITY: LayerVisibility = {
  existing: true, newRoads: true, abstain: true, priority: false, zones: true, predicted: true, labels: true,
}

const EMPTY: FeatureCollection = { type: 'FeatureCollection', features: [] }

export interface StyleData {
  alerts?: FeatureCollection
  points?: FeatureCollection
  abstain?: FeatureCollection
  priority?: FeatureCollection
  zoneLabels?: FeatureCollection
  draw?: FeatureCollection
  predicted?: FeatureCollection
}

export interface ZoneImage {
  url: string
  corners: [[number, number], [number, number], [number, number], [number, number]]
}

export interface StyleOptions {
  theme: MapTheme
  base: BaseImagery
  zoneImage?: ZoneImage | null
  visible?: LayerVisibility
  data?: StyleData
  /** The fetched OpenFreeMap liberty style (needed for base = 'streets'). */
  liberty?: StyleSpecification | null
  /** 3D mode: real terrain (AWS Terrain Tiles), extruded buildings (OSM heights), sky. */
  threeD?: boolean
}

/**
 * Building walls in the tones of Andhra towns seen from above: light plaster and cement for houses,
 * darker concrete and glass for tall blocks. The vector tiles carry no per-building id or facade
 * data (OSM has none), so the tone follows height; it is a plausible look, not a photo texture.
 */
const H: ExpressionSpecification = ['coalesce', ['get', 'render_height'], 6]
export const BUILDING_COLOR: ExpressionSpecification = ['interpolate', ['linear'], H, 0, '#d3cdc2', 8, '#c9c3b8', 20, '#bab7b1', 45, '#a9adb1', 120, '#9aa1a8']
/** Extruded OSM buildings for the imagery base maps (liberty has its own `building-3d`). */
function buildings3d(vis: (on: boolean) => { visibility: 'visible' | 'none' }, on: boolean): LayerSpecification {
  return {
    id: 'rw-buildings-3d', type: 'fill-extrusion', source: 'openmaptiles', 'source-layer': 'building', minzoom: 14,
    layout: vis(on),
    paint: {
      'fill-extrusion-color': BUILDING_COLOR,
      'fill-extrusion-height': ['interpolate', ['linear'], ['zoom'], 14, 0, 15.2, H],
      'fill-extrusion-base': ['coalesce', ['get', 'render_min_height'], 0],
      'fill-extrusion-opacity': ['interpolate', ['linear'], ['zoom'], 14, 0.6, 16, 0.95],
      'fill-extrusion-vertical-gradient': true,
    },
  }
}

/** Road casing + line widths by OpenMapTiles class, in pixels, by zoom. */
function roadWidth(scale = 1): ExpressionSpecification {
  return [
    'interpolate', ['exponential', 1.5], ['zoom'],
    8, ['match', ['get', 'class'], ['motorway', 'trunk'], 1.2 * scale, 'primary', 0.9 * scale, 0.4 * scale],
    12, ['match', ['get', 'class'], ['motorway', 'trunk'], 2.6 * scale, 'primary', 2.0 * scale, 'secondary', 1.6 * scale, 'tertiary', 1.3 * scale, 0.8 * scale],
    16, ['match', ['get', 'class'], ['motorway', 'trunk'], 8 * scale, 'primary', 6.5 * scale, 'secondary', 5.5 * scale, 'tertiary', 4.5 * scale, 3 * scale],
    19, ['match', ['get', 'class'], ['motorway', 'trunk'], 20 * scale, 'primary', 16 * scale, 'secondary', 14 * scale, 'tertiary', 12 * scale, 8 * scale],
  ]
}

/** Labels and thin roads drawn on top of imagery (satellite / EOX / our seasons). */
function hybridLayers(c: Palette, vis: (on: boolean) => { visibility: 'visible' | 'none' }, visible: LayerVisibility): LayerSpecification[] {
  const halo = { 'text-color': c.label, 'text-halo-color': c.labelHalo, 'text-halo-width': 1.6, 'text-halo-blur': 0.5 }
  const labels = vis(visible.labels)
  return [
    {
      id: 'hy-boundary-state', type: 'line', source: 'openmaptiles', 'source-layer': 'boundary',
      filter: ['all', ['in', ['get', 'admin_level'], ['literal', [3, 4]]], ['!=', ['get', 'maritime'], 1]],
      layout: labels,
      paint: { 'line-color': c.line, 'line-opacity': 0.7, 'line-width': ['interpolate', ['linear'], ['zoom'], 3, 0.6, 10, 1.6], 'line-dasharray': [3, 2] },
    },
    {
      id: 'hy-boundary-district', type: 'line', source: 'openmaptiles', 'source-layer': 'boundary', minzoom: 7,
      filter: ['all', ['in', ['get', 'admin_level'], ['literal', [5, 6]]], ['!=', ['get', 'maritime'], 1]],
      layout: labels,
      paint: { 'line-color': c.line, 'line-opacity': 0.45, 'line-width': 1, 'line-dasharray': [2, 2] },
    },
    {
      id: 'hy-roads', type: 'line', source: 'openmaptiles', 'source-layer': 'transportation', minzoom: 5,
      filter: ['in', ['get', 'class'], ['literal', ['motorway', 'trunk', 'primary', 'secondary', 'tertiary', 'minor', 'service', 'track']]],
      layout: { 'line-cap': 'round', 'line-join': 'round', ...vis(visible.existing) },
      paint: {
        'line-color': ['match', ['get', 'class'], ['motorway', 'trunk'], '#ffd27a', 'primary', '#fff2c4', c.road],
        'line-width': roadWidth(0.55),
        'line-opacity': ['interpolate', ['linear'], ['zoom'], 5, 0.5, 12, 0.55, 16, 0.4, 19, 0.25],
      },
    },
    {
      id: 'hy-water-names-pt', type: 'symbol', source: 'openmaptiles', 'source-layer': 'water_name',
      filter: ['==', ['geometry-type'], 'Point'],
      layout: { ...labels, 'text-field': NAME, 'text-font': ['Noto Sans Italic'], 'text-size': 12, 'text-max-width': 8 },
      paint: { 'text-color': '#bfe6ff', 'text-halo-color': c.labelHalo, 'text-halo-width': 1.4 },
    },
    {
      id: 'hy-water-names-line', type: 'symbol', source: 'openmaptiles', 'source-layer': 'water_name',
      filter: ['==', ['geometry-type'], 'LineString'],
      layout: { ...labels, 'text-field': NAME, 'text-font': ['Noto Sans Italic'], 'text-size': 12, 'symbol-placement': 'line' },
      paint: { 'text-color': '#bfe6ff', 'text-halo-color': c.labelHalo, 'text-halo-width': 1.4 },
    },
    {
      id: 'hy-waterway-names', type: 'symbol', source: 'openmaptiles', 'source-layer': 'waterway', minzoom: 11,
      layout: { ...labels, 'text-field': NAME, 'text-font': ['Noto Sans Italic'], 'text-size': 11, 'symbol-placement': 'line' },
      paint: { 'text-color': '#bfe6ff', 'text-halo-color': c.labelHalo, 'text-halo-width': 1.4 },
    },
    {
      id: 'hy-road-names', type: 'symbol', source: 'openmaptiles', 'source-layer': 'transportation_name', minzoom: 12,
      layout: {
        ...labels, 'symbol-placement': 'line', 'text-field': NAME, 'text-font': ['Noto Sans Regular'],
        'text-size': ['interpolate', ['linear'], ['zoom'], 12, 10, 16, 13, 19, 15], 'text-max-angle': 30,
      },
      paint: halo,
    },
    {
      id: 'hy-airports', type: 'symbol', source: 'openmaptiles', 'source-layer': 'aerodrome_label', minzoom: 9,
      layout: { ...labels, 'text-field': NAME, 'text-font': ['Noto Sans Regular'], 'text-size': 12, 'text-max-width': 10 },
      paint: halo,
    },
    {
      id: 'hy-poi', type: 'symbol', source: 'openmaptiles', 'source-layer': 'poi', minzoom: 15,
      filter: ['<=', ['get', 'rank'], 12],
      layout: { ...labels, 'text-field': NAME, 'text-font': ['Noto Sans Regular'], 'text-size': 11, 'text-max-width': 9, 'text-optional': true },
      paint: { ...halo, 'text-color': '#e9f1ff' },
    },
    {
      id: 'hy-places-minor', type: 'symbol', source: 'openmaptiles', 'source-layer': 'place', minzoom: 11,
      filter: ['in', ['get', 'class'], ['literal', ['village', 'suburb', 'neighbourhood', 'hamlet', 'quarter', 'locality', 'isolated_dwelling']]],
      layout: {
        ...labels, 'text-field': NAME, 'text-font': ['Noto Sans Regular'],
        'text-size': ['interpolate', ['linear'], ['zoom'], 11, 11, 16, 14], 'text-max-width': 8,
      },
      paint: halo,
    },
    {
      id: 'hy-places-town', type: 'symbol', source: 'openmaptiles', 'source-layer': 'place', minzoom: 7,
      filter: ['==', ['get', 'class'], 'town'],
      layout: { ...labels, 'text-field': NAME, 'text-font': ['Noto Sans Regular'], 'text-size': ['interpolate', ['linear'], ['zoom'], 7, 11, 14, 15], 'text-max-width': 8 },
      paint: halo,
    },
    {
      id: 'hy-places-city', type: 'symbol', source: 'openmaptiles', 'source-layer': 'place', minzoom: 3,
      filter: ['==', ['get', 'class'], 'city'],
      layout: { ...labels, 'text-field': NAME, 'text-font': ['Noto Sans Bold'], 'text-size': ['interpolate', ['linear'], ['zoom'], 4, 11, 10, 16, 14, 19], 'text-max-width': 8 },
      paint: halo,
    },
    {
      id: 'hy-places-state', type: 'symbol', source: 'openmaptiles', 'source-layer': 'place', minzoom: 3, maxzoom: 9,
      filter: ['==', ['get', 'class'], 'state'],
      layout: { ...labels, 'text-field': NAME, 'text-font': ['Noto Sans Regular'], 'text-size': 12, 'text-transform': 'uppercase', 'text-letter-spacing': 0.15, 'text-max-width': 8 },
      paint: { ...halo, 'text-color': '#e6ecf5' },
    },
    {
      id: 'hy-places-country', type: 'symbol', source: 'openmaptiles', 'source-layer': 'place', maxzoom: 7,
      filter: ['==', ['get', 'class'], 'country'],
      layout: { ...labels, 'text-field': NAME, 'text-font': ['Noto Sans Bold'], 'text-size': ['interpolate', ['linear'], ['zoom'], 1, 10, 5, 15], 'text-max-width': 7 },
      paint: halo,
    },
  ]
}

/** RoadWatch overlays (same on every base map). */
function overlayLayers(c: Palette, theme: MapTheme, vis: (on: boolean) => { visibility: 'visible' | 'none' }, visible: LayerVisibility): LayerSpecification[] {
  return [
    { id: 'rw-districts', type: 'line', source: 'districts', paint: { 'line-color': c.sentinel, 'line-width': 1.2, 'line-opacity': ['interpolate', ['linear'], ['zoom'], 6, 0.7, 12, 0.35] } },
    { id: 'rw-abstain', type: 'fill', source: 'abstain', layout: vis(visible.abstain), paint: { 'fill-pattern': `hatch-${theme}`, 'fill-opacity': 0.85 } },
    { id: 'rw-abstain-line', type: 'line', source: 'abstain', layout: vis(visible.abstain), paint: { 'line-color': c.abstain, 'line-width': 1, 'line-dasharray': [2, 2] } },
    { id: 'rw-priority', type: 'fill', source: 'priority', layout: vis(visible.priority), paint: { 'fill-color': c.priority, 'fill-opacity': 0.08 } },
    { id: 'rw-priority-line', type: 'line', source: 'priority', layout: vis(visible.priority), paint: { 'line-color': c.priority, 'line-width': 1.5, 'line-dasharray': [3, 2] } },
    { id: 'rw-zones', type: 'line', source: 'zones', layout: vis(visible.zones), paint: { 'line-color': c.sentinel, 'line-width': 1.6, 'line-opacity': 0.9, 'line-dasharray': [1, 2] } },
    {
      // model output (RoadWatch-extracted roads), when an inference run exists for the shown zone/season
      id: 'rw-predicted', type: 'line', source: 'predicted',
      layout: { 'line-cap': 'round', 'line-join': 'round', ...vis(visible.predicted) },
      paint: { 'line-color': c.predicted, 'line-width': ['interpolate', ['linear'], ['zoom'], 9, 1.2, 14, 3, 18, 6], 'line-opacity': ['interpolate', ['linear'], ['get', 'confidence'], 0.5, 0.55, 1, 1] },
    },
    {
      // white casing under alert lines (readable on imagery and on the street map); thicker when selected
      id: 'rw-new-glow', type: 'line', source: 'alerts', minzoom: 10,
      layout: { 'line-cap': 'round', 'line-join': 'round', ...vis(visible.newRoads) },
      paint: {
        'line-color': '#ffffff',
        'line-width': ['interpolate', ['linear'], ['zoom'], 10, 3.5, 14, 7, 18, 12],
        'line-opacity': ['case', ['boolean', ['feature-state', 'selected'], false], 1, 0.85],
      },
    },
    {
      id: 'rw-new', type: 'line', source: 'alerts', minzoom: 10, filter: ['!=', ['get', 'status'], 'pending'],
      layout: { 'line-cap': 'round', 'line-join': 'round', ...vis(visible.newRoads) },
      paint: { 'line-color': c.signal, 'line-width': ['interpolate', ['linear'], ['zoom'], 8, 1.6, 14, 4] },
    },
    {
      id: 'rw-new-pending', type: 'line', source: 'alerts', minzoom: 10, filter: ['==', ['get', 'status'], 'pending'],
      layout: { 'line-cap': 'butt', 'line-join': 'round', ...vis(visible.newRoads) },
      paint: { 'line-color': c.signal, 'line-width': ['interpolate', ['linear'], ['zoom'], 8, 1.6, 14, 4], 'line-dasharray': [2, 1.2] },
    },
    {
      id: 'rw-alert-cluster', type: 'circle', source: 'alert-points', filter: ['has', 'point_count'], layout: vis(visible.newRoads),
      paint: {
        'circle-color': c.signal, 'circle-opacity': 0.92,
        'circle-radius': ['step', ['get', 'point_count'], 13, 10, 17, 50, 23, 150, 30],
        'circle-stroke-color': '#ffffff', 'circle-stroke-width': 2,
      },
    },
    {
      id: 'rw-alert-cluster-count', type: 'symbol', source: 'alert-points', filter: ['has', 'point_count'],
      layout: { ...vis(visible.newRoads), 'text-field': ['get', 'point_count_abbreviated'], 'text-font': ['Noto Sans Bold'], 'text-size': 12, 'text-allow-overlap': true },
      paint: { 'text-color': '#ffffff' },
    },
    {
      id: 'rw-alert-pt', type: 'circle', source: 'alert-points', filter: ['!', ['has', 'point_count']], layout: vis(visible.newRoads),
      paint: {
        'circle-radius': ['case', ['boolean', ['feature-state', 'selected'], false], 7, 5],
        'circle-color': ['match', ['get', 'priority'], 'high', c.priority, c.signal],
        'circle-stroke-color': c.labelHalo, 'circle-stroke-width': 2,
      },
    },
    { id: 'rw-draw-fill', type: 'fill', source: 'draw', paint: { 'fill-color': c.sentinel, 'fill-opacity': 0.08 } },
    { id: 'rw-draw-line', type: 'line', source: 'draw', paint: { 'line-color': c.sentinel, 'line-width': 1.5, 'line-dasharray': [2, 1.5] } },
    {
      id: 'rw-search-pin', type: 'circle', source: 'search-pin',
      paint: { 'circle-radius': 7, 'circle-color': c.signal, 'circle-stroke-color': '#ffffff', 'circle-stroke-width': 2.5 },
    },
    {
      id: 'rw-zone-labels', type: 'symbol', source: 'zone-labels',
      layout: {
        ...vis(visible.zones), 'text-field': ['concat', 'Zone ', ['get', 'code'], ' · ', ['get', 'name']],
        'text-font': ['Noto Sans Bold'], 'text-size': 12, 'text-anchor': 'bottom-left', 'text-offset': [0.3, -0.3], 'text-max-width': 30,
      },
      paint: { 'text-color': c.sentinel, 'text-halo-color': c.labelHalo, 'text-halo-width': 1.4 },
    },
  ]
}

export function buildStyle({ theme, base, zoneImage, visible = DEFAULT_VISIBILITY, data = {}, liberty, threeD = false }: StyleOptions): StyleSpecification {
  const c = PALETTES[theme]
  const vis = (on: boolean) => ({ visibility: on ? ('visible' as const) : ('none' as const) })
  const useLiberty = base === 'streets' && liberty

  const sources: Record<string, SourceSpecification> = {
    openmaptiles: { type: 'vector', url: OMT_URL, attribution: '© OpenFreeMap © OpenStreetMap contributors' },
    esri: {
      type: 'raster',
      tiles: ['https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'],
      tileSize: 256, maxzoom: 19,
      attribution: 'Imagery © Esri, Maxar, Earthstar Geographics, and the GIS User Community',
    },
    eox: {
      type: 'raster',
      tiles: ['https://tiles.maps.eox.at/wmts/1.0.0/s2cloudless-2024_3857/default/g/{z}/{y}/{x}.jpg'],
      tileSize: 256, maxzoom: 14,
      attribution: 'Sentinel-2 cloudless 2024 by EOX IT Services GmbH (CC BY-NC-SA 4.0), contains modified Copernicus Sentinel data 2024',
    },
    dem: {
      type: 'raster-dem',
      tiles: ['https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png'],
      encoding: 'terrarium', tileSize: 256, maxzoom: 15,
      attribution: 'Terrain: AWS Terrain Tiles (Mapzen / SRTM / others)',
    },
    districts: { type: 'geojson', data: DATA.districts },
    zones: { type: 'geojson', data: DATA.zones },
    'zone-labels': { type: 'geojson', data: data.zoneLabels ?? EMPTY },
    abstain: { type: 'geojson', data: data.abstain ?? EMPTY },
    priority: { type: 'geojson', data: data.priority ?? EMPTY },
    predicted: { type: 'geojson', data: data.predicted ?? EMPTY },
    alerts: { type: 'geojson', data: data.alerts ?? EMPTY, promoteId: 'id' },
    'alert-points': { type: 'geojson', data: data.points ?? EMPTY, promoteId: 'id', cluster: true, clusterRadius: 44, clusterMaxZoom: 12 },
    draw: { type: 'geojson', data: data.draw ?? EMPTY },
    'search-pin': { type: 'geojson', data: EMPTY },
  }

  let baseLayers: LayerSpecification[]
  if (useLiberty) {
    for (const [k, v] of Object.entries(liberty.sources)) if (!(k in sources)) sources[k] = v
    baseLayers = (liberty.layers as LayerSpecification[])
      .filter((l) => !DROP_FROM_LIBERTY.has(l.id))
      // same realistic walls on the Streets map as on the imagery maps
      .map((l) => (l.type === 'fill-extrusion' ? ({ ...l, paint: { ...l.paint, 'fill-extrusion-color': BUILDING_COLOR, 'fill-extrusion-vertical-gradient': true } } as LayerSpecification) : l))
  } else {
    baseLayers = [
      { id: 'background', type: 'background', paint: { 'background-color': '#0b1220' } },
      { id: 'base-esri', type: 'raster', source: 'esri', layout: vis(base === 'satellite' || base === 's2' || base === 'streets') },
      { id: 'base-eox', type: 'raster', source: 'eox', layout: vis(base === 'eox') },
    ]
    if (zoneImage) {
      sources['rw-s2'] = { type: 'image', url: zoneImage.url, coordinates: zoneImage.corners }
      baseLayers.push({ id: 'rw-s2', type: 'raster', source: 'rw-s2', layout: vis(base === 's2'), paint: { 'raster-opacity': 1, 'raster-fade-duration': 250 } })
    }
    const hybrid = hybridLayers(c, vis, visible)
    const firstSymbol = hybrid.findIndex((l) => l.type === 'symbol')
    hybrid.splice(firstSymbol, 0, buildings3d(vis, threeD))  // buildings under the labels
    baseLayers.push(...hybrid)
  }

  return {
    version: 8,
    glyphs: useLiberty ? liberty.glyphs ?? GLYPHS : GLYPHS,
    sprite: useLiberty ? liberty.sprite ?? SPRITE : SPRITE,
    projection: { type: 'globe' },
    ...(threeD
      ? {
          terrain: { source: 'dem', exaggeration: 1.3 },
          // low warm afternoon sun from the south-west: lit and shaded walls read as real volumes
          light: { anchor: 'map', color: '#fff4e0', intensity: 0.42, position: [1.4, 215, 45] },
          sky: {
            'sky-color': '#6fa8dc', 'horizon-color': '#d6e6f5', 'fog-color': '#e8eef5',
            'sky-horizon-blend': 0.6, 'horizon-fog-blend': 0.7, 'fog-ground-blend': 0.25, 'atmosphere-blend': 0.6,
          },
        }
      : {}),
    sources,
    layers: [...baseLayers, ...overlayLayers(c, theme, vis, visible)],
  } as StyleSpecification
}

let libertyPromise: Promise<StyleSpecification> | null = null
/** Fetch the OpenFreeMap liberty style once per page load. */
export function loadLiberty(): Promise<StyleSpecification> {
  libertyPromise ??= fetch(LIBERTY_URL).then((r) => {
    if (!r.ok) throw new Error(`liberty style HTTP ${r.status}`)
    return r.json() as Promise<StyleSpecification>
  })
  libertyPromise.catch(() => (libertyPromise = null))
  return libertyPromise
}

/** Diagonal hatch for abstained tiles, drawn once per theme. */
export function hatchImage(theme: MapTheme) {
  const s = 12
  const cv = document.createElement('canvas')
  cv.width = cv.height = s
  const g = cv.getContext('2d')!
  g.strokeStyle = PALETTES[theme].abstain
  g.lineWidth = 2
  g.globalAlpha = 0.85
  for (const o of [-s, 0, s]) {
    g.beginPath()
    g.moveTo(o, s)
    g.lineTo(o + s, 0)
    g.stroke()
  }
  return g.getImageData(0, 0, s, s)
}
