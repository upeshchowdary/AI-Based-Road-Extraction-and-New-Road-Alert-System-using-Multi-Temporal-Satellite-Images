import { KPIS } from '@/features/home/HomeSections'
import { PageIntro, Section } from '@/components/site/PageIntro'
import { Chip } from '@/components/ui/primitives'

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
  'Free GPU quota is about 6 hours per account per week, which bounds model size and the number of seeds.',
]

export default function ResearchPage() {
  return (
    <>
      <PageIntro docTitle="Research" title="Research" lead="How RoadWatch is built and measured: method, data, models, metrics and limits. Results are published here after evaluation — not before." />
      <Section title="Method">
        <ol className="grid gap-3 md:grid-cols-5">
          {[
            ['Composite', 'Seasonal Sentinel-2 median of up to 8 low-cloud scenes; cloud classes masked; 0 = no data.'],
            ['Extract', 'Segment road pixels, threshold, skeletonize, build a graph, prune spurs, join gaps.'],
            ['Match', 'Match graphs between co-registered dates by buffer, direction and topology.'],
            ['Filter', 'Persistence (≥ 2 dates), connectivity, minimum length, abstain on bad tiles.'],
            ['Score', 'Model × persistence × connectivity × data quality; priority zones boost.'],
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
                    <Chip>Pending evaluation</Chip>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-4 text-[14px] text-muted">Mandatory negative tests: occlusion, seasonal appearance, change vs noise, CRS/registration mismatch, domain shift — each must be detected, abstained on or labelled.</p>
      </Section>
      <Section title="Models">
        <div className="grid gap-3 md:grid-cols-2">
          <article className="rounded-panel border border-line bg-surface p-6">
            <div className="flex items-center justify-between">
              <h3 className="t-h3 text-fg">Baseline A</h3>
              <Chip tone="signal">Training</Chip>
            </div>
            <p className="mt-3 text-muted">U-Net / D-LinkNet with a ResNet34 encoder, trained on DeepGlobe Roads. A one-epoch timing run sets the GPU budget for full runs on three seeds.</p>
          </article>
          <article className="rounded-panel border border-line bg-surface p-6">
            <div className="flex items-center justify-between">
              <h3 className="t-h3 text-fg">Reference B</h3>
              <Chip>Planned</Chip>
            </div>
            <p className="mt-3 text-muted">DINOv3 satellite backbone, frozen, with a light decoder head — if the gated licence is approved. Chosen against Baseline A by a documented trade-off.</p>
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
