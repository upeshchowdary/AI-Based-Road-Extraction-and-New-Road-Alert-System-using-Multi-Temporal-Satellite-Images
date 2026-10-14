const D2R = Math.PI / 180
export const EARTH_R_KM = 6371
/** Sentinel-2 orbit altitude — the hero dive ends here. */
export const S2_ALT_KM = 786

/**
 * Unit-sphere position for a lat/lon, matching three.js SphereGeometry UVs with an
 * equirectangular texture (u=0 at lon -180). Plain tuple so this module stays three-free
 * (it is shared with the HUD on the critical path).
 */
export function latLonToXYZ(lat: number, lon: number, r = 1): [number, number, number] {
  const la = lat * D2R
  const lo = lon * D2R
  return [r * Math.cos(la) * Math.cos(lo), r * Math.sin(la), -r * Math.cos(la) * Math.sin(lo)]
}

/** Globe Euler rotation (order XYZ) that puts (lat, lon) facing the +Z camera. */
export function facing(lat: number, lon: number): [number, number] {
  return [lat * D2R, -Math.PI / 2 - lon * D2R]
}

/** Inverse of facing(): sub-camera lat/lon from the globe rotation. */
export function subCameraPoint(rotX: number, rotY: number) {
  const lat = rotX / D2R
  let lon = (-Math.PI / 2 - rotY) / D2R
  lon = ((((lon + 180) % 360) + 360) % 360) - 180
  return { lat, lon }
}

/** Shortest-path angle interpolation in degrees. */
export function lerpLon(a: number, b: number, t: number) {
  const d = ((((b - a) % 360) + 540) % 360) - 180
  return a + d * t
}

/**
 * Approximate subsolar point for a UTC date (good to ~1°), so the day/night terminator
 * on the globe is the real one for the moment the page is viewed.
 */
export function subsolarPoint(date = new Date()) {
  const start = Date.UTC(date.getUTCFullYear(), 0, 0)
  const doy = (date.getTime() - start) / 86400000
  const g = ((2 * Math.PI) / 365) * (doy - 1)
  const decl =
    0.006918 - 0.399912 * Math.cos(g) + 0.070257 * Math.sin(g) - 0.006758 * Math.cos(2 * g) + 0.000907 * Math.sin(2 * g)
  const eqTime = 229.18 * (0.000075 + 0.001868 * Math.cos(g) - 0.032077 * Math.sin(g) - 0.014615 * Math.cos(2 * g) - 0.040849 * Math.sin(2 * g))
  const utcMin = date.getUTCHours() * 60 + date.getUTCMinutes() + date.getUTCSeconds() / 60
  const lon = -(utcMin + eqTime - 720) / 4
  return { lat: decl / D2R, lon }
}

export const smooth = (e0: number, e1: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - e0) / (e1 - e0)))
  return t * t * (3 - 2 * t)
}
export const easeInOutCubic = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2)
export const clamp01 = (x: number) => Math.min(1, Math.max(0, x))
