"""Mandatory negative tests NT-1..NT-5 (PROJECT_PROMPT 8.1; KL charter CLIMATE-06 'negative-test campaign').

Each test builds a controlled fixture that triggers the failure, then checks the system's safe
response: abstain, refuse, or not alert - never a silent wrong result. Evidence (expected vs
observed) is recorded through the `evidence` fixture (see conftest.py, scripts/negative_report.py).
"""

from __future__ import annotations

import geopandas as gpd
import numpy as np
import pytest
from rasterio.transform import from_origin
from shapely.geometry import LineString, box

from roadwatch.change.detect import detect_new_roads
from roadwatch.data.grid import TileKey
from roadwatch.graph.extract import mask_to_lines
from roadwatch.qa.checks import check_grid, check_registration, check_valid

S = ["2022_pre_monsoon", "2022_post_monsoon", "2023_pre_monsoon", "2024_pre_monsoon",
     "2025_pre_monsoon", "2026_pre_monsoon"]
OLD = LineString([(0, 0), (3000, 0)])            # existing road
NEW = LineString([(1500, 0), (1500, 900)])       # genuinely new road, joins the old one
TF = from_origin(500000, 1800000, 10, 10)        # 10 m pixels, UTM 44N


def gdf(*geoms, crs=32644):
    return gpd.GeoDataFrame({"confidence": [0.8] * len(geoms)}, geometry=list(geoms), crs=crs)


def road_prob(h=120, w=400, row=60, half=2):
    p = np.zeros((h, w), np.float32)
    p[row - half:row + half + 1, 10:w - 10] = 0.95
    return p


# ---------------------------------------------------------------- NT-1 occlusion (trees / shadows)
def test_nt1_occlusion_gap_keeps_road_length(evidence):
    """A tree crown hides 6 px (60 m) of a 380 px road: the road must still be extracted."""
    prob = road_prob()
    prob[50:71, 200:206] = 0.05                       # occluder across the road
    lines = mask_to_lines(prob, TF, "EPSG:32644")
    kept = lines.length_m.sum() / 3800
    evidence.update(nt="NT-1", case="6-px occlusion across a 3.8 km road (single date)",
                    expected="road still extracted (>= 90% of its length); no spurious branches",
                    observed=f"{len(lines)} segments, {kept:.0%} of length kept")
    assert kept >= 0.9


def test_nt1_occluded_existing_road_is_not_a_new_road(evidence):
    """An existing road hidden under trees on later dates, then visible again, must not alert."""
    mid_hidden = gdf(LineString([(0, 0), (1200, 0)]), LineString([(1800, 0), (3000, 0)]))
    lines = {S[0]: gdf(OLD), S[1]: gdf(OLD), S[2]: mid_hidden, S[3]: mid_hidden,
             S[4]: gdf(OLD), S[5]: gdf(OLD)}
    out = detect_new_roads(lines, S)
    evidence.update(nt="NT-1", case="existing road 600 m occluded on 2 later dates",
                    expected="0 alerts (the road is in the 2022 baseline)", observed=f"{len(out)} alerts")
    assert out.empty


def test_nt1_new_road_survives_one_occluded_date(evidence):
    """A real new road hidden on one date (seen, hidden, seen, seen) must still alert."""
    lines = {S[0]: gdf(OLD), S[1]: gdf(OLD), S[2]: gdf(OLD, NEW), S[3]: gdf(OLD),
             S[4]: gdf(OLD, NEW), S[5]: gdf(OLD, NEW)}
    out = detect_new_roads(lines, S)
    evidence.update(nt="NT-1", case="new road occluded on 1 of 4 later dates",
                    expected="1 alert; the occluded date counts against stability, not as removal",
                    observed=f"{len(out)} alerts, seen={list(out.iloc[0].seen) if len(out) else '-'}")
    assert len(out) == 1 and out.iloc[0].first_seen == S[2]


