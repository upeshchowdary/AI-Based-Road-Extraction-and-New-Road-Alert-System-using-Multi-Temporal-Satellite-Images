# Deploy RoadWatch on Render (free)

One web service runs everything: the API, the built website and a small data bundle.
Cost: **free** plan (512 MB RAM). It sleeps after 15 minutes without visitors; the first visit after
that takes about a minute to wake up. Fine for a review demo — open the link a minute before you present.

## What gets deployed

| Piece | Where it comes from |
|---|---|
| API + website | This repo, built by `Dockerfile` (Node builds `web/`, Python runs `roadwatch serve`) |
| Configs, tile registry, holdout, run log | Tracked in Git |
| Zone images, KPI metrics, predicted roads, alerts | **Data bundle** `roadwatch_data.tar.gz` on the GitHub release `data-v1` |

The 500 MB of Sentinel-2 GeoTIFFs never leave the laptop: the bundle carries the 27 pre-rendered zone
images instead. Everything in it is Copernicus-derived (attributed on every map) or RoadWatch output.

## 1. Data bundle (laptop, only when results change)

```powershell
cd E:\cap-22
uv run python scripts/build_deploy_bundle.py
gh release upload data-v1 data_cache/deploy/roadwatch_data.tar.gz --clobber
```
Then on Render: **Manual Deploy → Deploy latest commit** so the image downloads the new bundle.

## 2. Create the service (once) — 🔴 your turn

1. Open **https://dashboard.render.com** → **Sign in with GitHub** (use the account that owns the repo).
2. Top right **+ New** → **Blueprint**.
3. **Connect a repository** → if the repo is not listed, click **Configure account** → GitHub opens →
   under *Repository access* pick **Only select repositories** → choose
   `AI-Based-Road-Extraction-and-New-Road-Alert-System-using-Multi-Temporal-Satellite-Images` → **Save**.
4. Back on Render, pick that repo → **Connect**.
5. Render reads `render.yaml` and shows one service, **roadwatch-ap** (free, Singapore).
   Blueprint name: `roadwatch` → **Deploy Blueprint**.
6. Wait for the first build (about 6–10 minutes). The log ends with `Uvicorn running on http://0.0.0.0:…`
   and the status turns **Live**.
7. Your link is at the top of the service page, like `https://roadwatch-ap.onrender.com`.

No secrets or environment variables are needed: the deployed app only reads public data.

## 3. Check it

- `https://<your-app>.onrender.com/api/health` → `"status": "ok"`, `"composites": 630`.
- `/map` → zone A–C images under **Our seasons**, extracted roads, 413 alert markers.
- `/results` → KPI-1 tables. `/api/docs` → API reference.

## Updating

- **Code or UI change:** push to `main` → Render redeploys automatically (`autoDeploy: true`).
- **New results** (new model, new alerts): rebuild + upload the bundle (step 1), then *Manual Deploy*.

## If something is wrong

- **Build fails at the data step:** the release file is missing → run step 1.
- **"Out of memory" / restarts:** the free plan has 512 MB. Avoid opening many zone images at once,
  or switch the service to the *Starter* plan in Render → Settings.
- **Search says "unavailable":** the geocoders (Photon, Nominatim) rate-limit shared hosts; coordinates
  (`16.51, 80.63`) always work.
