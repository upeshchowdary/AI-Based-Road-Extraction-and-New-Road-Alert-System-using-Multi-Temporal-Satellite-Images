# All-India Tier-1 road map — coverage and accuracy check (ADR-025)

_Generated 2026-10-29 by `scripts/india_check.py` from the Kaggle map runs. Expected tiles = official India boundary (DataMeet, CC BY 2.5 IN) on the 10 m / 512 px grid, split at 23.6° N._

| Half | Expected tiles | Mapped (ok) | Cloudy in all seasons | No imagery | Error | Never processed | Pixel IoU vs OSM | Flagged tiles | Season used (ok tiles) |
|---|---|---|---|---|---|---|---|---|---|
| south | 65,166 | 64,327 | 122 | 167 | 550 | 0 | 0.252 | 5,587 | 2026_pre_monsoon: 62,510, 2025_pre_monsoon: 1,515, 2024_pre_monsoon: 302 |
| north | 63,741 | 63,183 | 203 | 355 | 0 | 0 | 0.232 | 8,210 | 2026_pre_monsoon: 60,985, 2025_pre_monsoon: 1,683, 2024_pre_monsoon: 515 |

**Unprocessed or failed tiles: 550** (22 blocks listed in `data_cache/outputs/india/rerun_blocks.json` for a re-run). The map is not complete until this is 0.

Tiles that are cloudy in all three pre-monsoon seasons, or have no imagery, are real data gaps of Sentinel-2 optical imagery (Sentinel-1 radar is the planned fill, CP2) — they are shown, not guessed.

## Accuracy flags

- `low_osm_agreement`: OSM has ≥ 500 road pixels in the tile but pixel IoU with our roads < 0.1 — 13,072 tiles.
- `possible_false_roads`: OSM has < 100 road pixels but we draw > 5000 — 725 tiles (either OSM is unmapped there, or false roads).

OSM is a consistency reference, not ground truth: its coverage varies by state. Flagged tiles are listed in `data_cache/outputs/india/coverage.parquet` (`flag` column) for review.

![coverage](india_coverage.png)
