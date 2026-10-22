# Plan — accurate road-change detection, clear evidence, precise masks

Written 2026-10-22 after the owner's review: *"it is not showing the new roads, it shows random things;
the before/after images are so blurry you can't see anything; extract only road changes, mark them
precisely, make the before/after clear, catch even small roads built in the last 2–3 years."*

This plan is meant to be executed in order. Every phase ends with a **gate**: a measured check that
must pass before the next phase starts. Nothing is claimed that is not measured (source-to-claim map).

---

## 0. What is wrong today (checked in the running app, 2026-10-22)

| # | What the owner sees | Example (local app) | Root cause | Measured |
|---|---|---|---|---|
| P1 | "New road" that was already there | **RW-C001**: 0.77 km road; the before image (Nov 2022) clearly shows the same wide road | The 2022 road map *missed* the road (bright new concrete looks unlike the roads the model learned), so in 2026 (darker asphalt) it looks "new". Also: resurfacing/widening is treated as a new road | 37 % of alerts lie on roads OSM already had in 2022 (`reports/kpi23_change_eval.md`) |
| P2 | Random lines inside villages / buildings | **RW-A010**: 100 m "road" in a dense village; nothing visible | 10 m pixels cannot resolve village lanes; the model's per-date noise inside built-up areas survives the persistence rule; no building check | 42 % of alerts unverifiable against OSM |
| P3 | Blurry before/after | every alert | Evidence chips are 10 m Sentinel-2 pixels (a 100 m road = 10 pixels) stretched to ~400 px | — |
| P4 | Before/after look totally different | RW-C001, RW-A010 | "Before" = **Nov 2022 (post-monsoon, green)**, "after" = **Apr 2026 (pre-monsoon, brown)**: season change, not road change | — |
| P5 | Many real new roads not shown | zone C: 615 km newly mapped in OSM 2022→2026 | Recall of the 10 m model ≈ 0.4 of road pixels; the map is fragmented (zone A: 937 km in 871 pieces); narrow roads are invisible at 10 m | change recall 0.06 of newly-mapped length; APLS 0.004 |
| P6 | Only a centre-line, no shape | all alerts | Output is a line, not the footprint of the new road | — |

**The hard truth to plan around:** Sentinel-2 is 10 m per pixel. A 4 m village road is 0.4 pixel wide.
No amount of training makes Sentinel-2 *see* it reliably or show it sharply. "Even small roads,
precisely masked, clear before/after" needs **sharper imagery**. The plan therefore changes the
imagery first, then the model, then the alert logic, then the display — and keeps Sentinel-2 for what
it does well (free, statewide/India screening every 5 days).

---

## 1. Decisions needed from the owner before execution (🔴)

