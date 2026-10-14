# UI deploy guide

_Deploy the public site and app with free services only._

## Target setup

| Piece | Service | Notes |
|---|---|---|
| Public site + app | **Cloudflare Pages** (free tier) | Static build; no server needed for the frontend |
| Static data layers | **Hugging Face Hub** (free) | PMTiles, GeoJSON pipeline outputs |
| Backend API | **Hugging Face Spaces** (free, ZeroGPU or CPU) | FastAPI; sleeps when idle |

---

## 1. Build the frontend

```powershell
cd e:\cap-22\web
pnpm build
```

Output lands in `web/dist/`. Check it:

```powershell
pnpm preview   # serves dist/ locally at http://localhost:4173
```

Open http://localhost:4173 and do a quick smoke test (Home, Explore, /app).

---

## 2. Deploy to Cloudflare Pages

### First deploy

1. Push the repo to GitHub (see PROGRESS.md — run `git push origin main`).
2. Go to [dash.cloudflare.com](https://dash.cloudflare.com) → Pages → Create a project → Connect to Git.
3. Select the `AI-Based-Road-Extraction…` repo.
4. Framework: **Vite**.
5. Build command: `cd web && pnpm install && pnpm build`
6. Build output directory: `web/dist`
7. Environment variables: none needed for the static site (API keys are server-side).
8. Deploy.

### Subsequent deploys

Push to `main` — Cloudflare Pages auto-deploys. Or use the CLI:

```powershell
npx wrangler pages deploy web/dist --project-name roadwatch-ap
```

---

## 3. Upload static data to Hugging Face

```powershell
# Install huggingface_hub if needed
uv pip install huggingface_hub

# Upload the precomputed PMTiles + GeoJSON layers
uv run python scripts/build_web_data.py
```

`build_web_data.py` uploads to the HF dataset repo. The Explore page fetches from there — CORS is open on HF Hub datasets.

---

## 4. Wake sleeping services

Hugging Face Spaces on the free tier sleeps after ~48 h of inactivity. Wake it:

1. Open the Space URL (e.g. `https://huggingface.co/spaces/<org>/roadwatch-api`).
2. Click **Restart** (or just open the Space — it wakes automatically, takes ~30 s).
3. Check the API health endpoint: `GET /health` → `{"status":"ok"}`.

The frontend falls back to MSW fixture data when the API is asleep, so the public demo always works.

---

## 5. Attributions check before going live

1. Open `/attributions` on the deployed site.
2. Confirm every row in `LICENSES_DATA.md` has a matching entry.
3. Check EOX attribution near every map: *"Sentinel-2 cloudless by EOX IT Services GmbH (2016), CC BY 4.0"*.
4. Check OSM attribution near every map: *"© OpenStreetMap contributors"*.
5. No government logos (NTRO, ISRO, NRSC, KL University) — text mentions only.

---

## 6. Custom domain (optional)

In Cloudflare Pages → Custom domains, add your domain (e.g. `roadwatch.pages.dev` is free). HTTPS is automatic.

---

## Rollback

Cloudflare Pages keeps every deployment. To roll back: Pages → Deployments → pick a previous one → **Retry deployment** (or **Set as production**).
