# UI MASTER PROMPT — RoadWatch website + app
### Premium 3D / motion web experience for the Automatic Road Extraction & New-Road Alerting project

> **How to use this file:** put it next to `PROJECT_PROMPT.md` in the project root. In Claude Code say:
> *"Read PROJECT_PROMPT.md and UI_PROMPT.md fully. Follow UI_PROMPT.md for all frontend work. Start with UI Section 0."*
>
> This file adds to `PROJECT_PROMPT.md`; it does not replace it. All rules there still apply (ask-vs-do rules, 🔴 YOUR TURN blocks, free tools only, laptop disk limit, Windows + Antigravity, honesty rules). The frontend lives in `web/`.

---

## 0. YOUR ROLE FOR THE UI

You are now also my **creative director, product designer, motion designer and senior frontend / WebGL engineer**. The goal is a website and app that feels like a **$10,000+ agency build**: one strong visual concept, cinematic scroll storytelling, a calm and fast professional app, real data, flawless details, fast loading and accessibility.

### 0.1 First actions
1. Read both prompt files fully.
2. Check free disk space before installing anything (the 3D + map stack needs ~0.6–1 GB of `node_modules`). Use `pnpm`. Warn me if free space would go below 1 GB.
3. Install the helper skills listed in Section 2.2 (official GSAP skills, frontend design skill) if not already present.
4. Do the **reference research pass** (Section 1.3): actually open the reference sites in a browser, scroll them, and write `docs/ui/research.md` (what effects they use, what works, what to avoid). Take your own notes; never copy their code, images, logos or text.
5. Ask me the Section 14 questions in one batch with defaults.
6. Produce the **design system first** (Section 3) and a 1-page visual style board, and show it to me with a 🔴 YOUR TURN review block before building pages.

### 0.2 Golden rules
- **One concept, executed perfectly** beats many effects. Every animation must explain something (orbit → road, raw image → alert, before → after). No decoration-only effects.
- **Two moods:** the **public site** is cinematic (3D, scroll stories, big type). The **app** is calm, fast and data-dense (like a pro tool): short subtle motion only, no smooth-scroll hijacking, no 3D except the map.
- **Real data or clearly labelled demo data.** Never invent numbers, client logos, testimonials, partner badges or quotes. KPIs come from `reports/`. Demo data shows a visible "Demo data" label.
- **No official government emblems or logos** (NTRO, ISRO, NRSC, Government of India, KL University) unless I confirm written permission. Mention them only as plain text (e.g. "Problem statement SIH1564, issued by NTRO").
- **Performance and accessibility are part of the design**, not extras (Section 10).
- **Never block the ML work.** In CP1, UI work is limited to Phase UI-1 (Section 12). ML gates in `PROJECT_PROMPT.md` come first.

