import { CircleCheck, CircleDashed, Clock } from 'lucide-react'
import { Chip, Panel } from '@/components/ui/primitives'
import { ErrorState, ListSkeleton, PageHeader } from '@/components/ui/States'
import { cn } from '@/lib/cn'
import { DATA, useJson, type RunLogRow, type ZoneMeta } from '@/lib/data'
import { dateLabel } from '@/lib/format'

const PACKS = [
  ['A', 'Hard negatives'],
  ['B', 'Full spectrum (16-bit, red-edge, SWIR)'],
  ['C', 'More dates'],
  ['D', 'Full fine-tuning'],
  ['E', 'Skipped tiles'],
  ['F', 'More high-res zones'],
  ['G', 'Reviewed alerts as labels'],
  ['H', 'Full model statewide'],
]
const NTS = ['NT-1 Occlusion', 'NT-2 Seasonal appearance', 'NT-3 Change vs noise', 'NT-4 CRS / registration / dates', 'NT-5 Cloud / data quality']

function Status({ s }: { s: 'ok' | 'running' | 'planned' }) {
  if (s === 'ok') return <span className="inline-flex items-center gap-1.5 text-[12px] text-verified"><CircleCheck className="size-3.5" strokeWidth={2} />Done</span>
  if (s === 'running') return <span className="inline-flex items-center gap-1.5 text-[12px] text-signal-ink"><Clock className="size-3.5" strokeWidth={2} />In progress</span>
  return <span className="inline-flex items-center gap-1.5 text-[12px] text-muted"><CircleDashed className="size-3.5" strokeWidth={2} />Planned</span>
}

