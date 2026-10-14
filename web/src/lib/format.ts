export function fmtLat(v: number, d = 4) {
  return `${Math.abs(v).toFixed(d)}° ${v >= 0 ? 'N' : 'S'}`
}
export function fmtLon(v: number, d = 4) {
  const w = ((((v + 180) % 360) + 360) % 360) - 180
  return `${Math.abs(w).toFixed(d)}° ${w >= 0 ? 'E' : 'W'}`
}
export function fmtKm(v: number, d = 1) {
  return `${v.toLocaleString('en-IN', { minimumFractionDigits: d, maximumFractionDigits: d })} km`
}
export function fmtInt(v: number) {
  return Math.round(v).toLocaleString('en-IN')
}
export function fmtScore(v: number) {
  return v.toFixed(2)
}
export function utcClock(d = new Date()) {
  return d.toISOString().slice(11, 19)
}
export function utcDate(d = new Date()) {
  return d.toISOString().slice(0, 10)
}

const SEASON: Record<string, string> = { pre_monsoon: 'Pre-monsoon', post_monsoon: 'Post-monsoon' }

/** "2023_post_monsoon" → "Post-monsoon 2023" */
export function dateLabel(id: string) {
  const [y, ...rest] = id.split('_')
  return `${SEASON[rest.join('_')] ?? rest.join(' ')} ${y}`
}
/** "2023_post_monsoon" → "Nov 2023" (composite mid-window) */
export function dateShort(id: string) {
  const [y, ...rest] = id.split('_')
  return `${rest.join('_') === 'pre_monsoon' ? 'Apr' : 'Nov'} ${y}`
}
