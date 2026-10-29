import { KPIS } from '@/features/home/HomeSections'
import { PageIntro, Section } from '@/components/site/PageIntro'
import { Chip } from '@/components/ui/primitives'
import { API, useJson } from '@/lib/data'

const DATASETS = [
  ['OpenStreetMap', 'Road labels, boundaries, edit history (change labels)', 'ODbL 1.0'],
  ['Sentinel-2 L2A (Planetary Computer)', 'Seasonal composites, B2 B3 B4 B8, 10 m', 'Copernicus open data'],
  ['Sentinel-1 RTC', 'Radar for monsoon dates (CP2)', 'Copernicus open data'],
  ['DeepGlobe Roads', 'High-resolution extraction training (Baseline A)', 'Research use, not re-hosted'],
  ['Massachusetts Roads', 'Extra high-resolution training', 'Research use, not re-hosted'],
  ['SpaceNet 3', 'Graph metrics (APLS)', 'CC BY-SA 4.0'],
  ['Microsoft Road Detections', 'Extra labels', 'ODbL 1.0'],
]

const LIMITS = [
  'At 10 m, roads narrower than about 5 m are not reliably visible. The high-resolution tier covers this only in pilot zones.',
  'OpenStreetMap is a 2026 snapshot: older composites get labels for roads that may not exist yet. Extraction training uses the newest composites; OSM edit history provides dated change labels (CP2).',
  'DeepGlobe images carry no coordinates, so its split is by image-ID hash, not spatial. All Andhra Pradesh evaluation uses the spatial holdout.',
  'Free GPU quota is 30 hours per account per week (T4 x2), which bounds model size and the number of seeds.',
]

type Ci = { value: number; lo: number; hi: number; n: number }
type KpiRun = {
  run: string
  run_id: string
  config_hash: string
  stop_reason?: string
  splits: Record<string, { iou: Ci; f1: Ci; precision: Ci; recall: Ci }>
  timing: { wall_sec?: number }
}
const RUN_LABEL: Record<string, string> = {
  baseline_a_full_s0: 'Baseline A · U-Net ResNet34 · DeepGlobe 0.5 m',
  reference_b_full_s0: 'Reference B · frozen DINOv3-sat ViT-L + decoder · DeepGlobe 0.5 m',
  s2_model_full_s0: 'Tier-1 model · U-Net ResNet34 · AP Sentinel-2 10 m',
}
const SPLIT_LABEL: Record<string, string> = {
  test: 'Test (holdout)', val: 'Validation', zone_A: 'Zone A · Vijayawada', zone_B: 'Zone B · Machilipatnam', zone_C: 'Zone C · Gannavaram–Nunna',
}
const fmt = (c: Ci) => `${c.value.toFixed(3)} [${c.lo.toFixed(3)}, ${c.hi.toFixed(3)}]`

