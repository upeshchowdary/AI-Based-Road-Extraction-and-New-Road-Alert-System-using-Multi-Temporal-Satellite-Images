# DECISIONS — Architecture Decision Records

> One ADR per decision. Status: Proposed / Accepted / Superseded by ADR-xxx.
> Cheap-to-redo choices are made by the engineer and logged here; expensive ones wait for the user.

---

## ADR-001 — Repository root is `E:\cap-22`
- **Status:** Accepted (2026-10-14)
- **Context:** Section 5 shows a `roadwatch/` root folder. The project folder already exists at `E:\cap-22` with `PROJECT_PROMPT.md` in it.
- **Decision:** `E:\cap-22` *is* the `roadwatch/` repo root. Python package lives at `src/roadwatch/`.
- **Consequence:** No extra nesting level; all paths in docs are relative to `E:\cap-22`.

## ADR-002 — Python 3.11 via uv
- **Status:** Accepted (2026-10-14)
- **Context:** Section 4 fixes Python 3.11. Machine has 3.13 / 3.12 / 3.10, not 3.11. Kaggle images and geo wheels (rasterio, GDAL, geopandas) are best supported on 3.11.
- **Decision:** `uv python install 3.11`, pin with `.python-version`. Keep uv cache inside the project (`UV_CACHE_DIR=.cache/uv`, git-ignored) per Section 2.
- **Consequence:** Same minor version locally and on Kaggle → fewer "works on Kaggle, not locally" bugs.

## ADR-003 — Disk budget: prompt says 2–4 GB free, machine has much more
- **Status:** Accepted — option B (user, 2026-10-14). Enforced by `scripts/disk_check.py`.
- **Context:** Section 2 assumes only 2–4 GB free. Measured: E: (project drive) 249.9 GB free, D: 209.7 GB, C: 19.2 GB. Also a local RTX 4070 (8 GB VRAM) exists, while Section 2/4 say "no CUDA PyTorch locally".
- **Options:**
  - A. Keep the strict 3 GB cap and CPU-only ONNX locally (as written).
  - B. Keep the project under 3 GB in Git/env, but allow a git-ignored `data_cache/` on E: (cap 30 GB) for pilot-zone chips and fast local debugging; still no training locally.
- **Recommended default:** B (faster iteration, still all training on Kaggle, all lean rules unchanged).

## ADR-004 — Scripts target Windows PowerShell 5.1
- **Status:** Accepted (2026-10-14)
- **Context:** Only Windows PowerShell 5.1 is installed (no `pwsh` 7).
- **Decision:** All documented commands must run in PowerShell 5.1 (no `&&`, no `??`). Python CLIs (`uv run roadwatch ...`) do the real work so shell differences don't matter.

## ADR-005 — Provisional defaults for Section 13 questions not yet asked
- **Status:** Proposed (2026-10-14) — will be confirmed in question batch 2 (dates, KL template, paper)
- **Decision (provisional):** Monitoring dates 2022–2026, 2 per year (pre-monsoon Mar–May, post-monsoon Oct–Dec) · KL University report/slide templates unknown → generic IEEE-style report until a template arrives · research paper target: yes, draft in CP2.
- **Consequence:** Week 1 work isn't blocked; all three are config/doc changes, cheap to redo.

## ADR-006 — CP1 compressed from 4 weeks to 6 days
- **Status:** Accepted (2026-10-14). User: "review in 6 days" → CP1 review ≈ 2026-10-20.
- **Decision:** Keep the CP1 *vertical slice* (data pipeline → Baseline A → masks → graph → GeoJSON → map page → KPI-1 table with CIs). Cut/defer:
  - SAM-Road → CP2.
  - Reference B (DINOv3) only if the gated licence is approved by Day 3; otherwise it stays planned, and Baseline A vs a second CNN encoder is the O2 comparison for CP1.
  - Supabase, Telegram, Gemini, Earth Engine, Copernicus, Bhoonidhi accounts → CP2.
  - Docs written as short versions; completed in CP2.
- **Consequence:** The CP1 report must state these cuts plainly. Nothing is deleted, only postponed.

