# PROGRESS — RoadWatch AP

> Living log. Read this and `DECISIONS.md` at the start of every session.
> Newest status block on top.

## Current status (2026-10-16)

- **Phase:** CP1 review pack ready (ADR-006). **CP1 review ≈ Tue 2026-10-20.**
- **Run it:** `uv run roadwatch serve` → http://127.0.0.1:8000 (UI + API in one process). Dev: `uv run roadwatch serve --reload` + `npx vite` in `web/` (→ http://localhost:5173, proxies `/api`).
- **Review pack:** `reports/CP1_report.md`, `reports/kpi1_cp1.md` (regenerate: `uv run python scripts/kpi_report.py`), `reports/CP1_slides_outline.md`, `docs/guides/cp1_demo_script.md`.
- **Models:** Baseline A s0 test IoU 0.501 [0.490, 0.513] · Ref B timing only (on hold) · **Tier-1 S2 model v1 test IoU 0.320 [0.300, 0.338]** (ADR-019), running locally via ONNX on zones A–C (2022 + 2026 pre-monsoon) and shown on the map.
- **Web:** map = Satellite (Esri) / Streets (OpenFreeMap) / S2 2024 (EOX) / Our seasons; globe; search; UI wired to FastAPI; marketing/unbuilt pages removed. Results page reads `/api/kpis` live.
- **GPU used:** 3.61 h total. Lead account quota resets Sat 2026-10-17.
- **Pending (team):** Baseline A seeds 1–2 on teammates A/B (run cards in `runs/cards/`).
- **Git:** canonical repo https://github.com/upeshchowdary/AI-Based-Road-Extraction-and-New-Road-Alert-System-using-Multi-Temporal-Satellite-Images (clean history, ADR-017). Commit named files only (`.kilo/`, `archive-wHzHQ5/` are not ours).
- **Laptop RAM:** 16 GB is the hard limit — keep one heavy Claude session at a time.

### ML status (2026-10-14)
| Item | Result |
|---|---|
| Baseline A (U-Net R34, DeepGlobe) seed 0 | TEST IoU **0.501 [0.490, 0.513]**, F1 **0.668 [0.658, 0.678]**, n = 640, 2.45 GPU-h. Overfits after epoch 0 (ADR-018). |
| Reference B (frozen DINOv3-sat ViT-L) timing | val IoU 0.165 after 1 epoch; 35 min/epoch → decision pending (ADR-018) |
| S2 composites | zones 630 (9 seasons) + pilot 1,122 (3 recent seasons), all on Kaggle outputs |
| Kaggle limits found | 6 GPU-h/week/account; max 2 concurrent GPU sessions; outputs paged (fixed in `--fetch`) |
| KPI tooling | `qa/metrics.py` bootstrap 95% CIs over images (3 tests) |

### UI session — what was built (Phase UI-1 complete + most of UI-2/3)

