import { useEffect, useRef, useState } from 'react'
import { TimeScrubber } from '@/components/map/TimeScrubber'
import { Switch } from '@/components/ui/Switch'
import { cn } from '@/lib/cn'
import { DATA, useJson, type ZoneMeta } from '@/lib/data'
import { useReducedMotion } from '@/lib/motionPref'
import { zoneProjector } from '@/lib/zoneProject'

/** What a person can see at the bypass crossing in each composite (visual reading, not a model output). */
const SEEN: Record<string, string> = {
  '2022_pre_monsoon': 'Earthwork north of the river; bridge piers in the channel.',
  '2022_post_monsoon': 'Part of the bridge deck is visible across the water.',
  '2023_pre_monsoon': 'The bridge spans most of the river.',
  '2023_post_monsoon': 'Bridge complete; approach roads cleared on both banks.',
  '2024_pre_monsoon': 'The full corridor is visible north and south of the Krishna.',
  '2024_post_monsoon': 'The river runs high after the monsoon; the deck is still bright new concrete.',
  '2025_pre_monsoon': 'The deck has darkened: it has been surfaced and joins the roads on both banks.',
  '2025_post_monsoon': 'The darker surface persists across the river and along both approaches.',
  '2026_pre_monsoon': 'Newest composite: a grid of new plot boundaries appears south-west of the bypass.',
}

/** Reproject the zone's OSM GeoJSON into image pixels (2048×2560, UTM-aligned) for the SVG overlay. */
function useZonePaths(meta: ZoneMeta | undefined, enabled: boolean) {
  const roads = useJson<GeoJSON.FeatureCollection<GeoJSON.LineString | GeoJSON.MultiLineString>>(enabled ? DATA.zoneRoads : null).data
  const ref = useJson<GeoJSON.FeatureCollection<GeoJSON.LineString | GeoJSON.MultiLineString>>(enabled ? DATA.zoneNewRef : null).data
  const [paths, setPaths] = useState<{ major: string; minor: string; fresh: string } | null>(null)
  useEffect(() => {
    if (!meta || !roads || !ref) return
    const P = zoneProjector(meta)
    const px = (lon: number, lat: number) => P([lon, lat]).map((v) => v.toFixed(1)).join(',')
    const toD = (fc: typeof roads, keep: (c: string) => boolean) => {
      let d = ''
      for (const f of fc.features) {
        if (!keep(String(f.properties?.c))) continue
        const lines = f.geometry.type === 'LineString' ? [f.geometry.coordinates] : f.geometry.coordinates
        for (const l of lines) d += 'M' + l.map(([x, y]) => px(x, y)).join('L')
      }
      return d
    }
    setPaths({
      major: toD(roads, (c) => c === 'major' || c === 'secondary'),
      minor: toD(roads, (c) => c === 'minor'),
      fresh: toD(ref, () => true),
    })
  }, [meta, roads, ref])
  return paths
}

