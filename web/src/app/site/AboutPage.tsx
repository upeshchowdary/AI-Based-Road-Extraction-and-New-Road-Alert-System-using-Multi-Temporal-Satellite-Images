import { useGSAP } from '@gsap/react'
import { gsap } from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { useRef } from 'react'
import { PageIntro, Section } from '@/components/site/PageIntro'
import { ButtonLink } from '@/components/ui/Button'
import { useReducedMotion } from '@/lib/motionPref'

gsap.registerPlugin(ScrollTrigger)

/** Roles from DECISIONS.md ADR-009. Names and photos are shown only with consent (none yet). */
const TEAM = [
  ['Model engineering lead', 'Models, pipeline and the system end to end.'],
  ['Spatial evidence & provenance lead', 'Data sources, licences and the evidence manifest.'],
  ['GIS workflow & delivery lead', 'Exports, QGIS workflows and the demo.'],
  ['Validation & uncertainty lead', 'Holdout evaluation, confidence intervals, negative tests.'],
  ['Training runs & reproducibility lead', 'Kaggle runs, seeds and the run log.'],
]

const TIMELINE = [
  ['Oct 2026', 'Foundation', 'Repository, frozen spatial holdout, pilot area (NTR + Krishna, 7,152 km²).', true],
  ['Oct 2026', 'Data pipeline', 'Seasonal Sentinel-2 composites for zones A–C; OSM road labels.', true],
  ['Oct 2026', 'CP1 review', 'Baseline A, mask → graph → GeoJSON, a map of extracted roads, KPI-1 with CIs.', false],
  ['CP2', 'Change detection', 'Graph matching, persistence and abstain rules, pixel-difference baseline, ablations.', false],
  ['CP2', 'Full system', 'Alerts, review loop, priority zones, PMGSY audit, radar, connectivity, offline mode.', false],
  ['CP2', 'Statewide', 'Tier 1 screening across Andhra Pradesh; final report and paper draft.', false],
] as const

export default function AboutPage() {
  const line = useRef<HTMLDivElement>(null)
  const reduced = useReducedMotion()
  useGSAP(() => {
    if (reduced || !line.current) return
    gsap.fromTo(line.current, { scaleY: 0 }, { scaleY: 1, ease: 'none', scrollTrigger: { trigger: line.current.parentElement, start: 'top 70%', end: 'bottom 60%', scrub: 0.6 } })
  }, [reduced])
  return (
    <>
      <PageIntro
        docTitle="About"
        title="Built to keep maps honest"
        lead="RoadWatch is a final-year capstone at KL University, built on problem statement SIH1564 from the Smart India Hackathon, issued by NTRO: extract roads from satellite imagery and alert on new ones."
      />
      <Section title="Mission">
        <p className="t-lead measure text-muted">Every new road should be visible to the people responsible for it — security analysts, rural road auditors and planners — within one season, with evidence they can check themselves.</p>
      </Section>
      <Section title="Team" lead="Five roles. Names and photos appear here once every member has agreed.">
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {TEAM.map(([r, d]) => (
            <li key={r} className="rounded-panel border border-line bg-surface p-5">
              <h3 className="text-[17px] font-medium text-fg">{r}</h3>
              <p className="mt-2 text-[14px] text-muted">{d}</p>
            </li>
          ))}
          <li className="rounded-panel border border-dashed border-line-strong p-5">
            <h3 className="text-[17px] font-medium text-fg">Faculty mentor</h3>
            <p className="mt-2 text-[14px] text-muted">Name to be added with permission.</p>
          </li>
        </ul>
      </Section>
      <Section title="Timeline">
        <div className="relative max-w-3xl pl-10">
          <span className="absolute top-2 bottom-2 left-[11px] w-[3px] rounded-full bg-line" aria-hidden />
          <div ref={line} className="absolute top-2 bottom-2 left-[11px] w-[3px] origin-top rounded-full bg-signal" aria-hidden style={{ background: 'repeating-linear-gradient(180deg, var(--signal) 0 14px, transparent 14px 22px)' }} />
          <ol className="space-y-10">
            {TIMELINE.map(([when, t, d, done]) => (
              <li key={t} className="relative">
                <span className={`absolute top-1.5 -left-[35px] size-4 rounded-full border-2 ${done ? 'border-signal bg-signal' : 'border-line-strong bg-bg0'}`} aria-hidden />
                <p className="t-mono text-[13px] text-muted">
                  {when} · {done ? 'done' : 'next'}
                </p>
                <h3 className="mt-1 text-[19px] font-medium text-fg">{t}</h3>
                <p className="mt-1 text-muted">{d}</p>
              </li>
            ))}
          </ol>
        </div>
      </Section>
      <Section title="Get in touch" className="border-b-0">
        <ButtonLink to="/contact" variant="outline" size="lg">
          Contact the team
        </ButtonLink>
      </Section>
    </>
  )
}
