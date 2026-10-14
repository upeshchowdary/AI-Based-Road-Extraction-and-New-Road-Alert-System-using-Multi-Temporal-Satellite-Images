# Run the RoadWatch website + app locally

## Option A — one command (uses the last production build of the UI)

```powershell
cd E:\cap-22
uv run roadwatch serve
```
Open **http://127.0.0.1:8000** (map: **http://127.0.0.1:8000/explore**, app: **/app**, API docs: **/docs**).
Stop with `Ctrl+C`. After changing UI code, rebuild once: `cd web; npx vite build`.

## Option B — development (live reload of the UI)

Two terminals:
```powershell
# terminal 1 — API
cd E:\cap-22
uv run roadwatch serve --reload
# terminal 2 — UI
cd E:\cap-22\web
npx vite
```
Open **http://localhost:5173**. Vite forwards every `/api/...` request to the API on port 8000.

## The map (`/explore`)

| Control | What it does |
|---|---|
| Search box (top) | Type any place in the world (≥ 3 letters) or `lat, lon` → pick a result → the map flies there and drops a pin. |
| Base map → **Satellite** | Sub-metre satellite imagery (Esri) with road + place names down to village/street level. Default. |
| Base map → **Streets** | Full street map (OpenFreeMap): buildings, shops, hospitals, road numbers, house numbers. |
| Base map → **S2 2024** | Sentinel-2 cloudless 2024 (10 m) — the newest free yearly mosaic. |
| Base map → **Our seasons** | RoadWatch's own Sentinel-2 composites; pick zone A / B / C and drag the date bar (2022–2026). |
| Layers | Toggle existing roads, unreliable (cloudy) tiles, zones, roads extracted by RoadWatch, names. |
| Before / after swipe | Compare two seasons of our composites side by side. |
| Zoom | Scroll / pinch / +− buttons. Zoom all the way out for the globe. |

Real vs demo: imagery, roads, zones, unreliable tiles and extracted roads are real. **Alerts and red
priority zones are demo** until change detection is built (CP2); every screen that shows them says so.

## If something is wrong
- Map black: open the browser console (F12). A style error there names the bad layer.
- "search services unavailable": no internet or both geocoders are down; coordinates still work.
- Our seasons empty: composites must exist under `data_cache/runs/*/s2/` (see `train_on_kaggle.md`).
