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

## ADR-013 — Kaggle free GPU quota (corrected: 30 h/week/account)
- **Correction (2026-10-18, user + evidence):** the lead account's Kaggle *Settings → Quotas* shows **Kaggle GPU 01:05 / 30 hrs** and `kaggle quota` reports `GPU 1.09h used, 28.91h remaining, 30.00h total, refresh 2026-10-24`. The quota is **30 h/week/account**. The 6 h below came from a 2026-10-14 `kaggle quota` reading of 21600 s; either the account limit was raised after verification or I read the wrong field — not resolvable now. All docs, cards, API and UI now say 30 h. Team capacity is therefore ~150 GPU-h/week (5 accounts), far above the 40–75 h project budget; the `max_hours` stops stay as cost discipline, not as a quota necessity.
- **Status (original, superseded):** measured 2026-10-14 via `kaggle quota`: totalTimeAllowed 21600 s (= 6 h); resets Sat 00:00 UTC; TPU 20 h/week
- **Consequences (as planned with the wrong 6 h figure):** ~30 GPU-h/week for the team of 5 accounts (Section 6.3 budget of 40–75 h is still feasible across ~2–3 weeks, but CP1 must be lean).
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

## ADR-018 — CP1 extraction results; Reference B vs Baseline A
- **Status:** Accepted (2026-10-18; proposed 2026-10-14) — see "Resolved" below
- **Evidence:**
  - Baseline A (U-Net R34, DeepGlobe, seed 0): TEST IoU **0.501 [0.490, 0.513]**, F1 **0.668 [0.658, 0.678]** (n = 640 images, 95% bootstrap CI), 2.45 GPU-h. Best val IoU at epoch 0, then val fell every validation while train loss fell (overfitting) → early stop at epoch 5. Below the ~0.60–0.65 IoU usually reported on DeepGlobe — known gap, to report honestly.
  - Reference B (frozen DINOv3-sat ViT-L + 2.24 M-param decoder): after 1 epoch val IoU **0.165** (Baseline A had 0.496 after its first epoch); 35 min/epoch on T4×2 → ~4.6 GPU-h for 8 epochs.
- **Options:** (a) spend ~2.5 GPU-h of a teammate account to resume Ref B for 4 epochs and get a fair learning curve; (b) keep Ref B frozen but change the decoder (stronger high-res detail path) before spending more; (c) for CP1 report Ref B as "not competitive at equal cost" with the measured evidence, and revisit in CP2 with LoRA (Pack D).
- **Also:** Baseline A should get a lower-LR / stronger-augmentation variant (overfitting) — seeds 1 and 2 (teammate cards) still use the original config so the 3-seed result stays comparable.
- **Resolved (2026-10-18): Baseline A is the O2 reference.** With the 30 h quota, Reference B got a full run (`reference_b_full_s0`, same split, 5 h budget): 5 of 8 epochs, val IoU 0.144 → 0.219 → 0.275 → 0.259 → 0.342 (not converged), **TEST IoU 0.356 [0.343, 0.368]**, F1 0.525, precision 0.590, recall 0.473; 3.95 h training (4.20 h session). Baseline A seed 0: 0.501 [0.490, 0.513] in 2.46 h. CIs do not overlap → a frozen foundation backbone with a light decoder is clearly worse here; recall is its weak side (thin roads need high-res detail the frozen ViT-L/16 features at 1/16 scale lose). LoRA / a high-res detail path stays a CP2 option (Pack D), not a CP1 claim.

## ADR-019 — Tier-1 Sentinel-2 model v1 and local inference
- **Status:** Accepted (2026-10-16)
- **Evidence:** `s2_model_full_s0` (U-Net R34, 4 bands, 498 train tile-seasons, 25 epochs, 0.34 GPU-h): TEST IoU **0.320 [0.300, 0.338]**, F1 0.484; zones A/B/C IoU 0.296 / 0.332 / 0.300 (n = 60 / 75 / 75), precision > recall everywhere. Full table: `reports/kpi1_cp1.md` (generated by `scripts/kpi_report.py`).
- **Decision:** This model (`s2_model_full_s0_6e9081638291`, ONNX 98 MB) is the CP1 Tier-1 model. Laptop inference via ONNX Runtime CPU (`roadwatch infer`) for zones A–C, seasons 2022/2026 pre-monsoon; outputs (prob GeoTIFF + GeoJSON/GPKG/SHP) in `data_cache/outputs/`, shown on the map as "Roads extracted by RoadWatch".
- **Known limits:** labels include residential streets narrower than a 10 m pixel (recall is the weak side); trained on the pilot only — statewide/national training is CP2 (Pack-style expansion, same code).

