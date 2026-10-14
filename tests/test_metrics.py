import pandas as pd
import pytest

from roadwatch.qa.metrics import bootstrap


def test_point_estimate_matches_pooled_counts():
    df = pd.DataFrame({"tp": [50, 30, 20], "fp": [10, 5, 5], "fn": [10, 5, 15]})
    r = bootstrap(df, n_boot=500)
    tp, fp, fn = 100, 20, 30
    assert r["iou"].value == pytest.approx(tp / (tp + fp + fn))
    assert r["precision"].value == pytest.approx(tp / (tp + fp))
    assert r["recall"].value == pytest.approx(tp / (tp + fn))
    for m in r.values():
        assert m.lo <= m.value <= m.hi


def test_ci_narrows_with_more_images():
    small = pd.DataFrame({"tp": [50, 10] * 5, "fp": [10, 30] * 5, "fn": [5, 20] * 5})
    big = pd.concat([small] * 20, ignore_index=True)
    w_small = bootstrap(small)["iou"]
    w_big = bootstrap(big)["iou"]
    assert (w_big.hi - w_big.lo) < (w_small.hi - w_small.lo)


def test_deterministic():
    df = pd.DataFrame({"tp": [5, 9, 1, 4], "fp": [1, 2, 3, 4], "fn": [2, 2, 2, 2]})
    assert bootstrap(df)["f1"] == bootstrap(df)["f1"]
