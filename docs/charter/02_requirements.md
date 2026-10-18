# 02 — Requirements (functional and non-functional)

Derived from the KL charter CLIMATE-06 (FR-1…FR-7, NFR-1…NFR-6) and `PROJECT_PROMPT.md`.
Status: ✅ met with evidence · 🟡 partly · ❌ not yet. Version 1.0 (2026-10-18).

## Functional requirements

| ID | Requirement (charter) | How RoadWatch meets it | Status | Evidence |
|---|---|---|---|---|
| FR-1 | Ingest labelled satellite road data; validate version, provenance, schema, units and quality gates before use | Sentinel-2 L2A via Planetary Computer STAC (scene ids recorded per tile); DeepGlobe attached on Kaggle; OSM labels from a dated Geofabrik extract; grid/CRS and cloud gates per tile; every tile in the registry | ✅ | `src/roadwatch/data/`, `qa/checks.py`, `evidence/tile_registry.parquet`, `evidence/manifest.csv` |
| FR-2 | Reproduce the O2 reference through a one-command path with an independent expected-result oracle | `scripts/kaggle_push.py <model> <run>` (config hash per run); KPIs recomputed from per-image counts by `scripts/kpi_report.py` | 🟡 | Oracle = OSM/DeepGlobe masks; no separate hand-verified oracle set yet |
| FR-3 | Implement the O3 contribution (road networks over time) as a separately testable, versioned subsystem | `roadwatch.change.detect` (graph comparison, persistence, stability, abstain), unit + negative tests | ✅ | `tests/test_change.py`, `tests/negative/`, ADR-020 |
| FR-4 | Implement the alert-generation layer with input, output, error, configuration and telemetry contracts | Alerts JSON (score = confidence × persistence × connectivity × quality, evidence chips, history); FastAPI contracts | 🟡 | `/api/alerts`, `/api/alerts/{id}/evidence`, `/api/docs`; telemetry is basic (health endpoint, server log) |
| FR-5 | Implement the Python segmentation + change pipeline with its contracts | `roadwatch` CLI: `s2-build`, `labels-build`, `infer`, `detect`, `serve`; Pydantic-validated configs | ✅ | `src/roadwatch/cli.py`, `configs/`, `tests/test_config.py` |
| FR-6 | Deliver the complete demonstrable result, not an isolated notebook/model/dashboard | Web app + API + data bundle, deployed | ✅ | https://roadwatch-ap.onrender.com, `Dockerfile`, CI docker smoke test |
| FR-7 | Detect the NT-1 condition, invoke the safe/degraded response, keep recovery evidence | Occlusion handled by multi-date persistence; tested | ✅ | `reports/negative_tests.md` (NT-1, 3 cases) |

## Non-functional and domain-assurance requirements

| ID | Requirement (charter) | How RoadWatch meets it | Status | Evidence |
|---|---|---|---|---|
| NFR-1 | Performance: every KPI target met under AC-1 and AC-4, incl. tail values and resource cost | KPI-1 and KPI-6 measured with 95% CIs; resource profile recorded | 🟡 | `reports/kpi1_cp1.md`, `reports/kpi6_registration.md`, `runs/RUN_LOG.csv`; KPI-2…5 open |
| NFR-2 | Reliability and recovery: every negative test passes; no critical failure hidden by an average | NT-1…NT-5, 14 cases, all pass; per-zone results reported separately | ✅ | `reports/negative_tests.md` |
| NFR-3 | CRS, registration, resolution, temporal alignment and missing coverage explicit | Deterministic UTM tile grid; grid + cloud gates; registration measured; detection refuses mixed CRS / unordered dates; cloudy tiles abstain | ✅ | `qa/checks.py`, NT-4, NT-5, KPI-6 |
| NFR-4 | Independent spatial validation prevents leakage between development and test areas | Frozen block holdout (EPSG:7755, 20.48 km blocks, 1 km buffer, sha256 8a9150a57d46); CI fails if it changes | ✅ | `evidence/holdout/`, `roadwatch holdout check`, ADR-007/008 |
| NFR-5 | Maintainability: version control, automated tests, documented interfaces, config validation, clean-environment build | Git + CI (lint, 64 tests, holdout check, Docker build); OpenAPI docs; Pydantic configs | ✅ | `.github/workflows/ci.yml`, `/api/docs` |
| NFR-6 | Operability: logs, health/quality indicators, operator guidance, degraded mode, verified recovery | Health endpoint; abstain = degraded mode; run and deploy guides | 🟡 | `/api/health`, `docs/guides/`; operating guide + recovery procedure still to write |

## Constraints carried from the project prompt

Free tools only · training on Kaggle (30 GPU-h/week/account) · laptop inference via ONNX · secrets only
in `.env` · licences respected (`LICENSES_DATA.md`) · nothing cut from the lean build lost (reserve
registry) · test set frozen.
