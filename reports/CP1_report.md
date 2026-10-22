# CP1 Report — AI-Based Road Extraction and New-Road Alert System using Multi-Temporal Satellite Images

**Project code name:** RoadWatch AP · **Problem:** SIH1564 (NTRO) · **KL charter:** CLIMATE-06 · **KL University capstone, Semester VII**
**Repository:** https://github.com/upeshchowdary/AI-Based-Road-Extraction-and-New-Road-Alert-System-using-Multi-Temporal-Satellite-Images
**Live demo:** https://roadwatch-ap.onrender.com
**Status date:** 2026-10-18 · CP1 review ≈ 2026-10-20

---

## 1. Problem and goal

Detect roads in satellite images of the same area on different dates, turn them into a vector road
network, and alert when a **genuinely new road** appears — with a confidence score, before/after
evidence and few false alerts. Users: NTRO/security analysts, PMGSY/NRIDA rural-road monitoring,
state PWDs, planners. Charter, requirements, architecture, risks and sources: [`docs/charter/`](../docs/charter/).

**Design:** two tiers.
- **Tier 1** — free Sentinel-2 (10 m) for statewide screening of Andhra Pradesh, streamed tile by tile.
- **Tier 2** — high-resolution verification in three 20 × 20 km pilot zones (NTR/Krishna districts).

## 2. Objectives and what was delivered

| Objective | Delivered | Evidence |
|---|---|---|
| O1 Contract + data access | Repo, env, configs (all lean rules as switches), CI, account checks, AOI + 3 zones, **frozen spatial holdout**; charter, requirements, architecture, risk register, source-to-claim map | `configs/`, `evidence/holdout/` (sha256 8a9150a57d46), `docs/charter/01…05` |
| Data pipeline | Sentinel-2 L2A STAC search, windowed COG reads on a deterministic tile grid, SCL cloud mask, BOA-offset fix, seasonal median composites, QA gates (grid/CRS, cloud abstain, registration) | 630 zone composites (3 zones × 9 seasons 2022–2026) + 1,122 pilot composites; `evidence/tile_registry.parquet` |
| Labels | OSM roads → masks on the tile grid; empty tiles reserved (lean rule) | 374 pilot tiles, 79,408 road lines |
| O2 Baseline A | U-Net ResNet34 on DeepGlobe, timing run then 3 full seeds | Test IoU **0.494 ± 0.006** (3 seeds) |
| O2 Reference B | Frozen DINOv3-sat ViT-L + decoder, full run | Test IoU **0.356** [0.343, 0.368] after 5 epochs (5 GPU-h budget) — below Baseline A; Baseline A stays the reference |
| Tier-1 model | U-Net ResNet34, 4 S2 bands, AP pilot | Test IoU 0.320 [0.300, 0.338] (seed 0, in use); seed 2: 0.334 [0.313, 0.353]; seed 1 queued |
| Vertical slice → system | mask → graph → GeoJSON/GPKG/SHP; ONNX CPU inference; FastAPI; web app; Docker deployment | `roadwatch infer`, `roadwatch serve`, `/map`, live site |
| O3 (started early) | **Graph-level change detection v1** with persistence, stability and abstain; alerts with before/after evidence and a review loop | 413 real alerts in the pilot zones (ADR-020, ADR-022) |

## 3. Method

1. **Composite:** per tile and season, median of up to 8 least-cloudy Sentinel-2 scenes; SCL classes
   0, 1, 3, 8, 9, 10 masked; processing-baseline ≥ 04.00 offset (−1000 DN) removed; uint8 storage.
2. **Quality gates (abstain mode):** tiles failing the cloud/no-data or grid gate are marked
   *unreliable* and kept as `reserved` (e.g. 25 zone-B tiles in coastal post-monsoon seasons) — never guessed.
3. **Extract:** U-Net segmentation → threshold → clean → skeleton → junction-cluster graph → spur
   pruning → simplified centre-lines with per-segment confidence → GeoJSON / GeoPackage / Shapefile.
4. **Change (v1, ADR-020):** baseline = roads in both 2022 seasons (25 m buffer); candidates = roads in
   the latest season outside it, ≥ 100 m; seen / absent / abstain per later season; alert only if seen on
   ≥ 3 later seasons and stable (≥ 75% of clear seasons after first sighting). Score = model confidence ×
   persistence × connectivity × data quality. Inputs with mixed or geographic CRS or unordered dates are
   refused (NT-4).

## 4. Evaluation design (fixed before any tuning)

- **AP spatial holdout:** 95 of 489 blocks (20.48 km, EPSG:7755, hash-selected), 1 km buffer — CI
  fails if it changes. The same test set is used by the lean model and every later enhancement.
