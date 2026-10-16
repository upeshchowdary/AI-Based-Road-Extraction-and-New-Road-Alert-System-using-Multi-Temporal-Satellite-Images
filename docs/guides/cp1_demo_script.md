# CP1 demo script (≈ 2 minutes)

**Live site:** https://roadwatch-ap.onrender.com (free plan: it sleeps after 15 min idle — open it
**2 minutes before** you present so it is awake). **Backup:** on the laptop `cd E:\cap-22; uv run roadwatch serve`
→ http://127.0.0.1:8000 (same app, also stores review decisions). Chrome, full screen; have
`reports/kpi1_cp1.md` open in a tab.

| Time | Do | Say |
|---|---|---|
| 0:00 | Home page: globe → scroll once | "RoadWatch reads free satellite images of Andhra Pradesh and alerts when a new road appears — with proof." |
| 0:10 | **Open the map** → type **Gannavaram** in search → pick it | "Any place in the world, with road and village names, like Google Maps." |
| 0:25 | Base map → **Our seasons**, zone A → drag 2022 → 2026 | "Our own Sentinel-2 composites: clouds removed, nine seasons. Watch the Western Bypass appear." |
| 0:45 | Layers → **Roads extracted by RoadWatch** | "Teal is what our model extracts on a laptop CPU — vector roads you can open in QGIS." |
| 0:55 | Point at a hatched tile | "Abstain mode: cloudy tiles are marked unreliable instead of guessed." |
| 1:05 | **Alerts** tab → open the first alert | "413 real new-road alerts from graph-level change detection with a persistence rule." |
| 1:15 | Drag the before/after slider; click two dates in the strip | "Every alert carries its evidence: absent before, present on every later date." |
| 1:30 | Click **Reject** → pick a reason | "Each decision becomes a training label — that is how precision gets measured in CP2." |
| 1:40 | **Results** tab | "Every number has a 95% confidence interval on test areas frozen before training: baseline IoU 0.50 at 0.5 m; our Sentinel-2 model 0.32 at 10 m." |
| 1:55 | End | "Next: dated ground truth for precision, radar for monsoon, statewide run." |

**If the internet is slow:** use the laptop backup; "Our seasons", alerts and evidence are served locally.
**On a phone:** the same link works (bottom tabs, slide-up map panels).
