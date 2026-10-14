/**
 * "Night Survey" / "Paper Survey" MapLibre styles (UI_PROMPT.md 3.4) on OpenFreeMap vector tiles
 * (OpenMapTiles schema). International (admin_level 2) boundaries are deliberately not drawn —
 * see DECISIONS.md ADR-018. Our own layers (imagery, alerts, zones) are part of the style so a
 * theme switch is a cheap style diff.
 */
import type { FeatureCollection } from 'geojson'
import type { ExpressionSpecification, LayerSpecification, StyleSpecification } from 'maplibre-gl'
import { DATA, type ZoneMeta } from '@/lib/data'

export type MapTheme = 'dark' | 'light'
export type BaseImagery = 'none' | 's2' | 'eox'

interface Palette {
  land: string
  water: string
  waterLine: string
  landcover: string
  urban: string
  line: string
  label: string
  labelHalo: string
  road: string
  hillshadeShadow: string
  hillshadeHighlight: string
  abstain: string
  signal: string
  sentinel: string
  priority: string
}

export const PALETTES: Record<MapTheme, Palette> = {
  dark: {
    land: '#0a0f1a',
    water: '#060b14',
    waterLine: '#13203a',
    landcover: '#0c1320',
    urban: '#101829',
    line: '#2a3854',
    label: '#8c99b0',
    labelHalo: '#05070c',
    road: '#9fb3c8',
    hillshadeShadow: '#000000',
    hillshadeHighlight: '#1e2940',
    abstain: '#6b7486',
    signal: '#ffb547',
    sentinel: '#4fd1e8',
    priority: '#ff5c6c',
  },
  light: {
    land: '#f2efe8',
    water: '#d9e3ea',
    waterLine: '#bccbd6',
    landcover: '#ebe7dc',
    urban: '#e6e1d6',
    line: '#c9c2b2',
    label: '#5a6478',
    labelHalo: '#f6f4ef',
    road: '#5c6f86',
    hillshadeShadow: '#8b8576',
    hillshadeHighlight: '#ffffff',
    abstain: '#8a92a0',
    signal: '#b86a00',
    sentinel: '#0b8ba3',
    priority: '#c02d3c',
  },
}

const NAME: ExpressionSpecification = ['coalesce', ['get', 'name:en'], ['get', 'name_en'], ['get', 'name']]

/** Road width by OpenMapTiles class, interpolated by zoom. */
function roadWidth(scale = 1): ExpressionSpecification {
  return [
    'interpolate',
    ['exponential', 1.6],
    ['zoom'],
    6,
    ['match', ['get', 'class'], ['motorway', 'trunk'], 0.8 * scale, 'primary', 0.5 * scale, 0.2 * scale],
    12,
    ['match', ['get', 'class'], ['motorway', 'trunk'], 2.4 * scale, 'primary', 1.8 * scale, 'secondary', 1.4 * scale, 'tertiary', 1.1 * scale, 0.6 * scale],
    16,
    ['match', ['get', 'class'], ['motorway', 'trunk'], 10 * scale, 'primary', 8 * scale, 'secondary', 6 * scale, 'tertiary', 5 * scale, 3 * scale],
  ]
}

export interface LayerVisibility {
  existing: boolean
  newRoads: boolean
  abstain: boolean
  priority: boolean
  zones: boolean
}

export const DEFAULT_VISIBILITY: LayerVisibility = { existing: true, newRoads: true, abstain: true, priority: true, zones: true }

const EMPTY: FeatureCollection = { type: 'FeatureCollection', features: [] }

export interface StyleData {
  alerts?: FeatureCollection
  points?: FeatureCollection
  abstain?: FeatureCollection
  priority?: FeatureCollection
  zoneLabels?: FeatureCollection
  draw?: FeatureCollection
}

export interface StyleOptions {
  theme: MapTheme
  meta?: ZoneMeta
  dateId: string
  base: BaseImagery
  visible?: LayerVisibility
  data?: StyleData
}

