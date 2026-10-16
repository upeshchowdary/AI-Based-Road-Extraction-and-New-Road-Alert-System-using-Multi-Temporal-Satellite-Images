import { Check } from 'lucide-react'
import { cn } from '@/lib/cn'
import { BASE_INFO, type BaseImagery } from './nightSurveyStyle'

// real preview tiles of Vijayawada (z12 x2965 y1857); streets is drawn, ours is our own composite
const PREVIEW: Record<BaseImagery, string | null> = {
  satellite: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/12/1857/2965',
  eox: 'https://tiles.maps.eox.at/wmts/1.0.0/s2cloudless-2024_3857/default/g/12/1857/2965.jpg',
  s2: '/data/zoneA/s2_2024_pre_monsoon.webp',
  streets: null,
}

function StreetsSwatch() {
  return (
    <svg viewBox="0 0 64 40" className="size-full" aria-hidden>
      <rect width="64" height="40" fill="#f4f1ea" />
      <path d="M0 30 C20 26 30 34 64 22" stroke="#cfe0ea" strokeWidth="7" fill="none" />
      <path d="M-2 12 L66 18 M18 -2 L26 42 M44 -2 L40 42" stroke="#ffffff" strokeWidth="3.5" />
      <path d="M-2 12 L66 18 M18 -2 L26 42 M44 -2 L40 42" stroke="#d9d3c6" strokeWidth="0.8" fill="none" />
      <path d="M0 4 L64 36" stroke="#f6c46a" strokeWidth="3" />
      <rect x="30" y="4" width="6" height="5" fill="#e3ddd0" />
      <rect x="48" y="26" width="7" height="5" fill="#e3ddd0" />
    </svg>
  )
}

export function BaseMapPicker({ value, onChange }: { value: BaseImagery; onChange: (v: BaseImagery) => void }) {
  return (
    <div role="radiogroup" aria-label="Base map" className="grid grid-cols-2 gap-2">
      {(['satellite', 'streets', 'eox', 's2'] as const).map((b) => {
        const on = value === b
        return (
          <button
            key={b}
            type="button"
            role="radio"
            aria-checked={on}
            title={BASE_INFO[b].title}
            onClick={() => onChange(b)}
            className={cn(
              'group relative overflow-hidden rounded-[10px] border text-left transition-[border-color,box-shadow] duration-200',
              on ? 'border-sentinel shadow-[0_0_0_3px_color-mix(in_oklab,var(--sentinel)_16%,transparent)]' : 'border-line hover:border-line-strong',
            )}
          >
            <div className="h-14 w-full overflow-hidden bg-surface2">
              {PREVIEW[b] ? (
                <img src={PREVIEW[b]!} alt="" loading="lazy" decoding="async" className="size-full object-cover transition-transform duration-500 group-hover:scale-[1.06]" />
              ) : (
                <StreetsSwatch />
              )}
            </div>
            <div className="flex items-center justify-between gap-1 bg-surface px-2 py-1.5">
              <span className={cn('truncate text-[12px] font-medium', on ? 'text-fg' : 'text-muted')}>{BASE_INFO[b].label}</span>
              {on && <Check className="size-3.5 shrink-0 text-sentinel" strokeWidth={2.4} aria-hidden />}
            </div>
          </button>
        )
      })}
    </div>
  )
}