## ADR-020 — First graph-level change detection (O3 v1), real alerts replace demo
- **Status:** Accepted (2026-10-16; user asked to continue with the next work)
- **Method:** `change/detect.py` — baseline = model roads in both 2022 seasons (25 m buffer); candidates = latest-season roads outside it, merged, >= 100 m; presence per later season via 5 m raster masks (seen / absent / abstain on registry-reserved tiles); persistence >= 2 dates AND seen in >= 3 later seasons AND **stability** >= 0.75 (once it appears it stays); score = confidence x persistence x connectivity x quality. `roadwatch detect` -> `data_cache/outputs/alerts/alerts.json`; `/api/alerts` serves it (`demo: false`).
- **Results (S2 model v1, 9 seasons 2022-2026):** 1,131 raw -> **413 alerts** after the stability rule (A 155 / B 99 / C 159; 101.8 km). Sanity check vs the known Vijayawada West Bypass (OSM, 49.8 km incl. both carriageways): **43% recall** within 40 m (52% before the stability rule); bypass alerts score above average (0.51 vs 0.46).
- **Not yet measured:** precision / KPI-2 / KPI-3 (needs dated ground truth: OSM edit history, CP2). Width, surface and construction stage are not estimated; UI shows "not estimated". Reviews are stored in the browser only.

## ADR-021 — Deploy on Render: one Docker service + release data bundle
- **Status:** Accepted (2026-10-16; user asked to make it ready to deploy on Render)
- **Decision:** One Render web service (free plan, Singapore) built from `Dockerfile` via `render.yaml`: Node stage builds `web/`, Python stage runs `roadwatch serve` (API + built UI). Data the API reads but Git does not hold ships as `roadwatch_data.tar.gz` on GitHub release **data-v1** (`scripts/build_deploy_bundle.py`): 27 pre-rendered zone images + meta, composite tile index, run metrics, predicted roads, alerts (67 MB). The 500 MB of GeoTIFFs stay local; the API falls back to the index + pre-rendered images (`ROADWATCH_DATA`, `composites_manifest.json`).
- **Why:** no secrets needed at runtime, no paid storage, one URL for the review; Git history stays free of data.
- **Checks:** CI job `docker` builds the same image, starts it and checks health (630 composites), real alerts, a zone image and the SPA. Free-plan limits: 512 MB RAM, sleeps after 15 min idle.
- **Licences:** bundle is Copernicus-derived (attributed) + RoadWatch outputs; Esri/EOX imagery is never bundled (fetched by the browser under their terms).

## ADR-022 — Alert evidence chips and server-side review decisions
- **Status:** Accepted (2026-10-16; next tasks after the deploy setup)
- **Evidence:** `GET /api/alerts/{id}/evidence` lists one chip per season (square crop >= 640 m, 160 m margin, 10 m/px) with the road path in chip pixels and what change detection saw (seen / absent / abstain). Chips are cut from the zone images, cached under `web_cache/chips/` (name includes a geometry hash), and pre-rendered into the deploy bundle (413 alerts x 9 seasons). The alert page compares the last clear date before `first_seen` with the latest seen date; a filmstrip lets the reviewer pick any two dates.
- **Reviews:** `POST /api/reviews` appends to `data_cache/outputs/alerts/reviews.jsonl` (append-only: who/when/status/reason/model). `/api/alerts` applies the latest decision; `GET /api/reviews/labels.geojson` exports accepted/rejected alerts with reasons as training labels (CP2 retraining + KPI-2 precision). `ROADWATCH_REVIEWS=browser` makes a server read-only (public Render demo): decisions then stay in each visitor's browser, as before.
- **Not yet:** reviewer identity (single "Analyst"), multi-user conflict handling, persistence on Render (free disks are ephemeral).