/** A model repeated over seeds 0-2 (Section 7.5): is the result stable, or seed luck? */
function SeedSummary({ runs, prefix, title }: { runs: KpiRun[]; prefix: string; title: string }) {
  const seeds = [0, 1, 2]
    .map((s) => ({ s, t: runs.find((k) => k.run === `${prefix}_s${s}`)?.splits.test }))
    .filter((x): x is { s: number; t: NonNullable<typeof x.t> } => Boolean(x.t))
  if (seeds.length < 2) return null
  const ious = seeds.map((x) => x.t.iou.value)
  const mean = ious.reduce((a, b) => a + b, 0) / ious.length
  const sd = Math.sqrt(ious.reduce((a, b) => a + (b - mean) ** 2, 0) / (ious.length - 1))
  return (
    <div className="overflow-x-auto rounded-panel border border-line">
      <table className="w-full min-w-[520px] text-left text-[14px]">
        <caption className="p-4 text-left text-[15px] font-medium text-fg">
          {title} repeated over {seeds.length} seeds
          {/* phones: own line, so it stays in view (the table itself scrolls sideways) */}
          <span className="ml-2 text-[13px] font-normal text-muted max-sm:mt-1 max-sm:ml-0 max-sm:block">
            test IoU mean <span className="t-mono text-fg">{mean.toFixed(3)}</span> · SD <span className="t-mono text-fg">{sd.toFixed(3)}</span>
          </span>
        </caption>
        <thead>
          <tr className="border-y border-line text-[13px] text-muted">
            <th className="p-3 font-normal">Seed</th>
            <th className="p-3 font-normal">Test IoU [95% CI]</th>
            <th className="p-3 font-normal">Test F1 [95% CI]</th>
          </tr>
        </thead>
        <tbody className="t-mono">
          {seeds.map(({ s, t }) => (
            <tr key={s} className="border-b border-line last:border-0">
              <td className="p-3 font-sans text-fg">{s}</td>
              <td className="p-3 text-fg">{fmt(t.iou)}</td>
              <td className="p-3 text-fg">{fmt(t.f1)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function LiveResults() {
  const res = useJson<{ kpis: KpiRun[]; ci_method: string }>(API.kpis)
  const runs = (res.data?.kpis ?? []).filter((k) => RUN_LABEL[k.run])
  if (res.loading) return <p className="text-muted">Loading results from the API…</p>
  if (res.error || !runs.length) return <p className="text-muted">No evaluated runs available (start the API: <code>uv run roadwatch serve</code>).</p>
  return (
    <div className="space-y-6">
      {runs.map((k) => (
        <div key={k.run} className="overflow-x-auto rounded-panel border border-line">
          <table className="w-full min-w-[640px] text-left text-[14px]">
            <caption className="p-4 text-left text-[15px] font-medium text-fg">
              {RUN_LABEL[k.run]}
              <span className="t-mono ml-2 text-[12px] font-normal text-muted">
                {k.run_id} · {((k.timing.wall_sec ?? 0) / 3600).toFixed(2)} GPU-h
              </span>
            </caption>
            <thead>
              <tr className="border-y border-line text-[13px] text-muted">
                <th className="p-3 font-normal">Split</th>
                <th className="p-3 font-normal">n</th>
                <th className="p-3 font-normal">IoU [95% CI]</th>
                <th className="p-3 font-normal">F1 [95% CI]</th>
                <th className="p-3 font-normal">Precision</th>
                <th className="p-3 font-normal">Recall</th>
              </tr>
            </thead>
            <tbody className="t-mono">
              {['test', 'val', 'zone_A', 'zone_B', 'zone_C'].filter((s) => k.splits[s]).map((s) => (
                <tr key={s} className="border-b border-line last:border-0">
                  <td className="p-3 font-sans text-fg">{SPLIT_LABEL[s]}</td>
                  <td className="p-3 text-muted">{k.splits[s].iou.n}</td>
                  <td className="p-3 text-fg">{fmt(k.splits[s].iou)}</td>
                  <td className="p-3 text-fg">{fmt(k.splits[s].f1)}</td>
                  <td className="p-3 text-muted">{k.splits[s].precision.value.toFixed(3)}</td>
                  <td className="p-3 text-muted">{k.splits[s].recall.value.toFixed(3)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ))}
      <SeedSummary runs={res.data?.kpis ?? []} prefix="baseline_a_full" title="Baseline A" />
      <SeedSummary runs={res.data?.kpis ?? []} prefix="s2_model_full" title="Tier-1 model" />
      <p className="text-[13px] text-muted">{res.data?.ci_method}. Computed live by the API from per-image pixel counts of each run.</p>
    </div>
  )
}

export default function ResearchPage() {
  return (
    <>
      <PageIntro docTitle="Results" title="Results" lead="How RoadWatch is built and measured: method, data, models, metrics and limits. Results below are read live from the evaluated runs." />
      <Section title="Results — KPI-1 road extraction (live)" lead="Every number is recomputed from the run outputs. Each holdout zone is shown separately.">
        <LiveResults />
      </Section>
      <Section title="Method">
        <ol className="grid gap-3 md:grid-cols-5">
          {[
            ['Composite', 'Seasonal Sentinel-2 median of up to 8 low-cloud scenes; cloud classes masked; 0 = no data.'],
            ['Extract', 'Segment road pixels, threshold, skeletonize, build a graph, prune spurs, simplify to centre-lines.'],
            ['Match', 'Roads of each later date are compared with the 2022 network: within 25 m counts as the same road.'],
            ['Filter', 'Seen on ≥ 3 later dates, stable after first sighting, minimum length, abstain on cloudy tiles.'],
            ['Score', 'Model confidence × persistence × connectivity × data quality.'],
          ].map(([t, d], i) => (
            <li key={t} className="rounded-panel border border-line bg-surface p-5">
              <span className="t-mono text-sentinel-ink">{i + 1}</span>
              <h3 className="mt-2 text-[17px] font-medium text-fg">{t}</h3>
              <p className="mt-2 text-[14px] text-muted">{d}</p>
            </li>
          ))}
        </ol>
      </Section>
      <Section title="Evaluation design" lead="Test regions were frozen before any tuning and never change, so the lean model and every enhancement are measured on the same ground.">
        <dl className="grid gap-px overflow-hidden rounded-panel border border-line bg-line sm:grid-cols-3">
          {[
            ['Holdout blocks', '95 of 489', 'AP blocks of 20.48 km, chosen by hash (EPSG:7755)'],
            ['Buffer', '1 km', 'No chip within 1 km of a test block is trained on'],
            ['Holdout hash', '8a9150a57d46', 'CI fails if the split ever changes'],
          ].map(([k, v, d]) => (
            <div key={k} className="bg-bg0 p-6">
              <dt className="text-[13px] text-muted">{k}</dt>
              <dd className="t-mono mt-2 text-[24px] text-fg">{v}</dd>
              <dd className="mt-2 text-[13px] text-muted">{d}</dd>
            </div>
          ))}
        </dl>
        <p className="mt-4 text-[14px] text-muted">All three high-resolution zones (Vijayawada West Bypass, Machilipatnam port, Gannavaram–Nunna) are evaluation-only.</p>
      </Section>
      <Section title="Metrics and targets" lead="Each is reported per condition with 95% confidence intervals and raw confusion evidence. No critical condition can hide behind an average.">
        <div className="overflow-x-auto rounded-panel border border-line">
          <table className="w-full min-w-[640px] text-left text-[14px]">
            <caption className="sr-only">KPIs, measures, targets and status</caption>
            <thead>
              <tr className="border-b border-line text-[13px] text-muted">
                <th className="p-4 font-normal">KPI</th>
                <th className="p-4 font-normal">Measure</th>
                <th className="p-4 font-normal">Target</th>
                <th className="p-4 font-normal">Result</th>
              </tr>
            </thead>
            <tbody>
              {KPIS.map((k) => (
                <tr key={k.id} className="border-b border-line last:border-0">
                  <td className="p-4">
                    <span className="t-mono text-muted">{k.id}</span> <span className="text-fg">{k.name}</span>
                  </td>
                  <td className="p-4 text-muted">{k.measure}</td>
                  <td className="t-mono p-4 text-fg">{k.target}</td>
                  <td className="p-4">
                    {k.id === 'KPI-1' ? (
                      <Chip tone="signal">Baselines measured · see below</Chip>
                    ) : k.id === 'KPI-6' ? (
                      <Chip tone="signal">Median 0.071 px · 100% ≤ 1 px</Chip>
                    ) : (
                      <Chip>Pending (CP2)</Chip>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-4 text-[14px] text-muted">Negative tests NT-1…NT-5 (occlusion, seasonal tracks, noise, CRS/registration/date mismatch, cloud): 14 of 14 cases pass, residual risks listed in the negative-test report.</p>
      </Section>
      <Section title="Models">
        <div className="grid gap-3 md:grid-cols-2">
          <article className="rounded-panel border border-line bg-surface p-6">
            <div className="flex items-center justify-between">
              <h3 className="t-h3 text-fg">Baseline A</h3>
              <Chip tone="signal">3 seeds · O2 reference</Chip>
            </div>
            <p className="mt-3 text-muted">U-Net with a ResNet34 encoder on DeepGlobe Roads (0.5 m). Test IoU 0.494 ± 0.006 over 3 seeds. Best after the first epoch, then overfit — reported honestly.</p>
          </article>
          <article className="rounded-panel border border-line bg-surface p-6">
            <div className="flex items-center justify-between">
              <h3 className="t-h3 text-fg">Reference B</h3>
              <Chip>Trained · below Baseline A</Chip>
            </div>
            <p className="mt-3 text-muted">Frozen DINOv3 satellite ViT-L with a 2.2 M-parameter decoder. 5 epochs in its 5 GPU-hour budget: test IoU 0.356 [0.343, 0.368] vs Baseline A 0.501 — still improving when stopped, but well behind at higher cost. Fine-tuning (LoRA) is the CP2 option.</p>
          </article>
          <article className="rounded-panel border border-line bg-surface p-6 md:col-span-2">
            <div className="flex items-center justify-between">
              <h3 className="t-h3 text-fg">Tier-1 Sentinel-2 model</h3>
              <Chip tone="signal">v1 in use on the map</Chip>
            </div>
            <p className="mt-3 text-muted">U-Net ResNet34 on 4 Sentinel-2 bands (B02 B03 B04 B08, 10 m) with OpenStreetMap labels, trained on the pilot outside every holdout. Runs on a laptop CPU via ONNX Runtime; its roads appear on the map as “Roads extracted by RoadWatch”.</p>
          </article>
        </div>
      </Section>
      <Section title="Data and licences">
        <div className="overflow-x-auto rounded-panel border border-line">
          <table className="w-full min-w-[640px] text-left text-[14px]">
            <caption className="sr-only">Datasets, use and licence</caption>
            <tbody>
              {DATASETS.map(([n, u, l]) => (
                <tr key={n} className="border-b border-line last:border-0">
                  <th scope="row" className="p-4 font-normal text-fg">
                    {n}
                  </th>
                  <td className="p-4 text-muted">{u}</td>
                  <td className="t-mono p-4 text-[13px] text-muted">{l}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Section>
      <Section title="Limitations">
        <ul className="max-w-3xl space-y-4">
          {LIMITS.map((l) => (
            <li key={l} className="flex gap-4 text-[16px] text-muted">
              <span className="mt-2.5 h-px w-4 shrink-0 bg-sentinel" aria-hidden />
              {l}
            </li>
          ))}
        </ul>
      </Section>
      <Section title="Paper and reproducibility" className="border-b-0">
        <p className="measure text-muted">A paper draft is planned for the second semester, with a reproducibility package: frozen configs, data versions, the holdout and one-command runs.</p>
        <pre className="t-mono mt-6 max-w-xl overflow-x-auto rounded-card border border-line bg-bg1 p-4 text-[13px] text-fg">{`uv run roadwatch info
uv run roadwatch holdout check`}</pre>
      </Section>
    </>
  )
}
