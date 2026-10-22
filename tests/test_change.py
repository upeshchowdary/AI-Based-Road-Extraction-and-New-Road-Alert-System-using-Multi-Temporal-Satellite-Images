import geopandas as gpd
from shapely.geometry import LineString, box

from roadwatch.change.detect import ChangeParams, detect_new_roads

SEASONS = ["2022_pre_monsoon", "2022_post_monsoon", "2023_pre_monsoon", "2024_pre_monsoon",
           "2025_pre_monsoon"]
OLD = LineString([(0, 0), (2000, 0)])          # existing road
NEW = LineString([(1000, 0), (1000, 800)])     # built 2023, joins the old road
NOISE = LineString([(3000, 500), (3300, 500)])  # appears only in the latest season


def _gdf(*geoms):
    return gpd.GeoDataFrame({"confidence": [0.8] * len(geoms)}, geometry=list(geoms), crs=32644)


def _scenario():
    return {
        "2022_pre_monsoon": _gdf(OLD),
        "2022_post_monsoon": _gdf(OLD),
        "2023_pre_monsoon": _gdf(OLD, NEW),
        "2024_pre_monsoon": _gdf(OLD, NEW),
        "2025_pre_monsoon": _gdf(OLD, NEW, NOISE),
    }


def test_new_connected_persistent_road_is_found():
    out = detect_new_roads(_scenario(), SEASONS)
    assert len(out) == 1
    r = out.iloc[0]
    assert 750 <= r.length_m <= 800                     # the part outside the old road's buffer
    assert r.first_seen == "2023_pre_monsoon"
    assert r.seen == ["absent", "absent", "seen", "seen", "seen"]
    assert r.connectivity == 1.0 and r.persistence == 1.0 and r.quality == 1.0
    assert 0.79 <= r.score <= 0.81


def test_single_date_noise_is_rejected_by_persistence():
    out = detect_new_roads(_scenario(), SEASONS)
    assert all(abs(g.coords[0][0] - 3000) > 1 for g in out.geometry)


def test_cloudy_season_abstains_not_absent():
    lines = _scenario()
    lines["2024_pre_monsoon"] = _gdf(OLD)                # road hidden by cloud that season
    cloud = {"2024_pre_monsoon": box(900, -100, 1100, 900)}
    out = detect_new_roads(lines, SEASONS, abstain=cloud, p=ChangeParams(min_seen=2))
    r = out.iloc[0]
    assert r.seen[3] == "abstain"
    assert r.persistence == 1.0 and r.quality == 0.667    # 2 valid of 3 later seasons


def test_flickering_road_rejected_by_stability():
    lines = _scenario()
    lines["2024_pre_monsoon"] = _gdf(OLD)                # seen 2023, gone 2024 (no cloud), back 2025
    lines["2025_pre_monsoon"] = _gdf(OLD, NEW)
    out = detect_new_roads(lines, SEASONS, p=ChangeParams(min_seen=2, min_stability=0.75))
    assert len(out) == 0                                   # 2 of 3 seasons after appearing = 0.67


def test_season_with_no_roads_does_not_crash():
    # statewide shard 0 (2026-10-22): a block where the model found no road on one date -> NaN bounds
    lines = _scenario()
    lines["2024_pre_monsoon"] = gpd.GeoDataFrame({"confidence": []}, geometry=[], crs=32644)
    out = detect_new_roads(lines, SEASONS, p=ChangeParams(min_seen=2, min_stability=0.6))
    assert len(out) == 1 and out.iloc[0].seen[3] == "absent"


def test_short_segments_dropped():
    out = detect_new_roads(_scenario(), SEASONS, p=ChangeParams(min_length_m=900))
    assert len(out) == 0
