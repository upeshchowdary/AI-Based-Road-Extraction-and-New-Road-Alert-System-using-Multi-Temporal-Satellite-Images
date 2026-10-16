import { useGSAP } from '@gsap/react'
import { gsap } from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { useLenis } from 'lenis/react'
import { ArrowRight } from 'lucide-react'
import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router'
import { AlertCard } from '@/components/alerts/AlertCard'
import { UtcClock } from '@/components/brand/Brand'
import { Magnetic } from '@/components/motion/Magnetic'
import type { HeroState } from '@/components/three/HeroScene'
import { cameraAt } from '@/components/three/cameraPath'
import { ButtonLink } from '@/components/ui/Button'
import { ease } from '@/design/motion'
import { cn } from '@/lib/cn'
import { DATA, useJson, type AlertsFile, type HeroPaths, type ZoneMeta } from '@/lib/data'
import { fmtInt, fmtLat, fmtLon } from '@/lib/format'
import { useQualityTier } from '@/lib/gpuTier'
import { useReducedMotion } from '@/lib/motionPref'
import { useMediaQuery } from '@/lib/useMediaQuery'
import { useResolvedTheme } from '@/lib/theme'
import { GlobePoster } from './GlobePoster'
import { RoadReveal, type RoadRevealHandles } from './RoadReveal'

gsap.registerPlugin(ScrollTrigger)

const HeroScene = lazy(() => import('@/components/three/HeroScene'))

const STAGES = [
  { label: 'Orbit', at: 0 },
  { label: 'India', at: 0.2 },
  { label: 'Andhra Pradesh', at: 0.44 },
  { label: 'Road', at: 0.8 },
] as const
const stageIndex = (p: number) => (p < 0.12 ? 0 : p < 0.32 ? 1 : p < 0.6 ? 2 : 3)

function useHeroData() {
  const meta = useJson<ZoneMeta>(DATA.zoneMeta)
  const paths = useJson<HeroPaths>(DATA.heroPaths)
  const alerts = useJson<AlertsFile>(DATA.demoAlerts)
  const featured = alerts.data?.alerts.find((a) => a.featured)
  return { meta: meta.data, paths: paths.data, featured, dates: alerts.data?.dates ?? [] }
}

export function Hero() {
  const reduced = useReducedMotion()
  const small = useMediaQuery('(max-width: 767px)')
  if (reduced || small) return <HeroStatic />
  return <HeroPinned />
}

function Headline({ className }: { className?: string }) {
  const ref = useRef<HTMLDivElement>(null)
  const reduced = useReducedMotion()

  useGSAP(() => {
    if (reduced || !ref.current) return
    // Word-by-word stagger on mount (not scroll-driven — fires immediately)
    const words = ref.current.querySelectorAll<HTMLElement>('.rw-word')
    gsap.from(words, {
      yPercent: 110,
      opacity: 0,
      duration: 1.0,
      ease: 'expo.out',
      stagger: 0.055,
      delay: 0.15,
    })
    gsap.from(ref.current.querySelector('.rw-sub'), {
      opacity: 0,
      y: 18,
      duration: 0.9,
      ease: 'expo.out',
      delay: 0.65,
    })
    gsap.from(ref.current.querySelector('.rw-ctas'), {
      opacity: 0,
      y: 14,
      duration: 0.8,
      ease: 'expo.out',
      delay: 0.9,
    })
  }, { scope: ref, dependencies: [reduced] })

  const words = ['Every', 'new', 'road.']
  const words2 = ['Seen', 'first.']
  return (
    <div ref={ref} className={className}>
      <h1 className="t-display text-balance leading-[0.92]" style={{ fontFeatureSettings: "'kern', 'ss01'" }}>
        <span className="block overflow-hidden">
          {words.map((w) => (
            <span key={w} className="rw-word mr-[0.22em] inline-block text-fg">{w}</span>
          ))}
        </span>
        <span className="block overflow-hidden mt-1">
          {words2.map((w, i) => (
            <span
              key={w}
              className="rw-word mr-[0.22em] inline-block"
              style={{
                color: i === 1 ? 'var(--signal)' : 'var(--text)',
                fontFamily: i === 1 ? 'var(--font-serif)' : undefined,
                fontStyle: i === 1 ? 'italic' : undefined,
              }}
            >{w}</span>
          ))}
        </span>
      </h1>
      <p className="rw-sub t-lead mt-7 max-w-[34rem] text-pretty" style={{ color: 'var(--text-muted)' }}>
        RoadWatch reads satellite images of Andhra Pradesh, maps every road, and alerts you the moment a new one appears —{' '}
        <span style={{ color: 'var(--text)', fontWeight: 500 }}>with the proof.</span>
      </p>
      <div className="rw-ctas mt-10 flex flex-wrap items-center gap-4">
        <Magnetic>
          <ButtonLink to="/map" variant="signal" size="lg">
            Open the map
            <ArrowRight className="size-4" strokeWidth={1.75} aria-hidden />
          </ButtonLink>
        </Magnetic>
        <ButtonLink to="/#how-it-works" variant="ghost" size="lg">
          See how it works
        </ButtonLink>
      </div>
    </div>
  )
}

