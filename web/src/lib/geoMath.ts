import type { LngLat } from './data'

const R = 6371.0088
const rad = (d: number) => (d * Math.PI) / 180

export function haversineKm([lon1, lat1]: LngLat, [lon2, lat2]: LngLat) {
  const dLat = rad(lat2 - lat1)
  const dLon = rad(lon2 - lon1)
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(rad(lat1)) * Math.cos(rad(lat2)) * Math.sin(dLon / 2) ** 2
  return 2 * R * Math.asin(Math.sqrt(a))
}

export type Box = [number, number, number, number] // minLon, minLat, maxLon, maxLat

export function boxAreaKm2([x0, y0, x1, y1]: Box) {
  return haversineKm([x0, (y0 + y1) / 2], [x1, (y0 + y1) / 2]) * haversineKm([x0, y0], [x0, y1])
}

export const inBox = ([x, y]: LngLat, [x0, y0, x1, y1]: Box) => x >= x0 && x <= x1 && y >= y0 && y <= y1

/** Length of a polyline inside a box, counting segments by their midpoint (good to a segment). */
export function lengthInBoxKm(coords: LngLat[], b: Box) {
  let km = 0
  for (let i = 1; i < coords.length; i++) {
    const m: LngLat = [(coords[i - 1][0] + coords[i][0]) / 2, (coords[i - 1][1] + coords[i][1]) / 2]
    if (inBox(m, b)) km += haversineKm(coords[i - 1], coords[i])
  }
  return km
}

/** Ray-casting point-in-polygon on the outer ring. */
export function inPolygon([x, y]: LngLat, ring: LngLat[]) {
  let inside = false
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i]
    const [xj, yj] = ring[j]
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside
  }
  return inside
}

export function polygonAreaKm2(ring: LngLat[]) {
  // equirectangular approximation around the ring's mean latitude
  const lat0 = rad(ring.reduce((s, p) => s + p[1], 0) / ring.length)
  let a = 0
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [x1, y1] = [rad(ring[j][0]) * Math.cos(lat0) * R, rad(ring[j][1]) * R]
    const [x2, y2] = [rad(ring[i][0]) * Math.cos(lat0) * R, rad(ring[i][1]) * R]
    a += x1 * y2 - x2 * y1
  }
  return Math.abs(a / 2)
}
