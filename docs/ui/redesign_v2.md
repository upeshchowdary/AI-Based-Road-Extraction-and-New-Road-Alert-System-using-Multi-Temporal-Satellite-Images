# UI redesign v2 — "Orbit to Street"

User brief (2026-10-16): professional "$10k" UI, simple to understand, advanced look, 3D effects,
smooth site + animations + smooth map. Full creative control.

## Problems found (audit with screenshots)
1. Home hero broken in light OS theme: dark headline on a grey→white wash next to a dark globe; nav unreadable.
2. Two products in one: "site" (Home, Explore, Results, Docs) and "app" (Command Center, Alerts, Change
   Explorer, Road Network, Priority Zones, Reports, System) — two navs, three maps, duplicated features.
3. Overview map shows 413 orange markers → noise; KPI tiles show misleading values ("0 new roads", "0% false-alert").
4. Map jank: alert pulse loop repaints the whole map ~15×/s; every alert drawn at every zoom.
5. "Demo data" labels on real data.

## Concept
**Orbit to Street.** The landing page *is* a camera move: 3D Earth (night lights, atmosphere) → India →
Andhra Pradesh → Vijayawada, then the real map takes over. One idea, executed precisely. Dark-first
"night survey" palette: ink-black, cool steel, one warm signal (amber = new road), one cool sensor colour
(cyan = our data). Display serif (Instrument Serif) for big moments, Geist for UI, Geist Mono for numbers.

## Information architecture (one product, one nav)
| Route | Purpose | Replaces |
|---|---|---|
| `/` | Landing: scroll-driven orbit → street descent, 3 steps, live numbers from the API, CTA | Home |
| `/map` | Workspace: search, base maps, 3D, seasons timeline, layers, alerts list + detail drawer | Explore, Command Center, Change Explorer |
| `/alerts` · `/alerts/:id` | Review inbox (keyboard), evidence | App Alerts |
| `/results` | KPI tables (live), method, honest findings | Research |
| `/data` | Runs, GPU budget, data health, registry | System |
| `/docs` | Guides | Docs |
Redirects: `/explore`→`/map`, `/app`→`/map`, `/app/alerts*`→`/alerts*`, `/app/system`→`/data`,
`/research`→`/results`, removed pages → `/map`.

## Map smoothness
- alerts as clustered circle layer (GeoJSON cluster) + lines only from z12; no HTML markers.
- remove the always-on pulse loop (pulse only the selected alert, CSS-free).
- tuned wheel zoom rate + inertia; `fadeDuration` 200; `renderWorldCopies` false on globe.

## Motion system
- Lenis smooth scroll on content pages (not on the map).
- GSAP ScrollTrigger for the hero descent (pinned), staggered reveals elsewhere.
- View Transitions API between routes; `prefers-reduced-motion` respected everywhere.
