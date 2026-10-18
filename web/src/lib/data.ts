/**
 * Data loader. Live project data comes from the RoadWatch API (FastAPI, `uv run roadwatch serve`;
 * Vite proxies /api in dev). The home-page story assets (hero images, zone-A snapshot) are still
 * static files in web/public/data produced by scripts/build_web_data.py.
 * Alerts come from RoadWatch change detection; without its output the API serves a demo set flagged `demo: true`.
 */
import { useCallback, useEffect, useState } from 'react'

export type LngLat = [number, number]

export interface DateInfo {
  id: string
  label: string
  month: string
  image?: string
  scenes?: number
}

export interface ZoneMeta {
  name: string
  tile_ids: string[]
  crs: string
  resolution_m: number
  size_px: [number, number]
  corners_lonlat: [LngLat, LngLat, LngLat, LngLat]
  center_lonlat: LngLat
  hero: { crop_px: [number, number, number, number]; center_lonlat: LngLat; pixeldiff_blobs: number }
  dates: DateInfo[]
  pixeldiff: { before: string; after: string; method: string; threshold: number; min_blob_px: number; blobs: number }
  reference_new_road: { name: string; source: string; length_km_in_zone: number }
  attribution: string
}

export interface HeroPaths {
  size: number
  existing: { c: 'major' | 'secondary' | 'minor'; d: string }[]
  new: { c: 'new'; d: string }[]
}

export type AlertStatus = 'pending' | 'accepted' | 'rejected' | 'flagged'
export type AlertPriority = 'high' | 'normal' | 'low'
export type Stage = 'cleared' | 'earthwork' | 'gravel' | 'paved'
export type Seen = 'absent' | 'seen' | 'abstain'

export interface DemoAlert {
  id: string
  geometry: { type: 'LineString'; coordinates: LngLat[] }
  length_km: number
  width_m: number | null
  district: string
  score: number
  factors: { model: number; persistence: number; connectivity: number; quality: number }
  stage: Stage | null
  surface: 'paved' | 'unpaved' | null
  status: AlertStatus
  priority: AlertPriority
  first_seen: string
  /** one entry per date in the file's `dates`; null = that date was not analysed for this alert */
  persistence: (Seen | null)[]
  scope?: 'pilot zone' | 'statewide'
  block?: string
  sensor: string
  featured?: boolean
  /** false for real RoadWatch alerts (roadwatch detect); demo alerts omit it */
  demo?: boolean
  zone?: string
  name?: string
}

export interface AlertsFile {
  demo: boolean
  model_id?: string
  generated_utc?: string
  note: string
  dates: DateInfo[]
  alerts: DemoAlert[]
}

export interface RunLogRow {
  run_id: string
  person: string
  notebook: string
  config_hash: string
  start_utc: string
  end_utc: string
  gpu_hours: string
  result: string
}

export const DATA = {
  zoneMeta: '/data/zoneA/meta.json',
  heroPaths: '/data/zoneA/hero_paths.json',
  zoneRoads: '/data/zoneA/roads_existing.json',
  zoneNewRef: '/data/zoneA/road_new_reference.json',
  zoneImage: (dateId: string) => `/data/zoneA/s2_${dateId}.webp`,
  heroImage: (dateId: '2022_pre_monsoon' | '2024_pre_monsoon') => `/data/zoneA/hero_${dateId}.webp`,
  heroPixelDiff: '/data/zoneA/hero_pixeldiff.png',
  zonePixelDiff: '/data/zoneA/pixeldiff.png',
  ap: '/api/boundaries/ap',
  apGlobe: '/data/boundaries/ap_globe.json',
  districts: '/api/boundaries/districts',
  zones: '/api/zones',
  pilotRoads: '/data/pilot/roads_major.json',
  demoAlerts: '/api/alerts',
  runLog: '/api/runs/log',
  abstain: '/api/quality/abstain',
  quality: '/api/quality/summary',
} as const

/** Live API endpoints (see src/roadwatch/api/app.py). */
export const API = {
  health: '/api/health',
  kpis: '/api/kpis',
  runs: '/api/runs',
  search: (q: string, near?: { lng: number; lat: number }) =>
    `/api/search?q=${encodeURIComponent(q)}${near ? `&lat=${near.lat.toFixed(2)}&lon=${near.lng.toFixed(2)}` : ''}`,
  zoneSeasons: (code: string) => `/api/imagery/zones/${code}/seasons`,
  zoneImageMeta: (code: string, season: string) => `/api/imagery/zones/${code}/${season}/meta`,
  predicted: (code: string, season: string) => `/api/roads/predicted?zone=${code}&season=${season}`,
  predictedIndex: '/api/roads/predicted/index',
  alertEvidence: (id: string) => `/api/alerts/${encodeURIComponent(id)}/evidence`,
  reviews: '/api/reviews',
  reviewLabels: '/api/reviews/labels.geojson',
} as const

/** Image chips around one alert, one per season (GET /api/alerts/{id}/evidence). */
export interface AlertEvidence {
  id: string
  zone: string
  first_seen: string | null
  m_per_px: number
  attribution: string
  chips: { season: string; state: 'seen' | 'absent' | 'abstain' | null; size_px: number; path: string; image: string }[]
}

export interface SearchResult {
  name: string
  label: string
  type?: string
  center: LngLat
  bbox: [number, number, number, number] | null
  source: string
}

export interface ZoneSeason {
  id: string
  label: string
  year: number
  tiles: number
  of: number
  unreliable_tiles: number
}

export interface ZoneImageMeta {
  zone: string
  season: string
  corners_lonlat: [LngLat, LngLat, LngLat, LngLat]
  valid_fraction: number
  scenes: string[]
  image: string
  attribution: string
}

const cache = new Map<string, Promise<unknown>>()

export function fetchJson<T>(url: string): Promise<T> {
  let p = cache.get(url) as Promise<T> | undefined
  if (!p) {
    p = fetch(url).then((r) => {
      if (!r.ok) throw new Error(`${url} → HTTP ${r.status}`)
      return r.json() as Promise<T>
    })
    p.catch(() => cache.delete(url))
    cache.set(url, p)
  }
  return p
}

export interface Resource<T> {
  data?: T
  error?: Error
  loading: boolean
  retry: () => void
}

export function useJson<T>(url: string | null): Resource<T> {
  const [state, setState] = useState<{ data?: T; error?: Error; loading: boolean }>({ loading: Boolean(url) })
  const [nonce, setNonce] = useState(0)
  useEffect(() => {
    if (!url) return
    let live = true
    setState((s) => ({ data: s.data, loading: true }))
    fetchJson<T>(url).then(
      (data) => live && setState({ data, loading: false }),
      (error: Error) => live && setState({ error, loading: false }),
    )
    return () => {
      live = false
    }
  }, [url, nonce])
  const retry = useCallback(() => {
    if (url) cache.delete(url)
    setNonce((n) => n + 1)
  }, [url])
  return { ...state, retry }
}

/** Preload files and report real progress (used by the preloader). */
export function preload(urls: string[], onProgress: (done: number, total: number) => void): Promise<void> {
  let done = 0
  const total = urls.length
  onProgress(0, total)
  return Promise.all(
    urls.map((u) =>
      (u.endsWith('.json') ? fetchJson(u) : fetch(u).then((r) => r.blob()))
        .catch(() => undefined)
        .then(() => onProgress(++done, total)),
    ),
  ).then(() => undefined)
}
