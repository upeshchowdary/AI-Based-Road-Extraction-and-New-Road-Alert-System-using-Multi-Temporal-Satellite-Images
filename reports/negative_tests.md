# Negative tests NT-1 to NT-5 (charter CLIMATE-06, PROJECT_PROMPT 8.1)

_Generated 2026-10-18T08:37:55+00:00 by `scripts/negative_report.py` from `tests/negative/`. Result: **14/14 passed** (pytest exit 0)._

Each test builds a controlled fixture that triggers the failure and checks the safe response (abstain, refuse, or no alert) instead of a silent wrong result.

## NT-1 — Occlusion (trees / shadows)

- **Trigger:** Road partly hidden in one image; existing road hidden on some dates; new road hidden on one date.
- **Expected safe behaviour:** Extraction keeps the road; an occluded existing road never becomes a 'new road'; a real new road survives one hidden date.
- **Recovery:** Re-run extraction on the next clear season; persistence over dates absorbs single-date occlusion.
- **Residual risk:** A new road hidden on most dates (dense canopy) is missed - recall loss, not a false alert.

| Test | Case | Expected | Observed | Result | Time |
|---|---|---|---|---|---|
| `test_nt1_occlusion_gap_keeps_road_length` | 6-px occlusion across a 3.8 km road (single date) | road still extracted (>= 90% of its length); no spurious branches | 2 segments, 96% of length kept | ✅ pass | 0.03 s |
| `test_nt1_occluded_existing_road_is_not_a_new_road` | existing road 600 m occluded on 2 later dates | 0 alerts (the road is in the 2022 baseline) | 0 alerts | ✅ pass | 0.09 s |
| `test_nt1_new_road_survives_one_occluded_date` | new road occluded on 1 of 4 later dates | 1 alert; the occluded date counts against stability, not as removal | 1 alerts, seen=['absent', 'absent', 'seen', 'absent', 'seen', 'seen'] | ✅ pass | 0.03 s |

## NT-2 — Seasonal appearance (mud tracks, crop boundaries)

- **Trigger:** A line that appears and disappears with the seasons.
- **Expected safe behaviour:** No alert unless seen on >= 3 later dates and staying (stability >= 0.75).
- **Recovery:** Human review rejects the alert; the rejection is stored as a training label (ADR-022).
- **Residual risk:** With 4 later dates, a track seen 3 times is indistinguishable from an occluded road and alerts; more dates per year (Enhancement Pack C) narrow this.

| Test | Case | Expected | Observed | Result | Time |
|---|---|---|---|---|---|
| `test_nt2_seasonal_track_does_not_alert` | track on 2 of 4 later dates (seen-gone-gone-seen; gone-seen-gone-seen) | 0 alerts: a new road must be seen on >= 3 later dates and stay | 0 + 0 alerts | ✅ pass | 0.05 s |
| `test_nt2_limit_three_of_four_sightings` | seasonal track on 3 of 4 later dates (residual risk) | alerts (indistinguishable from an occluded new road with 4 dates) - left to human review; fix = more dates (Pack C) | 1 alert(s), stability rule at its 0.75 boundary | ✅ pass | 0.02 s |

## NT-3 — Change versus noise

- **Trigger:** Isolated noisy pixels; a road-like line on one date only.
- **Expected safe behaviour:** Specks are removed before graph extraction; single-date lines never alert (persistence).
- **Recovery:** Nothing to recover: the noise never enters the alert list.
- **Residual risk:** Larger coherent noise blobs (e.g. a ploughed strip) can still pass extraction; persistence then decides.

| Test | Case | Expected | Observed | Result | Time |
|---|---|---|---|---|---|
| `test_nt3_speckle_noise_gives_no_roads` | 1% isolated noise pixels at p=0.95 on a 3 km x 3 km tile | 0 road lines (specks below 30 px are removed) | 0 lines | ✅ pass | 0.01 s |
| `test_nt3_single_date_change_is_not_an_alert` | 500 m line on the latest date only | 0 alerts (persistence: seen on >= 3 later dates) | 0 alerts | ✅ pass | 0.02 s |

## NT-4 — CRS / registration / temporal mismatch

- **Trigger:** Seasons in different UTM zones; degrees instead of metres; dates out of order; image shifted by pixels; tile off the grid.
- **Expected safe behaviour:** Change detection refuses mismatched or unordered inputs (error, no alerts); quality gates fail shifted or off-grid tiles -> marked unreliable.
- **Recovery:** Reproject / re-sort / rebuild the tile on the grid (s2-build is idempotent per tile), then re-run.
- **Residual risk:** The registration gate is tested and measured (KPI-6) but not yet enforced per tile inside s2-build - planned.

| Test | Case | Expected | Observed | Result | Time |
|---|---|---|---|---|---|
| `test_nt4_crs_mismatch_is_refused` | one season in EPSG:32643, the rest in EPSG:32644 | refuse (no alerts computed on mismatched coordinates) | NT-4: seasons are in different CRS ['EPSG:32643', 'EPSG:32644']; reproject before comparing | ✅ pass | 0.01 s |
| `test_nt4_geographic_crs_is_refused` | lines in degrees (EPSG:4326) | refuse (buffers in metres would be wrong) | NT-4: change detection needs a projected (metric) CRS, got EPSG:4326 | ✅ pass | 0.01 s |
| `test_nt4_out_of_order_dates_are_refused` | 2024 passed before 2023 | refuse (first-seen dates would be wrong) | NT-4: seasons must be in time order, got ['2022_pre_monsoon', '2022_post_monsoon', '2024_pre_monsoon', '2023_pre_monsoon', '2025_pre_monsoon', '2026_pre_monsoon'] | ✅ pass | 0.01 s |
| `test_nt4_misregistered_image_fails_quality_gate` | same scene shifted by (3, 2) px | registration gate fails (> 0.5 px) for the shifted image, passes for the aligned one | shifted: 3.606 px passed=False; aligned: 0.0 px passed=True | ✅ pass | 0.02 s |
| `test_nt4_off_grid_tile_fails_quality_gate` | tile written in the wrong UTM zone / half a pixel off the grid | grid gate fails -> tile marked unreliable (abstain) | wrong CRS passed=False; shifted origin passed=False | ✅ pass | 0.26 s |

## NT-5 — Cloud / terrain / season / sensor / geography shift

- **Trigger:** Cloudy composite; new road under cloud on some later dates.
- **Expected safe behaviour:** Cloudy tiles are reserved (abstain); cloudy dates count as 'abstain', never 'absent'; too few clear sightings -> no alert; alerts carry quality < 1.
- **Recovery:** Next clear season fills the gap; Sentinel-1 radar for monsoon dates (CP2).
- **Residual risk:** Model shift to unseen geography (e.g. Rayalaseema dry land) is not covered by a unit test; measured instead by the per-region KPI-1 table and the statewide v2 model.

| Test | Case | Expected | Observed | Result | Time |
|---|---|---|---|---|---|
| `test_nt5_cloudy_tile_is_marked_unreliable` | composite with 55% cloud/no-data | cloud gate fails -> registry status reserved (cloudy) -> abstain | bad fraction 0.55 > 0.3: passed=False | ✅ pass | 0.00 s |
| `test_nt5_cloudy_dates_abstain_never_absent` | new road under cloud on 2 later dates; then on 1 later date | 2 cloudy dates: no alert (only 2 clear sightings); 1 cloudy date: alert with 'abstain' in its history and quality < 1 | 0 alerts; 1 alert, seen=['absent', 'absent', 'seen', 'abstain', 'seen', 'seen'], quality=0.75 | ✅ pass | 0.02 s |
