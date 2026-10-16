import { useGSAP } from '@gsap/react'
import { gsap } from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { useRef, useState } from 'react'
import { cn } from '@/lib/cn'
import { DATA, useJson, type AlertsFile, type HeroPaths } from '@/lib/data'
import { useReducedMotion } from '@/lib/motionPref'
import { useMediaQuery } from '@/lib/useMediaQuery'
import { PipelineTile } from './PipelineTile'

gsap.registerPlugin(ScrollTrigger)

export const PIPELINE = [
  {
    t: 'Satellite image',
    d: 'Sentinel-2 composites every season at 10 m, high-resolution imagery for the pilot zones.',
    note: 'Real: pre-monsoon 2024 composite, median of 8 Sentinel-2 scenes.',
  },
  {
    t: 'Clouds and shadows masked',
    d: 'Unusable pixels are hatched and never guessed. Bad tiles abstain instead of raising alerts.',
    note: 'This composite is cloud-free. Hatched shapes illustrate how masked pixels look.',
  },
  {
    t: 'Road mask',
    d: 'A segmentation model marks every pixel that is road.',
    note: "Shown: OpenStreetMap road labels, the training target. The model's own masks are on the map (Roads extracted by RoadWatch).",
  },
  {
    t: 'Road graph',
    d: 'Pixels become centre-lines and junctions — a network you can measure, not a picture.',
    note: 'Centre-lines and end nodes from OpenStreetMap geometry.',
  },
  {
    t: 'Compared over time',
    d: 'Graphs from two dates are matched. Roads that match fade. Roads that don’t, glow.',
    note: 'Amber: Vijayawada West Bypass, absent in 2022, present in 2024.',
  },
  {
    t: 'Alert',
    d: 'A new road must persist across dates and connect to the network. Then you get the proof.',
    note: 'Illustration: this score breakdown uses example values. Real alerts are on the map and in Alerts.',
  },
]

function StepList({ step, onPick, interactive }: { step: number; onPick?: (i: number) => void; interactive: boolean }) {
  return (
    <ol className="relative space-y-1">
      <span aria-hidden className="absolute top-4 bottom-4 left-[15px] w-px bg-line" />
      <span
        aria-hidden
        className="absolute top-4 left-[15px] w-px origin-top bg-sentinel transition-transform duration-500 ease-out-expo shadow-[0_0_8px_rgba(79,209,232,0.5)]"
        style={{ height: 'calc(100% - 32px)', transform: `scaleY(${step / (PIPELINE.length - 1)})` }}
      />
      {PIPELINE.map((s, i) => {
        const Tag = interactive ? 'button' : 'div'
        const isCur = i === step
        return (
          <li key={s.t} className="relative">
            <Tag
              {...(interactive ? { type: 'button' as const, onClick: () => onPick?.(i), 'aria-pressed': isCur } : {})}
              className={cn(
                'group flex w-full gap-4 rounded-[10px] p-3 text-left transition-all duration-300',
                isCur
                  ? 'border border-line-strong/80 bg-white/[0.04] shadow-[0_4px_24px_rgba(0,0,0,0.3)] backdrop-blur-sm'
                  : 'border border-transparent hover:bg-white/[0.02]',
                interactive && 'cursor-pointer',
              )}
            >
              <span
                className={cn(
                  't-mono relative z-10 mt-0.5 grid size-7 shrink-0 place-items-center rounded-full border text-[11px] font-semibold transition-all duration-300',
                  isCur
                    ? 'border-sentinel bg-sentinel/20 text-sentinel shadow-[0_0_12px_rgba(79,209,232,0.3)]'
                    : i < step
                    ? 'border-sentinel/50 bg-bg0 text-sentinel-ink'
                    : 'border-line-strong bg-bg0 text-muted',
                )}
              >
                {i + 1}
              </span>
              <span className="min-w-0 flex-1">
                <span
                  className={cn(
                    'block text-[18px] leading-snug font-medium transition-colors duration-300',
                    isCur ? 'text-fg font-semibold' : 'text-muted group-hover:text-fg/80',
                  )}
                >
                  {s.t}
                </span>
                <span
                  className={cn(
                    'grid transition-[grid-template-rows,opacity] duration-500 ease-out-expo',
                    isCur ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0',
                  )}
                >
                  <span className="overflow-hidden">
                    <span className="block pt-1.5 text-[14px] leading-relaxed text-muted">{s.d}</span>
                  </span>
                </span>
              </span>
            </Tag>
          </li>
        )
      })}
    </ol>
  )
}

export function Pipeline() {
  const reduced = useReducedMotion()
  const wide = useMediaQuery('(min-width: 1024px)')
  const paths = useJson<HeroPaths>(DATA.heroPaths).data
  const alert = useJson<AlertsFile>(DATA.demoAlerts).data?.alerts.find((a) => a.featured)
  const [step, setStep] = useState(0)
  const section = useRef<HTMLElement>(null)
  const pinned = wide && !reduced

  useGSAP(
    () => {
      if (!pinned) return
      ScrollTrigger.create({
        trigger: section.current,
        start: 'top top',
        end: 'bottom bottom',
        onUpdate: (self) => {
          const s = Math.min(PIPELINE.length - 1, Math.floor(self.progress * PIPELINE.length))
          setStep((cur) => (cur === s ? cur : s))
        },
      })
    },
    { dependencies: [pinned], revertOnUpdate: true },
  )

  const header = (
    <div className="max-w-xl">
      <h2 className="t-h1 text-fg">How it works</h2>
      <p className="t-lead mt-5 text-muted">One image tile, six steps, from raw pixels to an alert you can check.</p>
    </div>
  )

  if (!pinned) {
    return (
      <section id="how-it-works" aria-labelledby="hiw" className="section-y scroll-mt-16 border-t border-line bg-bg1">
        <div className="container-rw">
          <div id="hiw">{header}</div>
          <div className="mt-12 grid gap-10 md:grid-cols-2">
            <div>
              <PipelineTile step={step} paths={paths} alert={alert} />
              <p className="mt-3 text-[13px] text-muted" aria-live="polite">
                {PIPELINE[step].note}
              </p>
            </div>
            <StepList step={step} onPick={setStep} interactive />
          </div>
        </div>
      </section>
    )
  }

  return (
    <section ref={section} id="how-it-works" aria-labelledby="hiw" className="relative border-t border-line bg-bg1" style={{ height: `${PIPELINE.length * 70 + 100}vh` }}>
      <div className="sticky top-0 flex h-dvh items-center">
        <div className="container-rw grid w-full grid-cols-12 items-center gap-10 pt-16">
          <div className="col-span-5">
            <div id="hiw">{header}</div>
            <div className="mt-10">
              <StepList step={step} interactive={false} />
            </div>
          </div>
          <div className="col-span-6 col-start-7">
            <PipelineTile step={step} paths={paths} alert={alert} className="mx-auto max-h-[72vh] max-w-[72vh]" />
            <p className="mx-auto mt-3 max-w-[72vh] text-[13px] text-muted" aria-live="polite">
              <span className="t-mono mr-2 text-sentinel-ink">{String(step + 1).padStart(2, '0')}/06</span>
              {PIPELINE[step].note}
            </p>
          </div>
        </div>
      </div>
    </section>
  )
}
