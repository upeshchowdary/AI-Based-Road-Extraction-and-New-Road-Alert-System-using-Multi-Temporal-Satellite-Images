# UI review guide

_How to review the RoadWatch UI at the end of each phase._

## Before you start

Make sure the dev server is running (see `ui_run_locally.md`). Open Chrome — Lighthouse and axe-core work best there.

---

## What to open and check

### 1. Home `/`

| Step | What to do | What to look for |
|---|---|---|
| Load | Open `http://localhost:5173` | Preloader ring draws; transitions into hero cleanly |
| Hero scroll | Scroll slowly through ~350 vh | Globe → India → AP boundary → scan line → amber road → alert card → map handoff |
| Scroll rail | Click the 4 stage labels on the right rail | Camera jumps to the right stage |
| Below fold | Continue scrolling | Problem, Pipeline (H3), Pixel-diff vs RoadWatch toggle, Capabilities bento, Time-lapse, Who it's for, Results, Open data all appear |
| Pixel-diff toggle | Click the toggle in H4 | Pixel-diff: 1,183 blobs flutter (not too fast); RoadWatch: 1 amber road |
| Time-lapse | Drag the year scrubber | Roads accumulate; km and alert counters tick |
| Reduced motion | Set OS motion to "Reduce" or toggle in footer | No scroll-hijacking; 200 ms cross-fades; static globe poster |
| Mobile | Resize to 390 px wide | Static version, no WebGL; all text legible |

### 2. Explore `/explore`

| Step | What | Look for |
|---|---|---|
| Load | `http://localhost:5173/explore` | Map centres on Vijayawada pilot zone |
| Date picker | Click through all 9 dates (2022 pre → 2026 post) | Roads update; no tile flash or jump |
| Before/after slider | Drag the scan-line divider | Images swap smoothly; divider follows cursor |
| Unreliable tiles | Enable "Unreliable tiles" layer | 25 hatched tiles appear |
| Alert click | Click an amber alert marker | Side panel slides open with confidence breakdown |
| Guided tour | Clear `localStorage.roadwatch_tour_done` and refresh | 5 coach marks appear in order |
| Mobile | 390 px | Bottom sheet replaces side panel |

### 3. App `/app`

- **Sign-in:** `/app/sign-in` — both form and "Explore with demo account" button work.
- **Command Center:** KPI tiles load (skeletons first), alert feed populates, map renders.
- **Alerts:** `J/K` move, `Enter` opens, `A` accepts, `R` rejects (asks reason), `F` flags.
- **Alert detail:** before/after swipe, confidence breakdown bar, audit log.
- **Ctrl+K:** Command palette opens from any screen.
- **All screens:** check loading skeleton → empty state → error state → offline state (disconnect network).
- **"Demo data" banner** visible on all app screens.

### 4. All public pages

Visit `/platform`, `/capabilities`, `/solutions/security`, `/solutions/rural-road-audit`, `/solutions/planning`, `/stories`, `/research`, `/about`, `/docs`, `/contact`, `/attributions`, `/privacy`, `/design`.

Check: page loads, no 404, title tag correct, content matches the design system (Night Survey colours, Geist font, amber only for CTAs/numbers).

### 5. 404

Navigate to `http://localhost:5173/nonexistent`. Dead-end road draws; button returns home.

---

## Automated checks

Run after each check above:

```powershell
# TypeScript (from web/)
pnpm tsc --noEmit

# Lighthouse (Chrome required; adjust URL if needed)
npx lighthouse http://localhost:5173 --view --output html --output-path reports/ui/lighthouse/home.html
npx lighthouse http://localhost:5173/explore --view --output html --output-path reports/ui/lighthouse/explore.html

# axe-core (via playwright)
pnpm playwright test tests/a11y.spec.ts
```

Targets: Performance ≥ 90 (Home ≥ 87 acceptable while 3D lazy-loads; Explore being improved), Accessibility ≥ 95, Best Practices ≥ 95, SEO ≥ 95.

---

## Screenshots (Playwright)

```powershell
pnpm playwright test tests/screenshots.spec.ts
```

Saves to `reports/ui/<page>/` at 1440×900, 1024×768, 390×844, dark and light.

---

## Sending feedback

Open an issue or leave a comment in the PR. Include:
- The route you were on
- What you expected vs what happened
- A screenshot if relevant
- Your browser and OS

For design feedback: rate the page 1–10 on concept clarity, visual hierarchy, typography, colour, motion quality, interaction details, responsiveness, performance, accessibility, content honesty. Anything below 8.5 → file an issue with specific suggestions.
