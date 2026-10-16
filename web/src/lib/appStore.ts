/**
 * Review decisions (accept / reject / flag). With a RoadWatch server in "server" mode they are stored
 * on the server (`/api/reviews`, append-only, exported as training labels) and shared by everyone using
 * it. A read-only deployment ("browser" mode) or no server keeps them in this browser (localStorage).
 */
import { useEffect, useMemo } from 'react'
import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'
import { API, DATA, useJson, type AlertsFile, type AlertStatus, type DemoAlert } from './data'

export interface LogEntry {
  at: string
  who: string
  action: string
  note?: string
}

type Decisions = Record<string, { status: AlertStatus; reason?: string | null }>
type ServerReviews = { mode: 'server' | 'browser'; statuses: Decisions; log: Record<string, LogEntry[]> }

interface ReviewState {
  /** where decisions live: unknown until /api/reviews answers */
  mode: 'unknown' | 'server' | 'browser'
  server: Decisions
  serverLog: Record<string, LogEntry[]>
  overrides: Decisions
  log: Record<string, LogEntry[]>
  report: string[]
  aoi: 'pilot' | 'ap'
  loadServer: () => Promise<void>
  setStatus: (ids: string[], status: AlertStatus, reason?: string) => Promise<void>
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

async function reviewsRequest(init?: RequestInit): Promise<ServerReviews> {
  const r = await fetch(API.reviews, { cache: 'no-store', ...init, headers: { 'Content-Type': 'application/json', ...init?.headers } })
  if (!r.ok) throw new Error((await r.json().catch(() => null))?.detail ?? `HTTP ${r.status}`)
  return r.json()
}

export const useReview = create<ReviewState>()(
  persist(
    (set, get) => ({
      mode: 'unknown',
      server: {},
      serverLog: {},
      overrides: {},
      log: {},
      report: [],
      aoi: 'pilot',
      loadServer: async () => {
        try {
          const d = await reviewsRequest()
          set({ mode: d.mode, server: d.statuses, serverLog: d.log })
        } catch {
          set({ mode: 'browser' }) // no API (static preview): keep decisions in this browser
        }
      },
      setStatus: async (ids, status, reason) => {
        if (get().mode === 'server') {
          const prev = get().server
          // optimistic: show the decision at once, roll back if the server refuses it
          set({ server: { ...prev, ...Object.fromEntries(ids.map((id) => [id, { status, reason }])) } })
          try {
            const d = await reviewsRequest({ method: 'POST', body: JSON.stringify({ ids, status, reason }) })
            set({ server: d.statuses, serverLog: d.log })
          } catch (e) {
            set({ server: prev })
            throw e
          }
          return
        }
        set((s) => {
          const overrides = { ...s.overrides }
          const log = { ...s.log }
          const at = new Date().toISOString()
          for (const id of ids) {
            overrides[id] = { status, reason }
            log[id] = [...(log[id] ?? []), { at, who: 'You (this browser)', action: VERB[status], note: reason }]
          }
          return { overrides, log }
        })
      },
      toggleReport: (id) =>
        set((s) => ({ report: s.report.includes(id) ? s.report.filter((x) => x !== id) : [...s.report, id] })),
      setAoi: (aoi) => set({ aoi }),
      resetReviews: () => set({ overrides: {}, log: {}, report: [] }),
    }),
    // server state is never cached locally: it is re-read on every visit
    { name: 'rw-reviews', storage, partialize: (s) => ({ overrides: s.overrides, log: s.log, report: s.report, aoi: s.aoi }) },
  ),
)

let serverLoad: Promise<void> | null = null

/** The decisions that apply here (server's when it stores them, else this browser's) + their log. */
export function useDecisions() {
  const mode = useReview((s) => s.mode)
  const server = useReview((s) => s.server)
  const serverLog = useReview((s) => s.serverLog)
  const overrides = useReview((s) => s.overrides)
  const log = useReview((s) => s.log)
  useEffect(() => {
    if (mode === 'unknown') serverLoad ??= useReview.getState().loadServer()
  }, [mode])
  return mode === 'server' ? { mode, decisions: server, log: serverLog } : { mode, decisions: overrides, log }
}

/** Alerts (real or demo, see `demo`) with the applicable review decisions applied. */
export function useAlerts() {
  const res = useJson<AlertsFile>(DATA.demoAlerts)
  const { decisions } = useDecisions()
  const alerts = useMemo<DemoAlert[] | undefined>(
    () => res.data?.alerts.map((a) => (decisions[a.id] ? { ...a, status: decisions[a.id].status } : a)),
    [res.data, decisions],
  )
  return { alerts, dates: res.data?.dates ?? [], demo: res.data?.demo !== false, modelId: res.data?.model_id, generatedUtc: res.data?.generated_utc, loading: res.loading, error: res.error, retry: res.retry }
}
