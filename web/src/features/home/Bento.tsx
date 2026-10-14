import { CircleCheck, Folder, Wifi } from 'lucide-react'
import { useEffect, useRef, type ReactNode } from 'react'
import { cn } from '@/lib/cn'
import './bento.css'

function Tile({ title, line, span = 1, children, demo }: { title: string; line: string; span?: 1 | 2 | 4; children: ReactNode; demo?: boolean }) {
  const ref = useRef<HTMLLIElement>(null)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const io = new IntersectionObserver(
      ([e]) => {
        if (e.isIntersecting) {
          el.dataset.on = 'true'
          io.disconnect()
        }
      },
      { threshold: 0.45 },
    )
    io.observe(el)
    return () => io.disconnect()
  }, [])
  const replay = () => {
    const el = ref.current
    if (!el || el.dataset.on !== 'true') return
    el.dataset.on = 'false'
    void el.offsetWidth
    el.dataset.on = 'true'
  }
  return (
    <li
      ref={ref}
      data-on="false"
      onPointerEnter={(e) => e.pointerType === 'mouse' && replay()}
      onPointerMove={(e) => {
        if (e.pointerType !== 'mouse' || !ref.current) return
        const r = ref.current.getBoundingClientRect()
        ref.current.style.setProperty('--mx', `${e.clientX - r.left}px`)
        ref.current.style.setProperty('--my', `${e.clientY - r.top}px`)
      }}
      className={cn(
        'bento-tile group relative flex flex-col overflow-hidden rounded-card border border-line bg-surface p-6',
        span === 2 && 'lg:col-span-2',
        span === 4 && 'sm:col-span-2 lg:col-span-4',
      )}
    >
      <div className="relative h-36" aria-hidden>
        {children}
      </div>
      <h3 className="mt-5 text-[17px] font-medium text-fg">{title}</h3>
      <p className="mt-1.5 text-[14px] leading-relaxed text-muted">{line}</p>
      {demo && <span className="mt-3 self-start text-[11px] text-muted">Numbers in this illustration are demo values.</span>}
    </li>
  )
}

const V = { viewBox: '0 0 320 144', className: 'size-full', preserveAspectRatio: 'xMidYMid meet' } as const

