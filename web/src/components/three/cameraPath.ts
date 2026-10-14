import { EARTH_R_KM, S2_ALT_KM, easeInOutCubic, lerpLon, smooth } from './geo'

export const INDIA = { lat: 21.6, lon: 79.4 }
export const AP = { lat: 15.9, lon: 80.1 }
export const ZONE = { lat: 16.555, lon: 80.585 }
const D_ORBIT = 4.4
const D_INDIA = 2.25
const D_AP = 1.5
const D_S2 = 1 + S2_ALT_KM / EARTH_R_KM

/**
 * The hero camera path as a pure function of scroll progress p (0..1) and idle time t (s).
 * Shared by the WebGL scene and the HUD so the readout is the real camera position.
 */
export function cameraAt(p: number, t: number) {
  const idle = { lat: 13, lon: 104 - t * 1.1 }
  const s2 = easeInOutCubic(smooth(0.0, 0.28, p))
  const s3a = easeInOutCubic(smooth(0.32, 0.47, p))
  const s3b = easeInOutCubic(smooth(0.47, 0.6, p))

  let lat = idle.lat + (INDIA.lat - idle.lat) * s2
  let lon = lerpLon(idle.lon, INDIA.lon, s2)
  lat += (AP.lat - lat) * s3a
  lon = lerpLon(lon, AP.lon, s3a)
  lat += (ZONE.lat - lat) * s3b
  lon = lerpLon(lon, ZONE.lon, s3b)

  let dist = D_ORBIT + (D_INDIA - D_ORBIT) * s2
  dist += (D_AP - dist) * s3a
  dist += (D_S2 - dist) * s3b
  lon = ((((lon + 180) % 360) + 360) % 360) - 180
  return { lat, lon, dist, altKm: (dist - 1) * EARTH_R_KM, centred: s2 }
}

export const CAMERA_START_DIST = D_ORBIT