export function Timelapse() {
  const meta = useJson<ZoneMeta>(DATA.zoneMeta).data
  const reduced = useReducedMotion()
  const [i, setI] = useState(0)
  const [playing, setPlaying] = useState(false)
  const [showRoads, setShowRoads] = useState(false)
  const [showNew, setShowNew] = useState(false)
  const [near, setNear] = useState(false)
  const sec = useRef<HTMLElement>(null)
  useEffect(() => {
    const io = new IntersectionObserver(([e]) => e.isIntersecting && setNear(true), { rootMargin: '600px' })
    if (sec.current) io.observe(sec.current)
    return () => io.disconnect()
  }, [])
  const paths = useZonePaths(meta, near)
  const dates = meta?.dates ?? []
  const d = dates[i]
  const newVisible = showNew

  return (
    <section ref={sec} aria-labelledby="tl-title" className="section-y border-t border-line bg-bg0">
      <div className="container-rw grid gap-12 lg:grid-cols-12">
        <div className="lg:col-span-5 lg:pt-6">
          <h2 id="tl-title" className="t-h1 text-fg">
            Watch Vijayawada grow
          </h2>
          <p className="t-lead mt-5 text-muted">
            Nine seasonal Sentinel-2 composites of zone A, 2022 to 2026. Drag through them and watch a highway cross the Krishna.
          </p>

          <div className="mt-10 rounded-card border border-line bg-surface p-5">
            <div className="flex items-baseline justify-between gap-4">
              <p className="text-[19px] font-medium text-fg" aria-live="polite">
                {d?.label ?? '—'}
              </p>
              <p className="t-mono text-[12px] text-muted">{d ? `${d.scenes} scenes · median` : ''}</p>
            </div>
            <p className="mt-2 min-h-[3em] text-[14px] leading-snug text-muted">
              {d && SEEN[d.id]} <span className="text-[12px]">(visual reading)</span>
            </p>
            <TimeScrubber dates={dates} index={i} onChange={setI} playing={playing} onPlayingChange={reduced ? undefined : setPlaying} label="Composite date" className="mt-4" />
            <div className="mt-5 space-y-3 border-t border-line pt-4">
              <label className="flex items-center justify-between gap-4 text-[14px] text-fg">
                <span className="flex items-center gap-2.5">
                  <span className="h-0.5 w-5 rounded bg-signal" aria-hidden />
                  New road (OpenStreetMap reference)
                </span>
                <Switch checked={showNew} onCheckedChange={setShowNew} label="Show new road" />
              </label>
              <label className="flex items-center justify-between gap-4 text-[14px] text-fg">
                <span className="flex items-center gap-2.5">
                  <span className="h-0.5 w-5 rounded bg-steel" aria-hidden />
                  Existing roads (OSM, 2026 snapshot)
                </span>
                <Switch checked={showRoads} onCheckedChange={setShowRoads} label="Show existing roads" />
              </label>
            </div>
            <dl className="mt-5 grid grid-cols-2 gap-4 border-t border-line pt-4">
              <div>
                <dt className="text-[12px] text-muted">New road km detected</dt>
                <dd className="mt-1 text-[14px] text-fg">After evaluation</dd>
              </div>
              <div>
                <dt className="text-[12px] text-muted">Alerts raised</dt>
                <dd className="mt-1 text-[14px] text-fg">After evaluation</dd>
              </div>
            </dl>
          </div>
        </div>

        <div className="lg:col-span-7">
          <div className="relative mx-auto aspect-[4/5] max-h-[86vh] overflow-hidden rounded-panel border border-line-strong/80 bg-[#06080e] shadow-[0_20px_50px_rgba(0,0,0,0.6)]">
            {near && meta && (
              <svg viewBox={`0 0 ${meta.size_px[0]} ${meta.size_px[1]}`} preserveAspectRatio="xMidYMid slice" className="absolute inset-0 size-full" role="img" aria-label={`Sentinel-2 composite of zone A, ${d?.label}`}>
                <defs>
                  <filter id="tl-amber-glow" x="-30%" y="-30%" width="160%" height="160%">
                    <feGaussianBlur stdDeviation="8" />
                  </filter>
                </defs>
                {dates.map((dt, k) => (
                  <image
                    key={dt.id}
                    href={DATA.zoneImage(dt.id)}
                    width={meta.size_px[0]}
                    height={meta.size_px[1]}
                    className="transition-opacity duration-700"
                    opacity={k === i ? 1 : 0}
                  />
                ))}
                {paths && (
                  <>
                    <g fill="none" stroke="#9fb3c8" strokeLinecap="round" className={cn('transition-opacity duration-500', showRoads ? 'opacity-100' : 'opacity-0')}>
                      <path d={paths.minor} strokeWidth="1.1" strokeOpacity="0.45" />
                      <path d={paths.major} strokeWidth="2.4" strokeOpacity="0.9" />
                    </g>
                    {newVisible && (
                      <path
                        d={paths.fresh}
                        fill="none"
                        stroke="#ffb547"
                        strokeWidth="16"
                        strokeOpacity="0.4"
                        filter="url(#tl-amber-glow)"
                        className="transition-opacity duration-500"
                      />
                    )}
                    <path d={paths.fresh} fill="none" stroke="#ffb547" strokeWidth="4.5" strokeLinecap="round" className={cn('transition-opacity duration-500', newVisible ? 'opacity-100' : 'opacity-0')} />
                  </>
                )}
              </svg>
            )}
            {/* Corner brackets HUD */}
            <div aria-hidden className="pointer-events-none absolute inset-3">
              {(['top-0 left-0 border-t border-l', 'top-0 right-0 border-t border-r', 'bottom-0 left-0 border-b border-l', 'bottom-0 right-0 border-b border-r'] as const).map((c) => (
                <span key={c} className={cn('absolute size-3 border-sentinel/50', c)} />
              ))}
            </div>
            <div className="t-mono pointer-events-none absolute bottom-4 left-4 rounded-chip border border-white/10 bg-[#05070c]/80 px-2.5 py-1 text-[11px] text-[#e8edf5]/80 backdrop-blur-md">
              {meta?.attribution.split('·')[0]}
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
