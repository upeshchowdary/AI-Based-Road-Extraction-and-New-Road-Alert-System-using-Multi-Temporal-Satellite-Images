import { lazy, Suspense } from 'react'
import type { RwMapProps } from './RwMap'

const Impl = lazy(() => import('./RwMap'))

/** MapLibre (~270 KB gz) loads after the page shell has painted; a scan-line skeleton holds its place. */
export function RwMap(props: RwMapProps) {
  return (
    <Suspense fallback={<div className="rw-skeleton absolute inset-0 bg-bg1" aria-busy="true" aria-label="Loading map" />}>
      <Impl {...props} />
    </Suspense>
  )
}
