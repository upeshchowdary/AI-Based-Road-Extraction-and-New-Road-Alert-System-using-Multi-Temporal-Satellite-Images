import { Check, FileDown, FileUp, Loader2, RotateCcw } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { toast } from 'sonner'
import { PersistenceDots } from '@/components/alerts/AlertParts'
import { alertCentre } from '@/components/alerts/AlertSummary'
import { HBars } from '@/components/charts/Charts'
import { RwMap } from '@/components/map/LazyMap'
import { Button } from '@/components/ui/Button'
import { Panel } from '@/components/ui/primitives'
import { EmptyState, PageHeader } from '@/components/ui/States'
import { useAlerts } from '@/lib/appStore'
import { cn } from '@/lib/cn'
import { DATA, useJson, type DemoAlert, type ZoneMeta } from '@/lib/data'
import { dateLabel, dateShort, fmtKm } from '@/lib/format'
import { useReducedMotion } from '@/lib/motionPref'
import { cropAround } from '@/lib/zoneProject'

const STEPS = ['Validating file', 'Matching to detected roads', 'Measuring length and dates', 'Building report']

export default function AuditPage() {
  const { alerts, dates } = useAlerts()
  const meta = useJson<ZoneMeta>(DATA.zoneMeta).data
  const reduced = useReducedMotion()
  const [road, setRoad] = useState<DemoAlert | null>(null)
  const [file, setFile] = useState<File | null>(null)
  const [step, setStep] = useState(-1)
  const [drag, setDrag] = useState(false)
  const input = useRef<HTMLInputElement>(null)
  const samples = useMemo(() => (alerts ?? []).filter((a) => a.length_km > 1).slice(0, 6), [alerts])

  const start = (r: DemoAlert, f: File | null = null) => {
    setRoad(r)
    setFile(f)
    setStep(0)
  }
  useEffect(() => {
    if (step < 0 || step >= STEPS.length) return
    const t = window.setTimeout(() => setStep((s) => s + 1), reduced ? 150 : 750)
    return () => window.clearTimeout(t)
  }, [step, reduced])

  const onFile = (f: File | undefined) => {
    if (!f) return
    if (!/\.(zip|geojson|json|gpkg)$/i.test(f.name)) {
      toast.error('Unsupported file', { description: 'Upload a zipped shapefile, a GeoPackage or GeoJSON.' })
      return
    }
    // UI-only build: the file is not parsed; a sample road stands in for the matching step.
    if (samples[0]) start(samples[0], f)
  }

  const done = step >= STEPS.length && road
  const sanctioned = road ? +(road.length_km * 1.35).toFixed(2) : 0
  const crop = road && meta ? cropAround(meta, road.geometry.coordinates) : null

  return (
    <div className="pb-10">
      <PageHeader title="PMGSY Audit" description="Compare a sanctioned road with what the satellite shows was built." />
      <div className="grid gap-4 p-4 lg:grid-cols-[380px_minmax(0,1fr)] lg:p-6">
        <div className="space-y-4">
          <Panel className="p-4">
            <h2 className="text-[14px] font-medium text-fg">1. Sanctioned road</h2>
            <div
              onDragOver={(e) => (e.preventDefault(), setDrag(true))}
              onDragLeave={() => setDrag(false)}
              onDrop={(e) => {
                e.preventDefault()
                setDrag(false)
                onFile(e.dataTransfer.files[0])
              }}
              className={cn('mt-3 flex flex-col items-center gap-2 rounded-card border border-dashed px-4 py-7 text-center transition-colors', drag ? 'border-sentinel bg-sentinel/5' : 'border-line-strong')}
            >
              <FileUp className="size-6 text-muted" strokeWidth={1.5} aria-hidden />
              <p className="text-[14px] text-fg">Drop a GeoSadak shapefile (.zip), GeoPackage or GeoJSON</p>
              <Button size="sm" variant="subtle" onClick={() => input.current?.click()}>
                Choose file
              </Button>
              <input ref={input} type="file" accept=".zip,.geojson,.json,.gpkg" className="sr-only" onChange={(e) => onFile(e.target.files?.[0])} />
              <p className="text-[11px] text-muted">In this UI build files aren’t parsed; a sample road is used.</p>
            </div>
            <p className="mt-4 text-[13px] text-muted">Or pick a sample road</p>
            <ul className="mt-2 space-y-1">
              {samples.map((a) => (
                <li key={a.id}>
                  <button
                    type="button"
                    onClick={() => start(a)}
                    aria-pressed={road?.id === a.id}
                    className="flex w-full items-center justify-between rounded-[8px] border border-line px-3 py-2 text-left text-[13px] transition-colors hover:border-line-strong aria-pressed:border-sentinel/60 aria-pressed:bg-sentinel/5"
                  >
                    <span className="text-fg">{a.name ?? `Village road · ${a.district}`}</span>
                    <span className="t-mono text-muted">{a.id}</span>
                  </button>
                </li>
              ))}
            </ul>
          </Panel>

          {step >= 0 && (
            <Panel className="p-4" aria-live="polite">
              <h2 className="text-[14px] font-medium text-fg">2. Processing</h2>
              <ol className="mt-3 space-y-2.5">
                {STEPS.map((s, i) => (
                  <li key={s} className="flex items-center gap-3 text-[14px]">
                    <span className={cn('grid size-5 place-items-center rounded-full border', i < step ? 'border-verified bg-verified/15 text-verified' : i === step ? 'border-sentinel text-sentinel' : 'border-line-strong text-muted')}>
                      {i < step ? <Check className="size-3" strokeWidth={2.5} /> : i === step ? <Loader2 className="size-3 animate-spin" strokeWidth={2} /> : null}
                    </span>
                    <span className={i <= step ? 'text-fg' : 'text-muted'}>{s}</span>
                  </li>
                ))}
              </ol>
              {file && <p className="t-mono mt-3 text-[11px] text-muted">{file.name} · {(file.size / 1024).toFixed(0)} KB</p>}
            </Panel>
          )}
        </div>

        <Panel className="min-h-[520px] overflow-hidden">
          {!done ? (
            <EmptyState className="h-full" title="No report yet" body="Upload a sanctioned road or pick a sample. The report shows sanctioned vs detected length, first-seen dates and before/after chips." />
          ) : (
            <article className="p-5">
              <header className="flex flex-wrap items-start justify-between gap-3 border-b border-line pb-4">
                <div>
                  <p className="text-[12px] text-muted">PMGSY audit report · draft · demo</p>
                  <h2 className="mt-1 text-[20px] font-medium text-fg">{road.name ?? `Village road · ${road.district}`}</h2>
                  <p className="t-mono mt-1 text-[12px] text-muted">
                    {road.id} · {road.district} · sanctioned 2021-22 (demo)
                  </p>
                </div>
                <div className="flex gap-2">
                  <Button size="sm" variant="ghost" onClick={() => (setStep(-1), setRoad(null))}>
                    <RotateCcw className="size-3.5" strokeWidth={1.75} /> New audit
                  </Button>
                  <Button size="sm" variant="subtle" onClick={() => toast('PDF export is part of the backend', { description: 'Reports are rendered with WeasyPrint on the server; this UI build isn’t connected yet.' })}>
                    <FileDown className="size-3.5" strokeWidth={1.75} /> Download PDF
                  </Button>
                </div>
              </header>
              <div className="mt-5 grid gap-5 xl:grid-cols-2">
                <section>
                  <h3 className="text-[13px] text-muted">Length</h3>
                  <HBars
                    className="mt-3"
                    max={sanctioned}
                    format={(v) => fmtKm(v, 2)}
                    rows={[
                      { label: 'Sanctioned', value: sanctioned, color: 'var(--road-existing)' },
                      { label: 'Detected', value: road.length_km, color: 'var(--signal)' },
                    ]}
                  />
                  <p className="mt-3 text-[14px] text-fg">
                    <span className="t-mono">{Math.round((road.length_km / sanctioned) * 100)}%</span> of the sanctioned length is visible on the ground.
                  </p>
                  <h3 className="mt-6 text-[13px] text-muted">First seen</h3>
                  <div className="mt-2 flex items-center justify-between rounded-card border border-line p-3">
                    <span className="text-[14px] text-fg">{dateLabel(road.first_seen)}</span>
                    <PersistenceDots values={road.persistence} dates={dates} />
                  </div>
                </section>
                <section className="relative min-h-[240px] overflow-hidden rounded-card border border-line">
                  <RwMap meta={meta} dateId="2024_pre_monsoon" base="s2" alerts={[road]} selectedId={road.id} showDemoLayers={false} initial={{ center: alertCentre(road), zoom: 13 }} ariaLabel="Coverage map" />
                </section>
              </div>
              <section className="mt-6">
                <h3 className="text-[13px] text-muted">Before / after</h3>
                {crop && meta ? (
                  <div className="mt-2 grid grid-cols-2 gap-2">
                    {[meta.dates[0], meta.dates.at(-1)!].map((d) => (
                      <figure key={d.id} className="relative aspect-square overflow-hidden rounded-card border border-line">
                        <svg viewBox={`${crop.x} ${crop.y} ${crop.size} ${crop.size}`} className="size-full" role="img" aria-label={`Composite ${d.label}`}>
                          <image href={DATA.zoneImage(d.id)} width={meta.size_px[0]} height={meta.size_px[1]} />
                        </svg>
                        <figcaption className="t-mono absolute top-2 left-2 rounded-chip bg-[#05070c]/75 px-2 py-0.5 text-[11px] text-[#e8edf5]/90">{dateShort(d.id)}</figcaption>
                      </figure>
                    ))}
                  </div>
                ) : (
                  <p className="mt-2 text-[13px] text-muted">Imagery chips for this road are cut during evaluation (zone A only in this build).</p>
                )}
              </section>
            </article>
          )}
        </Panel>
      </div>
    </div>
  )
}
