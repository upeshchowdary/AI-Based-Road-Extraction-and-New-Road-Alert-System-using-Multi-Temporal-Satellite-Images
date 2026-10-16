import { create } from 'zustand'
import { createJSONStorage, persist, type StateStorage } from 'zustand/middleware'

export type ThemePref = 'dark' | 'light' | 'system'
export type MotionPref = 'on' | 'off' | 'system'

/** localStorage can throw (private mode, blocked site data) — never let that break the UI. */
const safeStorage: StateStorage = {
  getItem: (k) => {
    try {
      return localStorage.getItem(k)
    } catch {
      return null
    }
  },
  setItem: (k, v) => {
    try {
      localStorage.setItem(k, v)
    } catch {
      /* ignore */
    }
  },
  removeItem: (k) => {
    try {
      localStorage.removeItem(k)
    } catch {
      /* ignore */
    }
  },
}

interface Prefs {
  theme: ThemePref
  motion: MotionPref
  railCollapsed: boolean
  tourDone: boolean
  offline: boolean
  setTheme: (t: ThemePref) => void
  setMotion: (m: MotionPref) => void
  toggleRail: () => void
  setTourDone: (v: boolean) => void
  setOffline: (v: boolean) => void
}

export const usePrefs = create<Prefs>()(
  persist(
    (set) => ({
      theme: 'light',
      motion: 'system',
      railCollapsed: false,
      tourDone: false,
      offline: false,
      setTheme: (theme) => set({ theme }),
      setMotion: (motion) => set({ motion }),
      toggleRail: () => set((s) => ({ railCollapsed: !s.railCollapsed })),
      setTourDone: (tourDone) => set({ tourDone }),
      setOffline: (offline) => set({ offline }),
    }),
    {
      name: 'rw-prefs',
      storage: createJSONStorage(() => safeStorage),
      // v2 (redesign "Survey Atlas"): light is the new default; reset older saved themes once
      version: 2,
      migrate: (state) => ({ ...(state as Prefs), theme: 'light' }),
    },
  ),
)
