import { Marked } from 'marked'
import { Search } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { NavLink, useParams } from 'react-router'
import { cn } from '@/lib/cn'
import './docs.css'

// Guides are the project's own markdown in docs/guides (trusted). Raw HTML in them is dropped anyway.
const files = import.meta.glob('../../../../docs/guides/*.md', { query: '?raw', import: 'default', eager: true }) as Record<string, string>

const md = new Marked({ gfm: true, renderer: { html: () => '' } })

const DOCS = Object.entries(files)
  .map(([path, text]) => {
    const slug = path.split('/').pop()!.replace(/\.md$/, '')
    const title = text.match(/^#\s+(.+)$/m)?.[1] ?? slug.replace(/_/g, ' ')
    return { slug, title, text, file: `docs/guides/${slug}.md` }
  })
  .sort((a, b) => (a.slug === 'ui_run_locally' ? -1 : b.slug === 'ui_run_locally' ? 1 : a.title.localeCompare(b.title)))

export default function DocsPage() {
  const { slug } = useParams()
  const [q, setQ] = useState('')
  const doc = DOCS.find((d) => d.slug === slug) ?? DOCS[0]
  const html = useMemo(() => (doc ? (md.parse(doc.text) as string) : ''), [doc])
  const body = useRef<HTMLDivElement>(null)
  const list = q ? DOCS.filter((d) => (d.title + d.text).toLowerCase().includes(q.toLowerCase())) : DOCS

  useEffect(() => {
    document.title = `${doc?.title ?? 'Docs'} — RoadWatch docs`
  }, [doc])

  // copy buttons on code blocks
  useEffect(() => {
    const root = body.current
    if (!root) return
    root.querySelectorAll('pre').forEach((pre) => {
      if (pre.querySelector('button')) return
      const b = document.createElement('button')
      b.type = 'button'
      b.textContent = 'Copy'
      b.className = 'rw-copy'
      b.addEventListener('click', async () => {
        try {
          await navigator.clipboard.writeText(pre.querySelector('code')?.textContent ?? '')
          b.textContent = 'Copied'
        } catch {
          b.textContent = 'Select and copy'
        }
        window.setTimeout(() => (b.textContent = 'Copy'), 1500)
      })
      pre.appendChild(b)
    })
  }, [html])

  return (
    <div className="container-rw grid gap-10 pt-28 pb-24 lg:grid-cols-[260px_minmax(0,1fr)]">
      <aside className="lg:sticky lg:top-24 lg:self-start">
        <label className="flex h-10 items-center gap-2 rounded-[8px] border border-line bg-surface px-3 focus-within:border-sentinel">
          <Search className="size-4 text-muted" strokeWidth={1.75} aria-hidden />
          <span className="sr-only">Search docs</span>
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search guides" className="w-full bg-transparent text-[14px] text-fg outline-none placeholder:text-muted" />
        </label>
        <nav aria-label="Guides" className="mt-4">
          <ul className="space-y-0.5">
            {list.map((d) => (
              <li key={d.slug}>
                <NavLink to={`/docs/${d.slug}`} className={cn('block rounded-[8px] px-3 py-2 text-[14px] transition-colors', d.slug === doc?.slug ? 'bg-surface2 text-fg' : 'text-muted hover:text-fg')}>
                  {d.title}
                </NavLink>
              </li>
            ))}
            {!list.length && <li className="px-3 py-2 text-[14px] text-muted">No guide mentions “{q}”.</li>}
          </ul>
        </nav>
      </aside>
      <article className="min-w-0">
        <p className="t-mono text-[12px] text-muted">Source: {doc?.file}</p>
        <div ref={body} className="rw-prose mt-4" dangerouslySetInnerHTML={{ __html: html }} />
      </article>
    </div>
  )
}