| Route | What's there |
|---|---|
| `/` | 3D globe with real-time day/night terminator; scroll-pinned orbit → India → AP → road scene (5 stages); real Sentinel-2 images of Vijayawada 2022 & 2024; new West Bypass (NH16) in amber; 8 below-fold sections (Problem, How it works, Why not just compare, Capabilities bento, Time-lapse, Who it's for, Results, Open data) |
| `/explore` | Full-screen MapLibre + deck.gl; 9 seasons 2022–2026; OSM roads; before/after scan-line slider; 25 unreliable tiles (hatched); alert detail panel; 5-step guided tour |
| `/app` | All 12 screens: Command Center, Alerts (J/K/A/R/F keyboard review), Alert detail, Change Explorer, Road Network, PMGSY Audit, Zones, Ask, Reports, System, Settings, Sign-in. Ctrl+K command palette. All screens have loading / empty / error / offline states. |
| `/platform` | Deep architecture page with animated data-flow diagram |
| `/capabilities` | Feature deep-dives with sticky index |
| `/solutions/:slug` | 3-solution template (security / rural-road-audit / planning) |
| `/about` `/docs` `/contact` `/attributions` `/privacy` | All built |
| `/stories` `/stories/:slug` | Scrollytelling map stories |
| `/research` | Method, KPIs, model cards, ablation |
| `/design` | Living style page (dev only) — all tokens, typography, motion, components |
| `404` | Dead-end road that draws itself |

**What is real vs demo:**
- Real: Sentinel-2 imagery, OSM roads, 25 unreliable tile locations, run log, GPU hours, day/night terminator.
- Demo (labelled "Demo data" everywhere): alert scores, review statuses, red priority zones.
- National borders not drawn.

### Checks completed

| Check | Result |
|---|---|
| TypeScript | 0 errors (`npx tsc --noEmit`) |
| axe accessibility scan | 0 issues across 13 pages |
| Lighthouse desktop — all pages except Home & Explore | Performance ≥ 90, Accessibility 100, SEO 100 |
| Lighthouse desktop — Home | ~87 performance (3D lazy-loads after first paint), 100 rest |
| Lighthouse desktop — Explore | ~25 performance (map tile flash at 9-date changes — not re-run after fix) |
| Initial JS per public page | ≤ 200 KB gz; 3D and map chunks load post-first-paint |

### Not done yet (resume here next session)

1. **Re-run Lighthouse** on Home and Explore after the browser stabilises at the 9-date change.
2. **Playwright screenshots** at 1440×900, 1024×768, 390×844 (dark + light) per page → `reports/ui/`.
3. **Section 14 batch questions** (defaults used — confirm with user if needed).
4. **GSAP skills install** (`npx skills add greensock/gsap-skills` or equivalent).
5. **Commit** — stage only: `web/`, `scripts/build_web_data.py`, `docs/guides/ui_run_locally.md`, `UI_PROMPT.md`. Leave `archive-wHzHQ5/` out.
6. **Security scan (HawkScan)** — needs `HAWKSCAN_API_KEY` env var; skip until set.
7. **`docs/guides/ui_review.md`, `ui_deploy.md`, `ui_demo_video.md`** — not written yet.
8. **EOX licence corrected** in `LICENSES_DATA.md` ✅ (done this session).
9. **ADR-018–020 written** ✅ (done this session).

---

## Current status (2026-10-14, Day 1 evening — Day 2 work pulled forward)

- **Phase:** CP1 sprint (ADR-006). **CP1 review ≈ Tue 2026-10-20.**
- **Running on Kaggle:** Baseline A full_s0 (GPU, ≤3 h) · Reference B timing (GPU, DINOv3 frozen).
- **Blockers:** 6 local commits not on GitHub (my pushes are blocked by the tool's safety classifier
  after the token incident) → user runs `! git push origin main`. Needed before the
  Kaggle CPU build `s2_build pilot_latest` (it clones the repo at a pinned commit).
- **Quota:** Kaggle free GPU = 6 h/week/account (ADR-013). Lead account: ~2.8 h left until Sat 17 Oct.
- **Parallel UI session:** a second Claude session works from `UI_PROMPT.md` in `web/` +
  `scripts/build_web_data.py`. Not touched by this session; commit only explicitly named files.

### Day 2 (done 2026-10-14)
| Item | Evidence |
|---|---|
| Baseline A timing run | 508 s/epoch on T4×2, val IoU 0.451 after 1 epoch (`data_cache/runs/baseline_a_timing`) |
| Trainer v2 (4 crops/img, val_every, time budget, resume) + CPU smoke test | smoke passes for deepglobe / dinov3 / s2 modes; caught ONNX exporter bug |
| Sentinel-2 composites + QA + registry | 630 zone composites (3 zones × 9 seasons, Kaggle CPU), 25 cloudy tiles abstained, registration 0.0 px |
| OSM labels | 374 tiles, 79,408 road lines, 356 with roads; Kaggle dataset `roadwatch-pilot-labels` |
| Reference B (DINOv3 sat ViT-L frozen + decoder, 2.24 M trainable) | private Kaggle dataset with official weights + licence; timing run pushed |
| Mask → graph → GeoJSON/GPKG/SHP | `graph/extract.py`, 6 tests |
| Teammate run cards | A: Baseline A seed 1, B: seed 2 (`runs/cards/`) |
| Security incident | Kaggle token screenshot committed to public repo (f38e24b) by `git add -A`; user chose not to rotate; root images now git-ignored; commit only named files |

## CP1 6-day plan (ADR-006)

| Day | Date | Work | Gate / evidence |
|---|---|---|---|
| 1 | Wed 14 Oct | Repo, env, configs, AOI + zones, frozen holdout, check scripts, CI · accounts: Kaggle, HF (+ DINOv3 licence), GitHub | `roadwatch info`, tests green, **Gate 1** draft |
| 2 | Thu 15 Oct | Data pipeline: STAC search (Planetary Computer), windowed reads, seasonal composites, cloud mask, CRS/registration checks, tile registry + reserve log · OSM road labels → masks · Kaggle notebook **Baseline A** (U-Net/D-LinkNet ResNet34, DeepGlobe) **1-epoch timing run** | unit tests on fixtures, timing → GPU-hour estimate |
| 3 | Fri 16 Oct | Baseline A full run (teammate run cards) · Reference B: DINOv3 frozen + head (if licence approved) · Sentinel-2 road model on AP chips | RUN_LOG rows, checkpoints on HF |
| 4 | Sat 17 Oct | Inference on zones A/B/C · mask → skeleton → graph → GeoJSON/GPKG/Shapefile · minimal FastAPI + MapLibre page | map showing extracted roads |
| 5 | Sun 18 Oct | KPI-1 table (IoU/F1 + APLS-on-skeleton) with 95% bootstrap CIs, per condition (occlusion/terrain/zone) · failure log · resource profile · NT stubs | `reports/kpi1_cp1.md` |
| 6 | Mon 19 Oct | `reports/CP1_report.md`, slide outline, demo script, 2-min video plan, **Gate 2** checklist, rehearsal | review pack |

## Team (ADR-009)
| Person | Role | Runs Kaggle jobs |
|---|---|---|
| You | Model engineering lead | yes |
| A | Spatial evidence & provenance lead | yes |
| B | GIS workflow & delivery lead | yes |
| C | Validation & uncertainty lead | yes |
| D | Training-runs & reproducibility lead | yes |

## Done

### 2026-10-14 — Day 1, block 1: foundation
- `pyproject.toml` + uv env on Python 3.11.16 (`.python-version`), uv cache inside project.
- `src/roadwatch/config.py`: Pydantic configs; all lean rules are switches (`configs/lean.yaml`); config hash.
- AOI boundaries from OSM (`scripts/fetch_boundaries.py`): AP 163,136 km² · NTR 3,285 · Krishna 3,826.
- Zones A/B/C (`configs/zones.yaml`), pilot AOI = NTR ∪ Krishna ∪ zones = 7,152 km², 374 tiles.
- Deterministic tile grid (`data/grid.py`) and frozen spatial holdout (`data/splits.py`, `evidence/holdout/`): 95/489 AP blocks test + 3 zones; sha256 8a9150a57d46.
- CLI: `uv run roadwatch info`, `roadwatch holdout freeze|check`.
- `scripts/check_env.py`, `scripts/disk_check.py` (project 1.18 GB / 3 GB limit; drive 267 GB free).
- `.env.example`, `.github/workflows/ci.yml`, `LICENSES_DATA.md`, `evidence/manifest.csv`, `README.md`.
- Tests: 17 passed, ruff clean.

Evidence (`uv run roadwatch info`):
```
aoi   : ntr_krishna_pilot  area=7,152 km2
grid  : 512px @ 10.0 m, crs=auto_utm  tiles=374  epsg=[32644]
splits: train 177, zone_test 70, buffer 50, test 46, val 31
```

### 2026-10-14 — Section 0.1 kick-off
- Machine check: Win 11 Home, PS 5.1, i9-13900HX, 15.7 GB RAM, RTX 4070 Laptop 8 GB, E: 250 GB free, uv 0.12.5, Git 2.55, Node 24.
- Section 13 batch-1 answers: teammates A–D; review in 6 days; all three zones; accounts on demand; public repo; disk option B.

## Next
1. 🔴 Kaggle account + API token, Hugging Face account + token + DINOv3 licence request, GitHub repo push.
2. Day 2: data pipeline + Baseline A Kaggle notebook (timing run).

## Blockers / waiting on user
- Kaggle (phone-verified) + API token in `.env`.
- Hugging Face token in `.env` + DINOv3 licence request + org name.
- GitHub: create public repo, then I push.
