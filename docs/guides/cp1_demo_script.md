# CP1 demo script (≈ 2 minutes)

**Before the review:** `cd E:\cap-22; uv run roadwatch serve` → open http://127.0.0.1:8000/explore in
Chrome, full screen. Close other heavy apps (16 GB RAM). Have `reports/kpi1_cp1.md` open in a tab.

| Time | Do | Say |
|---|---|---|
| 0:00 | Map loads: globe → flies to Vijayawada | "RoadWatch watches roads from space. Free satellite data, any place in the world." |
| 0:15 | Type **Gannavaram** in search → pick result | "Search any place. Satellite imagery with road and village names, like Google Maps." |
| 0:30 | Zoom to street level, then switch **Streets** | "Detailed base maps work everywhere, even where we have not trained yet." |
| 0:45 | **Our seasons** → zone A → drag dates 2022 → 2026 | "These are our own Sentinel-2 composites — clouds removed, nine seasons. Watch the Western Bypass appear." |
| 1:05 | Turn on **Roads extracted by RoadWatch** | "Green is what our model extracts on a laptop CPU, as vector roads you can open in QGIS." |
| 1:20 | Point at a hatched tile (zone B, post-monsoon) | "Abstain mode: cloudy tiles are marked unreliable instead of guessed." |
| 1:30 | Open **Results** page | "Every number has a 95% confidence interval on a test area frozen before training. Baseline IoU 0.50; our Sentinel-2 model 0.32 at 10 m." |
| 1:45 | Open **App → System** | "Run log, GPU budget, data freshness — all real. Alerts are labelled demo until change detection in CP2." |
| 2:00 | End | "Next: graph-level change detection with persistence, radar for monsoon, statewide run." |

**If the internet is slow:** stay in "Our seasons" (served locally) and skip search.
