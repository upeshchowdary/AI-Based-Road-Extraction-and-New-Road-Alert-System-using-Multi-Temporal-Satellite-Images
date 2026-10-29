import { useState } from 'react'
import { SwipeDivider } from '@/components/map/SwipeDivider'
import { EmptyState } from '@/components/ui/States'
import type { AlertSharp, SharpImage } from '@/lib/data'

/**
 * Sub-metre before / after from Esri World Imagery Wayback: the web-mercator tiles around the alert,
 * stitched with plain <img> (no map library), the alert drawn on top in the same pixel space.
 * Imagery is for people to judge the alert; detection itself uses Sentinel-2 (ADR-029).
 */
const TILE = 256

function lonLatToPx(lon: number, lat: number, z: number): [number, number] {
  const n = TILE * 2 ** z
  const s = Math.sin((lat * Math.PI) / 180)
  return [((lon + 180) / 360) * n, (0.5 - Math.log((1 + s) / (1 - s)) / (4 * Math.PI)) * n]
}

/** Zoom so the alert plus a margin fits ~1024 px, between z15 (~4.5 m/px) and z19 (~0.3 m/px). */
function frame(bbox: AlertSharp['bbox']) {
  const [x0, y0, x1, y1] = bbox
  const lat = (y0 + y1) / 2
  const spanM = Math.max((x1 - x0) * 111_320 * Math.cos((lat * Math.PI) / 180), (y1 - y0) * 110_540, 150) * 1.6
  const mPerPxZ0 = (156_543 * Math.cos((lat * Math.PI) / 180))
  const z = Math.max(15, Math.min(19, Math.floor(Math.log2((1024 * mPerPxZ0) / spanM))))
  const [ax, ay] = lonLatToPx(x0, y1, z)
  const [bx, by] = lonLatToPx(x1, y0, z)
  const cx = (ax + bx) / 2
  const cy = (ay + by) / 2
  const half = Math.max(bx - ax, by - ay, 150 / (mPerPxZ0 / 2 ** z)) * 0.8
  return { z, left: cx - half, top: cy - half, size: half * 2, mPerPx: mPerPxZ0 / 2 ** z }
}

function Mosaic({ img, f }: { img: SharpImage; f: ReturnType<typeof frame> }) {
  const tiles = []
  for (let ty = Math.floor(f.top / TILE); ty <= Math.floor((f.top + f.size) / TILE); ty++)
    for (let tx = Math.floor(f.left / TILE); tx <= Math.floor((f.left + f.size) / TILE); tx++)
      tiles.push(
        <image
          key={`${tx}-${ty}`}
          href={img.tiles.replace('{level}', String(f.z)).replace('{row}', String(ty)).replace('{col}', String(tx))}
          x={tx * TILE - f.left}
          y={ty * TILE - f.top}
          width={TILE}
          height={TILE}
        />,
      )
  return <>{tiles}</>
}

function Pane({ img, f, path, outline, label }: { img: SharpImage; f: ReturnType<typeof frame>; path: string; outline: boolean; label: string }) {
  return (
    <svg viewBox={`0 0 ${f.size} ${f.size}`} preserveAspectRatio="xMidYMid slice" className="absolute inset-0 size-full bg-surface2" role="img" aria-label={label}>
      <Mosaic img={img} f={f} />
      {outline && (
        <>
          <path d={path} fill="none" stroke="#fff" strokeOpacity={0.9} strokeWidth={6} strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
          <path d={path} fill="none" stroke="#f76707" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" strokeDasharray="8 5" vectorEffect="non-scaling-stroke" />
        </>
      )}
    </svg>
  )
}

const tag = (role: string, im: SharpImage) =>
  `${role} · captured ${im.captured ?? 'unknown'}${im.res_m ? ` · ${im.res_m} m` : ''}${im.provider ? ` · ${im.provider}` : ''}`

export function SharpEvidence({ sharp, lines, side }: { sharp: AlertSharp; lines: [number, number][][]; side: boolean }) {
  const [pos, setPos] = useState(50)
  const [outlineBefore, setOutlineBefore] = useState(false)
  const { before, after } = sharp
  if (!before || !after)
    return <EmptyState className="h-full" title="No sharp imagery here" body={`Esri has no image captured before ${sharp.baseline_end} at this place, so only the Sentinel-2 evidence is available.`} />
  const f = frame(sharp.bbox)
  const path = lines
    .map((line) => 'M' + line.map(([lon, lat]) => { const [x, y] = lonLatToPx(lon, lat, f.z); return `${(x - f.left).toFixed(1)},${(y - f.top).toFixed(1)}` }).join('L'))
    .join(' ')
  const caption = (
    <span className="t-mono pointer-events-none absolute right-3 bottom-3 max-w-[calc(100%-1.5rem)] truncate rounded-chip bg-surface/90 px-2 py-0.5 text-[10px] text-muted">
      {sharp.attribution} · {Math.round((f.size * f.mPerPx) / 10) * 10} m across · visual reference only
    </span>
  )
  const toggle = (
    // phones: below the two date labels, which take the whole top edge there
    <label className="absolute top-3 right-3 flex items-center gap-1.5 rounded-chip bg-surface/90 px-2 py-1 text-[11px] text-fg max-sm:top-12">
      <input type="checkbox" checked={outlineBefore} onChange={(e) => setOutlineBefore(e.target.checked)} /> Outline on before
    </label>
  )
  if (side)
    return (
      <div className="grid h-full grid-cols-2 gap-px bg-line">
        {[before, after].map((im, i) => (
          <div key={im.release_num} className="relative overflow-hidden">
            <Pane img={im} f={f} path={path} outline={i === 1 || outlineBefore} label={tag(i ? 'After' : 'Before', im)} />
            <span className="absolute top-3 left-3 rounded-chip bg-surface/90 px-2 py-1 text-[11px] text-fg">{tag(i ? 'After' : 'Before', im)}</span>
            {i === 0 && toggle}
          </div>
        ))}
      </div>
    )
  return (
    <div className="relative h-full overflow-hidden">
      <Pane img={before} f={f} path={path} outline={outlineBefore} label={tag('Before', before)} />
      <div className="absolute inset-0" style={{ clipPath: `inset(0 0 0 ${pos}%)` }}>
        <Pane img={after} f={f} path={path} outline label={tag('After', after)} />
      </div>
      <SwipeDivider pos={pos} onChange={setPos} beforeLabel={before.captured ?? 'before'} afterLabel={after.captured ?? 'after'} className="[&>span]:!top-3" />
      {toggle}
      {caption}
    </div>
  )
}