- **Three zones are evaluation-only** (never trained on).
- **DeepGlobe:** frozen hash split 80/10/10 (no coordinates exist for a spatial split).
- **Metrics:** pixel IoU / F1 / precision / recall, pooled over images, **95% bootstrap CIs over
  images**; every zone reported separately.

## 5. Results — KPI-1 (road extraction)

Full table generated from run outputs: [`reports/kpi1_cp1.md`](kpi1_cp1.md) (also live on the web
app's Results page).

| Model | Data | Test IoU [95% CI] | Test F1 | GPU-h |
|---|---|---|---|---|
| Baseline A — U-Net R34 (seed 0) | DeepGlobe 0.5 m | **0.501** [0.490, 0.513] | 0.668 | 2.46 |
| Baseline A — **3 seeds** (0, 1, 2) | DeepGlobe 0.5 m | **0.494** mean (SD 0.006; 0.490–0.501) | 0.661 | 2.46 + 0.45 + 0.47 |
| Reference B — frozen DINOv3-sat (5 epochs) | DeepGlobe 0.5 m | **0.356** [0.343, 0.368] | 0.525 | 4.20 (+ 0.61 timing) |
| Tier-1 S2 model — U-Net R34 | AP Sentinel-2 10 m | **0.320** [0.300, 0.338] | 0.484 | 0.34 |

Tier-1 per zone: A 0.296 [0.282, 0.312] · B 0.332 [0.319, 0.345] · C 0.300 [0.287, 0.311].

**O2 reference choice (ADR-018, confirmed 2026-10-18):** Reference B was trained on the same split
until its 5 GPU-h budget ran out (5 of 8 epochs, 33–65 min/epoch). Its val IoU rose every epoch but
one (0.144 → 0.219 → 0.275 → 0.259 → 0.342), so it had not converged, yet its test IoU **0.356
[0.343, 0.368]** is far below Baseline A's 0.501 [0.490, 0.513] (non-overlapping CIs) at 1.6× the
training time (3.95 h vs 2.46 h). Recall is its weak side (0.47 vs 0.71). **Baseline A is the O2 reference.** A
fine-tuned foundation model (LoRA) is a CP2 option, not a CP1 claim.

## 6. Results — change detection (O3, first version)

| Item | Value |
|---|---|
| Raw candidates (pilot zones A–C, 9 seasons 2022–2026) | 1,131 |
| Alerts after persistence + stability rules | **413** (A 155 / B 99 / C 159; 101.8 km) |
| Sanity check on a known new road (Vijayawada West Bypass, OSM) | 43% of its length recovered within 40 m |
| Evidence per alert | Sentinel-2 crops for all 9 dates with the road outlined; seen / absent / cloudy per date |
| KPI-2/3 vs OSM history (2022-01 → 2026-06, zones A–C) | precision 0.36 [0.31, 0.43] on verifiable alerts; known-false rate 0.37; recall 0.06 of newly mapped length ([`kpi23_change_eval.md`](kpi23_change_eval.md)) |
| vs pixel difference | better than naive pixel difference (false-alert rate 0.37 vs 0.44, KPI-3 +17 %), **worse than pixel difference with 30 m tolerance** (0.20) |

**Statewide Andhra Pradesh (ADR-023):** composites for all 6,790 tiles are built for 2022 pre/post
and 2023, 2024, 2025 pre-monsoon (6,316–6,612 tiles pass QA per season; the rest abstain, mostly
cloud). The 2026 season built completely too, but its run crashed afterwards in the OSM-labels step
(a missing cache folder), and Kaggle cannot use a crashed run as input — it is being rebuilt. Statewide
screening and alerts follow once it completes.

## 7. Results — KPI-6 and negative tests

- **KPI-6 registration error** ([`reports/kpi6_registration.md`](kpi6_registration.md)): over 522
  measurable tile pairs, median **0.071 px (0.7 m)**, P90 0.158 px, **100% within the 1 px gate**;
  26 open-sea tile pairs in zone B are reported as unmeasurable, not hidden.
- **Negative tests NT-1…NT-5** ([`reports/negative_tests.md`](negative_tests.md)): **14/14 cases pass**
  — occlusion, seasonal tracks, noise, CRS/registration/date mismatch, cloud. Residual risks listed
  (e.g. a seasonal track seen on 3 of 4 dates still alerts).

## 8. Resource profile (AC-4)

| Item | Value |
|---|---|
| Kaggle free GPU quota (measured) | **30 h / week / account** (Kaggle settings + `kaggle quota`, 2026-10-18; an earlier reading of 6 h was wrong, ADR-013), max 2 concurrent GPU sessions |
| GPU hours, finished runs | 8.73 h (timing 0.16 + Baseline A s0 2.46 + s1 0.45 + s2 0.47 + Ref B timing 0.61 + Ref B full 4.20 + S2 timing 0.05 + S2 full 0.34); every run in `runs/RUN_LOG.csv` |
| CPU data builds | Kaggle CPU sessions (no GPU quota): 1,122 pilot composites in 17.5 min; a statewide season (6,790 tiles) in ~76 min with 8 workers |
| Laptop inference | ONNX Runtime CPU, a 20 × 20 km zone in seconds |
| Local footprint | code + env < 3 GB; data cache < 30 GB (ADR-003) |

## 9. Failures and negative findings (reported, not hidden)

- **Baseline A overfits** after epoch 0 (val IoU 0.496 → 0.465) and is below published DeepGlobe
  results (~0.60–0.65, different split). The 3-seed result (0.494 ± 0.006) shows this is stable, not
  seed luck. Seeds 1–2 were planned for teammates A/B but ran on the lead account (2026-10-17).
- **A wrong hypothesis:** "JPEG decode is the bottleneck" — 4 crops per image did not speed training
  (13.5 → 14.6 crops/s); corrected in ADR-013.
- **A wrong measurement:** the Kaggle GPU quota was read as 6 h/week; it is 30 h (ADR-013 correction).
- **Reference B** (frozen foundation model) stayed far below the CNN even with more GPU time
  (test IoU 0.356 vs 0.501) — a frozen backbone is not enough for 0.5 m roads here.
- **Change detection is not yet better than a tolerant pixel-difference baseline** (precision 0.36 vs
  0.48, ADR-024). About 37 % of our alerts lie on roads OSM already had in 2022: the v1 model, trained
  on 2025–26 imagery, under-extracts old roads in 2022 composites, so they look new. A hysteresis
  baseline was tried and made it worse (rejected). Next: multi-year training, tested outside the
  holdout zones.
- **Run failures:** the 2026 statewide build crashed in its labels step (missing folder in a fresh
  clone) after building every composite; S2 seed 1 hung ~10 h on Kaggle with no output and was
  cancelled (not charged to quota). Fixes: the folder is created, and the trainer now has a hard
  watchdog that ends any run at 1.5× its budget + 1 h.
- **Tier-1 recall** is limited by 10 m pixels vs narrow residential streets in the OSM labels.
- **Engineering incidents:** a Kaggle-token screenshot was committed to a public repo by an
  over-broad `git add -A` — history rebuilt without it; rule: commit named files only. A paging bug
  silently truncated Kaggle downloads (554 of 630 files) — fixed. Five parallel statewide builds hit the
  Planetary Computer rate limit — retries and resume added (ADR-023).

## 10. Gate checklists

**Gate 1 — contract & data access:** ✅ repo + CI · ✅ env/disk checks · ✅ accounts (Kaggle, HF + DINOv3,
GitHub) · ✅ AOI + zones · ✅ frozen holdout · ✅ evidence manifest + licences · ✅ charter, requirements,
architecture, risk register, source-to-claim map (`docs/charter/`) · 🔴 KL deployment stakeholder and
team role assignment to be confirmed.

**Gate 2 — CP1 evidence:** ✅ data pipeline with tests (64 tests incl. 14 negative cases) · ✅ Baseline A
(3 seeds) · ✅ Reference B (full run, O2 comparison) · ✅ KPI-1 table with 95% CIs per zone · 🟡 robustness
per condition (terrain, occlusion) not yet separated · ✅ mask → graph → vector exports · ✅ API + web
app + deployment · ✅ resource profile · ✅ failure log · ✅ KPI-6 · ✅ negative tests NT-1…NT-5.

## 11. CP2 plan

O3: pixel-difference baseline and ablations (without persistence / stability / abstain), dated ground
truth from OSM edit history → KPI-2/3 with CIs; statewide Andhra Pradesh results and model v2. O4:
operating guide, recovery runbook, telemetry, Sentinel-1 radar for monsoon dates, attributes and
construction stage, PMGSY audit, alert dispatch. O5: acceptance harness (AC-1…AC-4), KPI-4/5,
independent review, final report, paper, poster, video. Enhancement packs (Section 14).

## 12. How to run

Live: **https://roadwatch-ap.onrender.com** (Render free plan, `docs/guides/deploy_render.md`).
Local: `uv run roadwatch serve` → http://127.0.0.1:8000 (see `docs/guides/run_dashboard_locally.md`).
Reproduce: KPI-1 `uv run python scripts/kpi_report.py` · KPI-6 `uv run python scripts/registration_report.py` ·
negative tests `uv run python scripts/negative_report.py`.
