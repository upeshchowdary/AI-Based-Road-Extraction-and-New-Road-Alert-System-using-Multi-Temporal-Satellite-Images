/** Motion tokens (UI_PROMPT.md 3.5). Durations in seconds for GSAP, ms helpers for CSS/Motion. */
import { gsap } from 'gsap'
import { CustomEase } from 'gsap/CustomEase'

gsap.registerPlugin(CustomEase)

export const dur = {
  micro: 0.12,
  ui: 0.2,
  panel: 0.4,
  reveal: 0.7,
  cinematic: 1.2,
} as const

export const ease = {
  reveal: 'expo.out',
  camera: 'power3.inOut',
  ui: 'power2.out',
  /** A satellite pass: slow lead-in, steady sweep, soft exit. */
  scan: CustomEase.create('scan', 'M0,0 C0.25,0.02 0.32,0.18 0.5,0.5 0.68,0.82 0.75,0.98 1,1'),
} as const

export const stagger = { tight: 0.03, normal: 0.045, loose: 0.06 } as const

export const scrub = 0.8

/** Motion (framer) transition presets for the calm app. */
export const appTransition = { duration: 0.2, ease: [0.33, 1, 0.68, 1] as const }
export const panelTransition = { duration: 0.25, ease: [0.16, 1, 0.3, 1] as const }
