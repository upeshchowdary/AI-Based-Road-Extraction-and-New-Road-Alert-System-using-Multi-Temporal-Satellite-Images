"""Sanity check for change detection: how much of a known new road do the alerts recover?

Reference: OpenStreetMap geometry of the Vijayawada West Bypass inside zone A
(web/public/data/zoneA/road_new_reference.json). Reports recall (share of the reference length
within `--tol` metres of an alert) and how many alerts touch it. Precision needs dated ground
truth (OSM edit history, CP2) and is NOT measured here.

Usage: uv run python scripts/eval_bypass.py [--tol 40]
"""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

import geopandas as gpd
from shapely.geometry import LineString
from shapely.ops import unary_union

ROOT = Path(__file__).resolve().parents[1]


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--tol", type=float, default=40.0)
    a = ap.parse_args()
    ref = gpd.read_file(ROOT / "web/public/data/zoneA/road_new_reference.json").to_crs(32644)
    alerts = json.loads((ROOT / "data_cache/outputs/alerts/alerts.json").read_text(encoding="utf-8"))
    za = [x for x in alerts["alerts"] if x["zone"] == "A"]
    if not za:
        print("no zone A alerts")
        return 1
    ag = gpd.GeoDataFrame({"score": [x["score"] for x in za], "id": [x["id"] for x in za]},
                          geometry=[LineString(x["geometry"]["coordinates"]) for x in za],
                          crs=4326).to_crs(32644)
    ref_line = unary_union(list(ref.geometry))
    near = unary_union(list(ag.geometry)).buffer(a.tol)
    covered = ref_line.intersection(near).length
    touching = ag[ag.distance(ref_line) <= a.tol]
    print(f"bypass length in zone A : {ref_line.length / 1000:.2f} km")
    recall = covered / ref_line.length
    print(f"recovered by alerts     : {covered / 1000:.2f} km  -> recall {recall:.1%} (tol {a.tol:.0f} m)")
    print(f"alerts touching bypass  : {len(touching)} of {len(ag)} zone-A alerts, "
          f"{touching.length.sum() / 1000:.2f} km, mean score {touching.score.mean():.2f} "
          f"(all zone-A alerts mean {ag.score.mean():.2f})")
    return 0


if __name__ == "__main__":
    sys.exit(main())
