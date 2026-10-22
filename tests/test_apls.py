"""APLS on networks with known answers."""

from shapely.geometry import LineString

from roadwatch.qa.apls import APLSParams, apls

GRID = [LineString([(0, y), (2000, y)]) for y in (0, 1000, 2000)] + \
       [LineString([(x, 0), (x, 2000)]) for x in (0, 1000, 2000)]
P = APLSParams(n_pairs=300)


def test_identical_networks_score_one():
    r = apls(GRID, GRID, P)
    assert r["apls"] > 0.999


def test_small_offset_still_scores_high():
    shifted = [LineString([(x + 5, y + 5) for x, y in g.coords]) for g in GRID]
    assert apls(GRID, shifted, P)["apls"] > 0.95


def test_broken_road_is_penalised_but_iou_like_overlap_would_not_be():
    # cut the middle vertical road and the middle horizontal road: ~5 % of length missing,
    # but many routes now need detours or are impossible
    cut = [g for g in GRID if g.coords[0] not in ((0, 1000), (1000, 0))]
    cut += [LineString([(0, 1000), (960, 1000)]), LineString([(1040, 1000), (2000, 1000)]),
            LineString([(1000, 0), (1000, 960)]), LineString([(1000, 1040), (1000, 2000)])]
    r = apls(GRID, cut, P)
    assert r["apls"] < 0.9


def test_empty_proposal_scores_zero():
    assert apls(GRID, [], P)["apls"] == 0.0