## ADR-023 — Statewide Andhra Pradesh: screening pipeline, v2 training, alert rule
- **Status:** In progress (2026-10-18; user: "train all the Andhra Pradesh ... make the numbers and alerts real")
- **Data:** Sentinel-2 composites for all of AP (configs/statewide.yaml: 6,790 tiles, 160,092 km², 3 UTM zones) on Kaggle **CPU** sessions: 2022 pre+post (change baseline), 2023–2026 pre-monsoon (post-monsoon is mostly cloud on the coast). Statewide OSM labels built in the 2026 run (Geofabrik southern-zone extract).
- **Incident:** 5 builds × 8 workers hit the Planetary Computer rate limit ("You have exceeded a rate limit"); ap_2022 died after 98 tiles. Fix in the kernel script only (no package change): workers restart with exponential back-off, start staggered, and a run can resume from earlier outputs (`kernel_sources` per run). ap_2022 re-run as ap_2022_r2 (4 workers).
- **Screening:** `kaggle/statewide/run.py`, CPU only (ONNX on CPU is fast enough; GPU hours are kept for training): per 5×5-tile block, model → road graph per season → the same change detection as the pilot (ADR-020: 2022 baseline, persistence, stability, abstain on cloudy tiles) → evidence chips per season. 6 shards.
- **Alert rule for statewide:** candidates are counted, but only roads **≥ 300 m** become alerts. Local test on 2 blocks near zone A: 256 candidates, median 150 m long (mostly fragments); ≥ 300 m kept 34 (13%). The pilot zones keep their 9-season run (ADR-020, ≥ 100 m) and their ids; statewide alerts inside the zones are dropped (Section 14.5 stable ids). Roads first seen in 2025–2026 cannot be confirmed yet (need ≥ 3 later dates) — stated, not hidden.
- **Training v2:** same U-Net R34, all AP train tiles, 2026 pre-monsoon, same frozen holdout (s2_model `v2_s0`, ~2 GPU-h). Promote over v1 only if equal or better on every holdout zone (Section 14.4).
- **Also:** S2 model v1 seeds 1–2 and Reference B 8-epoch run (fair O2 comparison) on the 30 h/week quota.
- **Update 2026-10-18 (evening):** composites complete, 6,790 tiles per season (QA pass: 2022 pre 6,316 · 2022 post 6,612 · 2023 6,394 · 2024 6,388 · 2025 6,598 · 2026 6,722). The 2026 run crashed **after** building every composite: `labels-build` writes `data_cache/osm/roads_*.parquet` and that folder does not exist in a fresh clone (fixed in `cli.py`; `kaggle/s2_build/run.py` also creates it, since the run is pinned to an older commit). Kaggle refuses an errored run as `kernel_sources` ("not valid kernel sources"), so 4 statewide shards started without 2026 — they were cancelled within minutes rather than produce alerts with a wrong latest season — and 2026 is rebuilt in full (v2, incl. labels). Kaggle allows **at most 5 concurrent CPU sessions** → shards go in two waves. S2 seed 1 sat ~10 h "running" on GPU with no output (cancelled; quota shows it was not charged); the trainer now has a hard watchdog (exit at 1.5 × `max_hours` + 1 h) and seed 1 was relaunched.
- **Update 2026-10-22:** 2026 v2 complete (6,790 composites + **6,790 statewide label tiles** from 616,512 OSM road lines). Statewide shards first failed in 20 s (`planetary_computer` not installed in the Kaggle image; `roadwatch.data.sentinel2` imports it at module level) — install list fixed, shards 0–4 relaunched; shard 5 follows when a CPU slot frees. `s2_model v2_s0` training. S2 v1 over 3 seeds: test IoU 0.320 / 0.313 / 0.334 → **0.322 ± 0.011**.

