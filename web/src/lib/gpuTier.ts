import { getGPUTier } from 'detect-gpu'
import { useEffect, useState } from 'react'
import { useReducedMotion } from './motionPref'

/** Quality tiers (UI_PROMPT.md 10.2). */
export type QualityTier = 'high' | 'medium' | 'low'

let cached: Promise<QualityTier> | null = null

function saveData() {
  const c = (navigator as Navigator & { connection?: { saveData?: boolean } }).connection
  return Boolean(c?.saveData)
}

function detect(): Promise<QualityTier> {
  if (cached) return cached
  cached = (async () => {
    if (saveData()) return 'low'
    try {
      // benchmarks are self-hosted so detection works offline and makes no third-party request
      const r = await getGPUTier({ benchmarksURL: '/gpu-benchmarks' })
      if (r.isMobile && r.tier < 3) return 'low'
      if (r.tier >= 3) return 'high'
      if (r.tier === 2) return 'medium'
      return r.tier === 1 && !r.isMobile ? 'medium' : 'low'
    } catch {
      return 'medium'
    }
  })()
  return cached
}

/** Returns null while detecting. Reduced motion always forces the low (no-WebGL) path. */
export function useQualityTier(): QualityTier | null {
  const reduced = useReducedMotion()
  const [tier, setTier] = useState<QualityTier | null>(null)
  useEffect(() => {
    let live = true
    detect().then((t) => live && setTier(t))
    return () => {
      live = false
    }
  }, [])
  if (reduced) return 'low'
  return tier
}