| # | Decision | Recommendation | Why |
|---|---|---|---|
| D1 | Sharper imagery source for *detection* in AP | **Planet NICFI basemaps (4.77 m, monthly/biannual, B-G-R-NIR)** — free for non-commercial use; owner signs up for access (Planet / NICFI program). Verify the program is still live and covers AP (Google's catalog lists the Asia collection; dates in the catalog disagree, so check on sign-up) | 2× sharper than Sentinel-2 and monthly → 5–6 m roads become visible, dates become months not seasons |
| D2 | Sharp imagery for *before/after evidence and ground-truth labelling* | **Esri World Imagery Wayback** (sub-metre, archived releases since 2014, free tiles; release date ≠ capture date). Read Esri's terms first: use for display and human labelling only, never as model training input | Fixes "blurry" completely for the person reviewing an alert |
| D3 | Building data to stop building changes becoming "roads" | **Google Open Buildings v3** (polygons) + **Open Buildings 2.5D Temporal** (yearly building presence 2016–2023, ~4 m), CC-BY 4.0 / ODbL | Rejects candidates that are new buildings, not roads |
| D4 | Ground truth (who labels) | Teammates A–D label new roads on Wayback before/after in ~150 cells of 2×2 km (≈ 20 h of work in total, see Phase 2) | Without a gold set nobody can say the alerts are accurate |
| D5 | ISRO Cartosat (Bhoonidhi) for zones | Optional, internal only, never published (LICENSES_DATA rule) | Sub-metre, official; slower to obtain |
| D6 | What "small road" means for the acceptance test | Recall reported per width class: ≥ 10 m, 6–10 m, < 6 m. Targets apply to ≥ 6 m with NICFI; < 6 m is best-effort and stated as such | Honest, testable |

---

## 2. Phases

### Phase 1 — Stop showing wrong things (1 day, no GPU)  ✅ gate: owner reviews 20 random alerts

1. **Same-season comparisons only.** `AlertDetail` / evidence endpoint: "before" = clearest *pre-monsoon* date before `first_seen` (default 2022 pre-monsoon), "after" = latest pre-monsoon. Post-monsoon images only in the full timeline. (`src/roadwatch/api/app.py` evidence, `web/src/features/alerts/AlertDetail.tsx`)
2. **No-blur rendering of Sentinel-2 chips:** nearest-neighbour scaling (`image-rendering: pixelated`), a wider context window (≥ 1.5 km), per-chip contrast stretch from the same scene statistics for before and after (so colour changes are real), scale bar.
3. **Label the current 413 alerts honestly** in the UI: "Screening candidates (Sentinel-2, 10 m) — about 1 in 3 lies on a road that already existed (measured)". Default sort: score; hide alerts < 300 m inside built-up areas (Open Buildings density > threshold) from the default view (still listed under "needs review").
4. **Wayback before/after tab** on every alert: pick the Wayback release closest *before* `first_seen` and the latest release; show both at sub-metre with the alert outline. Clearly labelled "visual reference (Esri), release date ≠ capture date". (`web/src/lib/wayback.ts`, release list from the Wayback config JSON)
5. Gate: owner opens 20 random alerts and can judge each one by eye in < 30 s.

### Phase 2 — Gold-standard change labels (1 week, people + no GPU)  ✅ gate: inter-annotator agreement

1. **Sampling:** 150 cells of 2 × 2 km in AP, stratified by land cover (urban core, peri-urban layouts, rural fields, coast/delta, hills) and by OSM change activity; 30 cells inside zones A–C (frozen test), the rest assigned by the existing holdout hash (EPSG:7755 blocks) → train / val / test. `scripts/sample_label_cells.py` → `data_cache/labels_gold/cells.geojson`.
2. **Labelling tool:** a page in the app (`/label`) or QGIS project: Wayback "before" (≈ early 2022) and "after" (latest) side by side + Sentinel-2 timeline; annotator draws every **road footprint that is new** (polygon, not line), tags type: *new road / widening / resurfacing only / under construction / track*, width class, and "first visible" year.
3. **Double-label 20 %** of cells (two teammates) → agreement (footprint IoU and per-road match); disagreements reviewed.
4. Store as `data_cache/labels_gold/new_roads.gpkg` + manifest with annotator, date, imagery release (evidence/manifest.csv). Licence note: derived from visual interpretation; check Esri terms (D2).
5. Gate: agreement ≥ 0.7 on matched roads; otherwise refine the labelling guide (`docs/guides/labelling_new_roads.md`) and relabel.

### Phase 3 — Better imagery in the pipeline (1–2 weeks, CPU)  ✅ gate: NICFI tiles registered for all AP months needed

1. `roadwatch/data/nicfi.py`: fetch NICFI monthly / biannual quads for AP (Planet Basemaps API with the owner's key in `.env`), crop to our tile grid (same tile ids, 4.77 m → resample to a 5 m grid with 1024 px tiles = same 5.12 km footprint), registry rows `sensor="nicfi"`, QA (cloud/haze flags), KPI-6 registration check against Sentinel-2.
2. Sentinel-2 composites gain **SWIR (B11, B12) and red-edge (B05)** at 20 m (resampled to 10 m): asphalt/concrete vs bare soil vs buildings separate much better in SWIR. Rebuild the 6 statewide seasons on Kaggle CPU (no GPU quota).
3. **Monthly Sentinel-2 composites** for the dry months (Dec–May) of 2023–2026 in zones and gold cells, so "first seen" becomes a month and construction can be followed.
4. Gate: NICFI + S2 stacks exist for every gold cell and zone, registered within 0.5 px.

### Phase 4 — Road extraction that sees old and new roads alike (1 week, ~8 GPU-h)  ✅ gate: paired test

Ready already (ADR-027 / TorchGeo): dated labels with ignore pixels, multi-year training, SSL4EO pretraining.
1. Train on **2022 + 2026** imagery with dated labels (`s2_model v3_multiyear_s0`) — fixes P1 at the source (the 2022 map must contain the roads that existed).
2. A/B **SSL4EO-S12 vs ImageNet** encoder (same data, chosen on validation).
3. **NICFI road model** (U-Net, 4 bands at 5 m) trained on OSM + dated labels for AP; predicts narrow roads S2 cannot.
4. **Hard negatives:** rejected alerts + known-false alerts (KPI-2/3 run) + building footprints added as negatives.
5. Gate: on the frozen holdout (paired, same images) v3 ≥ v1 on every split, and in the zones the 2022 road map recovers ≥ 90 % of roads OSM had mapped before 2022 (measured with `qa/change_eval` layers).

### Phase 5 — A real change detector, roads only (2 weeks, ~12 GPU-h)  ✅ gate: gold-set precision/recall

1. **Bi-temporal change model** (`kaggle/change_model/train.py`): Siamese U-Net (shared SSL4EO encoder) on (before, after) of the **same season**, output = *new-road footprint mask* directly (not two road maps differenced). Inputs: S2 (10 m, 7 bands incl. SWIR) and, where available, NICFI (5 m). Training labels: gold polygons (train cells) + weak labels = OSM roads created after the before-date that are absent from the before-image road map and present in ≥ 3 later dates; uncertain pixels = ignore.
2. **Candidate verification classifier** (second stage): for each candidate, a small CNN on the multi-date chip stack + simple features (length, width, straightness, connection to the network, building overlap from Open Buildings temporal, NDVI/SWIR change) → *new road / widening / resurfacing / building / field edge / noise*. Trained on gold labels + reviewed alerts.
3. **Rules that stay:** persistence (seen on ≥ 3 later dates), stability, abstain on cloud — now on monthly dates.
4. **Separate alert types:** *New road* (default view) vs *Widening / resurfacing* (separate filter) vs *Under construction* (cleared but not yet paved).
5. **Masks:** every alert carries the predicted footprint polygon (and centre-line); width estimated from the mask.
6. Gate (gold test cells + zones, bootstrap CIs, decided before training):
   - precision of default-view alerts **≥ 0.80**;
   - recall by length for new roads **≥ 10 m wide ≥ 0.80**, **6–10 m ≥ 0.60** (with NICFI), < 6 m reported, no target;
   - known-false rate vs OSM-2022 ≤ 0.10;
   - footprint mask IoU on matched roads ≥ 0.5;
   - first-seen date within ± 1 month (NICFI) / ± 1 season (S2) for ≥ 80 % of matched roads;
   - KPI-3: ≥ 5 % fewer false alerts than **pixel difference with tolerance** (the strong baseline), not just naive.
   If the gate fails: no promotion; report, diagnose per stratum, iterate Phase 4/5.

### Phase 6 — Display that a person can trust (3 days, no GPU)  ✅ gate: owner review

1. Alert page: **Wayback before / after** (sharp) as the first view, **NICFI monthly strip** (when did it appear), **Sentinel-2 measured evidence** (pixelated, honest), the **footprint mask** outlined on every image, type badge, width, first-seen month, verification classifier reason ("not a building: no building in Open Buildings 2023").
2. Map: alerts drawn as **footprint polygons** at zoom ≥ 14, filters (type, year first seen, confidence, length), the gold-label overlay for the team.
3. Remove anything not backed by data (e.g. empty "Width —" fields get real values from the mask).
4. Gate: owner opens 30 random default-view alerts and agrees with ≥ 24 (matches the 0.80 precision target, sanity check of the metric).

### Phase 7 — Scale out (after the gates pass)

1. Statewide AP with the new models (Kaggle CPU shards, ADR-023 pipeline + NICFI where licensed).
2. All-India (ADR-025 streaming pipeline) with the improved Sentinel-2 model; NICFI only where the licence and coverage allow; report per state.
3. Seasonal / monthly updates (ADR-026 updater) with stable alert ids.

---

## 3. What is already done and reusable

| Piece | Where |
|---|---|
| Dated labels with ignore pixels, multi-year training, SSL4EO weights | `kaggle/labels_dated`, `kaggle/baseline_a/train.py` (ADR-027) |
| KPI-2/3 evaluation vs OSM history, baselines, ablations | `src/roadwatch/qa/change_eval.py`, `scripts/change_eval_report.py` (ADR-024) |
| APLS, gap closing | `src/roadwatch/qa/apls.py`, `graph.extract.close_gaps` (ADR-028) |
| Stable alert ids, season updater | `src/roadwatch/change/ids.py`, `scripts/update_season.py` (ADR-026) |
| All-India streaming map + per-tile OSM check | `kaggle/india`, `scripts/india_check.py` (ADR-025) |
| Review loop (accept / reject → labels) | `/api/reviews`, `reviews.jsonl` (ADR-022) |

## 4. Compute and time budget

| Phase | GPU (Kaggle T4×2) | CPU (Kaggle) | People | Calendar |
|---|---|---|---|---|
| 1 | 0 | 0 | lead | 1 day |
| 2 | 0 | 0 | A–D ≈ 20 h total | 1 week |
| 3 | 0 | ~30 session-h | lead | 1–2 weeks (parallel with 2) |
| 4 | ~8 h | — | lead | 1 week |
| 5 | ~12 h | ~10 session-h | lead + 1 | 2 weeks |
| 6 | 0 | 0 | lead + 1 | 3 days |
| **Total** | **~20 GPU-h** (fits one 30 h week) | | | **≈ 5–6 weeks** |

## 5. Risks

| Risk | Mitigation |
|---|---|
| NICFI access denied / ended / AP not covered | Fall back: Sentinel-2 + SWIR + monthly composites; targets for 6–10 m roads become best-effort; say so |
| Esri terms forbid labelling use | Use Wayback for display only; label on NICFI / Cartosat (D5) instead |
| Gold labelling takes longer | Start with zones A–C + 50 cells; grow later |
| Change model overfits to zones | Zones are test only; train/val/test by block hash; report per stratum |
| Laptop limits (16 GB, flaky process start) | Heavy work on Kaggle; local = API + UI only; base-Python workaround (memory note) |
| Over-claiming | Every number through the source-to-claim map; gates decided before training |

## 6. Order of execution (copy this checklist)

- [ ] D1–D6 decided (owner)
- [ ] Phase 1: same-season pair, pixelated chips, honest labels, Wayback tab → owner gate
- [ ] Phase 2: sample cells, labelling guide + tool, label, agreement → gate
- [ ] Phase 3: NICFI ingest, S2 + SWIR/red-edge rebuild, monthly composites → gate
- [ ] Phase 4: v3 multi-year (dated labels) + SSL4EO A/B + NICFI road model + hard negatives → paired gate
- [ ] Phase 5: change model + verification classifier + types + masks → gold gate
- [ ] Phase 6: evidence UI + map polygons → owner gate
- [ ] Phase 7: statewide → India → updates
- [ ] Reports, CP2 deck, source-to-claim updated at every gate

Sources checked for this plan: Planet NICFI on the Google Earth Engine catalog
(https://developers.google.com/earth-engine/datasets/catalog/projects_planet-nicfi_assets_basemaps_asia),
ArcGIS World Imagery Wayback (https://www.esri.com/arcgis-blog/products/arcgis-living-atlas/mapping/use-world-imagery-wayback),
Google Open Buildings 2.5D Temporal (https://developers.google.com/earth-engine/datasets/catalog/GOOGLE_Research_open-buildings-temporal_v1).
