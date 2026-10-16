# Run the RoadWatch website + app locally

## Option A — one command (uses the last production build of the UI)

```powershell
cd E:\cap-22
uv run roadwatch serve
```
Open **http://127.0.0.1:8000** (map: **/map**, alerts: **/alerts**, results: **/results**, API reference: **/api/docs**).
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

## The map (`/map`)

| Control | What it does |
|---|---|
| Search box (top) | Type any place in the world (≥ 3 letters) or `lat, lon` → pick a result → the map flies there and drops a pin. |
| Base map → **Satellite** | Sub-metre satellite imagery (Esri) with road + place names down to village/street level. Default. |
| Base map → **Streets** | Full street map (OpenFreeMap): buildings, shops, hospitals, road numbers, house numbers. |
| Base map → **S2 2024** | Sentinel-2 cloudless 2024 (10 m) — the newest free yearly mosaic. |
| Base map → **Our seasons** | RoadWatch's own Sentinel-2 composites; pick zone A / B / C and drag the date bar (2022–2026). |
| Layers | Toggle new-road alerts, existing roads, unreliable (cloudy) tiles, zones, roads extracted by RoadWatch, names. |
| Before / after swipe | Compare two seasons of our composites side by side. |
| Zoom | Scroll / pinch / +− buttons. Zoom all the way out for the globe. |
| **3D** button (above +/−) | Real terrain + 3D buildings + sky. In 3D: right-drag (or Ctrl+drag) to tilt and rotate; the compass resets north. Click **2D** to flatten again. Works on Satellite, Streets, S2 2024 and Our seasons. |

Real vs demo: imagery, roads, zones, unreliable tiles, extracted roads and the **413 new-road alerts**
are real (change detection v1, S2 model v1 — not yet validated against ground truth). Only the red
**priority zones** are demo, and they are labelled so.

## On a phone
Same Wi-Fi as the laptop: `uv run roadwatch serve --host 0.0.0.0`, allow it on **Private networks** if
Windows Firewall asks, then open `http://<laptop-IP>:8000` (find the IP with `ipconfig`). Phones get a
bottom tab bar, slide-up map sheets and a compact alert list.

## If something is wrong
- Map black: open the browser console (F12). A style error there names the bad layer.
- "search services unavailable": no internet or both geocoders are down; coordinates still work.
- Our seasons empty: composites must exist under `data_cache/runs/*/s2/` (see `train_on_kaggle.md`).
