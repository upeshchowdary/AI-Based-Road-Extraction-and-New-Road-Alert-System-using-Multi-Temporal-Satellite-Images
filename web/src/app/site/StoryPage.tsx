import type { Map as MlMap } from 'maplibre-gl'
import { ArrowRight } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { Navigate, useParams } from 'react-router'
import { DEFAULT_VISIBILITY } from '@/components/map/nightSurveyStyle'
import { RwMap } from '@/components/map/LazyMap'
import { ButtonLink } from '@/components/ui/Button'
import { DATA, useJson, type ZoneMeta } from '@/lib/data'
import { useReducedMotion } from '@/lib/motionPref'

interface Step {
  date: string
  center: [number, number]
  zoom: number
  title: string
  body: string
  showNew?: boolean
}

/** Every step uses a real composite; captions are visual readings of that imagery. */
const STEPS: Step[] = [
  { date: '2022_pre_monsoon', center: [80.6, 16.55], zoom: 10.6, title: 'Zone A, April 2022', body: 'Vijayawada sits where the Krishna leaves the Eastern Ghats. Our first composite is the per-pixel median of 5 Sentinel-2 acquisitions, with clouds masked.' },
  { date: '2022_pre_monsoon', center: [80.575, 16.555], zoom: 13.2, title: 'Earthwork first', body: 'North of the river, a fresh earth embankment curves through the fields. In the channel, a line of bridge piers.' },
  { date: '2022_post_monsoon', center: [80.57, 16.535], zoom: 13.4, title: 'November 2022: a deck appears', body: 'After the monsoon, part of the bridge deck is visible across the water. A second sighting — this is when the persistence rule would fire.' },
  { date: '2023_post_monsoon', center: [80.57, 16.535], zoom: 13.4, title: 'November 2023: the bridge is complete', body: 'The deck spans the river and the approaches are cleared on both banks.' },
  { date: '2024_pre_monsoon', center: [80.565, 16.53], zoom: 12.2, title: 'April 2024: a corridor', body: 'The full alignment is visible north and south of the Krishna. OpenStreetMap now maps it as the Vijayawada West Bypass (NH16).', showNew: true },
  { date: '2025_pre_monsoon', center: [80.57, 16.535], zoom: 13.4, title: 'April 2025: surfaced', body: 'The bright new concrete has darkened: the deck has been surfaced. Construction stage moves from earthwork to paved.' },
  { date: '2026_pre_monsoon', center: [80.555, 16.515], zoom: 13.2, title: 'April 2026: what grows beside it', body: 'In the newest composite, a grid of new plot boundaries appears south-west of the bypass. New roads attract new roads — the next candidates to watch.' },
]

export default function StoryPage() {
  const { slug } = useParams()
  const meta = useJson<ZoneMeta>(DATA.zoneMeta).data
  const reduced = useReducedMotion()
  const [step, setStep] = useState(0)
  const [map, setMap] = useState<MlMap | null>(null)
  const cards = useRef<(HTMLElement | null)[]>([])

  useEffect(() => {
    document.title = 'A new corridor crosses the Krishna — RoadWatch stories'
  }, [])

  useEffect(() => {
    const io = new IntersectionObserver(
      (es) => {
        for (const e of es) if (e.isIntersecting) setStep(Number((e.target as HTMLElement).dataset.step))
      },
      { rootMargin: '-50% 0px -50% 0px' },
    )
    cards.current.forEach((c) => c && io.observe(c))
    return () => io.disconnect()
  }, [])

  useEffect(() => {
    const s = STEPS[step]
    map?.flyTo({ center: s.center, zoom: s.zoom, duration: reduced ? 0 : 1600, essential: true })
  }, [map, step, reduced])

  if (slug !== 'a-new-corridor') return <Navigate to="/stories" replace />
  const s = STEPS[step]
  return (
    <article className="relative">
      <div className="sticky top-0 h-dvh">
        <RwMap
          meta={meta}
          dateId={s.date}
          base="s2"
          visible={{ ...DEFAULT_VISIBILITY, newRoads: Boolean(s.showNew), abstain: false, priority: false, existing: false }}
          showDemoLayers={false}
          alerts={undefined}
          onReady={setMap}
          interactive={false}
          initial={{ center: STEPS[0].center, zoom: STEPS[0].zoom }}
          ariaLabel={`Sentinel-2 composite: ${s.title}`}
        />
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-r from-bg0/70 via-transparent to-transparent" />
        <div className="t-mono absolute right-4 bottom-4 rounded-chip bg-[#05070c]/75 px-2 py-1 text-[11px] text-[#e8edf5]/85">Contains modified Copernicus Sentinel data 2022–2026</div>
      </div>
      <div className="relative -mt-[100dvh]">
        <header className="flex min-h-dvh items-end pb-[18vh]">
          <div className="container-rw">
            <p className="t-mono text-sentinel-ink">Story · zone A · 2022 → 2026</p>
            <h1 className="t-h1 mt-4 max-w-3xl text-balance text-fg">A new corridor crosses the Krishna</h1>
            <p className="t-lead mt-5 max-w-xl text-muted">Scroll. Each step is a real seasonal composite.</p>
          </div>
        </header>
        {STEPS.map((st, i) => (
          <section key={i} ref={(el) => void (cards.current[i] = el)} data-step={i} className="flex min-h-[100dvh] items-center">
            <div className="container-rw">
              <div className="max-w-md rounded-panel border border-line bg-bg0/88 p-6 backdrop-blur-md">
                <p className="t-mono text-[12px] text-muted">
                  {i + 1} / {STEPS.length}
                </p>
                <h2 className="t-h3 mt-2 text-fg">{st.title}</h2>
                <p className="mt-3 text-muted">{st.body}</p>
              </div>
            </div>
          </section>
        ))}
        <section className="flex min-h-[80dvh] items-center">
          <div className="container-rw">
            <div className="max-w-md rounded-panel border border-line bg-bg0/90 p-6 backdrop-blur-md">
              <h2 className="t-h3 text-fg">What RoadWatch adds</h2>
              <p className="mt-3 text-muted">The same sequence, detected automatically for every tile in the state, with an alert at the second sighting. Detections for this story appear after evaluation.</p>
              <ButtonLink to="/explore" variant="signal" size="lg" className="mt-6">
                Explore it yourself <ArrowRight className="size-4" strokeWidth={1.75} aria-hidden />
              </ButtonLink>
            </div>
          </div>
        </section>
      </div>
    </article>
  )
}
