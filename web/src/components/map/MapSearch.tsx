import type { GeoJSONSource, Map as MlMap } from 'maplibre-gl'
import { Loader2, MapPin, Search, X } from 'lucide-react'
import { useEffect, useId, useRef, useState } from 'react'
import { cn } from '@/lib/cn'
import { API, type SearchResult } from '@/lib/data'

/** Zoom to use when a result has no bounding box, by OSM place type. */
const ZOOM_BY_TYPE: Record<string, number> = {
  country: 4.5, state: 6.5, county: 9, district: 9, city: 11.5, town: 12.5, village: 14, suburb: 14,
  neighbourhood: 15, hamlet: 15, coordinates: 15, road: 16, street: 16, house: 18,
}

export function MapSearch({ map, className }: { map: MlMap | null; className?: string }) {
  const [q, setQ] = useState('')
  const [results, setResults] = useState<SearchResult[]>([])
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState(0)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const listId = useId()
  const reqRef = useRef(0)
  const boxRef = useRef<HTMLDivElement>(null)
  const picked = useRef(false) // a chosen result fills the box; don't search for it again

  // debounced search (>= 3 chars); results are biased towards the current map centre
  useEffect(() => {
    const term = q.trim()
    if (picked.current) {
      picked.current = false
      return
    }
    if (term.length < 3) {
      setResults([])
      setError(null)
      return
    }
    const id = ++reqRef.current
    const t = window.setTimeout(async () => {
      setLoading(true)
      try {
        const c = map?.getCenter()
        const r = await fetch(API.search(term, c ? { lng: c.lng, lat: c.lat } : undefined))
        const body = await r.json()
        if (id !== reqRef.current) return
        if (!r.ok) throw new Error(body?.detail ?? `HTTP ${r.status}`)
        setResults(body.results ?? [])
        setError((body.results ?? []).length ? null : 'No places found')
        setActive(0)
        setOpen(true)
      } catch (e) {
        if (id === reqRef.current) {
          setResults([])
          setError(e instanceof Error ? e.message : 'Search failed')
          setOpen(true)
        }
      } finally {
        if (id === reqRef.current) setLoading(false)
      }
    }, 450)
    return () => window.clearTimeout(t)
  }, [q, map])

  // close on outside click
  useEffect(() => {
    const onDown = (e: PointerEvent) => {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false)
    }
    window.addEventListener('pointerdown', onDown)
    return () => window.removeEventListener('pointerdown', onDown)
  }, [])

  const go = (r: SearchResult) => {
    setOpen(false)
    picked.current = true
    setQ(r.name)
    if (!map) return
    const pin = map.getSource('search-pin') as GeoJSONSource | undefined
    pin?.setData({ type: 'FeatureCollection', features: [{ type: 'Feature', properties: { name: r.name }, geometry: { type: 'Point', coordinates: r.center } }] })
    const [w, s, e, n] = r.bbox ?? [0, 0, 0, 0]
    const tiny = !r.bbox || (Math.abs(e - w) < 1e-4 && Math.abs(n - s) < 1e-4)
    if (tiny) {
      map.flyTo({ center: r.center, zoom: ZOOM_BY_TYPE[r.type ?? ''] ?? 14, duration: 1800, essential: true })
    } else {
      map.fitBounds([[w, s], [e, n]], { padding: 80, maxZoom: 17, duration: 1800, essential: true })
    }
  }

  const clear = () => {
    setQ('')
    setResults([])
    setOpen(false)
    ;(map?.getSource('search-pin') as GeoJSONSource | undefined)?.setData({ type: 'FeatureCollection', features: [] })
  }

  return (
    <div ref={boxRef} className={cn('relative w-full max-w-[420px]', className)}>
      <div className="flex h-11 items-center gap-2 rounded-card border border-line bg-bg0/90 px-3 shadow-[var(--shadow-panel)] backdrop-blur-md focus-within:border-sentinel/70">
        {loading ? <Loader2 className="size-4 shrink-0 animate-spin text-muted" aria-hidden /> : <Search className="size-4 shrink-0 text-muted" strokeWidth={1.75} aria-hidden />}
        <input
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onFocus={() => results.length && setOpen(true)}
          onKeyDown={(e) => {
            if (e.key === 'ArrowDown') {
              e.preventDefault()
              setActive((a) => Math.min(a + 1, results.length - 1))
            } else if (e.key === 'ArrowUp') {
              e.preventDefault()
              setActive((a) => Math.max(a - 1, 0))
            } else if (e.key === 'Enter' && results[active]) {
              e.preventDefault()
              go(results[active])
            } else if (e.key === 'Escape') {
              setOpen(false)
            }
          }}
          placeholder="Search any place, or lat, lon"
          aria-label="Search places"
          role="combobox"
          aria-expanded={open}
          aria-controls={listId}
          aria-autocomplete="list"
          className="h-full min-w-0 flex-1 bg-transparent text-[14px] text-fg placeholder:text-muted focus:outline-none [&::-webkit-search-cancel-button]:hidden"
        />
        {q && (
          <button type="button" onClick={clear} aria-label="Clear search" className="rounded-[6px] p-1 text-muted hover:text-fg">
            <X className="size-4" strokeWidth={1.75} />
          </button>
        )}
      </div>
      {open && (results.length > 0 || error) && (
        <ul id={listId} role="listbox" className="absolute top-12 right-0 left-0 z-40 max-h-[60vh] overflow-y-auto rounded-card border border-line-strong bg-surface p-1 shadow-[var(--shadow-panel)]">
          {error && results.length === 0 && <li className="px-3 py-2.5 text-[13px] text-muted">{error}</li>}
          {results.map((r, i) => (
            <li key={`${r.label}-${i}`} role="option" aria-selected={i === active}>
              <button
                type="button"
                onMouseEnter={() => setActive(i)}
                onClick={() => go(r)}
                className={cn('flex w-full items-start gap-2.5 rounded-[8px] px-2.5 py-2 text-left', i === active && 'bg-surface2')}
              >
                <MapPin className="mt-0.5 size-4 shrink-0 text-signal" strokeWidth={1.75} aria-hidden />
                <span className="min-w-0">
                  <span className="block truncate text-[14px] text-fg">{r.name}</span>
                  <span className="block truncate text-[12px] text-muted">
                    {r.label}
                    {r.type ? ` · ${r.type}` : ''}
                  </span>
                </span>
              </button>
            </li>
          ))}
          <li className="px-3 pt-1.5 pb-1 text-[10.5px] text-muted">Search © OpenStreetMap contributors (Photon / Nominatim)</li>
        </ul>
      )}
    </div>
  )
}
