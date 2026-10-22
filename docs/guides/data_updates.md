# Keeping RoadWatch current — new seasons, new alerts (ADR-026)

RoadWatch compares **seasonal composites**: one cloud-free Sentinel-2 picture per season, the median of
up to 8 passes. A season can only be built once its window has closed:

| Season | Window | New data available from |
|---|---|---|
| Pre-monsoon | 1 Mar – 31 May | 1 June |
| Post-monsoon | 15 Oct – 31 Dec | 1 January |

So "live" for RoadWatch means: **twice a year, as soon as a window closes, build it, re-run detection and
publish** — not minute-by-minute (single cloudy passes would only add false alerts).

## 1. Ingest (local, safe)

```
uv run python scripts/update_season.py --dry-run   # lists finished seasons not built yet
uv run python scripts/update_season.py             # builds them for zones A–C
```

What it does, in order:

1. `roadwatch s2-build --zones-only --seasons-only <new>` — composites; **every tile is logged in the tile
   registry** (`evidence/tile_registry.parquet`: scenes used, cloud share, QA pass/abstain).
2. `roadwatch infer` — the Tier-1 model's road map for the new season.
3. `roadwatch detect` — alerts over all seasons. **Alert ids are stable**: an alert that overlaps one from the
   previous run keeps its id (`src/roadwatch/change/ids.py`), so accept/reject reviews stay on the same road;
   new roads get new numbers, ids are never reused.
4. `scripts/build_deploy_bundle.py` — the data bundle the website serves.

Nothing is published by this script.

## 2. Publish (needs the owner's go-ahead)

```
gh release upload data-v1 data_cache/deploy/roadwatch_data.tar.gz --clobber
git push            # Render redeploys on push (render.yaml autoDeploy), downloading the new bundle
```

The site's `/api/health` and the Alerts page then show the new season and the bundle date.

## 3. Statewide / India

The same seasons drive the Kaggle runs: add the new date key to `kaggle/statewide/runs.yaml`
(`seasons`) or `kaggle/india/runs.yaml` (`seasons`, newest first) and push the runs as in ADR-023/025.