# ---------------------------------------------------------------- NT-2 seasonal appearance
def test_nt2_seasonal_track_does_not_alert(evidence):
    """A mud track / crop boundary that comes and goes with the seasons must not alert."""
    track = LineString([(500, 2000), (1500, 2000)])
    dry_only = {S[0]: gdf(OLD), S[1]: gdf(OLD), S[2]: gdf(OLD, track), S[3]: gdf(OLD),
                S[4]: gdf(OLD), S[5]: gdf(OLD, track)}
    flicker = {S[0]: gdf(OLD), S[1]: gdf(OLD), S[2]: gdf(OLD), S[3]: gdf(OLD, track),
               S[4]: gdf(OLD), S[5]: gdf(OLD, track)}
    a, b = detect_new_roads(dry_only, S), detect_new_roads(flicker, S)
    evidence.update(nt="NT-2", case="track on 2 of 4 later dates (seen-gone-gone-seen; gone-seen-gone-seen)",
                    expected="0 alerts: a new road must be seen on >= 3 later dates and stay",
                    observed=f"{len(a)} + {len(b)} alerts")
    assert a.empty and b.empty


def test_nt2_limit_three_of_four_sightings(evidence):
    """Documented limit: with only 4 later dates, a track seen 3 of 4 times looks like a real road
    hidden once by trees (NT-1). It alerts; more dates per year (Enhancement Pack C) narrow this."""
    track = LineString([(500, 2000), (1500, 2000)])
    lines = {S[0]: gdf(OLD), S[1]: gdf(OLD), S[2]: gdf(OLD, track), S[3]: gdf(OLD),
             S[4]: gdf(OLD, track), S[5]: gdf(OLD, track)}
    out = detect_new_roads(lines, S)
    evidence.update(nt="NT-2", case="seasonal track on 3 of 4 later dates (residual risk)",
                    expected="alerts (indistinguishable from an occluded new road with 4 dates) - "
                             "left to human review; fix = more dates (Pack C)",
                    observed=f"{len(out)} alert(s), stability rule at its 0.75 boundary")
    assert len(out) == 1


