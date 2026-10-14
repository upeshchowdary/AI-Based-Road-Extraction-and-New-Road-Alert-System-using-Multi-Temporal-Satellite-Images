# Run the RoadWatch UI locally

The website and app live in `web/`. This build is **UI only**: it is not connected to the backend.
Imagery, roads and boundaries are real project data; alerts and scores are labelled **demo data**.

## 1. One-time setup (≈ 3 min)

Needs Node.js 20+ and pnpm (both already installed on the project laptop).

```powershell
cd E:\cap-22\web
pnpm install
```

`node_modules` is about 400 MB. pnpm keeps its store on `E:\.pnpm-store`, so drive C: is not used.

## 2. Start the dev server

```powershell
cd E:\cap-22\web
pnpm dev
```

Open **http://localhost:5173** in Chrome.

| URL | What it is |
|---|---|
| `http://localhost:5173/` | Home page with the 3D "orbit to road" scroll story |
| `http://localhost:5173/explore` | Live demo map (real Sentinel-2 composites of zone A, OSM roads) |
| `http://localhost:5173/app` | The app: Command Center, Alerts, Explorer, Audit, Zones, Ask, Reports, System, Settings |
| `http://localhost:5173/app/sign-in` | Sign-in screen ("Explore with demo account") |
| `http://localhost:5173/design` | Living style page: colours, type, components |

Stop the server with `Ctrl + C` in the terminal.

## 3. Switch theme and motion

- **Public site:** scroll to the footer → theme buttons (moon = dark, sun = light, monitor = system) and
  **Motion on / Off / System**.
- **App:** click the round **DA** avatar (top-right) → Dark / Light / System. Or open **Settings**.
- **Motion off** (or the Windows "Animation effects" setting off) turns the 3D hero into a calm static
  sequence and removes smooth scrolling.

## 4. Keyboard shortcuts in the app

| Keys | Action |
|---|---|
| `Ctrl` + `K` | Command palette (pages, alert IDs, actions) |
| `?` | Shortcut list |
| `[` | Collapse / expand the sidebar |
| `J` / `K` | Next / previous alert (Alerts page) |
| `Enter` | Open the alert |
| `A` / `R` / `F` | Accept / Reject (asks a reason) / Flag for field check |

Reviews are stored only in this browser (Settings → Reset demo reviews clears them).

## 5. Rebuild the UI data from the pipeline

The files in `web/public/data/` are generated from `data_cache/` (Sentinel-2 composites, OSM roads):

```powershell
cd E:\cap-22
uv run python scripts/build_web_data.py
```

## 6. Production build (optional)

```powershell
cd E:\cap-22\web
pnpm build
pnpm preview
```

Then open the URL that `pnpm preview` prints (usually http://localhost:4173).

## If something goes wrong

- **Port 5173 already in use:** another dev server is running. Close that terminal, or run `pnpm dev --port 5174`.
- **Map is empty:** the basemap comes from `tiles.openfreemap.org`; check the internet connection.
  Zone A imagery is local and always loads.
- **Globe doesn't appear:** your GPU tier is "low" or motion is off — the page shows the static version
  on purpose.