function HeroPinned() {
  const tier = useQualityTier()
  const light = useResolvedTheme() === 'light'
  const { meta, paths, featured, dates } = useHeroData()
  const state = useMemo<HeroState>(() => ({ progress: 0, t0: performance.now() }), [])
  const [sceneReady, setSceneReady] = useState(false)
  const [active, setActive] = useState(true)
  const lenis = useLenis()

  const section = useRef<HTMLElement>(null)
  const canvasWrap = useRef<HTMLDivElement>(null)
  const revealWrap = useRef<HTMLDivElement>(null)
  const reveal = useRef<RoadRevealHandles>(null)
  const dim = useRef<HTMLDivElement>(null)
  const wash = useRef<HTMLDivElement>(null)
  const s1 = useRef<HTMLDivElement>(null)
  const s2 = useRef<HTMLDivElement>(null)
  const s3 = useRef<HTMLDivElement>(null)
  const s4 = useRef<HTMLDivElement>(null)
  const s5 = useRef<HTMLDivElement>(null)
  const reticle = useRef<HTMLDivElement>(null)
  const counter = useRef<HTMLSpanElement>(null)
  const card = useRef<HTMLDivElement>(null)
  const rail = useRef<HTMLOListElement>(null)
  const railFill = useRef<HTMLDivElement>(null)
  const hud = useRef<{ lat: HTMLElement | null; lon: HTMLElement | null; alt: HTMLElement | null }>({ lat: null, lon: null, alt: null })
  const hudText = useRef<HTMLDivElement>(null)
  const onReady = useCallback(() => setSceneReady(true), [])

  // HUD readout = the real camera sub-point and altitude (same path function as the 3D scene).
  useEffect(() => {
    let lastActive = true
    const tick = () => {
      const c = cameraAt(state.progress, (performance.now() - state.t0) / 1000)
      const h = hud.current
      if (h.lat) h.lat.textContent = fmtLat(c.lat, 2)
      if (h.lon) h.lon.textContent = fmtLon(c.lon, 2)
      if (h.alt) h.alt.textContent = `${fmtInt(c.altKm)} km`
      const a = state.progress < 0.66
      if (a !== lastActive) {
        lastActive = a
        setActive(a)
      }
      if (rail.current) {
        const idx = stageIndex(state.progress)
        rail.current.querySelectorAll('button').forEach((b, i) => {
          if (i === idx) b.setAttribute('aria-current', 'step')
          else b.removeAttribute('aria-current')
        })
      }
      if (railFill.current) railFill.current.style.transform = `scaleY(${state.progress})`
    }
    gsap.ticker.add(tick)
    return () => gsap.ticker.remove(tick)
  }, [state])

  // Stop rendering WebGL when the hero is off-screen.
  useEffect(() => {
    const el = section.current
    if (!el) return
    const io = new IntersectionObserver(([e]) => {
      if (!e.isIntersecting) setActive(false)
      else setActive(state.progress < 0.66)
    })
    io.observe(el)
    return () => io.disconnect()
  }, [state])

  const ready = Boolean(meta && paths)  // the alert card is optional; the descent must always run

  useGSAP(
    () => {
      if (!ready) return
      const r = reveal.current!
      const tl = gsap.timeline({
        defaults: { ease: 'none' },
        scrollTrigger: { trigger: section.current, start: 'top top', end: 'bottom bottom', scrub: 0.8 },
        onUpdate: () => {
          state.progress = tl.progress()
        },
      })
      tl.set({}, {}, 1)
      // Stage 1 → out
      tl.to(s1.current, { autoAlpha: 0, y: -48, duration: 0.07, ease: 'power2.in' }, 0.035)
      tl.to(wash.current, { autoAlpha: 0, duration: 0.08, ease: 'power1.inOut' }, 0.04)
      // Stage 2 — India
      tl.fromTo(reticle.current, { autoAlpha: 0, scale: 1.5 }, { autoAlpha: 1, scale: 1, duration: 0.06, ease: 'expo.out' }, 0.14)
      tl.fromTo(s2.current, { autoAlpha: 0, y: 28 }, { autoAlpha: 1, y: 0, duration: 0.05, ease: 'power2.out' }, 0.15)
      tl.to([s2.current, reticle.current], { autoAlpha: 0, y: -24, duration: 0.04, ease: 'power2.in' }, 0.27)
      // Stage 3 — Andhra Pradesh
      tl.fromTo(s3.current, { autoAlpha: 0, y: 28 }, { autoAlpha: 1, y: 0, duration: 0.05, ease: 'power2.out' }, 0.34)
      const c = { v: 0 }
      tl.to(c, { v: 1.63, duration: 0.12, ease: 'power1.out', onUpdate: () => counter.current && (counter.current.textContent = c.v.toFixed(2)) }, 0.35)
      tl.to(s3.current, { autoAlpha: 0, y: -24, duration: 0.035, ease: 'power2.in' }, 0.545)
      // Dive into zone A: the globe gives way to the real Sentinel-2 composite
      tl.fromTo(revealWrap.current, { clipPath: 'circle(2% at 50% 50%)', autoAlpha: 0 }, { clipPath: 'circle(75% at 50% 50%)', autoAlpha: 1, duration: 0.07, ease: 'power2.in' }, 0.56)
      tl.fromTo(r.root, { scale: 1.6 }, { scale: 1, duration: 0.09, ease: 'power2.out' }, 0.56)
      tl.to(canvasWrap.current, { autoAlpha: 0, duration: 0.04 }, 0.6)
      tl.to(hudText.current, { autoAlpha: 0, duration: 0.03 }, 0.58)
      // Stage 4 — the road
      tl.fromTo(s4.current, { autoAlpha: 0, y: 24 }, { autoAlpha: 1, y: 0, duration: 0.04, ease: 'power2.out' }, 0.64)
      tl.fromTo(r.scan, { xPercent: -100 }, { xPercent: 0, duration: 0.12, ease: ease.scan }, 0.66)
      tl.fromTo(r.after, { clipPath: 'inset(0 100% 0 0)' }, { clipPath: 'inset(0 0% 0 0)', duration: 0.12, ease: ease.scan }, 0.66)
      tl.to(r.scan, { autoAlpha: 0, duration: 0.02 }, 0.78)
      tl.to([...r.newGlow, ...r.newRoads], { strokeDashoffset: 0, duration: 0.09, ease: 'power1.inOut' }, 0.77)
      if (card.current) tl.fromTo(card.current, { autoAlpha: 0, x: 48 }, { autoAlpha: 1, x: 0, duration: 0.05, ease: 'expo.out' }, 0.845)
      // Stage 5 — handoff
      tl.to(s4.current, { autoAlpha: 0, duration: 0.03 }, 0.9)
      tl.to(dim.current, { autoAlpha: 1, duration: 0.05 }, 0.9)
      tl.fromTo(s5.current, { autoAlpha: 0, y: 28 }, { autoAlpha: 1, y: 0, duration: 0.05, ease: 'power2.out' }, 0.91)
    },
    { scope: section, dependencies: [ready], revertOnUpdate: true },
  )

  const goStage = (at: number) => {
    const el = section.current
    if (!el) return
    const top = el.offsetTop + at * (el.offsetHeight - window.innerHeight)
    if (lenis) lenis.scrollTo(top, { duration: 1.4 })
    else window.scrollTo({ top, behavior: 'smooth' })
  }

  return (
    <section ref={section} aria-label="From orbit to the road" className="relative h-[460vh] bg-bg0">
      <div className="sticky top-0 h-dvh overflow-hidden">
        {/* Globe: CSS poster first, WebGL fades in once textures are ready */}
        <div ref={canvasWrap} className="absolute inset-0">
          <GlobePoster
            className={cn(
              'top-1/2 left-[70%] size-[min(82vh,56vw)] -translate-x-1/2 -translate-y-1/2 transition-opacity duration-700',
              sceneReady && 'opacity-0',
            )}
          />
          {tier && tier !== 'low' && (
            <div className={cn('absolute inset-0 transition-opacity duration-1000', sceneReady ? 'opacity-100' : 'opacity-0')}>
              <Suspense fallback={null}>
                <HeroScene tier={tier} state={state} active={active} onReady={onReady} light={light} />
              </Suspense>
            </div>
          )}
          <div
            ref={wash}
            className="pointer-events-none absolute inset-0"
            style={{ background: 'linear-gradient(90deg, var(--bg-0) 0%, color-mix(in oklab, var(--bg-0) 72%, transparent) 30%, transparent 58%)' }}
          />
        </div>

        {/* Stage 4/5 layer: real imagery of zone A */}
        <div ref={revealWrap} className="invisible absolute inset-0">
          <RoadReveal ref={reveal} meta={meta} paths={paths} />
          <div ref={dim} className="invisible absolute inset-0 bg-[#05070c]/55" />
        </div>

        {/* India reticle (no national boundary is drawn — see DECISIONS ADR-018) */}
        <div ref={reticle} className="pointer-events-none invisible absolute top-1/2 left-1/2 size-56 -translate-x-1/2 -translate-y-1/2" aria-hidden>
          <svg viewBox="0 0 100 100" className="size-full text-sentinel">
            <circle cx="50" cy="50" r="38" fill="none" stroke="currentColor" strokeWidth="0.4" strokeDasharray="1.5 2.5" />
            <path d="M50 4 V16 M50 84 V96 M4 50 H16 M84 50 H96" stroke="currentColor" strokeWidth="0.6" />
            <circle cx="50" cy="50" r="1.2" fill="currentColor" />
          </svg>
        </div>

        {/* Text stages (one visible at a time) */}
        <div className="container-bleed pointer-events-none relative flex h-full items-center">
          <div ref={s1} className="pointer-events-auto max-w-[44rem] pt-10">
            <Headline />
          </div>
          <div ref={s2} className="invisible absolute bottom-[18vh] left-[var(--gutter)] max-w-md">
            <p className="t-mono text-sentinel-ink">India · 3.29 M km²</p>
            <p className="t-h3 mt-3 text-fg">One country. Roads change every season.</p>
          </div>
          <div ref={s3} className="invisible absolute bottom-[18vh] left-[var(--gutter)] max-w-lg">
            <p className="t-mono text-sentinel-ink">Andhra Pradesh · Sentinel-2 grid 10 m</p>
            <p className="t-h2 mt-3 text-fg">
              <span ref={counter} className="tabular">0.00</span> lakh km²
            </p>
            <p className="t-lead mt-2 text-muted">watched every season, tile by tile.</p>
          </div>
          <div ref={s4} className="invisible absolute top-[18vh] left-[var(--gutter)] max-w-md">
            <p className="t-mono text-[#e8edf5]/80">Vijayawada · 2022 → 2024</p>
            <p className="t-h3 mt-3 text-[#e8edf5]">
              A satellite pass. Known roads in white. <span className="text-[#ff8a4c]">The new one in orange.</span>
            </p>
          </div>
          <div ref={s5} className="pointer-events-auto invisible absolute bottom-[14vh] left-[var(--gutter)] max-w-lg">
            <p className="t-h2 text-[#e8edf5]">Now explore it yourself.</p>
            <p className="t-lead mt-3 text-[#e8edf5]/80">Satellite and street maps of the whole world, our own seasonal composites, extracted roads and real alerts.</p>
            <ButtonLink to="/map" variant="signal" size="lg" className="mt-7">
              Open the live map
              <ArrowRight className="size-4" strokeWidth={1.75} aria-hidden />
            </ButtonLink>
          </div>
        </div>

        {featured && meta && (
          <div className="pointer-events-none absolute inset-y-0 right-[calc(var(--gutter)+128px)] flex items-center">
            <AlertCard
              ref={card}
              alert={featured}
              dates={dates}
              className="pointer-events-auto invisible"
              lengthNote="Length is the OpenStreetMap centreline inside zone A."
            />
          </div>
        )}

        {/* HUD — corner brackets + live camera readout */}
        <div aria-hidden className="pointer-events-none absolute inset-x-5 top-20 bottom-5 sm:inset-x-8">
          {(['top-0 left-0 border-t border-l', 'top-0 right-0 border-t border-r', 'bottom-0 left-0 border-b border-l', 'bottom-0 right-0 border-b border-r'] as const).map((c) => (
            <span key={c} className={cn('absolute size-4 border-line-strong', c)} />
          ))}
        </div>


        <div ref={hudText}>
          <div className="t-mono pointer-events-none absolute bottom-9 left-[calc(var(--gutter)+12px)] hidden gap-5 text-[12px] text-muted md:flex" aria-label="Camera position">
            <span>
              CAM <span className="text-fg" ref={(el) => void (hud.current.lat = el)} /> <span className="text-fg" ref={(el) => void (hud.current.lon = el)} />
            </span>
            <span>
              ALT <span className="text-fg" ref={(el) => void (hud.current.alt = el)} />
            </span>
          </div>

          {/* Animated Scroll Prompt */}
          <div className="pointer-events-none absolute bottom-7 left-1/2 -translate-x-1/2 hidden flex-col items-center gap-1.5 text-center opacity-70 transition-opacity duration-300 md:flex">
            <span className="text-[10px] font-mono tracking-widest uppercase text-muted">Scroll to descend</span>
            <div className="h-4 w-2.5 rounded-full border border-muted/50 p-0.5 flex justify-center">
              <div className="size-1 rounded-full bg-sentinel animate-bounce motion-reduce:animate-none" />
            </div>
          </div>

          <div className="t-mono pointer-events-none absolute right-[calc(var(--gutter)+12px)] bottom-9 hidden text-[12px] text-muted md:block">
            <UtcClock /> · sun position live
          </div>
        </div>

        {/* Scroll progress rail */}
        <nav aria-label="Hero stages" className="absolute top-1/2 right-5 hidden -translate-y-1/2 lg:block">
          <div className="absolute top-1 right-[5px] bottom-1 w-px bg-line">
            <div ref={railFill} className="h-full w-full origin-top bg-sentinel" style={{ transform: 'scaleY(0)' }} />
          </div>
          <ol ref={rail} className="relative flex flex-col gap-7">
            {STAGES.map((s) => (
              <li key={s.label}>
                <button
                  type="button"
                  onClick={() => goStage(s.at)}
                  className="group flex items-center gap-3 text-[12px] text-muted transition-colors hover:text-fg aria-[current=step]:text-fg"
                >
                  <span className="opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100 group-aria-[current=step]:opacity-100 font-mono text-[11px] tracking-wider uppercase">{s.label}</span>
                  <span className="relative size-[11px] rounded-full border border-line-strong bg-bg0 transition-all group-aria-[current=step]:border-sentinel group-aria-[current=step]:bg-sentinel group-aria-[current=step]:shadow-[0_0_0_4px_color-mix(in_oklab,var(--sentinel)_18%,transparent)]" />
                </button>
              </li>
            ))}
          </ol>
        </nav>
      </div>
    </section>
  )
}