## ADR-007 — Spatial holdout on one India-wide grid (EPSG:7755), frozen 2026-10-14
- **Status:** Accepted
- **Decision:** 20.48 km square blocks (4×4 Sentinel-2 tiles) on EPSG:7755 (WGS 84 / India NSF LCC). A block's split comes from sha256(seed, bx, by): 20% test, 10% val, rest train. Any chip within 1 km of a test block is `buffer` (never trained or tuned on). Tiles use per-UTM-zone grids with IDs `T{epsg}_{res}m_{size}_{col}_{row}`.
- **Why:** The split must not depend on the AOI, so pilot, statewide and any later India run see the same test set. Hash-based means no stored random state can be lost.
- **Evidence:** `evidence/holdout/` — 95 / 489 AP blocks are test; sha256 `8a9150a57d46…`. CI and `tests/test_splits.py` fail if it changes. `roadwatch holdout freeze` refuses to overwrite.

## ADR-008 — All three high-res zones are evaluation-only holdout
- **Status:** Accepted (user chose all three zones, 2026-10-14)
- **Decision:** Zones A (Vijayawada W. bypass), B (Machilipatnam port), C (Gannavaram–Nunna) are `zone_test`: never trained or tuned on, with a 1 km buffer. Pilot AOI = NTR ∪ Krishna ∪ zone boxes (zone A crosses into Guntur district).
- **Why:** New-road detection (KPI-2/3) and the demo are measured in these zones, so training on them would inflate results.
- **Cost:** 70 of 374 pilot tiles are not trainable; this is irrelevant statewide (~6,200 tiles).

## ADR-009 — Team roles
- **Status:** Accepted (provisional names A, B, C, D — replace with real names any time)
- **Decision:** User = Model engineering lead (codes). A = Spatial evidence & provenance lead. B = GIS workflow & delivery lead. C = Validation & uncertainty lead. D = Training-runs & reproducibility lead. All four run Kaggle jobs on their own accounts; seeds are split across accounts.

## ADR-010 — Public GitHub repository
- **Status:** Accepted (user, 2026-10-14)
- **Consequences:** No secrets (`.env` git-ignored, `check_env.py` prints only PRESENT/MISSING). No imagery, model weights or ISRO data in Git (`.gitignore` blocks *.tif, *.pt, *.onnx, data_cache/). Only small OSM-derived GeoJSON (ODbL, attributed).

## ADR-011 — Boundaries via Nominatim lookup, not Overpass
- **Status:** Accepted (2026-10-14)
- **Context:** Overpass mirrors returned 406/504 errors during setup. Nominatim `lookup?osm_ids=R…&polygon_geojson=1` returns the same OSM relation polygons.
- **Decision:** `scripts/fetch_boundaries.py` uses fixed relation IDs through Nominatim (≤1 req/s). Areas check out: AP 163,136 km², NTR 3,285 km², Krishna 3,826 km².
## ADR-012 — DeepGlobe fixed split by image-id hash (80/10/10)
- **Status:** Accepted (2026-10-14)
- **Context:** Only DeepGlobe's official *train* split (6,226 images) has masks; its images carry no coordinates, so a spatial split is impossible.
- **Decision:** sha256("deepglobe:"+image_id) → 10% test, 10% val, 80% train (4,972 / ~622 / ~632). Frozen in `kaggle/baseline_a/train.py::fixed_split`. The DeepGlobe test split is used only for KPI-1 extraction metrics; AP spatial holdout (ADR-007) is used for everything on AP imagery.

## ADR-013 — Kaggle free GPU quota is 6 h/week/account (not 30 h)
- **Status:** Accepted (measured 2026-10-14 via `kaggle quota`: totalTimeAllowed 21600 s; resets Sat 00:00 UTC; TPU 20 h/week)
- **Consequences:** ~30 GPU-h/week for the team of 5 accounts (Section 6.3 budget of 40–75 h is still feasible across ~2–3 weeks, but CP1 must be lean).
  - Training changes: 4 random crops per decoded image, validation every 2nd epoch, and a hard `max_hours` stop (resumable) in every GPU kernel.
  - **Correction (2026-10-14, full_s0 evidence):** the 4-crop change did NOT speed training up — throughput was 14.6 crops/s vs 13.5 before, so JPEG decode was not the bottleneck (my hypothesis was wrong). Each epoch simply holds 4× more crops (~25 min). Quota savings come from early stopping and `max_hours`, not from the loader.
  - Every GPU kernel is smoke-tested on CPU first (`scripts/smoke_train.py`) — it already caught an ONNX-exporter bug.
  - Quota is billed per session hour: the T4×2 timing run used 579 s for a ~568 s job.
  - Data builds (Sentinel-2 composites) run on **Kaggle CPU sessions**, which use no GPU quota.

