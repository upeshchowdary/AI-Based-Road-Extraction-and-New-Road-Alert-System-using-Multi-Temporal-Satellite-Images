# Tools, repositories, services and websites used by RoadWatch

A running list (user, 2026-10-22: "make a proper list of tools, repos, websites you used"). Updated
whenever something new is used. Data **licences and attribution** are kept in
[`LICENSES_DATA.md`](../LICENSES_DATA.md); this file says *what* is used, *where*, and *why*.

Status: ✅ in use · 🧪 integrated, being tested · 📋 planned (step in ADR-024/025/026).

## 1. Data sources

| Source | Website / repo | Used for | Where in the project | Licence | Status |
|---|---|---|---|---|---|
| Sentinel-2 L2A | https://planetarycomputer.microsoft.com (STAC: `planetarycomputer.microsoft.com/api/stac/v1`) | All imagery: seasonal 10 m composites | `src/roadwatch/data/sentinel2.py`, Kaggle builds | Copernicus open data | ✅ |
| OpenStreetMap — Geofabrik extracts | https://download.geofabrik.de/asia/india.html | Road labels (training), India OSM check | `labels-build`, `kaggle/s2_build`, `kaggle/india` | ODbL 1.0 | ✅ |
| OpenStreetMap full history — **ohsome API** (HeiGIT) | https://api.ohsome.org (`elementsFullHistory/geometry`) | Dated ground truth for KPI-2/3 (roads mapped after 2022) | `src/roadwatch/qa/change_eval.py` | ODbL 1.0 | ✅ |
| India official boundary — **DataMeet** | https://github.com/datameet/maps (`Country/india-composite.geojson`) | All-India AOI (follows the Survey of India boundary) | `configs/boundaries/india_official.geojson`, `kaggle/india/run.py` | CC BY 2.5 IN | ✅ |
| Andhra Pradesh / district boundaries | OpenStreetMap (via the project's boundary build) | State and pilot AOIs | `configs/boundaries/` | ODbL 1.0 | ✅ |
| DeepGlobe Roads | Kaggle dataset (DeepGlobe 2018 challenge) | Baseline A / Reference B training (0.5 m) | `kaggle/baseline_a` | research use | ✅ |
| DINOv3 sat weights | https://huggingface.co/facebook/dinov3-vitl16-pretrain-sat493m | Reference B backbone | `kaggle/baseline_a/train.py` (DINO path) | DINOv3 licence (gated) | ✅ |
| SSL4EO-S12 Sentinel-2 weights (via **TorchGeo**) | https://github.com/microsoft/torchgeo · https://torchgeo.readthedocs.io | Sentinel-2-pretrained encoder for the India models (instead of ImageNet) | `kaggle/baseline_a/train.py` (`encoder_weights: ssl4eo_s2_moco`) | weights CC-BY-4.0, code MIT | 🧪 |
| Microsoft Road Detections | https://github.com/microsoft/RoadDetections | Second, independent reference for the India accuracy check | India map check (step 4) | ODbL 1.0 | 📋 |
| APLS metric — CosmiQ reference code | https://github.com/CosmiQ/apls · https://pypi.org/project/apls/ | APLS graph metric (charter KPI-1). The PyPI release (0.1.0, 2019) pins GDAL 2.4.0 and no longer installs, so the **published definition was reimplemented** with the repo as reference | `src/roadwatch/qa/apls.py`, `scripts/apls_report.py` | Apache-2.0 (reference) | ✅ |
| GDAL `osmconf.ini` (OSM driver config) | https://gdal.org/drivers/vector/osm.html | Way version + timestamp for dated labels | `kaggle/labels_dated/run.py` | MIT/X | ✅ |

## 2. Web map layers and services (streamed, never stored)

| Service | Website | Used for | Status |
|---|---|---|---|
| Esri World Imagery | https://server.arcgisonline.com | "Satellite" basemap (visual context only) | ✅ |
| EOX Sentinel-2 cloudless 2024 | https://s2maps.eu | "S2 2024" basemap | ✅ |
| OpenFreeMap (vector tiles, building heights) | https://openfreemap.org | "Streets" basemap, 3D buildings | ✅ |
| AWS Terrain Tiles (Terrarium) | https://registry.opendata.aws/terrain-tiles/ | 3D terrain | ✅ |
| Photon (komoot) / Nominatim (OSMF) | https://photon.komoot.io · https://nominatim.org | Place search on the map | ✅ |

## 3. Compute, hosting and delivery

| Service | Website | Used for | Status |
|---|---|---|---|
| Kaggle Notebooks (CPU + GPU T4×2) and the `kaggle` CLI | https://www.kaggle.com · https://github.com/Kaggle/kaggle-api | All builds, training, statewide/India runs (`scripts/kaggle_push.py`) | ✅ |
| GitHub (repo, Releases, Actions CI) and `gh` CLI | https://github.com/upeshchowdary/AI-Based-Road-Extraction-and-New-Road-Alert-System-using-Multi-Temporal-Satellite-Images | Code, data bundle (release `data-v1`), CI (lint, tests, Docker smoke test) | ✅ |
| Render (free web service, Docker) | https://render.com | Public demo https://roadwatch-ap.onrender.com | ✅ |
| Hugging Face Hub | https://huggingface.co | DINOv3 weights access | ✅ |
| GitHub Actions schedule | https://docs.github.com/actions | Automatic season updates (step 5; enabled only with the owner's OK, it publishes) | 📋 |

## 4. Software libraries

**Python (geo + data):** uv (env/lock), numpy, pandas, geopandas, shapely 2, pyproj, rasterio (GDAL),
pyogrio, scipy, scikit-image ≥ 0.26, networkx, pystac-client, planetary-computer, requests, PyYAML,
Pillow, matplotlib. **ML:** PyTorch, segmentation-models-pytorch 0.3.4 (U-Net), transformers (DINOv3),
ONNX + ONNX Runtime (CPU inference), TorchGeo 0.7.0 (🧪). **Backend:** FastAPI, Uvicorn, Pydantic 2,
Typer. **Quality:** pytest, ruff.

**Web:** React 19, React Router, Vite, TypeScript, Tailwind CSS 4, MapLibre GL JS, Zustand, lucide-react,
pnpm.

**Planned (📋):** tippecanoe (https://github.com/felt/tippecanoe) + PMTiles (https://github.com/protomaps/PMTiles)
for the India road map in the browser; pyosmium (https://osmcode.org/pyosmium/) for fast OSM reading;
Playwright (https://playwright.dev) for end-to-end UI tests; Schemathesis (https://schemathesis.readthedocs.io)
for API fuzz tests from the OpenAPI spec.

## 5. Tools used while building (not shipped)

| Tool | Used for |
|---|---|
| Claude Code (Anthropic) | Development assistant: code, runs, reports |
| Claude in Chrome (browser extension) | Reading Kaggle run logs / active sessions, stopping hung or wrong runs |
| Docker | Same image locally, in CI and on Render |
| QGIS (recommended to the team) | Opening the 4-band GeoTIFF composites |

## 6. Papers and references cited

- Demir et al., *DeepGlobe 2018*, CVPR Workshops 2018 — DeepGlobe Roads.
- Zhou et al., *D-LinkNet*, CVPR Workshops 2018 — DeepGlobe road benchmark level.
- Wang et al., *SSL4EO-S12*, 2022 — Sentinel-2 self-supervised pretraining (TorchGeo weights).
- Van Etten et al., *SpaceNet: A Remote Sensing Dataset and Challenge Series* — APLS metric.
- Siméoni et al., *DINOv3*, 2025 — Reference B backbone.
