# CP1 Report — AI-Based Road Extraction and New-Road Alert System using Multi-Temporal Satellite Images

**Project code name:** RoadWatch AP · **Problem:** SIH1564 (NTRO) · **KL University capstone, Semester VII**
**Repository:** https://github.com/upeshchowdary/AI-Based-Road-Extraction-and-New-Road-Alert-System-using-Multi-Temporal-Satellite-Images
**Status date:** 2026-10-16 · CP1 review ≈ 2026-10-20

---

## 1. Problem and goal

Detect roads in satellite images of the same area on different dates, turn them into a vector road
network, and alert when a **genuinely new road** appears — with a confidence score, before/after
evidence and few false alerts. Users: NTRO/security analysts, PMGSY/NRIDA rural-road monitoring,
state PWDs, planners.

**Design:** two tiers.
- **Tier 1** — free Sentinel-2 (10 m) for statewide screening of Andhra Pradesh, streamed tile by tile.
- **Tier 2** — high-resolution verification in three 20 × 20 km pilot zones (NTR/Krishna districts).

## 2. CP1 objectives (O1–O2) and what was delivered

| Objective | Delivered | Evidence |
|---|---|---|
| O1 Contract + data access | Repo, env, configs (all lean rules as switches), CI, account checks, AOI + 3 zones, **frozen spatial holdout** | `configs/`, `evidence/holdout/` (sha256 8a9150a57d46), CI green |
| Data pipeline | Sentinel-2 L2A STAC search, windowed COG reads on a deterministic tile grid, SCL cloud mask, BOA-offset fix, seasonal median composites, QA (CRS/grid, cloud abstain, registration) | 630 zone composites (3 zones × 9 seasons 2022–2026) + 1,122 pilot composites; registry `evidence/tile_registry.parquet` |
| Labels | OSM roads → masks on the tile grid; empty tiles reserved (lean rule) | 374 tiles, 79,408 road lines |
| O2 Baseline A | U-Net ResNet34 on DeepGlobe, timing run then full run | Test IoU 0.501 [0.490, 0.513] |
| O2 Reference B | Frozen DINOv3-sat ViT-L + decoder, timing run | val IoU 0.165 after 1 epoch (on hold) |
| Tier-1 model | U-Net ResNet34, 4 S2 bands, AP pilot | Test IoU 0.320 [0.300, 0.338] |
| Vertical slice | mask → graph → GeoJSON/GPKG/SHP; ONNX CPU inference; FastAPI backend; web map + app | `roadwatch infer`, `roadwatch serve`, `/explore` |

## 3. Method

1. **Composite:** per tile and season, median of up to 8 least-cloudy Sentinel-2 scenes; SCL classes
   0, 1, 3, 8, 9, 10 masked; processing-baseline ≥ 04.00 offset (−1000 DN) removed; uint8 storage.
2. **Quality gates (abstain mode):** tiles failing the cloud/no-data gate are marked *unreliable* and
   kept as `reserved: cloudy` (25 zone-B tiles in coastal post-monsoon seasons) — never guessed.
3. **Extract:** U-Net segmentation → threshold → clean → skeleton → junction-cluster graph → spur
   pruning → simplified centre-lines with per-segment confidence → GeoJSON / GeoPackage / Shapefile.
4. **Change (CP2):** match graphs across co-registered dates; persistence ≥ 2 dates; connectivity,
   minimum length; SAR for monsoon dates.

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
| Baseline A — U-Net R34 | DeepGlobe 0.5 m | **0.501** [0.490, 0.513] | 0.668 | 2.46 |
| Reference B — frozen DINOv3-sat | DeepGlobe 0.5 m | 0.165 (val, after 1 epoch) | 0.283 | 0.61 (timing) |
| Tier-1 S2 model — U-Net R34 | AP Sentinel-2 10 m | **0.320** [0.300, 0.338] | 0.484 | 0.34 |

Tier-1 per zone: A 0.296 [0.282, 0.312] · B 0.332 [0.319, 0.345] · C 0.300 [0.287, 0.311].

**O2 reference choice (documented trade-off, ADR-018):** at equal GPU cost the frozen DINOv3 head
was far behind the CNN after one epoch and costs 35 min/epoch, so **Baseline A is the CP1
reference**; DINOv3 is revisited in CP2 with LoRA fine-tuning (Enhancement Pack D).

## 6. Resource profile (AC-4)

| Item | Value |
|---|---|
| Kaggle free GPU quota (measured) | **6 h / week / account**, max 2 concurrent GPU sessions |
| GPU hours used in CP1 | 3.61 h (timing 0.16 + Baseline A 2.46 + Ref B timing 0.61 + S2 timing 0.05 + S2 full 0.34) |
| CPU data builds | Kaggle CPU sessions (no GPU quota): 1,122 pilot composites in 17.5 min |
| Laptop inference | ONNX Runtime CPU, a 20 × 20 km zone in seconds |
| Local footprint | code + env < 3 GB; data cache < 30 GB (ADR-003) |

## 7. Failures and negative findings (reported, not hidden)

- **Baseline A overfits** after epoch 0 (val IoU 0.496 → 0.465) and is below published DeepGlobe
  results (~0.60–0.65). Seeds 1–2 (teammates) pending for the 3-seed result.
- **A wrong hypothesis:** "JPEG decode is the bottleneck" — 4 crops per image did not speed training
  (13.5 → 14.6 crops/s); corrected in ADR-013.
- **Reference B** not competitive at equal cost after one epoch.
- **Tier-1 recall** is limited by 10 m pixels vs narrow residential streets in the OSM labels.
- **Engineering incidents:** a Kaggle-token screenshot was committed to a public repo by an
  over-broad `git add -A` — history rebuilt without it in the new repo; rule: commit named files only.
  A paging bug silently truncated Kaggle downloads (554 of 630 files) — fixed and verified.

## 8. Gate checklists

**Gate 1 — contract & data access:** ✅ repo + CI · ✅ env/disk checks · ✅ accounts (Kaggle, HF + DINOv3,
GitHub) · ✅ AOI + zones · ✅ frozen holdout · ✅ evidence manifest + licences · ⏳ teammate accounts
(seeds 1–2 run cards issued).

**Gate 2 — CP1 evidence:** ✅ data pipeline with unit tests (38 tests) · ✅ Baseline A + Reference B
(timing) · ✅ KPI-1 table with 95% CIs per condition · ✅ mask → graph → vector exports · ✅ minimal
API + map page (now a full web app) · ✅ resource profile · ✅ failure log · ⏳ 3 seeds ·
⏳ negative tests NT-1..5 automated (CP2).

## 9. Scope cuts and CP2 plan

Deferred to CP2 (ADR-006): SAM-Road, Sentinel-1 fusion, graph-level change detection with
persistence (O3), alert scoring, priority zones, PMGSY audit, LLM features, Telegram/email, statewide
AP run, negative tests NT-1..5, enhancement packs. Alerts in the app are **demo data** until O3 exists
and say so on every screen.

## 10. How to run

`uv run roadwatch serve` → http://127.0.0.1:8000 (see `docs/guides/run_dashboard_locally.md`).
Reproduce KPI-1: `uv run python scripts/kpi_report.py`.