### 0.3 Tools you may use
You may use **any free website, tool, app, library, skill, or MCP** that helps, as long as it is free (no trials needing a card) and fits the disk limit. Examples:
- **Inspiration / research:** Awwwards (Sites of the Day, WebGL & scrolling collections), Godly, Codrops tutorials, Dribbble, Behance, Mobbin free tier, Muzli, Land-book, Lapa Ninja, Three.js examples, Bruno Simon's Three.js Journey free material, MapLibre and deck.gl example galleries.
- **Design:** Figma (free plan), Excalidraw, Spline (free plan — only if the export has no watermark/branding; otherwise build in React Three Fiber), Rive (free tier), LottieFiles (free animations; check each licence), Realtime Colors, Coolors, Huemint, Contrast checkers (WebAIM), Fontshare and Google Fonts, Haikei / SVG generators, Poly Haven (CC0 textures/HDRIs).
- **Agent tools:** browser automation/screenshots (Antigravity's browser, Playwright, Chrome DevTools MCP), Lighthouse, axe-core, the Claude Code skills in Section 2.2, Figma MCP if available on the free plan.
- **Assets:** NASA Blue Marble / Black Marble textures (public domain), EOX Sentinel-2 cloudless tiles (attribution required; 2016 = CC BY 4.0, 2018+ = CC BY-NC-SA 4.0 non-commercial), OpenFreeMap vector tiles, AWS Terrain Tiles (open data), OpenStreetMap (ODbL, attribution).
Record every asset and its licence in `LICENSES_DATA.md` and on the `/attributions` page.

---

## 1. THE CONCEPT

### 1.1 Brand
- **Name:** RoadWatch (confirm with me; Section 14).
- **Promise:** *"Every new road. Seen first."*
- **Supporting line:** *"RoadWatch reads satellite images of Andhra Pradesh, maps every road, and alerts you the moment a new one appears — with the proof."*
- **Voice:** precise, calm, confident, technical but simple. Short sentences. No hype words like "revolutionary".

### 1.2 Signature idea: "From orbit to the road"
The whole site is one continuous camera journey and one visual language:
1. **Orbit:** a real 3D Earth in space.
2. **Dive:** the camera descends to India → Andhra Pradesh → a single village.
3. **Scan:** a thin luminous **scan line** (like a satellite pass) sweeps the ground.
4. **Reveal:** existing roads glow cool steel; **new roads draw themselves in Signal Amber**.
5. **Proof:** a precise alert card appears: length, confidence, first-seen date, before/after.

Recurring motifs used everywhere (consistently, sparingly):
- **Scan line** — section transitions, loaders, hover states, the before/after divider.
- **Roads as light** — amber = new, steel = existing, hatched grey = unreliable/abstain.
- **Survey HUD** — thin corner brackets, monospace coordinates, UTC time, sensor/date chips, scale bar (inspired by cartographic instrument panels). Coordinates must be real (camera or cursor position).
- **Contour lines** — very faint topographic line patterns as backgrounds instead of generic gradients/particles.

### 1.3 Reference research pass (do it, then write `docs/ui/research.md`)
Open and study, noting patterns only:
- **Award-level motion sites:** Awwwards Sites of the Day of the last 6 months (filter: WebGL, 3D, scrolling), plus Codrops recent demos. Study: preloaders, scroll-pinned 3D scenes, text reveals, page transitions, hover micro-interactions, how they stay fast.
- **Geospatial / EO products:** planet.com (zoom-level storytelling: look broader / closer / deeper; imagery galleries), blackshark.ai (dark, minimal, interactive 3D city showcase), felt.com (live cartographic HUD with coordinates/CRS/scale, product UI vignettes, plain-language AI query), pixxel.space (Indian space-tech brand language), Mapflow, Picterra, EOX, Development Seed, Cesium, MapLibre/deck.gl showcases.
- **Pro app UIs:** Linear, Vercel dashboard, Raycast, Arc, Mapbox Studio, Felt app — study density, keyboard-first flows, command palette, calm motion.

Conclusions already drawn (verify and extend):
- 2026 winners show **restraint, one strong concept, scroll-driven narrative, technical craft and accessibility**; generic particle backgrounds and ignoring mobile/accessibility now lose. Avoid them.
- EO companies sell with **real imagery + zoom storytelling + proof**. We will do the same with our own data.
- Interactive demos (Blackshark's explorable city, Felt's live map) convert better than screenshots → we ship a real public **Explore** demo.

---

## 2. TECH STACK (all free)

### 2.1 Libraries
| Need | Choice |
|---|---|
| App framework | React + TypeScript + Vite (latest stable). React Router with **prerendering** of public pages for SEO/fast first paint (or Vite SSG). Record the choice in `DECISIONS.md`. |
| Styling | Tailwind CSS (latest), CSS variables for design tokens, `clsx`/`tailwind-merge` |
| UI primitives | shadcn/ui (Radix) — restyled fully to our design system; `cmdk` for command palette; `sonner` for toasts; `vaul` for mobile sheets |
| Scroll & timeline motion | **GSAP** (all plugins are free now: ScrollTrigger, SplitText, DrawSVG, MorphSVG, Flip, CustomEase, Observer) + `@gsap/react` (`useGSAP`) |
| Smooth scroll | **Lenis** (`lenis/react`) synced to the GSAP ticker — **public pages only**; disabled in `/app` and on map elements (`data-lenis-prevent`) |
| UI micro-motion | Motion (formerly Framer Motion, free MIT core only — no paid Motion+), View Transitions API for route/shared-element transitions with fallback |
| 3D | three.js + React Three Fiber + drei + postprocessing; `detect-gpu` for quality tiers; KTX2/WebP textures; `gltf-transform` for any models |
| Maps | **MapLibre GL JS** (globe projection + 3D terrain), **deck.gl** via `@deck.gl/maplibre` (`MapLibreOverlay`) for alerts/paths/heat layers, **PMTiles** for road layers, `terra-draw` for drawing priority zones |
| Charts | visx or ECharts (pick one; consistent styling) |
| Data | TanStack Query, Zustand, `openapi-typescript` (types from the FastAPI OpenAPI schema), **MSW** (Mock Service Worker) for demo/offline fixtures |
| Forms/auth | react-hook-form + zod, Supabase JS (Auth + DB) |
| Docs/content | MDX for `/docs`, `/research`, `/stories` |
| i18n (optional, Phase UI-4) | i18next — English + Telugu (తెలుగు) for public pages |
| Quality | Vitest, Playwright (screenshots, video, e2e), Lighthouse CI, axe-core, ESLint, Prettier |

### 2.2 Skills to install for yourself
- Official GSAP skills: `npx skills add https://github.com/greensock/gsap-skills` (or `/plugin marketplace add greensock/gsap-skills` in Claude Code). Use `gsap-core`, `gsap-timeline`, `gsap-scrolltrigger`, `gsap-react`, `gsap-plugins`, `gsap-performance`.
- A frontend/web design skill (e.g. Anthropic's `frontend-design`) and any well-maintained Lenis / React Three Fiber / accessibility skills you find. Read each skill's SKILL.md before use.

### 2.3 Folder structure (`web/`)
```
web/
  src/
    app/            # routes: (public)/..., app/...
    design/         # tokens.css, theme.ts, motion.ts, typography.css
    components/
      ui/           # restyled shadcn primitives
      brand/        # Logo, Wordmark, HUDFrame, ScanLine, ContourBg
      motion/       # Reveal, SplitHeading, Magnetic, Counter, ScrollProgress
      three/        # Globe, Atmosphere, Starfield, OrbitToRoadScene, QualityGate
      map/          # MapCanvas, NightSurveyStyle, layers/, BeforeAfterSwipe, TimeScrubber, Legend
      alerts/       # AlertCard, ConfidenceBreakdown, StageTracker, PersistenceDots
      charts/
    features/       # page-level sections
    lib/            # api client, msw handlers, gpu tier, reduced-motion, analytics(none)
  public/           # small assets only (< 50 MB total); big textures hosted externally
  tests/            # playwright, vitest
```
Big textures/videos are hosted on the Hugging Face org or GitHub Releases (check CORS works) — not in the repo.

---

## 3. DESIGN SYSTEM ("Night Survey")

Build this first as tokens + a living style page at `/design` (dev only).

### 3.1 Colour tokens
**Dark (default):**
| Token | Hex | Use |
|---|---|---|
| `--bg-0` | `#05070C` | deep space / page background |
| `--bg-1` | `#0A0F1A` | sections, app background |
| `--surface` | `#0F1626` | cards, panels |
| `--surface-2` | `#141D31` | raised panels, menus |
| `--line` | `#1E2940` | borders, dividers |
| `--text` | `#E8EDF5` | primary text |
| `--text-muted` | `#8C99B0` | secondary text |
| `--road-existing` | `#9FB3C8` | existing roads (cool steel, ~60% opacity on maps) |
| `--signal` | `#FFB547` | **brand accent = new roads**, primary CTAs, key numbers |
| `--signal-glow` | `rgba(255,181,71,0.35)` | glow/bloom around new roads |
| `--sentinel` | `#4FD1E8` | interactive focus, links, selection, scan line |
| `--verified` | `#2DD4A7` | accepted / verified |
| `--priority` | `#FF5C6C` | high-priority alerts, errors |
| `--abstain` | `#6B7486` + diagonal hatch | unreliable / abstained tiles |

**Light ("Paper Survey"):** background `#F6F4EF` (warm map paper), surface `#FFFFFF`, text `#0B1220`, muted `#5A6478`, signal `#B86A00`, sentinel `#0B8BA3`, existing roads `#5C6F86`. Same semantics.

Rules:
- Check every text/background pair for **WCAG 2.2 AA** contrast (4.5:1 body, 3:1 large text/UI). Fix tokens if any fail.
- Colour is never the only signal: new roads also get the draw-in animation, a dashed-to-solid style and an icon/label; abstain tiles are hatched.
- Amber is precious: use it only for new roads, the primary CTA and hero numbers.

### 3.2 Typography (free fonts)
- **UI and body:** Geist (OFL). **Data, coordinates, IDs:** Geist Mono or JetBrains Mono.
- **Editorial accent:** Instrument Serif (italic) — used for one or two words in big headings only (e.g. "Every new road. *Seen first.*").
- Fluid type scale with `clamp()`: display 56–128 px, h1 44–80, h2 32–56, h3 22–32, body 16–18, small 13–14, mono 12–14. Tight tracking on display sizes, generous line-height on body.
- Self-host fonts (subset, `font-display: swap`, preload the two critical weights).

### 3.3 Layout & shape
- 12-column grid, max content width 1280 px (1440 for full-bleed visuals), 8-px spacing scale, generous section padding (96–160 px desktop).
- Radii: 6 (inputs/chips), 12 (cards), 20 (feature panels). Hairline borders (`--line`) instead of heavy shadows; glows only for amber roads and active focus.
- Icons: Lucide (thin stroke, 1.5 px), consistent 20/24 px.
- Textures: faint contour-line SVG patterns, very subtle film grain (opacity ≤ 4%) on hero only.

### 3.4 Map style "Night Survey"
Custom MapLibre style JSON on OpenFreeMap vector tiles: land `#0A0F1A`, water `#060B14`, admin boundaries thin `--line`, labels muted and sparse, hillshade from AWS Terrain Tiles at low opacity, existing roads in steel (width by class), **new roads in amber with glow**, unreliable tiles hatched. Light version "Paper Survey". Satellite base toggle: EOX Sentinel-2 cloudless (with attribution) and our own Sentinel-2 dates.

### 3.5 Motion tokens (`design/motion.ts`)
- Durations: 120 (micro), 200 (UI), 400 (panel), 700 (reveal), 1200 (cinematic).
- Easings: `expo.out` for reveals, `power3.inOut` for camera moves, `power2.out` for UI; a custom "scan" ease for scan-line sweeps.
- Stagger: 30–60 ms per word/line/item.
- Scroll scrub smoothing: 0.6–1.
- **Reduced motion:** if `prefers-reduced-motion` or the site motion toggle is off → no scroll-scrubbed 3D, no parallax, no split-text; replace with simple 200 ms fades and static posters. Lenis disabled.

---

## 4. SITE MAP

**Public site (cinematic):**
`/` Home · `/platform` How it works · `/capabilities` · `/solutions/security` · `/solutions/rural-road-audit` · `/solutions/planning` · `/explore` Live demo · `/stories` + `/stories/:slug` · `/research` · `/about` · `/docs` · `/contact` · `/attributions` · `/privacy` · `404`

**App (calm, fast):** `/app/sign-in` · `/app` Command Center · `/app/alerts` · `/app/alerts/:id` · `/app/explorer` · `/app/network` · `/app/audit` · `/app/zones` · `/app/ask` · `/app/reports` · `/app/system` · `/app/settings`

**Global:** top nav (public) with logo, Platform, Capabilities, Solutions (mega-menu with mini map vignettes), Explore, Research, Docs, "Open app" button; mobile full-screen menu with staggered links. Footer with HUD details (live UTC clock, AP centroid coordinates, data attributions, theme toggle, motion toggle, language toggle if enabled).

---

## 5. HOME PAGE — section by section

### H0. Preloader (first visit only, ≤ 1.2 s)
Thin orbit ring draws around the logo; a mono counter shows **real** asset-loading progress (never a fake timer). Skip if assets are cached. On complete, the ring becomes the scan line and wipes into the hero.

### H1. Hero — "Orbit to Road" (pinned scroll scene, ~300–400 vh)
Full-screen React Three Fiber canvas behind HTML text. HUD corner brackets with live camera lat/lon/altitude in mono.
- **Stage 1 — Orbit:** realistic Earth (NASA Blue Marble day + Black Marble night lights, smooth day/night terminator, atmosphere rim glow, subtle starfield), slowly rotating. Headline with SplitText line reveal: "Every new road. *Seen first.*" Sub-line + two CTAs: **Explore live demo** (amber, magnetic) and **See how it works** (ghost).
- **Stage 2 — India (scroll 0–30%):** camera rotates and eases toward India; India outline traces with a glowing line; small mono label "INDIA · 3.29 M km²".
- **Stage 3 — Andhra Pradesh (30–60%):** camera dives; AP boundary draws (DrawSVG-style on a projected path); Sentinel-2 cloudless texture fades in over AP; counter animates "1.63 lakh km² watched every season".
- **Stage 4 — The road (60–90%):** crossfade to a real high-res or Sentinel tile from the pilot zone; the **scan line** sweeps; existing roads light up in steel; a **new road draws itself in amber**; an alert card slides in: "New road · 1.4 km · confidence 0.93 · first seen Mar 2025" (from real data, or labelled demo).
- **Stage 5 — Handoff (90–100%):** canvas fades into a live MapLibre map snapshot with "Now explore it yourself →" linking to `/explore`.
- Scroll progress rail on the right with 4 stage labels (Orbit · India · Andhra Pradesh · Road), clickable.
- **Low tier / mobile / reduced motion:** a pre-rendered short video or image sequence of the same journey (recorded from the 3D scene), with the same text steps; no WebGL required.

### H2. The problem
Big kinetic statement, line-by-line reveal: *"Maps go stale. Roads don't wait."* Three proof points with animated counters, each with a source link (e.g. the PMGSY pilot finding about roads shorter than sanctioned; manual map updating is slow). Only cited facts.

### H3. How it works (pinned pipeline story)
Left: 6 numbered steps that highlight as you scroll. Right: **one image tile that morphs through the pipeline**:
1. Satellite image (Sentinel-2 / high-res) → 2. Clouds and shadows masked (hatched) → 3. Road mask (pixels glow) → 4. Road graph (lines + nodes draw) → 5. Compared over time (two dates stack, matched roads dim, unmatched glow amber) → 6. Alert (card with confidence breakdown).
Progress line connects the steps. Each step has a one-line plain explanation.

### H4. "Why not just compare two images?" (signature differentiator)
Split screen with a toggle **Pixel difference ↔ RoadWatch** on the same before/after pair:
- Pixel difference: hundreds of red change blobs flicker (crops, water, shadows, clouds) + counter "2,314 changes".
- RoadWatch: calm map, only **3 amber new roads** + counter "3 new roads".
Caption: *"Everything changes between two satellite photos. Only roads matter."* Numbers must come from a real run (or be labelled demo).

### H5. Capabilities bento grid (10 tiles, each with its own micro-animation on hover/in-view)
Monsoon-proof (radar ripples through a cloud) · Persistence rule (3 date cards stack, alert fires on the 2nd) · Abstain mode (cloudy tile turns hatched "Unreliable") · Construction stages (progress: cleared → earthwork → gravel → paved) · PMGSY audit (report page lifts with sanctioned vs detected bar) · Priority zones (polygon pulses) · Connectivity impact (lines connect villages, "+3,000 people connected" demo) · Ask in plain English (query types itself, map answers) · Offline mode (signal icon cuts, system keeps working) · Exports (SHP / GPKG / GeoJSON chips fly into a folder). Cursor-follow soft light on tiles (desktop only).

### H6. Time-lapse — "Watch Andhra Pradesh grow"
Full-width map of AP (or pilot district) with a draggable year scrubber 2022 → 2026 (also scroll-driven). New roads accumulate in amber per date; km counter and alert counter tick; play/pause button. Real pipeline outputs only.

### H7. Who it's for
Three tall cards: **Security analysts** (priority zones, early alerts) · **Rural road auditors** (PMGSY audit reports) · **Planners** (connectivity impact). Hover: card expands, a mini map vignette animates; click → solution page.

### H8. Results you can check
KPI cards from `reports/` (precision, recall, false-alert rate vs pixel-difference baseline, independent-area coverage), each with "Measured on held-out regions" and a link to `/research`. An animated bar chart compares baseline vs RoadWatch. If results are not ready yet, show "Results coming after evaluation" — never placeholders that look real.

### H9. Built on open data
Text-based source strip (no fake partner logos): Copernicus Sentinel-1/2, NASA, OpenStreetMap, Microsoft Road Detections, PMGSY GeoSadak (as applicable) with links and licences. "Origin: Smart India Hackathon problem SIH1564."

### H10. Final CTA
Huge type: *"Watch the map rewrite itself."* Amber magnetic button "Explore live demo", secondary "Read the research". Background: slow contour lines drifting, scan line passes once.

---

## 6. OTHER PUBLIC PAGES

### `/platform` — How it works (deep)
Interactive architecture diagram (Tier 1 statewide Sentinel screening → Tier 2 high-res verification), animated data flow (dots travel along edges on scroll), model cards for the HR model and the S-model, the graph-change method explained visually (two graphs overlay, matched edges fade, new edges glow), the persistence rule and abstain logic as small interactive demos, and the "Lean → Enhanced" packs as an expandable roadmap.

### `/capabilities`
All features in detail: sticky left index, right content blocks each with a looping product vignette (real UI snippets recorded from the app), plus a comparison table vs "pixel differencing" and "manual mapping" (honest, factual, no competitor bashing).

### `/solutions/*` (3 pages, shared template)
Hero with a relevant map vignette → the problem in their words → workflow in 4 steps with UI clips → sample output (alert card / audit PDF preview / connectivity chart) → FAQ accordion → CTA.

### `/explore` — Live public demo (most important page after Home)
Full-screen map (Night Survey style) with: layer toggles (existing roads, new roads, unreliable tiles, priority zones, satellite base), date range slider, **before/after swipe** with scan-line divider, alert markers with pulse, click → side sheet with the full alert detail (read-only), legend, HUD (cursor lat/lon, zoom, date, sensor). "Demo data" banner if applicable. A 5-step **guided tour** (coach marks) on first visit. Works on mobile (bottom sheet).

### `/stories` and `/stories/:slug` — scrollytelling case stories (2–3, real detections only)
Each story = a pinned map with camera `flyTo` per scroll step and text cards over it (e.g. "A new corridor appears", "Seeing through the monsoon with radar", "Auditing a village road"). Each step shows dates, before/after, and the alert evidence.

### `/research`
Method summary, datasets and licences, model cards, KPI tables with confidence intervals, ablation charts, negative-test results, limitations (honest, including the 10 m limit), paper PDF + BibTeX, link to the reproducibility package. Tables styled for reading, charts animated on enter.

### `/about`
Mission, the team (names/roles/photos only with consent), mentor, project timeline (CP1 → CP2 milestones as an animated vertical road line), how the project started (SIH1564), contact.

### `/docs`
Renders `docs/guides/*.md` as MDX with sidebar, search (local, e.g. FlexSearch), copy buttons for commands, "last updated".

### `/contact`
Short form (name, email, organisation, message, use case) saved to Supabase; honeypot anti-spam; success animation (scan line + check). No paid services.

### `/attributions`, `/privacy`
Auto-generated from `LICENSES_DATA.md`: every dataset, imagery source, font, texture, library licence. Privacy: what is stored (contact form, accounts), nothing sold, no tracking cookies.

### `404`
*"This road doesn't exist… yet."* A small map where a dead-end road slowly draws itself, then a button back home.

---

## 7. THE APP — screen by screen (calm, fast, keyboard-first)

### 7.0 App shell
Left rail (icons + labels, collapsible), top bar: AOI switcher (Pilot district / Andhra Pradesh), date range, global search, **Cmd/Ctrl+K command palette**, notifications bell, model version chip (e.g. `v1-lean`), offline indicator, user menu. Keyboard shortcuts listed in a `?` overlay. Motion ≤ 250 ms, no smooth-scroll, no 3D except maps. Dark default, light available.

**Every screen must have:** loading skeleton, empty state (small illustration + next action), error state with retry, offline state, permission state, and "Demo data" banner when applicable.

### 7.1 `/app/sign-in`
Split screen: left a slow, low-cost rotating globe (or static poster on low tier) with the tagline; right a clean form (Supabase Auth: email + Google). Button **"Explore with demo account"** (read-only).

### 7.2 `/app` — Command Center
Centre: map with alerts (deck.gl), existing/new roads, unreliable tiles. Left: KPI tiles (new roads this period, new km, pending review, false-alert rate, unreliable tile %, last data date) with sparkline. Right: live alert feed (newest first). Bottom: timeline of dates with data coverage. New alert arrival = toast + pulse ring at the location + counter tick (subtle).

### 7.3 `/app/alerts` — Review inbox
Virtualised list/table with filters (status, priority, confidence, stage, district, date, sensor), saved views, bulk actions. Keyboard: `J/K` move, `Enter` open, `A` accept, `R` reject (asks reason), `F` flag for field check.

### 7.4 `/app/alerts/:id` — Alert detail (shared-element transition from the list card)
Large before/after swipe (+ third view: radar), date timeline with persistence dots, **confidence breakdown** bar (model × persistence × connectivity × data quality), attributes (length, width, surface, stage), AI explanation (labelled "AI-generated"), connectivity impact, location mini-map, actions (Accept / Reject with reason / Flag / Export GeoJSON / Add to report), full audit log of who did what.

### 7.5 `/app/explorer` — Change Explorer
Time slider over all dates with play, compare any two dates (swipe or side-by-side), layer stack with opacity, abstain hatch overlay, draw an area to get stats for it.

### 7.6 `/app/network` — Road Network
Map + inventory table (filters by surface, stage, district), totals, connectivity analysis (villages newly connected, travel-time reduction chart).

### 7.7 `/app/audit` — PMGSY Audit
Upload a GeoSadak shapefile or pick a road → animated step progress (validating → matching → measuring → building report) → report preview (sanctioned vs detected length bar, coverage map, first-seen dates, before/after chips) → download PDF.

### 7.8 `/app/zones` — Priority Zones
Draw/edit polygons with terra-draw, set priority level and notification rules, list of zones with alert counts.

### 7.9 `/app/ask` — Ask in plain English
Input with example prompts → answer as map + table + short text; shows the generated query for transparency; disabled with a clear message in offline mode.

### 7.10 `/app/reports`
Generated reports (KPI, enhancement, audit) with preview and download.

### 7.11 `/app/system` — System & Model Health
Data freshness per sensor, tile-quality map, abstain statistics, model registry (`v1-lean`, `v2-…`), enhancement packs status, training run log (from `runs/RUN_LOG.csv`), GPU hours used vs budget, negative-test status badges.

### 7.12 `/app/settings`
Profile, team and roles, notification channels (Telegram / email), theme, motion, language, offline mode, data attributions.

**Responsive:** public site fully responsive (390 px → 1920 px). App: full tools on desktop/tablet; on mobile, Command Center summary + alerts list + alert detail (read-only actions allowed).

---

## 8. SIGNATURE COMPONENTS (build these first, reuse everywhere)
`Globe` (day/night shader, atmosphere, quality tiers) · `OrbitToRoadScene` · `ScanLine` · `HUDFrame` (brackets + live coordinates) · `ContourBg` · `SplitHeading` · `Reveal` · `Counter` · `Magnetic` · `ScrollProgressRail` · `BeforeAfterSwipe` (scan-line divider, keyboard accessible) · `TimeScrubber` · `RoadDrawLayer` (animated amber path) · `AlertCard` · `ConfidenceBreakdown` · `PersistenceDots` · `StageTracker` · `MapLegend` · `CommandPalette` · `EmptyState` · `DemoBadge`.
Each component: typed props, reduced-motion behaviour, keyboard support, a demo on the `/design` page.

---

## 9. DATA CONNECTION
- Generate TypeScript types from the FastAPI OpenAPI schema (`openapi-typescript`); one typed API client.
- Until the backend is ready, use **MSW** handlers with small fixtures made from **real pipeline outputs** (GeoJSON, PMTiles). Mark them as demo in the UI.
- Public `/explore` and Home use **precomputed static layers** (PMTiles/GeoJSON on Hugging Face), so the public site works without the backend running.
- No analytics or tracking scripts.

---

## 10. PERFORMANCE, QUALITY TIERS, ACCESSIBILITY, SEO

### 10.1 Budgets (must pass before a page is "done")
- Lighthouse (desktop): Performance ≥ 90, Accessibility ≥ 95, Best Practices ≥ 95, SEO ≥ 95. Mobile Performance ≥ 80 on pages with 3D.
- LCP ≤ 2.5 s, CLS < 0.1, INP < 200 ms.
- Initial JS for public pages ≤ 200 KB gzipped; the 3D chunk (≤ 600 KB gz) loads lazily **after** first paint, behind a static poster image of the hero.
- Globe textures ≤ 4 MB total on high tier (KTX2/WebP), 2K textures on medium tier.
- 60 fps target on a mid laptop, never below 30 fps; measure with Chrome DevTools Performance and an on-screen FPS meter in dev.

### 10.2 Quality tiers (via `detect-gpu` + `prefers-reduced-motion` + Save-Data)
- **High:** full 3D, postprocessing bloom on amber roads, device-pixel-ratio cap 2.
- **Medium:** no postprocessing, DPR cap 1.5, 2K textures.
- **Low / mobile / reduced motion:** pre-rendered video/image sequence + CSS transitions, no WebGL on load.
- Pause rendering when off-screen or tab hidden (`frameloop="demand"` where possible).

### 10.3 Accessibility (WCAG 2.2 AA)
Semantic HTML, skip link, visible focus ring (`--sentinel`), full keyboard support (swipe slider, scrubber, maps controls, command palette), alt text for all imagery, map content also available as lists/tables, captions for videos, motion toggle in footer, no flashing above 3 per second (careful with the pixel-difference demo — keep flicker slow), respects `prefers-reduced-motion` and `prefers-color-scheme`.

### 10.4 SEO & sharing
Prerendered public pages, per-page titles/descriptions, designed Open Graph images (1200×630) per main page, favicon set + app icons, sitemap.xml, robots.txt, structured data for the research paper.

---

## 11. CONTENT & HONESTY RULES
- Write all copy yourself in the brand voice; keep it short. I approve key headlines.
- Every statistic has a source link or comes from our own `reports/`.
- No fake testimonials, client logos, partner badges, awards or user counts.
- Demo data is always labelled. AI-generated text is always labelled.
- Attributions are visible near maps/imagery and complete on `/attributions`.

---

## 12. BUILD PHASES

| Phase | When | Deliverables |
|---|---|---|
| **UI-0 Research & design system** | CP1 week 3 (≈ 2 days) | `docs/ui/research.md`, tokens, fonts, Night Survey map style, `/design` style page, style board → my review |
| **UI-1 CP1 demo slice** | CP1 week 3–4 (≤ 20% of CP1 time) | Home hero (poster + medium-tier globe version), H3 pipeline section, basic `/explore` showing extracted roads from the pilot zone, app shell skeleton. Enough for a strong CP1 demo. |
| **UI-2 Full public site** | CP2, first half | All public pages and sections, high-tier 3D, stories, research page, SEO, OG images |
| **UI-3 App** | CP2, alongside O4 | All app screens wired to the real API (MSW fallback), all states, keyboard flows |
| **UI-4 Polish & launch** | CP2, before final review | Performance and accessibility passes, Telugu toggle (optional), deploy (GitHub/Cloudflare Pages + HF Space), demo video recording, final `ui_review.md` |

Show me progress at the end of each phase with a 🔴 YOUR TURN review block (exact URL, what to scroll/click, what feedback to send).

---

## 13. SELF-REVIEW LOOP & "$10K" DEFINITION OF DONE

### 13.1 After every page/section
1. Take Playwright screenshots at **1440×900, 1024×768, 390×844**, in **dark and light**, and record a short scroll video for motion sections. Save to `reports/ui/<page>/`.
2. Run Lighthouse + axe; save results.
3. Score yourself 1–10 on: concept clarity, visual hierarchy, typography, colour, motion quality (purposeful, smooth), interaction details, responsiveness, performance, accessibility, honesty of content. **Anything below 8.5 → improve and re-check.**
4. Compare against the reference notes in `docs/ui/research.md`: "Would this hold up next to an Awwwards Site of the Day and next to planet.com / felt.com?" Write one line of honest critique and what you changed.

### 13.2 Definition of done ("worth $10k")
- [ ] One clear concept ("orbit to road") carried through every page and the app.
- [ ] Hero scroll scene runs at ≥ 50 fps on my laptop and has a polished low-tier fallback.
- [ ] Real data in Home, Explore, Stories and Research (or clearly labelled demo).
- [ ] "Why not just compare images?" section works with a real example.
- [ ] Public Explore demo usable by a stranger in under 30 seconds (guided tour).
- [ ] All app screens have all states (loading/empty/error/offline/demo).
- [ ] Keyboard-only and screen-reader checks pass; reduced-motion mode looks intentional.
- [ ] Budgets in Section 10.1 pass on every public page.
- [ ] Consistent design system: no one-off colours, fonts or spacings.
- [ ] Attributions complete; no copied assets; no fake proof.
- [ ] Deployed demo link + 2-minute demo video recorded from the real site.

---

## 14. QUESTIONS TO ASK ME BEFORE UI-0 (batch, with defaults)
1. Brand name and tagline OK? *(default: RoadWatch — "Every new road. Seen first.")*
2. Default theme? *(default: dark "Night Survey", with light mode)*
3. Accent colour OK? *(default: Signal Amber `#FFB547` for new roads)*
4. Team names, roles and photos for `/about`, and does everyone consent? *(default: names + roles, no photos)*
5. Mentor name and whether to show it. *(default: show name only)*
6. May we show KL University's name/logo? *(default: name as text only, no logo until permission)*
7. Hosting / domain? *(default: free Cloudflare Pages or GitHub Pages subdomain + HF Space for the API)*
8. Telugu language toggle on public pages? *(default: yes, Phase UI-4)*

---

## 15. "HOW TO USE IT" GUIDES FOR ME (write them, with every click)
- `docs/guides/ui_run_locally.md` — install, start the dev server, which URL to open (`http://localhost:5173`), how to switch theme/motion, where the `/design` style page is.
- `docs/guides/ui_review.md` — how I review each phase: what to open, what to scroll, what to check, how to send feedback.
- `docs/guides/ui_deploy.md` — deploy the public site and app, wake up sleeping free services, check attributions.
- `docs/guides/ui_demo_video.md` — how to record the demo video for free (e.g. OBS Studio), the exact click path through the site, and target length.