# ---------------------------------------------------------------- NT-3 change vs noise
def test_nt3_speckle_noise_gives_no_roads(evidence):
    """Isolated high-probability pixels (sensor / model noise) must not become road lines."""
    rng = np.random.default_rng(1564)
    prob = np.zeros((300, 300), np.float32)
    idx = rng.choice(prob.size, size=prob.size // 100, replace=False)   # 1% salt noise
    prob.flat[idx] = 0.95
    lines = mask_to_lines(prob, TF, "EPSG:32644")
    evidence.update(nt="NT-3", case="1% isolated noise pixels at p=0.95 on a 3 km x 3 km tile",
                    expected="0 road lines (specks below 30 px are removed)", observed=f"{len(lines)} lines")
    assert lines.empty


def test_nt3_single_date_change_is_not_an_alert(evidence):
    """Something that looks like a road on the latest date only is noise until it persists."""
    blip = LineString([(4000, 500), (4500, 500)])
    lines = {S[0]: gdf(OLD), S[1]: gdf(OLD), S[2]: gdf(OLD), S[3]: gdf(OLD), S[4]: gdf(OLD),
             S[5]: gdf(OLD, blip)}
    out = detect_new_roads(lines, S)
    evidence.update(nt="NT-3", case="500 m line on the latest date only",
                    expected="0 alerts (persistence: seen on >= 3 later dates)", observed=f"{len(out)} alerts")
    assert out.empty


# ---------------------------------------------------------------- NT-4 CRS / registration / time
def test_nt4_crs_mismatch_is_refused(evidence):
    lines = {s: gdf(OLD) for s in S}
    lines[S[3]] = gdf(OLD, crs=32643)
    with pytest.raises(ValueError, match="different CRS") as e:
        detect_new_roads(lines, S)
    evidence.update(nt="NT-4", case="one season in EPSG:32643, the rest in EPSG:32644",
                    expected="refuse (no alerts computed on mismatched coordinates)", observed=str(e.value))


def test_nt4_geographic_crs_is_refused(evidence):
    lines = {s: gdf(LineString([(80.6, 16.5), (80.7, 16.5)]), crs=4326) for s in S}
    with pytest.raises(ValueError, match="projected") as e:
        detect_new_roads(lines, S)
    evidence.update(nt="NT-4", case="lines in degrees (EPSG:4326)",
                    expected="refuse (buffers in metres would be wrong)", observed=str(e.value))


def test_nt4_out_of_order_dates_are_refused(evidence):
    lines = {s: gdf(OLD) for s in S}
    shuffled = [S[0], S[1], S[3], S[2], S[4], S[5]]
    with pytest.raises(ValueError, match="time order") as e:
        detect_new_roads(lines, shuffled)
    evidence.update(nt="NT-4", case="2024 passed before 2023",
                    expected="refuse (first-seen dates would be wrong)", observed=str(e.value))


def test_nt4_misregistered_image_fails_quality_gate(evidence):
    rng = np.random.default_rng(7)
    ref = rng.integers(20, 255, (256, 256)).astype(np.uint8)
    ref = (ref.astype(np.float32) + np.roll(ref, 1, 0) + np.roll(ref, 1, 1)) / 3   # some texture
    moved = np.roll(ref, (3, 2), axis=(0, 1))                                         # 3.6 px shift
    bad, good = check_registration(ref, moved, 0.5), check_registration(ref, ref, 0.5)
    evidence.update(nt="NT-4", case="same scene shifted by (3, 2) px",
                    expected="registration gate fails (> 0.5 px) for the shifted image, passes for the aligned one",
                    observed=f"shifted: {bad.value} px passed={bad.passed}; aligned: {good.value} px passed={good.passed}")
    assert not bad.passed and good.passed


def test_nt4_off_grid_tile_fails_quality_gate(evidence):
    key = TileKey.parse("T32644_10m_512_0097_0353")
    from roadwatch.data.sentinel2 import tile_transform

    t = tuple(tile_transform(key))[:6]
    wrong_crs = check_grid("EPSG:32643", t, (512, 512), key)
    shifted = check_grid(f"EPSG:{key.epsg}", (t[0], t[1], t[2] + 5, t[3], t[4], t[5]), (512, 512), key)
    evidence.update(nt="NT-4", case="tile written in the wrong UTM zone / half a pixel off the grid",
                    expected="grid gate fails -> tile marked unreliable (abstain)",
                    observed=f"wrong CRS passed={wrong_crs.passed}; shifted origin passed={shifted.passed}")
    assert not wrong_crs.passed and not shifted.passed


# ---------------------------------------------------------------- NT-5 cloud / season / geography shift
def test_nt5_cloudy_tile_is_marked_unreliable(evidence):
    r = check_valid(valid_fraction=0.45, cloud_fraction=0.6, max_cloud=0.3)
    evidence.update(nt="NT-5", case="composite with 55% cloud/no-data",
                    expected="cloud gate fails -> registry status reserved (cloudy) -> abstain",
                    observed=f"bad fraction {r.value} > {r.threshold}: passed={r.passed}")
    assert not r.passed


def test_nt5_cloudy_dates_abstain_never_absent(evidence):
    """Cloud on 2 of 4 later dates: those dates are 'abstain', and too little evidence means no alert."""
    lines = {S[0]: gdf(OLD), S[1]: gdf(OLD), S[2]: gdf(OLD, NEW), S[3]: gdf(OLD),
             S[4]: gdf(OLD), S[5]: gdf(OLD, NEW)}
    cloud = box(1000, -100, 2000, 1000)
    out = detect_new_roads(lines, S, abstain={S[3]: cloud, S[4]: cloud})
    one = detect_new_roads({**lines, S[4]: gdf(OLD, NEW)}, S, abstain={S[3]: cloud})
    evidence.update(nt="NT-5", case="new road under cloud on 2 later dates; then on 1 later date",
                    expected="2 cloudy dates: no alert (only 2 clear sightings); 1 cloudy date: alert with "
                             "'abstain' in its history and quality < 1",
                    observed=f"{len(out)} alerts; {len(one)} alert, seen={list(one.iloc[0].seen) if len(one) else '-'}, "
                             f"quality={one.iloc[0].quality if len(one) else '-'}")
    assert out.empty
    assert len(one) == 1 and "abstain" in one.iloc[0].seen and one.iloc[0].quality < 1
