/**
 * DEMO layers for the map UI (unreliable tiles, a priority zone). Clearly labelled as demo in
 * every legend. Real ones come from the abstain logic and from users drawing zones in the app.
 */
import type { Feature, FeatureCollection, LineString, Point, Polygon } from 'geojson'
import type { DemoAlert } from './data'

/** 5.12 km tiles on the coast near zone B, where monsoon cloud is common. Demo only. */
const ABSTAIN_TILES: [number, number][] = [
  [81.12, 16.2],
  [81.168, 16.2],
  [81.168, 16.246],
  [81.216, 16.154],
  [80.95, 16.33],
]
const T = 0.048

export const demoAbstain: FeatureCollection<Polygon> = {
  type: 'FeatureCollection',
  features: ABSTAIN_TILES.map(([x, y], i) => ({
    type: 'Feature',
    id: i,
    properties: { reason: i % 2 ? 'Cloud > 60% on 2 of 3 dates' : 'Shadow / registration check failed', demo: true },
    geometry: {
      type: 'Polygon',
      coordinates: [[[x, y], [x + T, y], [x + T, y + T], [x, y + T], [x, y]]],
    },
  })),
}

export const demoPriority: FeatureCollection<Polygon> = {
  type: 'FeatureCollection',
  features: [
    {
      type: 'Feature',
      id: 'pz-1',
      properties: { name: 'Coastal belt (demo zone)', level: 'high', demo: true },
      geometry: {
        type: 'Polygon',
        coordinates: [[[81.08, 16.13], [81.24, 16.11], [81.27, 16.24], [81.13, 16.29], [81.06, 16.22], [81.08, 16.13]]],
      },
    },
  ],
}

export function alertsToGeo(alerts: DemoAlert[]) {
  const lines: FeatureCollection<LineString> = {
    type: 'FeatureCollection',
    features: alerts.map(
      (a): Feature<LineString> => ({
        type: 'Feature',
        id: a.id,
        properties: { id: a.id, status: a.status, priority: a.priority, score: a.score },
        geometry: a.geometry,
      }),
    ),
  }
  const points: FeatureCollection<Point> = {
    type: 'FeatureCollection',
    features: alerts.map((a): Feature<Point> => {
      const c = a.geometry.coordinates
      return {
        type: 'Feature',
        id: a.id,
        properties: { id: a.id, priority: a.priority, status: a.status },
        geometry: { type: 'Point', coordinates: c[Math.floor(c.length / 2)] },
      }
    }),
  }
  return { lines, points }
}

export function bboxOf(coords: [number, number][]): [[number, number], [number, number]] {
  let [x0, y0, x1, y1] = [Infinity, Infinity, -Infinity, -Infinity]
  for (const [x, y] of coords) {
    x0 = Math.min(x0, x)
    y0 = Math.min(y0, y)
    x1 = Math.max(x1, x)
    y1 = Math.max(y1, y)
  }
  return [
    [x0, y0],
    [x1, y1],
  ]
}
