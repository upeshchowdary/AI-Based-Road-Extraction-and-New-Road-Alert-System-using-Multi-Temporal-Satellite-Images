/**
 * App review state for the UI-only build: reviews live in this browser (localStorage) until the
 * backend exists. Every screen that shows them carries the "Demo data" badge.
 */
import { useMemo } from 'react'
import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'
import { DATA, useJson, type AlertsFile, type AlertStatus, type DemoAlert } from './data'

export interface LogEntry {
  at: string
  who: string
  action: string
  note?: string
}

interface ReviewState {
  overrides: Record<string, { status: AlertStatus; reason?: string }>
  log: Record<string, LogEntry[]>
  report: string[]
  aoi: 'pilot' | 'ap'
  setStatus: (ids: string[], status: AlertStatus, reason?: string) => void
  toggleReport: (id: string) => void
  setAoi: (a: 'pilot' | 'ap') => void
  resetReviews: () => void
}

const storage = createJSONStorage(() => ({
  getItem: (k: string) => {
    try {
      return localStorage.getItem(k)
    } catch {
      return null
    }
  },
  setItem: (k: string, v: string) => {
    try {
      localStorage.setItem(k, v)
    } catch {
      /* ignore */
    }
  },
  removeItem: (k: string) => {
    try {
      localStorage.removeItem(k)
    } catch {
      /* ignore */
    }
  },
}))

const VERB: Record<AlertStatus, string> = { accepted: 'Accepted', rejected: 'Rejected', flagged: 'Flagged for field check', pending: 'Reopened' }

export const useReview = create<ReviewState>()(
  persist(
    (set) => ({
      overrides: {},
      log: {},
      report: [],
      aoi: 'pilot',
      setStatus: (ids, status, reason) =>
        set((s) => {
          const overrides = { ...s.overrides }
          const log = { ...s.log }
          const at = new Date().toISOString()
          for (const id of ids) {
            overrides[id] = { status, reason }
            log[id] = [...(log[id] ?? []), { at, who: 'Demo analyst', action: VERB[status], note: reason }]
          }
          return { overrides, log }
        }),
      toggleReport: (id) =>
        set((s) => ({ report: s.report.includes(id) ? s.report.filter((x) => x !== id) : [...s.report, id] })),
      setAoi: (aoi) => set({ aoi }),
      resetReviews: () => set({ overrides: {}, log: {}, report: [] }),
    }),
    { name: 'rw-reviews', storage },
  ),
)

/** Alerts (real or demo, see `demo`) with this browser's review decisions applied. */
export function useAlerts() {
  const res = useJson<AlertsFile>(DATA.demoAlerts)
  const overrides = useReview((s) => s.overrides)
  const alerts = useMemo<DemoAlert[] | undefined>(
    () => res.data?.alerts.map((a) => (overrides[a.id] ? { ...a, status: overrides[a.id].status } : a)),
    [res.data, overrides],
  )
  return { alerts, dates: res.data?.dates ?? [], demo: res.data?.demo !== false, modelId: res.data?.model_id, generatedUtc: res.data?.generated_utc, loading: res.loading, error: res.error, retry: res.retry }
}
