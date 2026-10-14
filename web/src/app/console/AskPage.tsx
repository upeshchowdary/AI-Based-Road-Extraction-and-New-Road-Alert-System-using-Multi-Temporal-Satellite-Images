import type { Map as MlMap } from 'maplibre-gl'
import { ArrowUp, Code2 } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router'
import { StatusDot } from '@/components/alerts/AlertParts'
import { alertCentre } from '@/components/alerts/AlertSummary'
import { RwMap } from '@/components/map/LazyMap'
import { Panel } from '@/components/ui/primitives'
import { EmptyState, OfflineState, PageHeader } from '@/components/ui/States'
import { useAlerts } from '@/lib/appStore'
import type { DemoAlert, LngLat } from '@/lib/data'
import { bboxOf } from '@/lib/demoLayers'
import { dateShort, fmtKm } from '@/lib/format'
import { haversineKm } from '@/lib/geoMath'
import { usePrefs } from '@/lib/store'

const EXAMPLES = ['New roads near Gannavaram since 2023', 'High priority alerts in Krishna', 'Pending paved roads longer than 1 km', 'Roads first seen in 2022 in NTR']

/** Approximate town centres for "near X" (OpenStreetMap place nodes, rounded). */
const PLACES: Record<string, LngLat> = {
  vijayawada: [80.648, 16.506],
  gannavaram: [80.802, 16.541],
  machilipatnam: [81.135, 16.187],
  gudivada: [80.993, 16.435],
  nuzvid: [80.846, 16.788],
  nandigama: [80.288, 16.772],
  jaggayyapeta: [80.097, 16.892],
  tiruvuru: [80.611, 17.096],
  avanigadda: [80.917, 16.021],
  pedana: [81.145, 16.257],
}

interface Parsed {
  where: string[]
  test: (a: DemoAlert) => boolean
  understood: boolean
}

function parse(q: string): Parsed {
  const s = q.toLowerCase()
  const where: string[] = []
  const tests: ((a: DemoAlert) => boolean)[] = []
  const district = /\bntr\b/.test(s) ? 'NTR' : /krishna/.test(s) ? 'Krishna' : null
  if (district) (where.push(`district = '${district}'`), tests.push((a) => a.district === district))
  if (/high[- ]priority|urgent/.test(s)) (where.push(`priority = 'high'`), tests.push((a) => a.priority === 'high'))
  const status = /pending|unreviewed|to review/.test(s) ? 'pending' : /accepted/.test(s) ? 'accepted' : /rejected/.test(s) ? 'rejected' : /field/.test(s) ? 'flagged' : null
  if (status) (where.push(`status = '${status}'`), tests.push((a) => a.status === status))
  const stage = (['paved', 'gravel', 'earthwork', 'cleared'] as const).find((x) => s.includes(x))
  if (stage) (where.push(`stage = '${stage}'`), tests.push((a) => a.stage === stage))
  const len = s.match(/(?:longer than|over|more than|>)\s*(\d+(?:\.\d+)?)\s*km/)
  if (len) (where.push(`length_km > ${len[1]}`), tests.push((a) => a.length_km > +len[1]))
  const since = s.match(/since\s+(20\d\d)/)
  if (since) (where.push(`first_seen >= '${since[1]}'`), tests.push((a) => +a.first_seen.slice(0, 4) >= +since[1]))
  const inYear = !since && s.match(/(?:in|during)\s+(20\d\d)/)
  if (inYear) (where.push(`year(first_seen) = ${inYear[1]}`), tests.push((a) => a.first_seen.startsWith(inYear[1])))
  const near = Object.keys(PLACES).find((p) => s.includes(p))
  if (near) (where.push(`ST_DWithin(geom, place('${near}'), 15 km)`), tests.push((a) => haversineKm(alertCentre(a), PLACES[near]) <= 15))
  return { where, test: (a) => tests.every((t) => t(a)), understood: where.length > 0 }
}