## ADR-024 — Upgrade plan after CP1: measure the change claim (KPI-2/3), then scale
- **Status:** In progress (2026-10-22; user: "do some advanced upgrades … plan them properly and execute")
- **Why:** the project's core claim is *new-road alerts with few false alerts*. KPI-1 (extraction) is measured; KPI-2/3 (detection precision/recall, false alerts vs a pixel-difference baseline) were "not measured — do not claim". That is the largest gap against the charter, so it goes first.
- **U1 — KPI-2/3 with dated ground truth (executing):** OSM full history (ohsome API, `elementsFullHistory`, one request per zone) gives the road network as mapped on 2022-01-01 and on 2026-06-01. Newly mapped roads (> 25 m from any 2022 road, ≥ 100 m) = confirmed-new ground truth; alerts on roads OSM already had in 2022 = **known false**; the rest = unverified (reported, never guessed). Compared on zones A–C with the same model and imagery: ours vs **pixel difference** (post-classification, naive and with 30 m tolerance) and **ablations** (no stability, no abstain, 2 dates only). `src/roadwatch/qa/change_eval.py`, `scripts/change_eval_report.py` → `reports/kpi23_change_eval.md`. Limits stated: newly *mapped* ≠ newly *built*; OSM misses village roads.
- **U2 — statewide alerts (running):** 6 CPU shards → `scripts/merge_statewide.py` → app.
- **U3 — model v2 (running):** promote over v1 only if not worse on any holdout zone (Section 14.4); otherwise report and keep v1.
- **Later (CP2):** seed ensemble / test-time augmentation for extraction, APLS graph metric, Sentinel-1 radar for monsoon dates, KPI-4/5 across districts.
- **First results (zones A, B; 2026-10-22):** our alerts are *less* precise than pixel difference with 30 m tolerance (verifiable precision A 0.28 vs 0.42, B 0.26 vs 0.37); about half our alerts lie on roads OSM already had in 2022. Likely cause: the v1 model was trained on 2025–26 imagery and under-extracts old roads in 2022 composites, so they look new. The stability rule does help (without it precision drops 0.28 → 0.20 in A).
- **Rejected:** hysteresis baseline (2022 roads at p ≥ 0.3, fixed a priori) made zone A worse (195 alerts, precision 0.14): the low threshold changes skeleton shapes and splits candidates. Not adopted. Further fixes are tested **outside** the holdout zones (statewide AP vs OSM history) so the zones stay an honest test; the root-cause fix is multi-year training.

## ADR-026 — Data updates: seasonal ingestion, registered tiles, stable alert ids
- **Status:** Accepted (2026-10-22; user: "see if the project is online and collecting real-time data and updating the alerts in the map UI and registering the new data")
- **Finding:** the live site is online but serves a fixed bundle (alerts generated 2026-10-16). Nothing ingests new imagery.
- **Decision:** "live" = seasonal. A season can be built once its window closes (pre-monsoon → 1 June, post-monsoon → 1 January); single cloudy passes would only add false alerts. `scripts/update_season.py` finds finished seasons not yet built and runs s2-build (every tile logged in the registry) → infer → detect → bundle. Publishing (release upload, redeploy) stays a separate, approved step (`docs/guides/data_updates.md`); a GitHub Actions schedule is switched on only with the owner's OK because it publishes.
- **Stable ids (see below):** `detect` used to number alerts by score, so a new season would have renumbered everything and moved reviews to the wrong road. `src/roadwatch/change/ids.py` keeps the id of an overlapping previous alert (≥ 50 % within 25 m), gives new roads the next number, never reuses ids (4 tests).

