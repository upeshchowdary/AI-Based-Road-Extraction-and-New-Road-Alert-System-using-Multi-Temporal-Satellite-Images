"""KPI-2/3 evaluation logic on synthetic geometry with known answers."""

import geopandas as gpd
import numpy as np
from rasterio.transform import from_origin
from shapely.geometry import LineString

from roadwatch.qa.change_eval import (
    EvalParams,
    bootstrap_share,
    classify,
    ground_truth,
    line_points,
    pixel_diff_blobs,
    recall_length,
)

CRS = 32644
P = EvalParams()
BOUNDS = (0, 0, 3000, 3000)


def gdf(*lines):
    return gpd.GeoDataFrame(geometry=list(lines), crs=CRS)


OLD = gdf(LineString([(0, 1000), (3000, 1000)]))                       # mapped before 2022
NOW = gdf(LineString([(0, 1000), (3000, 1000)]), LineString([(1500, 1000), (1500, 2500)]),
          LineString([(100, 100), (150, 100)]))                       # + a new road, + a 50 m stub


def test_ground_truth_keeps_only_new_long_pieces():
    gt = ground_truth(OLD, NOW, P)
    assert len(gt) == 1                                   # the 50 m stub is below min_length_m
    assert 1450 <= gt.length.sum() <= 1500                # new road minus the 25 m buffer at the junction


def test_classify_confirmed_false_unverified():
    gt = ground_truth(OLD, NOW, P)
    on_new = line_points(LineString([(1510, 1200), (1510, 2000)]))    # 10 m off the new road
    on_old = line_points(LineString([(200, 1005), (900, 1005)]))      # along the pre-2022 road
    nowhere = line_points(LineString([(2500, 2500), (2900, 2900)]))
    assert classify([on_new, on_old, nowhere, np.empty((0, 2))], gt, OLD, BOUNDS, P) == [
        "confirmed", "known_false", "unverified", "unverified"]


def test_recall_by_length():
    gt = ground_truth(OLD, NOW, P)
    half = line_points(LineString([(1500, 1030), (1500, 1760)]))      # covers about half of the new road
    r = recall_length(gt, [half], BOUNDS, P)
    assert 0.45 < r < 0.6
    assert recall_length(gt, [], BOUNDS, P) == 0.0


def test_pixel_diff_blobs_and_tolerance():
    t = from_origin(0, 100, 10, 10)
    base = np.zeros((10, 10), np.float32)
    base[5, :] = 0.9                                      # an old road
    latest = base.copy()
    latest[6, :] = 0.9                                    # same road, shifted one pixel (misregistration)
    latest[0:3, 0:4] = 0.9                                # a genuinely new 12-pixel patch
    naive = pixel_diff_blobs([base], latest, t, min_px=10)
    assert len(naive) == 2                                # the shift shows up as a false "new road"
    tol = pixel_diff_blobs([base], latest, t, tolerance_px=1, min_px=10)
    assert len(tol) == 1 and len(tol[0]) == 12            # tolerance removes it; the new patch stays
    x, y = tol[0][0]
    assert (x, y) == (5.0, 95.0)                          # pixel centre in map coordinates


def test_bootstrap_share():
    v, lo, hi, n = bootstrap_share(["confirmed"] * 3 + ["known_false"] + ["unverified"] * 6,
                                   ("confirmed",), ("confirmed", "known_false"))
    assert n == 4 and v == 0.75 and lo <= v <= hi
    assert bootstrap_share([], ("confirmed",))[3] == 0