export function buildStyle({ theme, meta, dateId, base, visible = DEFAULT_VISIBILITY, data = {} }: StyleOptions): StyleSpecification {
  const c = PALETTES[theme]
  const vis = (on: boolean) => ({ visibility: on ? ('visible' as const) : ('none' as const) })
  const layers: LayerSpecification[] = [
    { id: 'background', type: 'background', paint: { 'background-color': c.land } },
    {
      id: 'landcover',
      type: 'fill',
      source: 'omt',
      'source-layer': 'landcover',
      filter: ['in', ['get', 'class'], ['literal', ['wood', 'forest', 'wetland']]],
      paint: { 'fill-color': c.landcover, 'fill-opacity': 0.8 },
    },
    {
      id: 'landuse-urban',
      type: 'fill',
      source: 'omt',
      'source-layer': 'landuse',
      filter: ['in', ['get', 'class'], ['literal', ['residential', 'commercial', 'industrial', 'retail']]],
      paint: { 'fill-color': c.urban, 'fill-opacity': ['interpolate', ['linear'], ['zoom'], 8, 0, 11, 0.9] },
    },
    {
      id: 'hillshade',
      type: 'hillshade',
      source: 'dem',
      paint: {
        'hillshade-exaggeration': theme === 'dark' ? 0.35 : 0.25,
        'hillshade-shadow-color': c.hillshadeShadow,
        'hillshade-highlight-color': c.hillshadeHighlight,
        'hillshade-accent-color': c.hillshadeShadow,
      },
    },
    { id: 'water', type: 'fill', source: 'omt', 'source-layer': 'water', paint: { 'fill-color': c.water } },
    {
      id: 'waterway',
      type: 'line',
      source: 'omt',
      'source-layer': 'waterway',
      paint: { 'line-color': c.waterLine, 'line-width': ['interpolate', ['linear'], ['zoom'], 8, 0.5, 14, 2] },
    },
    // Our imagery bases (only one visible at a time)
    {
      id: 'rw-eox',
      type: 'raster',
      source: 'eox',
      layout: { visibility: base === 'eox' ? 'visible' : 'none' },
      paint: { 'raster-opacity': 0.92, 'raster-saturation': -0.1 },
    },
    {
      id: 'rw-s2',
      type: 'raster',
      source: 'rw-s2',
      layout: { visibility: base === 's2' ? 'visible' : 'none' },
      paint: { 'raster-opacity': 1, 'raster-fade-duration': 250 },
    },
    {
      id: 'boundary-state',
      type: 'line',
      source: 'omt',
      'source-layer': 'boundary',
      filter: ['all', ['==', ['get', 'admin_level'], 4], ['!=', ['get', 'maritime'], 1]],
      paint: { 'line-color': c.line, 'line-width': ['interpolate', ['linear'], ['zoom'], 4, 0.6, 10, 1.4], 'line-dasharray': [3, 2] },
    },
    {
      id: 'rw-districts',
      type: 'line',
      source: 'districts',
      paint: { 'line-color': c.line, 'line-width': 1, 'line-opacity': ['interpolate', ['linear'], ['zoom'], 6, 0.6, 12, 0.3] },
    },
    // Existing roads (OpenStreetMap) in steel
    {
      id: 'roads-existing',
      type: 'line',
      source: 'omt',
      'source-layer': 'transportation',
      filter: ['in', ['get', 'class'], ['literal', ['motorway', 'trunk', 'primary', 'secondary', 'tertiary', 'minor', 'service', 'track']]],
      layout: { 'line-cap': 'round', 'line-join': 'round', ...vis(visible.existing) },
      paint: {
        'line-color': c.road,
        'line-width': roadWidth(),
        'line-opacity': ['interpolate', ['linear'], ['zoom'], 6, 0.45, 12, 0.6, 15, 0.7],
      },
    },
    // Unreliable tiles (abstain) — hatched, never colour alone
    {
      id: 'rw-abstain',
      type: 'fill',
      source: 'abstain',
      layout: vis(visible.abstain),
      paint: { 'fill-pattern': `hatch-${theme}`, 'fill-opacity': 0.9 },
    },
    {
      id: 'rw-abstain-line',
      type: 'line',
      source: 'abstain',
      layout: vis(visible.abstain),
      paint: { 'line-color': c.abstain, 'line-width': 1, 'line-dasharray': [2, 2] },
    },
    // Priority zones
    {
      id: 'rw-priority',
      type: 'fill',
      source: 'priority',
      layout: vis(visible.priority),
      paint: { 'fill-color': c.priority, 'fill-opacity': 0.08 },
    },
    {
      id: 'rw-priority-line',
      type: 'line',
      source: 'priority',
      layout: vis(visible.priority),
      paint: { 'line-color': c.priority, 'line-width': 1.5, 'line-dasharray': [3, 2] },
    },
    // High-res verification zones A/B/C
    {
      id: 'rw-zones',
      type: 'line',
      source: 'zones',
      layout: vis(visible.zones),
      paint: { 'line-color': c.sentinel, 'line-width': 1.2, 'line-opacity': 0.75, 'line-dasharray': [1, 2.5] },
    },
    // New roads: glow + crisp line. Pending alerts dashed, reviewed ones solid.
    {
      id: 'rw-new-glow',
      type: 'line',
      source: 'alerts',
      layout: { 'line-cap': 'round', 'line-join': 'round', ...vis(visible.newRoads) },
      paint: {
        'line-color': c.signal,
        'line-width': ['interpolate', ['linear'], ['zoom'], 8, 6, 14, 16],
        'line-blur': ['interpolate', ['linear'], ['zoom'], 8, 4, 14, 10],
        'line-opacity': ['case', ['boolean', ['feature-state', 'selected'], false], 0.65, 0.3],
      },
    },
    {
      id: 'rw-new',
      type: 'line',
      source: 'alerts',
      filter: ['!=', ['get', 'status'], 'pending'],
      layout: { 'line-cap': 'round', 'line-join': 'round', ...vis(visible.newRoads) },
      paint: {
        'line-color': c.signal,
        'line-width': ['interpolate', ['linear'], ['zoom'], 8, 1.6, 14, 4],
      },
    },
    {
      // pending review = dashed; reviewed = solid (colour is never the only signal)
      id: 'rw-new-pending',
      type: 'line',
      source: 'alerts',
      filter: ['==', ['get', 'status'], 'pending'],
      layout: { 'line-cap': 'butt', 'line-join': 'round', ...vis(visible.newRoads) },
      paint: {
        'line-color': c.signal,
        'line-width': ['interpolate', ['linear'], ['zoom'], 8, 1.6, 14, 4],
        'line-dasharray': [2, 1.2],
      },
    },
    {
      id: 'rw-alert-pulse',
      type: 'circle',
      source: 'alert-points',
      layout: vis(visible.newRoads),
      paint: {
        'circle-radius': 6,
        'circle-color': 'rgba(0,0,0,0)',
        'circle-stroke-color': ['match', ['get', 'priority'], 'high', c.priority, c.signal],
        'circle-stroke-width': 1.5,
        'circle-stroke-opacity': 0.8,
      },
    },
    {
      id: 'rw-alert-pt',
      type: 'circle',
      source: 'alert-points',
      layout: vis(visible.newRoads),
      paint: {
        'circle-radius': ['case', ['boolean', ['feature-state', 'selected'], false], 7, 5],
        'circle-color': ['match', ['get', 'priority'], 'high', c.priority, c.signal],
        'circle-stroke-color': c.labelHalo,
        'circle-stroke-width': 2,
      },
    },
    {
      id: 'rw-draw-fill',
      type: 'fill',
      source: 'draw',
      paint: { 'fill-color': c.sentinel, 'fill-opacity': 0.08 },
    },
    {
      id: 'rw-draw-line',
      type: 'line',
      source: 'draw',
      paint: { 'line-color': c.sentinel, 'line-width': 1.5, 'line-dasharray': [2, 1.5] },
    },
    {
      id: 'place-labels',
      type: 'symbol',
      source: 'omt',
      'source-layer': 'place',
      filter: ['in', ['get', 'class'], ['literal', ['state', 'city', 'town']]],
      layout: {
        'text-field': NAME,
        'text-font': ['Noto Sans Regular'],
        'text-size': ['match', ['get', 'class'], 'state', 12, 'city', 13, 11],
        'text-letter-spacing': ['match', ['get', 'class'], 'state', 0.18, 0.02],
        'text-transform': ['match', ['get', 'class'], 'state', 'uppercase', 'none'],
        'text-max-width': 8,
      },
      paint: { 'text-color': c.label, 'text-halo-color': c.labelHalo, 'text-halo-width': 1.4 },
    },
    {
      id: 'rw-zone-labels',
      type: 'symbol',
      source: 'zone-labels',
      layout: {
        ...vis(visible.zones),
        'text-field': ['concat', 'Zone ', ['get', 'code'], ' · ', ['get', 'name']],
        'text-font': ['Noto Sans Regular'],
        'text-size': 11,
        'text-anchor': 'bottom-left',
        'text-offset': [0.3, -0.3],
        'text-max-width': 30,
      },
      paint: { 'text-color': c.sentinel, 'text-halo-color': c.labelHalo, 'text-halo-width': 1.2 },
    },
  ]

  const coords = meta?.corners_lonlat ?? [
    [80.488, 16.671],
    [80.68, 16.671],
    [80.68, 16.44],
    [80.489, 16.439],
  ]

  return {
    version: 8,
    glyphs: 'https://tiles.openfreemap.org/fonts/{fontstack}/{range}.pbf',
    sources: {
      omt: { type: 'vector', url: 'https://tiles.openfreemap.org/planet', attribution: '© OpenFreeMap © OpenStreetMap contributors' },
      dem: {
        type: 'raster-dem',
        tiles: ['https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png'],
        encoding: 'terrarium',
        tileSize: 256,
        maxzoom: 12,
        attribution: 'Terrain Tiles (AWS Open Data)',
      },
      eox: {
        type: 'raster',
        tiles: ['https://tiles.maps.eox.at/wmts/1.0.0/s2cloudless_3857/default/g/{z}/{y}/{x}.jpg'],
        tileSize: 256,
        maxzoom: 15,
        attribution: 'Sentinel-2 cloudless 2016 by EOX IT Services GmbH (CC BY 4.0)',
      },
      'rw-s2': {
        type: 'image',
        url: DATA.zoneImage(dateId),
        coordinates: coords as [[number, number], [number, number], [number, number], [number, number]],
      },
      districts: { type: 'geojson', data: DATA.districts },
      zones: { type: 'geojson', data: DATA.zones },
      'zone-labels': { type: 'geojson', data: data.zoneLabels ?? EMPTY },
      abstain: { type: 'geojson', data: data.abstain ?? EMPTY },
      priority: { type: 'geojson', data: data.priority ?? EMPTY },
      alerts: { type: 'geojson', data: data.alerts ?? EMPTY, promoteId: 'id' },
      'alert-points': { type: 'geojson', data: data.points ?? EMPTY, promoteId: 'id' },
      draw: { type: 'geojson', data: data.draw ?? EMPTY },
    },
    layers,
  }
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
