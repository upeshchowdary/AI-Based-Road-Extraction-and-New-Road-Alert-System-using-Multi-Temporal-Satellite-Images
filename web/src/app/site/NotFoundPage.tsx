import { useEffect } from 'react'
import { ContourBg } from '@/components/brand/Brand'
import { ButtonLink } from '@/components/ui/Button'

export default function NotFoundPage() {
  useEffect(() => {
    document.title = 'Not found — RoadWatch'
  }, [])
  return (
    <section className="relative flex min-h-[92dvh] items-center overflow-hidden pt-24">
      <ContourBg seed={11} opacity={0.4} />
      <div className="container-rw relative grid items-center gap-12 lg:grid-cols-2">
        <div>
          <p className="t-mono text-muted">404</p>
          <h1 className="t-h1 mt-4 text-fg">
            This road doesn’t exist… <span className="t-serif">yet.</span>
          </h1>
          <p className="t-lead mt-5 max-w-md text-muted">The page you followed isn’t on the map. It may have moved, or the link is wrong.</p>
          <ButtonLink to="/" variant="outline" size="lg" className="mt-8">
            Back to home
          </ButtonLink>
        </div>
        <svg viewBox="0 0 400 300" className="w-full max-w-lg" role="img" aria-label="A road that slowly draws itself and ends in a dead end">
          <rect width="400" height="300" rx="20" fill="var(--bg-1)" stroke="var(--line)" />
          <g fill="none" stroke="var(--road-existing)" strokeWidth="3" strokeLinecap="round" opacity="0.7">
            <path d="M0 220 C 80 210, 120 170, 200 160 S 330 150, 400 120" />
            <path d="M140 300 L 170 168" />
          </g>
          <path d="M200 160 C 220 120, 250 100, 290 90" stroke="var(--signal)" strokeWidth="3.5" fill="none" strokeLinecap="round" pathLength={1} className="rw-404-road" />
          <g className="rw-404-end" stroke="var(--signal)" strokeWidth="3.5" strokeLinecap="round">
            <path d="M290 78 L290 102" />
          </g>
        </svg>
      </div>
    </section>
  )
}
