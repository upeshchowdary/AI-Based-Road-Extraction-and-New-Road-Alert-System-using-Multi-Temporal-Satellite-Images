import type { LngLat, ZoneMeta } from './data'

/**
 * lon/lat → zone image pixel. The image is a UTM-aligned grid; over 20 km an affine map from
 * three corners is accurate to well under a pixel.
 */
export function zoneProjector(meta: ZoneMeta) {
  const [tl, tr, , bl] = meta.corners_lonlat
  const [W, H] = meta.size_px
  const ex = [tr[0] - tl[0], tr[1] - tl[1]]
  const ey = [bl[0] - tl[0], bl[1] - tl[1]]
  const det = ex[0] * ey[1] - ex[1] * ey[0]
  return ([lon, lat]: LngLat): [number, number] => {
    const dx = lon - tl[0]
    const dy = lat - tl[1]
    const u = (dx * ey[1] - dy * ey[0]) / det
    const v = (ex[0] * dy - ex[1] * dx) / det
    return [u * W, v * H]
  }
}

/** Square crop (image px) around a line, or null if the line is outside the zone image. */
export function cropAround(meta: ZoneMeta, coords: LngLat[], minSize = 200, pad = 60) {
  const P = zoneProjector(meta)
  const pts = coords.map(P)
  const [W, H] = meta.size_px
  if (pts.some(([x, y]) => x < 0 || y < 0 || x > W || y > H)) return null
  const xs = pts.map((p) => p[0])
  const ys = pts.map((p) => p[1])
  const cx = (Math.min(...xs) + Math.max(...xs)) / 2
  const cy = (Math.min(...ys) + Math.max(...ys)) / 2
  const size = Math.min(Math.min(W, H), Math.max(minSize, Math.max(...xs) - Math.min(...xs) + pad * 2, Math.max(...ys) - Math.min(...ys) + pad * 2))
  const x = Math.min(W - size, Math.max(0, cx - size / 2))
  const y = Math.min(H - size, Math.max(0, cy - size / 2))
  return { x, y, size, path: 'M' + pts.map(([px, py]) => `${px.toFixed(1)},${py.toFixed(1)}`).join('L') }
}
