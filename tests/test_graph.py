import geopandas as gpd
import numpy as np
from affine import Affine
from skimage.morphology import skeletonize

from roadwatch.graph.extract import GraphParams, export, mask_to_lines, skeleton_graph

T = Affine(10, 0, 500_000, 0, -10, 1_800_000)  # 10 m pixels, UTM-like origin
CRS = "EPSG:32644"


def _prob(shape=(128, 128)):
    return np.zeros(shape, np.float32)


def test_straight_road_becomes_one_line_with_right_length():
    p = _prob()
    p[62:66, 10:118] = 0.9
    g = mask_to_lines(p, T, CRS)
    assert len(g) == 1
    assert abs(g.length_m.iloc[0] - 1070) < 40      # ~107 px * 10 m
    assert 0.85 <= g.confidence.iloc[0] <= 0.95
    assert g.crs.to_epsg() == 32644
    assert len(g.geometry.iloc[0].coords) <= 4       # simplified straight line


def test_cross_junction_gives_four_edges():
    p = _prob()
    p[62:66, 10:118] = 0.9
    p[10:118, 62:66] = 0.9
    g = mask_to_lines(p, T, CRS)
    assert len(g) == 4
    assert all(g.length_m > 400)


def test_short_spur_is_pruned():
    p = _prob()
    p[62:66, 10:118] = 0.9
    p[56:62, 40:43] = 0.9                            # 6 px stub sticking out
    g = mask_to_lines(p, T, CRS, GraphParams(min_spur_px=10))
    assert len(g) == 1


def test_noise_specks_removed():
    p = _prob()
    rng = np.random.default_rng(0)
    for _ in range(40):
        y, x = rng.integers(0, 126, 2)
        p[y:y + 2, x:x + 2] = 0.9                    # 4 px specks
    assert len(mask_to_lines(p, T, CRS)) == 0


def test_loop_without_junction_is_kept():
    yy, xx = np.mgrid[:128, :128]
    r = np.hypot(yy - 64, xx - 64)
    p = ((r > 38) & (r < 42)).astype(np.float32) * 0.8
    g = skeleton_graph(skeletonize(p > 0.5))
    assert g.number_of_edges() >= 1


def test_export_roundtrip(tmp_path):
    p = _prob()
    p[62:66, 10:118] = 0.9
    g = mask_to_lines(p, T, CRS)
    paths = export(g, tmp_path / "roads")
    assert {x.suffix for x in paths} == {".geojson", ".gpkg", ".shp"}
    back = gpd.read_file(tmp_path / "roads.gpkg")
    assert back.crs.to_epsg() == 32644 and len(back) == 1
    assert gpd.read_file(tmp_path / "roads.geojson").crs.to_epsg() == 4326