export default function AskPage() {
  const offline = usePrefs((s) => s.offline)
  const { alerts } = useAlerts()
  const [q, setQ] = useState('')
  const [asked, setAsked] = useState<string | null>(null)
  const [map, setMap] = useState<MlMap | null>(null)

  const result = useMemo(() => {
    if (!asked) return null
    const p = parse(asked)
    const rows = p.understood ? (alerts ?? []).filter(p.test).sort((a, b) => b.length_km - a.length_km) : []
    const sql = `SELECT id, district, length_km, stage, first_seen, score\nFROM alerts\n${p.where.length ? `WHERE ${p.where.join('\n  AND ')}\n` : ''}ORDER BY length_km DESC;`
    return { ...p, rows, sql }
  }, [asked, alerts])

  useEffect(() => {
    if (!map || !result?.rows.length) return
    map.fitBounds(bboxOf(result.rows.flatMap((a) => a.geometry.coordinates)), { padding: 60, maxZoom: 13, duration: 700 })
  }, [map, result])

  if (offline) return (
    <>
      <PageHeader title="Ask" description="Questions in plain English, answered with the map." />
      <OfflineState feature="Ask" />
    </>
  )

  const total = result?.rows.reduce((s, a) => s + a.length_km, 0) ?? 0
  return (
    <div className="pb-10">
      <PageHeader title="Ask" description="Questions in plain English, answered with the map. The query it ran is always shown." />
      <div className="mx-auto max-w-6xl space-y-4 p-4 lg:p-6">
        <form
          onSubmit={(e) => {
            e.preventDefault()
            if (q.trim()) setAsked(q.trim())
          }}
          className="flex items-center gap-2 rounded-panel border border-line-strong bg-surface p-2 focus-within:border-sentinel"
        >
          <label htmlFor="ask" className="sr-only">
            Question
          </label>
          <input id="ask" value={q} onChange={(e) => setQ(e.target.value)} placeholder="e.g. New roads near Gannavaram since 2023" className="h-11 flex-1 bg-transparent px-3 text-[15px] text-fg outline-none placeholder:text-muted" />
          <button type="submit" aria-label="Ask" disabled={!q.trim()} className="grid size-10 place-items-center rounded-[10px] bg-signal text-on-signal disabled:opacity-40">
            <ArrowUp className="size-4" strokeWidth={2} />
          </button>
        </form>
        <div className="flex flex-wrap gap-2">
          {EXAMPLES.map((e) => (
            <button key={e} type="button" onClick={() => (setQ(e), setAsked(e))} className="rounded-full border border-line px-3 py-1.5 text-[13px] text-muted transition-colors hover:border-line-strong hover:text-fg">
              {e}
            </button>
          ))}
        </div>

        {!result ? (
          <Panel>
            <EmptyState title="Ask about new roads" body="Try a district, a town, a date, a stage or a length. Answers come from the alert database and always show the query." />
          </Panel>
        ) : !result.understood ? (
          <Panel>
            <EmptyState title="I couldn’t turn that into a query" body="Mention a district (NTR, Krishna), a town, a year, a stage (paved, gravel…), a status or a length like “longer than 1 km”." />
          </Panel>
        ) : (
          <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_380px]">
            <div className="space-y-4">
              <Panel className="p-4">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-[12px] text-muted">Answer · demo data</p>
                  <span className="rounded-chip border border-line px-2 py-0.5 text-[11px] text-muted">Template answer · Gemini later</span>
                </div>
                <p className="mt-2 text-[16px] leading-relaxed text-fg">
                  {result.rows.length
                    ? `${result.rows.length} alert${result.rows.length > 1 ? 's' : ''} match, ${fmtKm(total)} of new road in total. The longest is ${result.rows[0].id} (${fmtKm(result.rows[0].length_km, 2)}, ${result.rows[0].district}).`
                    : 'No alerts match. Widen the area or the dates.'}
                </p>
              </Panel>
              <Panel className="relative h-[380px] overflow-hidden">
                <RwMap dateId="2024_pre_monsoon" base="none" alerts={result.rows} showDemoLayers={false} onReady={setMap} initial={{ center: [80.8, 16.4], zoom: 9 }} ariaLabel="Answer map" />
              </Panel>
            </div>
            <div className="space-y-4">
              <Panel className="p-4">
                <h2 className="flex items-center gap-2 text-[13px] font-medium text-fg">
                  <Code2 className="size-4 text-muted" strokeWidth={1.75} aria-hidden /> Query it ran
                </h2>
                <pre className="t-mono mt-3 overflow-x-auto rounded-[8px] border border-line bg-bg0 p-3 text-[12px] leading-relaxed text-fg">{result.sql}</pre>
              </Panel>
              <Panel className="overflow-hidden">
                <table className="w-full text-[13px]">
                  <caption className="sr-only">Matching alerts</caption>
                  <thead>
                    <tr className="border-b border-line text-left text-[12px] text-muted">
                      <th className="px-4 py-2 font-normal">Alert</th>
                      <th className="py-2 font-normal">Length</th>
                      <th className="py-2 pr-4 font-normal">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {result.rows.slice(0, 12).map((a) => (
                      <tr key={a.id} className="border-b border-line last:border-0">
                        <td className="px-4 py-2">
                          <Link to={`/app/alerts/${a.id}`} className="t-mono text-sentinel-ink hover:underline">
                            {a.id}
                          </Link>
                          <div className="text-[11px] text-muted">
                            {a.district} · {dateShort(a.first_seen)}
                          </div>
                        </td>
                        <td className="t-mono py-2 text-fg">{fmtKm(a.length_km, 2)}</td>
                        <td className="py-2 pr-4">
                          <StatusDot status={a.status} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {result.rows.length > 12 && <p className="px-4 py-2 text-[12px] text-muted">+{result.rows.length - 12} more on the map</p>}
              </Panel>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