/** Mobile / reduced motion: the same story as a calm, static sequence (no WebGL, no scrubbing). */
function HeroStatic() {
  const { meta, paths, featured, dates } = useHeroData()
  const reduced = useReducedMotion()
  const steps = [
    { k: 'Orbit', t: 'Sentinel-2 passes over every five days, 786 km up.' },
    { k: 'India', t: '3.29 million km². Roads change every season.' },
    { k: 'Andhra Pradesh', t: '1.63 lakh km² watched every season, tile by tile.' },
    { k: 'Road', t: 'Known roads in steel. The new one in amber — with the proof.' },
  ]
  return (
    <section aria-label="From orbit to the road" className="relative overflow-hidden bg-bg0">
      <div className="relative min-h-[92dvh] pt-28 pb-16">
        <GlobePoster spin={!reduced} className="top-[58%] left-1/2 size-[130vw] max-w-[760px] -translate-x-1/2 opacity-70 md:left-[70%] md:size-[min(78vh,52vw)]" />
        <div className="absolute inset-0 bg-gradient-to-b from-bg0/30 via-bg0/50 to-bg0" />
        <div className="container-rw relative">
          <Headline />
        </div>
      </div>
      <div className="container-rw relative pb-20">
        <ol className="grid gap-6 border-l border-line pl-5 sm:grid-cols-2 sm:border-l-0 sm:pl-0">
          {steps.map((s, i) => (
            <li key={s.k} className="sm:border-t sm:border-line sm:pt-4">
              <span className="t-mono text-sentinel-ink">
                {i + 1} · {s.k}
              </span>
              <p className="mt-1.5 text-fg">{s.t}</p>
            </li>
          ))}
        </ol>
        <div className="relative mt-10 aspect-[4/5] overflow-hidden rounded-panel border border-line sm:aspect-[16/10]">
          <RoadReveal meta={meta} paths={paths} staticMode />
        </div>
        {featured && (
          <AlertCard
            alert={featured}
            dates={dates}
            className="relative mt-4 w-full max-w-none"
            lengthNote="Length is the OpenStreetMap centreline inside zone A. Score, stage and dates in this illustration are example values."
          />
        )}
        <Link to="/map" className="mt-6 inline-flex items-center gap-2 text-sentinel-ink underline-offset-4 hover:underline">
          Now explore it yourself
          <ArrowRight className="size-4" strokeWidth={1.75} aria-hidden />
        </Link>
      </div>
    </section>
  )
}
