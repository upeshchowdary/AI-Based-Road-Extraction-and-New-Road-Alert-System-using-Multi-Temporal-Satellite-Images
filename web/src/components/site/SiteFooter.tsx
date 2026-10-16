import { Monitor, Moon, Sun } from 'lucide-react'
import { Link } from 'react-router'
import { ContourBg, UtcClock, Wordmark } from '@/components/brand/Brand'
import { Segmented } from '@/components/ui/primitives'
import { usePrefs } from '@/lib/store'

/** Andhra Pradesh centroid, computed from the OSM boundary (EPSG:7755). */
export const AP_CENTROID = { lat: 15.7414, lon: 79.9245 }

export function ThemeToggle({ size = 'sm' }: { size?: 'sm' | 'md' }) {
  const theme = usePrefs((s) => s.theme)
  const setTheme = usePrefs((s) => s.setTheme)
  return (
    <Segmented
      label="Theme"
      size={size}
      value={theme}
      onChange={setTheme}
      options={[
        { value: 'dark', label: <Moon className="size-3.5" strokeWidth={1.75} aria-label="Dark" />, title: 'Dark (Night Survey)' },
        { value: 'light', label: <Sun className="size-3.5" strokeWidth={1.75} aria-label="Light" />, title: 'Light (Paper Survey)' },
        { value: 'system', label: <Monitor className="size-3.5" strokeWidth={1.75} aria-label="System" />, title: 'Follow system' },
      ]}
    />
  )
}

export function MotionToggle({ size = 'sm' }: { size?: 'sm' | 'md' }) {
  const motion = usePrefs((s) => s.motion)
  const setMotion = usePrefs((s) => s.setMotion)
  return (
    <Segmented
      label="Motion"
      size={size}
      value={motion}
      onChange={setMotion}
      options={[
        { value: 'on', label: 'Motion on' },
        { value: 'off', label: 'Off' },
        { value: 'system', label: 'System' },
      ]}
    />
  )
}

const COLS = [
  {
    title: 'Product',
    links: [
      { to: '/map', label: 'Map' },
      { to: '/alerts', label: 'Alerts' },
    ],
  },
  {
    title: 'Project',
    links: [
      { to: '/results', label: 'Results' },
      { to: '/docs', label: 'Docs' },
    ],
  },
  {
    title: 'Data',
    links: [{ to: '/attributions', label: 'Attributions' }],
  },
]

export function SiteFooter() {
  return (
    <footer className="relative overflow-hidden border-t border-line bg-bg1">
      <ContourBg seed={4} opacity={0.35} />
      <div className="container-bleed relative py-16">
        <div className="grid gap-12 lg:grid-cols-[1.2fr_2fr]">
          <div>
            <Wordmark />
            <p className="mt-4 max-w-sm text-[15px] text-muted">
              Reads satellite images of Andhra Pradesh, maps every road, and alerts you when a new one appears.
            </p>
            <p className="mt-4 max-w-sm text-[13px] text-muted">
              A final-year capstone built on problem statement SIH1564 (Smart India Hackathon), issued by NTRO.
            </p>
          </div>
          <nav aria-label="Footer" className="grid grid-cols-2 gap-8 sm:grid-cols-4">
            {COLS.map((c) => (
              <div key={c.title}>
                <h2 className="text-[13px] font-medium text-fg">{c.title}</h2>
                <ul className="mt-3 space-y-2">
                  {c.links.map((l) => (
                    <li key={l.to}>
                      <Link to={l.to} className="text-[14px] text-muted transition-colors hover:text-fg">
                        {l.label}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </nav>
        </div>

        <div className="mt-14 flex flex-col gap-6 border-t border-line pt-6 lg:flex-row lg:items-center lg:justify-between">
          <dl className="t-mono flex flex-wrap gap-x-8 gap-y-2 text-muted">
            <div className="flex gap-2">
              <dt className="sr-only">Time</dt>
              <dd>
                <UtcClock />
              </dd>
            </div>
            <div className="flex gap-2">
              <dt>AP centroid</dt>
              <dd className="text-fg">
                {AP_CENTROID.lat.toFixed(4)}° N {AP_CENTROID.lon.toFixed(4)}° E
              </dd>
            </div>
            <div className="flex gap-2">
              <dt>Grid</dt>
              <dd className="text-fg">EPSG:32644 · 10 m</dd>
            </div>
          </dl>
          <div className="flex flex-wrap items-center gap-3">
            <ThemeToggle />
            <MotionToggle />
          </div>
        </div>
        <p className="mt-6 text-[12px] leading-relaxed text-muted">
          Contains modified Copernicus Sentinel data 2022–2026. Roads and boundaries © OpenStreetMap contributors (ODbL). Earth
          imagery: NASA Visible Earth (Blue Marble, Black Marble). Basemap: OpenFreeMap.{' '}
          <Link to="/attributions" className="underline decoration-line-strong underline-offset-4 hover:text-fg">
            All attributions
          </Link>
        </p>
      </div>
    </footer>
  )
}