## ADR-025 — All-India Tier-1 road map: streamed, in two halves, gap-checked
- **Status:** In progress (2026-10-22; user: "run below half of India in training, after it completed perfectly train the other half, then check the total India map without any gaps and inaccurate data")
- **Size:** official India boundary (DataMeet `india-composite`, follows the Survey of India boundary; CC BY 2.5 IN) = 3,270,564 km². Split at the **area-median latitude 23.6° N**: south **64,982** tiles, north **63,542** tiles per date (10 m, 512 px; UTM 42–47 N) — 19× Andhra Pradesh.
- **Why streamed:** the AP builds store composites (~6 GB per date); India would need ~120 GB per date, over Kaggle's 20 GB output limit. `kaggle/india/run.py` builds each 5×5-tile block's composites in memory, runs the model, keeps only road lines (GeoParquet) and one status row per tile.
- **No gaps by design:** a tile failing the cloud gate in 2026 pre-monsoon falls back to 2025, then 2024 pre-monsoon; a tile failing all three is recorded as `cloudy_all` (or `no_imagery`), a block that crashes as `error` — never silently missing. A map run resumes from earlier outputs (attached as `kernel_sources`), skipping finished blocks, so error/timeout blocks are re-run until none remain.
- **Inaccurate data flagged, not hidden:** every mapped tile is scored against OSM (pixel tp/fp/fn vs the rasterised OSM roads, the same rule as the training labels); the India check flags tiles with low agreement for review.
- **Training per half:** `sample` mode builds composites + OSM labels for ~1 in 13 blocks (hash-spread, ~5,000 tiles per half) with the same frozen holdout rule as AP (EPSG:7755 block hash; AP zones stay holdout). Order: south sample → train → south map → north sample → train on south+north → north map → India check.
- **Repo-free runs:** India logic lives in the Kaggle script (uploaded directly); the package is the pinned GitHub commit, so no push is needed to run.
- **Known limits:** OSM coverage varies by state, so OSM agreement is a consistency check, not ground truth; 10 m pixels miss narrow lanes everywhere.

## ADR-027 — Multi-year training with dated labels (root cause of the false alerts)
- **Status:** In progress (2026-10-22)
- **Problem (ADR-024):** ~37 % of alerts lie on roads OSM already had in 2022. The v1/v2 models learn from 2025–26 imagery with the current OSM snapshot, so they extract old roads less well in 2022 composites, and those roads then look "new".
- **Decision:** train on 2022 *and* 2026 pre-monsoon composites of all AP (`s2_model v3_multiyear_s0`). Each year gets its own labels: for 2022 imagery, an OSM way created after 2022-03-01 (version 1, later timestamp) is **uncertain** — a new road or an old road mapped late — and is written as **ignore (128)**, neither road nor background (`kaggle/labels_dated`, GDAL `osmconf.ini` with `osm_version`/`osm_timestamp` on). The trainer's loss and metrics skip ignored pixels (identical to before when there are none) and use `labels_<year>/` for that year's composites.
- **Test:** the design is fixed before seeing results; v3 is judged on the same holdout as v1 (paired) and by re-running the KPI-2/3 evaluation with its road maps. Promoted only if extraction is not worse on any holdout split **and** the known-false alert rate drops.
- **Checked:** the Geofabrik extract carries way version + timestamp (zone A: 17 % of ways, 12 % of length created after 2022-03); a 30-tile local run writes 0 / 128 / 255 labels.

## ADR-028 — APLS measured; gap closing tested and left off
- **Status:** Accepted (2026-10-22)
- **APLS (charter KPI-1 graph metric)** reimplemented from the published definition (`src/roadwatch/qa/apls.py`; CosmiQ's PyPI package pins GDAL 2.4 and no longer installs). Zones A–C vs OSM, model v1, 2026 pre-monsoon (`reports/apls_zones.md`): APLS **0.004 / 0.040 / 0.004** (all roads), 0.008 / 0.053 / 0.024 (major roads). Direction matters: *ours → OSM* 0.51–0.63 (routes on our map exist for real) but *OSM → ours* ≈ 0.002–0.035: most real roads are not on our map at all (pixel recall ≈ 0.4, so a random pair of real road points is rarely both detected), and the map is fragmented (zone A: 937 km in 871 pieces, largest 48 km).
- **Gap closing** (`graph.extract.close_gaps`: dangling ends joined to the nearest road within 30 m = 3 px, direction within 45°, parameters fixed a priori; 4 tests) changed *ours → OSM* by +0.04 / +0.03 / −0.01 and *OSM → ours* not at all. Not a clear gain → **kept as an option, off by default**.
- **Also found:** the website's Method box claimed "join gaps"; no such step existed. To fix in the project check (step 6).
- **Consequence:** the lever for connectivity is recall (better model: SSL4EO pretraining, multi-year and all-India data), not post-processing.