## ADR-014 — Sentinel-2 composites: region reads, seasons, radiometry
- **Status:** Accepted (2026-10-14)
- **Decision:**
  - Composite per region (one windowed read per scene and band for a whole zone, then cut into tiles): 17× faster than per-tile reads, pixel-identical output (tested on zone A).
  - Seasons: pre_monsoon 03-01..05-31, post_monsoon 10-15..12-31 (config `data.seasons`). Seasons not finished yet are skipped, not reserved.
  - Up to 8 least-cloudy scenes (<60% cloud) per composite; SCL classes 0,1,3,8,9,10 masked; per-pixel median.
  - Processing baseline ≥ 04.00 (2022+) has a +1000 DN offset — removed so all dates share one scale.
  - Storage uint8 (reflectance 0–3000 → 1–255, 0 = no data). 16-bit is Pack B.
- **Evidence:** zone A tile T32644_10m_512_89_356: valid 100%, grid check pass, 2023↔2025 registration shift 0.0 px.

## ADR-015 — OSM labels from Geofabrik southern-zone extract
- **Status:** Accepted (2026-10-14)
- **Decision:** Roads = OSM `highway` vehicle classes (motorway … track), rasterised on the tile grid with a per-class width buffer (min 5 m half-width, all_touched). Tiles with < 20 road pixels are "empty"; in train/val only `empty_tile_keep_ratio` (0.2) of them are kept, deterministic by tile-id hash; the rest are `reserved: empty_tile` (Pack A). Holdout-buffer tiles are `reserved: holdout_buffer`.
- **Limitation:** OSM is a 2026 snapshot — older composites get labels for roads that may not exist yet. Extraction training uses the newest composites; OSM edit history (CP2) gives dated change labels.
## ADR-016 — Frozen DINOv3 runs online, not with cached features
- **Status:** Accepted (2026-10-14)
- **Context:** Lean switch `model.backbone_mode=frozen_cached`. For DeepGlobe, caching 1/16 ViT-L features for ~20k 512-px crops = 32x32x1024 fp16 x 20k ≈ 40 GB, more than Kaggle's working disk.
- **Decision:** Reference B keeps the backbone frozen but computes features on the fly (under no_grad, fp16). Same model and result as cached; costs one backbone forward per crop per epoch. Caching stays the plan for Sentinel-2 tiles (much smaller).

## ADR-017 — New canonical GitHub repo with clean history
- **Status:** Accepted (user request, 2026-10-14)
- **Decision:** Canonical repo is `upeshchowdary/AI-Based-Road-Extraction-and-New-Road-Alert-System-using-Multi-Temporal-Satellite-Images` (public; GitHub names cannot contain spaces). Its history is the old history rebuilt commit-by-commit (same messages/authors/dates/final tree) with `image.png` (Kaggle-token screenshot) removed from all 6 trees that had it. `git filter-branch` crashed on Windows, so the rebuild used `git commit-tree`.
- **Local:** `main` = clean history tracking `origin` (new repo). The old local history is kept as branch `old-main-unclean`; the old repo is remote `roadwatch-ap-old`. The old repo still holds the screenshot in commit f38e24b — delete or archive it when convenient.

## ADR-018 — Frontend tech stack (`web/`)
- **Status:** Accepted (UI session, 2026-10-14)
- **Context:** UI_PROMPT.md Section 2.1 specified the full stack. Choices made during the UI session are recorded here.
- **Framework:** React 19 + TypeScript + Vite 6; React Router v7 with lazy page splits.
- **Styling:** Tailwind CSS v4 (Vite plugin), CSS custom properties for the Night Survey token set, `clsx`/`tailwind-merge`.
- **UI primitives:** shadcn/ui (Radix) restyled; `cmdk` command palette; `sonner` toasts; `vaul` mobile sheets.
- **3D / scroll:** GSAP 3 (all plugins free: ScrollTrigger, SplitText, DrawSVG); `@gsap/react` `useGSAP`; Lenis smooth scroll on public pages only (disabled in `/app` and on map elements).
- **3D scene:** three.js + React Three Fiber + drei + postprocessing. `detect-gpu` quality tiers: high (full postprocessing, DPR 2), medium (no postprocessing, DPR 1.5), low (static poster/video, no WebGL).
- **Maps:** MapLibre GL JS + deck.gl (`@deck.gl/maplibre`), PMTiles road layer, `terra-draw` for priority zones.
- **Data:** TanStack Query + Zustand + MSW (fixture-based demo mode); no analytics/tracking.
- **Fonts:** Geist + Geist Mono (self-hosted, subsetted) + Instrument Serif (editorial italic accent).
- **Consequence:** `node_modules` ~0.9 GB; pnpm workspace at `web/`. All other Python/ML work in the repo root is unaffected.