export default function SystemPage() {
  const runs = useJson<RunLogRow[]>(DATA.runLog)
  const meta = useJson<ZoneMeta>(DATA.zoneMeta).data
  const gpu = (runs.data ?? []).reduce((s, r) => s + (parseFloat(r.gpu_hours) || 0), 0)
  const latest = meta?.dates.at(-1)

  return (
    <div className="pb-10">
      <PageHeader title="Data & runs" description="Data freshness, tile quality, models, training runs and tests — all real project state." demo={false} />
      {/* grid-cols-1 = minmax(0, 1fr): without it the run table (min 640 px) widens every card past a phone screen */}
      <div className="grid grid-cols-1 gap-4 p-4 lg:grid-cols-3 lg:p-6">
        <Panel className="p-4">
          <h2 className="text-[14px] font-medium text-fg">Data freshness</h2>
          <ul className="mt-3 divide-y divide-line text-[13px]">
            <li className="flex items-center justify-between py-2">
              <span className="text-fg">Sentinel-2 L2A</span>
              <span className="text-muted">{latest ? dateLabel(latest.id) : '—'} · zones A–C</span>
            </li>
            <li className="flex items-center justify-between py-2">
              <span className="text-fg">Sentinel-1 RTC</span>
              <span className="text-muted">Not built (CP2)</span>
            </li>
            <li className="flex items-center justify-between py-2">
              <span className="text-fg">High-resolution</span>
              <span className="text-muted">Not acquired</span>
            </li>
            <li className="flex items-center justify-between py-2">
              <span className="text-fg">OSM roads</span>
              <span className="text-muted">Geofabrik, 2026-10-14</span>
            </li>
          </ul>
        </Panel>

        <Panel className="p-4">
          <div className="flex items-center justify-between">
            <h2 className="text-[14px] font-medium text-fg">Tile quality · zone A</h2>
            <span className="t-mono text-[12px] text-muted">{meta?.tile_ids.length ?? 0} tiles</span>
          </div>
          {/* laid out as on the ground: columns west→east, rows north→south */}
          <div className="mx-auto mt-3 grid max-w-[220px] grid-cols-4 gap-1" role="img" aria-label="All 20 zone A tiles have 100% valid pixels on every date">
            {[...(meta?.tile_ids ?? [])]
              .sort((a, b) => {
                const [ca, ra] = a.split('_').slice(-2).map(Number)
                const [cb, rb] = b.split('_').slice(-2).map(Number)
                return rb - ra || ca - cb
              })
              .map((t) => (
                <div key={t} title={`${t}: 100% valid`} className="grid aspect-square place-items-center rounded-[3px] border border-verified/30 bg-verified/15">
                  <span className="t-mono text-[8px] text-verified">{t.split('_').slice(-2).join('·')}</span>
                </div>
              ))}
          </div>
          <p className="mt-3 text-[12px] text-muted">Zone A: 100% valid pixels on all 9 composites. Across zones A–C, 25 of 630 tile-dates were abstained as cloudy — all in zone B, mostly post-monsoon.</p>
        </Panel>

        <Panel className="p-4">
          <h2 className="text-[14px] font-medium text-fg">GPU budget</h2>
          <p className="mt-3 flex items-baseline gap-2">
            <span className="t-mono text-[28px] text-fg">{gpu.toFixed(2)}</span>
            <span className="text-[13px] text-muted">GPU-h logged of 40–75 h planned</span>
          </p>
          <div className="mt-3 h-2 overflow-hidden rounded-full bg-surface2" role="img" aria-label={`${gpu.toFixed(2)} of 75 GPU hours`}>
            <div className="h-full rounded-r-[4px] bg-signal" style={{ width: `${Math.max(1, (gpu / 75) * 100)}%` }} />
          </div>
          <p className="mt-3 text-[12px] text-muted">Kaggle free quota: 30 GPU-h per account per week, 5 accounts (ADR-013). Runs in progress log hours when they finish.</p>
        </Panel>

        <Panel className="p-4 lg:col-span-2">
          <h2 className="text-[14px] font-medium text-fg">Training & data runs</h2>
          {runs.error ? (
            <ErrorState what="the run log" onRetry={runs.retry} />
          ) : !runs.data ? (
            <ListSkeleton rows={4} />
          ) : (
            <div className="scrollbar-thin mt-3 overflow-x-auto">
              <table className="w-full min-w-[640px] text-[13px]">
                <caption className="sr-only">runs/RUN_LOG.csv</caption>
                <thead>
                  <tr className="border-b border-line text-left text-[12px] text-muted">
                    <th className="py-2 font-normal">Run</th>
                    <th className="py-2 font-normal">By</th>
                    <th className="py-2 font-normal">Started (UTC)</th>
                    <th className="py-2 font-normal">GPU-h</th>
                    <th className="py-2 font-normal">Result</th>
                  </tr>
                </thead>
                <tbody>
                  {runs.data.map((r) => (
                    <tr key={r.run_id} className="border-b border-line align-top last:border-0">
                      <td className="t-mono py-2 pr-3 text-[12px] text-fg">{r.run_id}</td>
                      <td className="py-2 pr-3 text-fg">{r.person}</td>
                      <td className="t-mono py-2 pr-3 text-[12px] text-muted">{r.start_utc.replace('T', ' ').slice(0, 16)}</td>
                      <td className="t-mono py-2 pr-3 text-fg">{r.gpu_hours || '—'}</td>
                      <td className="py-2 text-muted">{r.result.replace(/_/g, ' ')}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <p className="mt-2 text-[11px] text-muted">Source: runs/RUN_LOG.csv (contribution evidence).</p>
            </div>
          )}
        </Panel>

        <Panel className="p-4">
          <h2 className="text-[14px] font-medium text-fg">Model registry</h2>
          <ul className="mt-3 space-y-3 text-[13px]">
            <li className="rounded-card border border-line p-3">
              <div className="flex items-center justify-between">
                <span className="t-mono text-fg">s2-v1 · in use</span>
                <Status s="ok" />
              </div>
              <p className="mt-1 text-muted">Tier-1 Sentinel-2 U-Net (4 bands, 10 m). Test IoU 0.320 [0.300, 0.338]. Runs on a laptop CPU (ONNX); powers extracted roads and alerts.</p>
            </li>
            <li className="rounded-card border border-line p-3">
              <div className="flex items-center justify-between">
                <span className="t-mono text-fg">baseline-a</span>
                <Status s="ok" />
              </div>
              <p className="mt-1 text-muted">U-Net ResNet34 on DeepGlobe 0.5 m. Test IoU 0.494 ± 0.006 over 3 seeds (seed 0: 0.501 [0.490, 0.513]). O2 reference.</p>
            </li>
            <li className="rounded-card border border-line p-3">
              <div className="flex items-center justify-between">
                <span className="t-mono text-fg">ref-b</span>
                <Status s="ok" />
              </div>
              <p className="mt-1 text-muted">Frozen DINOv3-sat ViT-L + decoder. 5 epochs (5 GPU-h budget): test IoU 0.356 [0.343, 0.368] — below Baseline A.</p>
            </li>
          </ul>
        </Panel>

        <Panel className="p-4">
          <h2 className="text-[14px] font-medium text-fg">Negative tests</h2>
          <ul className="mt-3 space-y-2 text-[13px]">
            {NTS.map((n) => (
              <li key={n} className="flex items-center justify-between">
                <span className="text-fg">{n}</span>
                <Chip tone="signal">Pass</Chip>
              </li>
            ))}
          </ul>
        </Panel>

        <Panel className="p-4 lg:col-span-2">
          <h2 className="text-[14px] font-medium text-fg">Enhancement packs</h2>
          <ul className="mt-3 grid gap-2 sm:grid-cols-2">
            {PACKS.map(([k, l]) => (
              <li key={k} className={cn('flex items-center gap-3 rounded-[8px] border border-line px-3 py-2 text-[13px]')}>
                <span className="t-mono grid size-6 place-items-center rounded-[4px] bg-surface2 text-fg">{k}</span>
                <span className="flex-1 text-fg">{l}</span>
                <Status s="planned" />
              </li>
            ))}
          </ul>
        </Panel>
      </div>
    </div>
  )
}
