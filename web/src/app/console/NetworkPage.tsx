import { useMemo, useState } from 'react'
import { HBars } from '@/components/charts/Charts'
import { DemoBadge } from '@/components/brand/Brand'
import { DEFAULT_VISIBILITY } from '@/components/map/nightSurveyStyle'
import { RwMap } from '@/components/map/LazyMap'
import { Panel, Segmented } from '@/components/ui/primitives'
import { ErrorState, ListSkeleton, PageHeader } from '@/components/ui/States'
import { DATA, useJson, type ZoneMeta } from '@/lib/data'
import { fmtInt } from '@/lib/format'

interface NetworkStats {
  source: string
  total_km: number
  segments: number
  by_class: { district: string; class: string; km: number }[]
  by_surface: { district: string; surface: string; km: number }[]
}

const CLASS_ORDER = ['motorway', 'trunk', 'primary', 'secondary', 'tertiary', 'unclassified', 'residential', 'service', 'track', 'living_street', 'road']
const CLASS_LABEL: Record<string, string> = {
  motorway: 'Motorway',
  trunk: 'Trunk (NH)',
  primary: 'Primary',
  secondary: 'Secondary',
  tertiary: 'Tertiary',
  unclassified: 'Unclassified',
  residential: 'Residential',
  service: 'Service',
  track: 'Track',
  living_street: 'Living street',
  road: 'Unknown class',
}

export default function NetworkPage() {
  const res = useJson<NetworkStats>('/data/pilot/network_stats.json')
  const meta = useJson<ZoneMeta>(DATA.zoneMeta).data
  const [district, setDistrict] = useState<'all' | 'NTR' | 'Krishna'>('all')
  const s = res.data

  const rows = useMemo(() => {
    if (!s) return []
    const acc = new Map<string, { NTR: number; Krishna: number }>()
    for (const r of s.by_class) {
      const k = r.class.replace(/_link$/, '')
      const cur = acc.get(k) ?? { NTR: 0, Krishna: 0 }
      cur[r.district as 'NTR' | 'Krishna'] += r.km
      acc.set(k, cur)
    }
    return CLASS_ORDER.filter((c) => acc.has(c)).map((c) => {
      const v = acc.get(c)!
      return { cls: c, ntr: v.NTR, krishna: v.Krishna, total: v.NTR + v.Krishna }
    })
  }, [s])

  const surface = useMemo(() => {
    if (!s) return []
    const pick = (d: string) => s.by_surface.filter((r) => district === 'all' || r.district === d)
    const sum = (k: string) => pick(district).filter((r) => r.surface === k).reduce((a, r) => a + r.km, 0)
    return [
      { label: 'Paved', value: sum('paved'), color: 'var(--road-existing)' },
      { label: 'Unpaved', value: sum('unpaved'), color: 'var(--road-existing)' },
      { label: 'Not tagged', value: sum('unknown'), color: 'var(--abstain)' },
    ]
  }, [s, district])

  const val = (r: (typeof rows)[number]) => (district === 'all' ? r.total : district === 'NTR' ? r.ntr : r.krishna)
  const total = rows.reduce((a, r) => a + val(r), 0)

  return (
    <div className="pb-10">
      <PageHeader title="Road Network" description="Inventory of the mapped network in the pilot, and what new roads change." demo={false} />
      <div className="grid gap-4 p-4 lg:grid-cols-[minmax(0,1fr)_420px] lg:p-6">
        <Panel className="relative min-h-[420px] overflow-hidden lg:min-h-[560px]">
          <RwMap meta={meta} dateId="2024_pre_monsoon" base="none" visible={{ ...DEFAULT_VISIBILITY, abstain: false, priority: false }} showDemoLayers={false} initial={{ center: [80.8, 16.4], zoom: 9 }} ariaLabel="Road network of the pilot area" />
          <div className="t-mono pointer-events-none absolute bottom-3 left-3 rounded-chip bg-bg0/80 px-2 py-1 text-[11px] text-muted">© OpenFreeMap © OpenStreetMap contributors</div>
        </Panel>

        <div className="space-y-4">
          <Panel className="p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-[14px] font-medium text-fg">Inventory · OpenStreetMap</h2>
              <Segmented
                size="sm"
                label="District"
                value={district}
                onChange={setDistrict}
                options={[
                  { value: 'all', label: 'Both' },
                  { value: 'NTR', label: 'NTR' },
                  { value: 'Krishna', label: 'Krishna' },
                ]}
              />
            </div>
            {res.error ? (
              <ErrorState what="the road inventory" onRetry={res.retry} />
            ) : !s ? (
              <ListSkeleton rows={8} />
            ) : (
              <>
                <p className="mt-3 flex items-baseline gap-2">
                  <span className="t-mono text-[28px] text-fg tabular">{fmtInt(total)}</span>
                  <span className="text-[14px] text-muted">km of mapped road · {fmtInt(s.segments)} segments</span>
                </p>
                <table className="mt-4 w-full text-[13px]">
                  <caption className="sr-only">Road length by class</caption>
                  <thead>
                    <tr className="border-b border-line text-left text-[12px] text-muted">
                      <th className="py-2 font-normal">Class</th>
                      <th className="py-2 text-right font-normal">km</th>
                      <th className="w-28 py-2 pl-3 font-normal">
                        <span className="sr-only">Share</span>
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((r) => (
                      <tr key={r.cls} className="border-b border-line last:border-0">
                        <td className="py-1.5 text-fg">{CLASS_LABEL[r.cls] ?? r.cls}</td>
                        <td className="t-mono py-1.5 text-right text-fg">{fmtInt(val(r))}</td>
                        <td className="py-1.5 pl-3">
                          <span className="block h-1.5 rounded-r-[3px] bg-steel" style={{ width: `${Math.max(2, (val(r) / Math.max(...rows.map(val))) * 100)}%` }} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <p className="mt-3 text-[11px] text-muted">{s.source}. Includes link roads in their parent class.</p>
              </>
            )}
          </Panel>

          <Panel className="p-4">
            <h2 className="text-[14px] font-medium text-fg">Surface (OSM tag)</h2>
            <HBars className="mt-4" rows={surface} format={(v) => `${fmtInt(v)} km`} />
            <p className="mt-3 text-[11px] text-muted">Most OSM roads here carry no surface tag; RoadWatch’s surface estimate fills this gap.</p>
          </Panel>

          <Panel className="p-4">
            <div className="flex items-center justify-between">
              <h2 className="text-[14px] font-medium text-fg">Connectivity from new roads</h2>
              <DemoBadge />
            </div>
            <dl className="mt-3 grid grid-cols-2 gap-4">
              <div>
                <dt className="text-[12px] text-muted">Villages newly connected</dt>
                <dd className="t-mono mt-1 text-[22px] text-fg">14</dd>
              </div>
              <div>
                <dt className="text-[12px] text-muted">Median time saved</dt>
                <dd className="t-mono mt-1 text-[22px] text-fg">11 min</dd>
              </div>
            </dl>
            <h3 className="mt-5 text-[12px] text-muted">Travel time to nearest market, before → after (minutes)</h3>
            <HBars
              className="mt-3"
              format={(v) => `${v} min`}
              rows={[
                { label: 'Before new roads', value: 34, color: 'var(--road-existing)' },
                { label: 'After new roads', value: 23, color: 'var(--signal)' },
              ]}
            />
            <p className="mt-3 text-[11px] text-muted">Placeholder values. Computed with OSMnx/NetworkX once alerts are real.</p>
          </Panel>
        </div>
      </div>
    </div>
  )
}
