"""Gap closing joins broken roads, not parallel ones (ADR-028)."""

import geopandas as gpd
from shapely.geometry import LineString

from roadwatch.graph.extract import close_gaps
from roadwatch.qa.apls import APLSParams, apls


def lines(*gs):
    return gpd.GeoDataFrame({"confidence": [0.8] * len(gs)}, geometry=list(gs), crs=32644)


def test_collinear_break_is_joined():
    out = close_gaps(lines(LineString([(0, 0), (500, 0)]), LineString([(520, 0), (1000, 0)])))
    assert int(out.gap_fill.sum()) == 1                    # one link per gap, not one from each side
    link = out[out.gap_fill].geometry.iloc[0]
    assert 19 <= link.length <= 21


def test_parallel_roads_are_not_stitched():
    out = close_gaps(lines(LineString([(0, 0), (500, 0)]), LineString([(0, 20), (500, 20)])))
    assert int(out.gap_fill.sum()) == 0


def test_gap_beyond_limit_left_alone_and_touching_ends_untouched():
    out = close_gaps(lines(LineString([(0, 0), (500, 0)]), LineString([(560, 0), (1000, 0)])))
    assert int(out.gap_fill.sum()) == 0                    # 60 m > 30 m
    out = close_gaps(lines(LineString([(0, 0), (500, 0)]), LineString([(500, 0), (1000, 0)])))
    assert int(out.gap_fill.sum()) == 0                    # already connected


def test_t_junction_gap_joined_and_apls_recovers():
    main = LineString([(0, 0), (2000, 0)])
    side = LineString([(1000, 25), (1000, 1000)])           # stops 25 m short of the main road
    ref = [main, LineString([(1000, 0), (1000, 1000)])]
    broken = lines(main, side)
    fixed = close_gaps(broken)
    assert int(fixed.gap_fill.sum()) == 1
    p = APLSParams(n_pairs=200)
    assert apls(ref, list(fixed.geometry), p)["apls"] > apls(ref, list(broken.geometry), p)["apls"] + 0.2