## ADR-019 — \"Night Survey\" design system and motion approach
- **Status:** Accepted (UI session, 2026-10-14)
- **Tokens:** `--bg-0 #05070C` (deep space) through `--signal #FFB547` (Signal Amber for new roads) and `--sentinel #4FD1E8` (interactive / scan line). Full set in `web/src/design/tokens.css`. Light mode \"Paper Survey\" also defined.
- **Amber is precious:** used only for new roads, the primary CTA, and hero KPI numbers. No decoration use.
- **Motion tiers:** 120 ms micro → 200 ms UI → 400 ms panel → 700 ms reveal → 1200 ms cinematic. `prefers-reduced-motion`: all scroll-scrubbed 3D and parallax off; 200 ms cross-fades only; Lenis disabled. Site motion toggle in footer persists to `localStorage`.
- **Recurring motifs:** scan line (section transitions, loaders, before/after divider), roads as light (amber = new, steel = existing, hatched grey = unreliable), Survey HUD (corner brackets, monospace coordinates, UTC clock, sensor/date chips), contour lines as backgrounds.
- **WCAG 2.2 AA:** every text/background pair checked; colour never the only signal (new roads also get draw-in animation + dashed-to-solid style + label).
- **Consequence:** `/design` route (dev only) shows the living style page for all tokens, typography, components.

## ADR-020 — Home hero scroll scene strategy and `/explore` architecture
- **Status:** Accepted (UI session, 2026-10-14)
- **Hero (H1):** GSAP ScrollTrigger pins the React Three Fiber canvas for ~350 vh. Five stages: Orbit (NASA Blue Marble + Black Marble night lights, day/night terminator) → India → Andhra Pradesh (AP boundary draw) → Road (scan line + amber new-road draw + alert card) → Handoff (MapLibre snapshot). Real Sentinel-2 imagery (Vijayawada 2022/2024) used in Stage 4 and the \"Why not just compare images?\" section (1,183 changed areas vs 1 new road from real run).
- **Low tier / mobile / reduced motion:** pre-rendered WebP poster replaces the WebGL canvas; same text stages animated with CSS. Phones ≥ 390 px wide get a calm static version.
- **Explore (`/explore`):** full-screen MapLibre + deck.gl; 9-season date picker (2022–2026); before/after BeforeAfterSwipe with scan-line divider; 25 unreliable tiles shown hatched; alert detail side-panel; 5-step guided tour (coach marks, localStorage-gated). \"Demo data\" banner on all computed scores, review statuses and priority zones. Real imagery + OSM roads + pipeline GeoJSON outputs.
- **Scroll progress rail:** right edge of the hero, 4 stage labels (Orbit · India · Andhra Pradesh · Road), keyboard-focusable and click-jumpable.
- **Consequence:** Home Lighthouse desktop ≈ 87 performance (3D loads lazily post-first-paint); Explore perf score lower due to map tiles loading (not re-measured after 9-date fix). All other pages ≥ 90 performance, 100 accessibility.

## ADR-018 — CP1 extraction results so far; Reference B decision pending
- **Status:** Proposed (2026-10-14) — needs the user's call on teammate GPU hours
- **Evidence:**
  - Baseline A (U-Net R34, DeepGlobe, seed 0): TEST IoU **0.501 [0.490, 0.513]**, F1 **0.668 [0.658, 0.678]** (n = 640 images, 95% bootstrap CI), 2.45 GPU-h. Best val IoU at epoch 0, then val fell every validation while train loss fell (overfitting) → early stop at epoch 5. Below the ~0.60–0.65 IoU usually reported on DeepGlobe — known gap, to report honestly.
  - Reference B (frozen DINOv3-sat ViT-L + 2.24 M-param decoder): after 1 epoch val IoU **0.165** (Baseline A had 0.496 after its first epoch); 35 min/epoch on T4×2 → ~4.6 GPU-h for 8 epochs.
- **Options:** (a) spend ~2.5 GPU-h of a teammate account to resume Ref B for 4 epochs and get a fair learning curve; (b) keep Ref B frozen but change the decoder (stronger high-res detail path) before spending more; (c) for CP1 report Ref B as "not competitive at equal cost" with the measured evidence, and revisit in CP2 with LoRA (Pack D).
- **Also:** Baseline A should get a lower-LR / stronger-augmentation variant (overfitting) — seeds 1 and 2 (teammate cards) still use the original config so the 3-seed result stays comparable.
