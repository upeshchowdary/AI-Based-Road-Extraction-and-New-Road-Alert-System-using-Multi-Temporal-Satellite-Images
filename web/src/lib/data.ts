/**
 * Static data loader. The UI is not wired to the backend yet (UI-only build):
 * everything comes from web/public/data, produced by scripts/build_web_data.py.
 * Files under data/demo/ are demo data and every screen that shows them says so.
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
  width_m: number
  district: string
  score: number
  factors: { model: number; persistence: number; connectivity: number; quality: number }
  stage: Stage
  surface: 'paved' | 'unpaved'
  status: AlertStatus
  priority: AlertPriority
  first_seen: string
  persistence: Seen[]
  sensor: string
  featured?: boolean
  name?: string
}

export interface AlertsFile {
  demo: true
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
  ap: '/data/boundaries/ap.json',
  apGlobe: '/data/boundaries/ap_globe.json',
  districts: '/data/boundaries/districts.json',
  zones: '/data/boundaries/zones.json',
  pilotRoads: '/data/pilot/roads_major.json',
  demoAlerts: '/data/demo/alerts.json',
  runLog: '/data/system/run_log.json',
  abstain: '/data/quality/abstain.json',
  quality: '/data/quality/summary.json',
} as const

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
