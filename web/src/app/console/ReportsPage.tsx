import { FileDown, FileText } from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router'
import { toast } from 'sonner'
import { Button } from '@/components/ui/Button'
import { Chip, Panel } from '@/components/ui/primitives'
import { PageHeader } from '@/components/ui/States'
import { useReview } from '@/lib/appStore'
import { cn } from '@/lib/cn'

const REPORTS = [
  { id: 'kpi-cp1', title: 'KPI-1 report · CP1', kind: 'KPI', status: 'Planned', when: 'CP1 review', sections: ['Extraction accuracy (IoU, F1, APLS) with 95% CIs', 'Per-condition results: occlusion, terrain, zone', 'Failure log', 'Resource profile (GPU hours, inference speed)'] },
  { id: 'alerts-draft', title: 'Monthly alert digest', kind: 'Alerts', status: 'Draft', when: 'Built from alerts you add', sections: ['Alerts added from the alert detail page', 'Before/after chips per alert', 'Review decisions and reasons'] },
  { id: 'audit-demo', title: 'PMGSY audit · village road', kind: 'Audit', status: 'Demo', when: 'From the Audit page', sections: ['Sanctioned vs detected length', 'First-seen dates', 'Coverage map', 'Before/after chips'] },
  { id: 'enh-a', title: 'Enhancement report · Pack A', kind: 'Enhancement', status: 'Planned', when: 'After the lean build passes its gates', sections: ['What was added (hard negatives)', 'GPU hours used', 'KPIs before vs after on the frozen holdout', 'Alerts added / withdrawn'] },
]

export default function ReportsPage() {
  const [sel, setSel] = useState(REPORTS[1].id)
  const inReport = useReview((s) => s.report)
  const r = REPORTS.find((x) => x.id === sel)!
  return (
    <div className="pb-10">
      <PageHeader title="Reports" description="KPI, alert, audit and enhancement reports with preview and download." />
      <div className="grid gap-4 p-4 lg:grid-cols-[380px_minmax(0,1fr)] lg:p-6">
        <ul className="space-y-2" aria-label="Reports">
          {REPORTS.map((x) => (
            <li key={x.id}>
              <button
                type="button"
                onClick={() => setSel(x.id)}
                aria-pressed={sel === x.id}
                className={cn('flex w-full items-start gap-3 rounded-card border p-4 text-left transition-colors', sel === x.id ? 'border-sentinel/50 bg-surface2' : 'border-line bg-surface hover:border-line-strong')}
              >
                <FileText className="mt-0.5 size-5 shrink-0 text-muted" strokeWidth={1.5} aria-hidden />
                <span className="min-w-0 flex-1">
                  <span className="block text-[14px] font-medium text-fg">{x.title}</span>
                  <span className="mt-0.5 block text-[12px] text-muted">{x.when}</span>
                </span>
                <Chip tone={x.status === 'Draft' ? 'sentinel' : x.status === 'Demo' ? 'signal' : 'neutral'}>{x.status}</Chip>
              </button>
            </li>
          ))}
        </ul>
        <Panel className="p-6">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-[12px] text-muted">{r.kind} report</p>
              <h2 className="mt-1 text-[20px] font-medium text-fg">{r.title}</h2>
            </div>
            <Button size="sm" variant="subtle" onClick={() => toast('Report export is part of the backend', { description: 'PDFs are rendered server-side (WeasyPrint); not connected in this UI build.' })}>
              <FileDown className="size-3.5" strokeWidth={1.75} /> Download PDF
            </Button>
          </div>
          <div className="mt-6 rounded-card border border-line bg-bg1 p-6">
            <div className="mx-auto max-w-xl rounded-[6px] border border-line bg-surface p-6 shadow-[var(--shadow-panel)]">
              <p className="t-mono text-[11px] text-muted">RoadWatch · {r.kind.toUpperCase()}</p>
              <h3 className="mt-2 text-[17px] font-medium text-fg">{r.title}</h3>
              <ol className="mt-4 space-y-2 text-[14px] text-muted">
                {r.sections.map((s, i) => (
                  <li key={s} className="flex gap-3">
                    <span className="t-mono text-[12px] text-fg">{i + 1}</span>
                    {s}
                  </li>
                ))}
              </ol>
              {r.id === 'alerts-draft' && (
                <div className="mt-5 border-t border-line pt-4">
                  <p className="text-[13px] text-fg">{inReport.length ? `${inReport.length} alert${inReport.length > 1 ? 's' : ''} added` : 'No alerts added yet'}</p>
                  {inReport.length ? (
                    <ul className="mt-2 flex flex-wrap gap-1.5">
                      {inReport.map((id) => (
                        <li key={id}>
                          <Link to={`/app/alerts/${id}`} className="t-mono rounded-chip border border-line px-2 py-0.5 text-[12px] text-sentinel-ink hover:border-line-strong">
                            {id}
                          </Link>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="mt-1 text-[12px] text-muted">Open an alert and choose “Add to report”.</p>
                  )}
                </div>
              )}
            </div>
          </div>
        </Panel>
      </div>
    </div>
  )
}
