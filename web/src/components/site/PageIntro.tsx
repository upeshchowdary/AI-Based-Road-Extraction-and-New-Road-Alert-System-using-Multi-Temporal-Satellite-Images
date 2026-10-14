import { useEffect, type ReactNode } from 'react'
import { ContourBg } from '@/components/brand/Brand'
import { SplitHeading } from '@/components/motion/SplitHeading'
import { cn } from '@/lib/cn'

/** Page title block for public pages. `title` also sets document.title. */
export function PageIntro({ title, docTitle, lead, children, className }: { title: ReactNode; docTitle: string; lead?: ReactNode; children?: ReactNode; className?: string }) {
  useEffect(() => {
    document.title = `${docTitle} — RoadWatch`
  }, [docTitle])
  return (
    <header className={cn('relative overflow-hidden border-b border-line bg-bg0 pt-36 pb-20 md:pt-44 md:pb-24', className)}>
      <ContourBg seed={docTitle.length} opacity={0.35} />
      <div className="container-rw relative">
        <SplitHeading as="h1" className="t-h1 max-w-4xl text-balance text-fg">
          {title}
        </SplitHeading>
        {lead && <p className="t-lead measure mt-6 text-pretty text-muted">{lead}</p>}
        {children}
      </div>
    </header>
  )
}

export function Section({ title, lead, children, className, id }: { title?: ReactNode; lead?: ReactNode; children: ReactNode; className?: string; id?: string }) {
  return (
    <section id={id} className={cn('section-y border-b border-line', className)}>
      <div className="container-rw">
        {title && <h2 className="t-h2 max-w-3xl text-fg">{title}</h2>}
        {lead && <p className="t-lead measure mt-4 text-muted">{lead}</p>}
        <div className={title || lead ? 'mt-12' : undefined}>{children}</div>
      </div>
    </section>
  )
}
