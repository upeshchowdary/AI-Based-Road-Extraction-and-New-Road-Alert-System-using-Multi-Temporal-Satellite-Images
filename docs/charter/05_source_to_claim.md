# 05 — Source-to-claim map

Every claim the reports, slides or website make, the source behind it, and its verification status.
✅ verified (evidence in this repo or the cited source checked) · 🟡 cited, re-check before the final report
· ❌ claim not yet supported — do not state it. Version 1.0 (2026-10-18).

## Problem and context

| Claim | Source | Status |
|---|---|---|
| The problem is SIH1564 "Automatic Road Extraction and Alert Generation for New Roads", issued by NTRO | Smart India Hackathon problem statement SIH1564; KL catalogue record CLIMATE-06 | ✅ |
| KL charter requires O1–O5, AC-1…AC-4, KPI-1…KPI-6, NT-1…NT-5 and deliverables D1–D7 | KL Capstone Framework, CLIMATE-06 (B.Tech, AI Systems for Visual Intelligence) | ✅ |
| New roads matter for planning, logistics and monitoring; manual map updates are slow | Problem statement (SIH1564 / CLIMATE-06) | ✅ (as stated by the issuer) |

## Data

| Claim | Source | Status |
|---|---|---|
| Sentinel-2 L2A gives 10 m bands B02, B03, B04, B08; scene classification (SCL) used for cloud masking | ESA Sentinel-2 user handbook; `src/roadwatch/data/sentinel2.py` | ✅ |
| Processing baseline ≥ 04.00 adds a −1000 DN offset that must be removed | ESA processing-baseline notes; ADR-014 | ✅ |
| Andhra Pradesh = 160,092 km² on our boundary, 6,790 tiles of 512 px at 10 m | `roadwatch info --config configs/statewide.yaml` (official state area is ~162,970 km²; difference = boundary file) | ✅ |
| 630 zone composites (3 zones × 9 seasons) + 1,122 pilot composites | `evidence/tile_registry.parquet`, `/api/health` | ✅ |
| OSM data is ODbL; Copernicus data free with attribution; EOX S2 cloudless CC BY-NC-SA; Esri imagery visual-only | `LICENSES_DATA.md` | ✅ |
| DeepGlobe roads: 4,972 / 614 / 640 train / val / test images in our frozen split | Training log (`baseline_a_full_s0`), ADR-012 | ✅ |

## Method and models

| Claim | Source | Status |
|---|---|---|
| Spatial holdout: 95 of 489 blocks of 20.48 km, 1 km buffer, sha256 8a9150a57d46 | `evidence/holdout/`, `roadwatch holdout check` (CI) | ✅ |
| Reference B uses DINOv3 ViT-L/16 pretrained on satellite imagery (SAT-493M), frozen | Hugging Face `facebook/dinov3-vitl16-pretrain-sat493m`; ADR-016 | ✅ |
| D-LinkNet-style models reach ~0.60–0.65 IoU on DeepGlobe (used to say Baseline A is below published results) | Zhou et al., "D-LinkNet", CVPR Workshops 2018 (DeepGlobe challenge winner, IoU ≈ 0.646) | 🟡 note the split differs from ours |
| Change detection uses a 2022 baseline, persistence ≥ 3 later dates, stability ≥ 0.75, abstain on unreliable tiles | `src/roadwatch/change/detect.py`, ADR-020 | ✅ |

## Results (all regenerated from run outputs)

| Claim | Source | Status |
|---|---|---|
| Baseline A test IoU 0.501 / 0.491 / 0.490 → 0.494 ± 0.006 over 3 seeds | `reports/kpi1_cp1.md` (`scripts/kpi_report.py`) | ✅ |
| Reference B (frozen DINOv3-sat) test IoU 0.356 [0.343, 0.368] after 5 epochs, below Baseline A → Baseline A is the O2 reference | `reports/kpi1_cp1.md`, `data_cache/runs/reference_b_full_s0/`, ADR-018 | ✅ |
| Statewide composites: 6,790 tiles per season for 2022 pre/post, 2023–2025 pre (6,316–6,612 pass QA) | Build registries `registry_s*.parquet` of the Kaggle runs, `runs/RUN_LOG.csv` | ✅ |
| Tier-1 S2 model test IoU 0.320 [0.300, 0.338]; zones A/B/C 0.296 / 0.332 / 0.300 | `reports/kpi1_cp1.md` | ✅ |
| Registration error median 0.071 px, P90 0.158 px, 100% ≤ 1 px | `reports/kpi6_registration.md` (`scripts/registration_report.py`) | ✅ |
| 14/14 negative-test cases pass | `reports/negative_tests.md` (`scripts/negative_report.py`) | ✅ |
| 413 new-road alerts in the pilot zones (1,131 raw candidates) | `data_cache/outputs/alerts/alerts.json`, ADR-020 | ✅ |
| 43% of the Vijayawada West Bypass recovered within 40 m | ADR-020 sanity check (one road) | ✅ as a single-road check — **not** a recall KPI |
| Alert precision / false-alert rate | — | ❌ not measured; do not claim |
| "Fewer false alerts than pixel differencing" | — | ❌ baseline not built; do not claim |

## Resources

| Claim | Source | Status |
|---|---|---|
| Kaggle free GPU quota = 30 h/week/account (T4×2), resets Saturday 00:00 UTC | Kaggle Settings → Quotas + `kaggle quota` (2026-10-18); ADR-013 correction | ✅ |
| GPU hours used per run | `runs/RUN_LOG.csv` | ✅ |
| Planetary Computer rate-limits heavy parallel use | Kaggle log of `s2_build_ap_2022` ("You have exceeded a rate limit"); ADR-023 | ✅ |