export function Bento() {
  return (
    <section aria-labelledby="cap-title" className="section-y border-t border-line bg-bg1">
      <div className="container-rw">
        <div className="max-w-2xl">
          <h2 id="cap-title" className="t-h1 text-fg">
            Built for the hard parts
          </h2>
          <p className="t-lead mt-5 text-muted">Clouds, seasons, mud tracks and audits. Each capability below exists to cut a false alert or prove a real one.</p>
        </div>
        <ul className="mt-14 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Tile span={2} title="Monsoon-proof" line="Radar (Sentinel-1) sees through cloud, so the monsoon doesn’t hide new roads.">
            <svg {...V}>
              <path className="b-road-under" pathLength={1} strokeDasharray="1" d="M10 120 C 90 100, 150 70, 310 30" stroke="var(--sentinel)" strokeWidth="2.5" fill="none" strokeLinecap="round" />
              <path d="M70 70 q20 -36 60 -22 q30 -30 70 -4 q40 -6 46 30 q30 14 6 40 q-30 22 -70 8 q-40 20 -80 -2 q-52 4 -46 -30 q-14 -14 14 -20 Z" fill="var(--surface-2)" stroke="var(--line-strong)" />
              <g fill="none" stroke="var(--sentinel)" strokeWidth="1.2">
                <circle className="b-ripple" cx="160" cy="80" r="6" opacity="0" />
                <circle className="b-ripple" cx="160" cy="80" r="6" opacity="0" />
                <circle className="b-ripple" cx="160" cy="80" r="6" opacity="0" />
              </g>
            </svg>
          </Tile>
          <Tile title="Persistence rule" line="A road must be seen on two dates before you’re alerted. Mud and crops don’t persist.">
            <svg {...V}>
              {[0, 1, 2].map((i) => (
                <g key={i} className="b-card" style={{ transformBox: 'fill-box' }}>
                  <rect x={60 + i * 34} y={22 + i * 14} width="150" height="96" rx="8" fill="var(--surface-2)" stroke="var(--line-strong)" />
                  <path d={`M${74 + i * 34} ${100 + i * 14} C ${120 + i * 34} ${80 + i * 14}, ${150 + i * 34} ${60 + i * 14}, ${196 + i * 34} ${40 + i * 14}`} stroke={i === 0 ? 'var(--line-strong)' : 'var(--signal)'} strokeWidth="2.4" fill="none" strokeLinecap="round" />
                </g>
              ))}
              <g className="b-fire">
                <circle cx="248" cy="50" r="14" fill="var(--signal)" />
                <path d="M248 43 v8 M248 55 v1" stroke="var(--on-signal)" strokeWidth="2.4" strokeLinecap="round" />
              </g>
            </svg>
          </Tile>
          <Tile title="Abstain mode" line="Cloudy, shadowed or misaligned tiles say “unreliable” instead of guessing.">
            <svg {...V}>
              <defs>
                <pattern id="b-hatch" width="8" height="8" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
                  <line x1="0" y1="0" x2="0" y2="8" stroke="var(--abstain)" strokeWidth="2.5" />
                </pattern>
              </defs>
              <rect x="90" y="14" width="140" height="116" rx="8" fill="var(--bg-1)" stroke="var(--line-strong)" />
              <path d="M100 100 C 140 80, 180 60, 220 40" stroke="var(--road-existing)" strokeWidth="2" fill="none" />
              <path className="b-cloud" d="M120 64 q16 -26 44 -14 q24 -20 48 4 q26 6 18 28 q-14 18 -44 10 q-26 14 -50 -2 q-30 0 -24 -16 q-8 -8 8 -10 Z" fill="var(--surface-2)" stroke="var(--line-strong)" />
              <g className="b-hatch">
                <rect x="90" y="14" width="140" height="116" rx="8" fill="url(#b-hatch)" />
                <rect x="112" y="60" width="96" height="26" rx="6" fill="var(--bg-0)" stroke="var(--abstain)" />
                <text x="160" y="77" textAnchor="middle" fontSize="12" fill="var(--text)" fontFamily="var(--font-sans)">
                  Unreliable
                </text>
              </g>
            </svg>
          </Tile>

          <Tile title="Construction stages" line="Cleared, earthwork, gravel, paved — tracked date by date.">
            <div className="flex h-full flex-col justify-center gap-3 px-2">
              <div className="grid grid-cols-4 gap-1.5">
                {['Cleared', 'Earthwork', 'Gravel', 'Paved'].map((s) => (
                  <div key={s} className="h-2 overflow-hidden rounded-full bg-surface2">
                    <div className="b-stage h-full bg-signal" />
                  </div>
                ))}
              </div>
              <div className="grid grid-cols-4 gap-1.5 text-[11px] text-muted">
                {['Cleared', 'Earthwork', 'Gravel', 'Paved'].map((s) => (
                  <span key={s}>{s}</span>
                ))}
              </div>
            </div>
          </Tile>
          <Tile span={2} demo title="PMGSY audit" line="Upload a sanctioned road. Get a report: sanctioned vs detected length, first-seen dates, before/after chips.">
            <div className="flex h-full items-center justify-center">
              <div className="b-report w-[78%] max-w-sm rounded-[8px] border border-line-strong bg-bg1 p-4">
                <div className="flex items-center justify-between text-[12px]">
                  <span className="text-fg">Audit · village road</span>
                  <span className="t-mono text-muted">PDF</span>
                </div>
                <div className="mt-3 space-y-2 text-[11px] text-muted">
                  <div className="flex items-center gap-2">
                    <span className="w-16">Sanctioned</span>
                    <div className="h-2 flex-1 rounded-full border border-dashed border-muted/60" />
                    <span className="t-mono w-14 text-right whitespace-nowrap text-fg">6.0 km</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="w-16">Detected</span>
                    <div className="h-2 flex-1">
                      <div className="b-bar h-2 w-[70%] rounded-full bg-signal" />
                    </div>
                    <span className="t-mono w-14 text-right whitespace-nowrap text-fg">4.2 km</span>
                  </div>
                </div>
              </div>
            </div>
          </Tile>
          <Tile title="Priority zones" line="Draw sensitive areas. New roads inside them jump the queue.">
            <svg {...V}>
              <path d="M10 110 C 90 96, 150 80, 310 70" stroke="var(--road-existing)" strokeWidth="2" fill="none" opacity="0.7" />
              <path className="b-zone" d="M120 26 L236 18 L262 104 L150 128 Z" fill="color-mix(in oklab, var(--priority) 12%, transparent)" stroke="var(--priority)" strokeDasharray="5 4" strokeWidth="1.4" />
              <path d="M160 92 C 180 70, 200 56, 224 44" stroke="var(--signal)" strokeWidth="2.6" fill="none" strokeLinecap="round" />
            </svg>
          </Tile>

          <Tile demo title="Connectivity impact" line="See which villages a new road connects, and how much closer they get.">
            <svg {...V}>
              {[
                [60, 104],
                [150, 40],
                [232, 96],
                [286, 36],
              ].map(([x, y], i) => (
                <circle key={i} cx={x} cy={y} r="7" fill="var(--bg-1)" stroke="var(--verified)" strokeWidth="1.6" />
              ))}
              <path className="b-link" pathLength={1} d="M60 104 L150 40 L232 96 L286 36" stroke="var(--signal)" strokeWidth="2.4" fill="none" strokeLinecap="round" />
              <g className="b-people">
                <rect x="96" y="112" width="128" height="24" rx="6" fill="var(--bg-0)" stroke="var(--verified)" strokeOpacity="0.6" />
                <text x="160" y="128" textAnchor="middle" fontSize="12" fill="var(--verified)" fontFamily="var(--font-sans)">
                  +3,000 people
                </text>
              </g>
            </svg>
          </Tile>
          <Tile span={2} title="Ask in plain English" line="Type a question. The map answers, and shows the query it ran.">
            <div className="flex h-full flex-col justify-between">
              <div className="t-mono rounded-[8px] border border-line-strong bg-bg1 px-3 py-2.5 text-[13px] text-fg">
                <span className="text-muted">› </span>
                <span className="b-type">new roads near Gannavaram since 2023</span>
              </div>
              <svg viewBox="0 0 320 70" className="h-[76px] w-full">
                <path d="M0 50 C 80 40, 160 30, 320 24" stroke="var(--line-strong)" strokeWidth="1.5" fill="none" />
                <path d="M0 62 C 60 58, 120 64, 200 56 S 290 40, 320 44" stroke="var(--line-strong)" strokeWidth="1" fill="none" />
                {[
                  [70, 38],
                  [132, 30],
                  [188, 46],
                  [250, 26],
                ].map(([x, y], i) => (
                  <circle key={i} className="b-answer" style={{ ['--i' as string]: i }} cx={x} cy={y} r="5" fill="var(--signal)" />
                ))}
              </svg>
            </div>
          </Tile>
          <Tile title="Offline mode" line="Once data is cached, the whole system runs with no internet.">
            <div className="flex h-full items-center justify-center gap-6">
              <div className="relative">
                <Wifi className="b-bars size-14 text-muted" strokeWidth={1.25} />
                <svg viewBox="0 0 56 56" className="absolute inset-0 size-14">
                  <path className="b-cut" pathLength={1} d="M6 50 L50 6" stroke="var(--priority)" strokeWidth="2.5" strokeLinecap="round" />
                </svg>
              </div>
              <span className="b-ok inline-flex items-center gap-1.5 text-[13px] text-verified">
                <CircleCheck className="size-4" strokeWidth={1.75} />
                Still running
              </span>
            </div>
          </Tile>

          <Tile span={4} title="Exports" line="Shapefile, GeoPackage and GeoJSON in the right coordinate system — straight into QGIS.">
            <div className="flex h-full items-center justify-center gap-4">
              {['SHP', 'GPKG', 'GeoJSON'].map((c, i) => (
                <span
                  key={c}
                  className="b-chip t-mono rounded-chip border border-sentinel/40 bg-sentinel/10 px-3 py-1.5 text-[13px] text-sentinel-ink"
                  style={{ ['--i' as string]: i, ['--dx' as string]: `${(2 - i) * 70 + 70}px`, ['--dy' as string]: '0px' }}
                >
                  {c}
                </span>
              ))}
              <Folder className="b-folder ml-6 size-14 text-fg" strokeWidth={1.25} />
            </div>
          </Tile>
        </ul>
      </div>
    </section>
  )
}
