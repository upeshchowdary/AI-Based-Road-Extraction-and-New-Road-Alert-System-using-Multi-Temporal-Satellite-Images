"""KPI-1 graph metric: APLS of the Tier-1 road maps on holdout zones A-C vs OpenStreetMap.

Usage: uv run python scripts/apls_report.py [--model s2_model_full_s0_6e9081638291] [--season 2026_pre_monsoon]
Reference = OSM roads in the zone (Geofabrik extract), all vehicle classes and major roads only (tertiary
and above: 10 m pixels cannot resolve most residential lanes). Writes reports/apls_zones.md + .json.
"""

from __future__ import annotations

import argparse
import json
import sys
from datetime import UTC, datetime
from pathlib import Path

import geopandas as gpd
import pyogrio
from shapely.geometry import box

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "src"))
from roadwatch.config import load_config  # noqa: E402
from roadwatch.graph.extract import close_gaps  # noqa: E402
from roadwatch.labels.osm import ROAD_CLASSES  # noqa: E402
from roadwatch.qa.apls import APLSParams, apls  # noqa: E402

MAJOR = ("motorway", "trunk", "primary", "secondary", "tertiary", "motorway_link", "trunk_link",
         "primary_link", "secondary_link", "tertiary_link")


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--model", default="s2_model_full_s0_6e9081638291")
    ap.add_argument("--season", default="2026_pre_monsoon")
    ap.add_argument("--pbf", type=Path, default=ROOT / "data_cache" / "osm" / "southern-zone-latest.osm.pbf")
    a = ap.parse_args()
    cfg = load_config(ROOT / "configs" / "pilot.yaml")
    p = APLSParams()
    where = "highway IN (" + ",".join(f"'{c}'" for c in ROAD_CLASSES) + ")"
    rows = {}
    for z in cfg.aoi.zones:
        pred = gpd.read_file(ROOT / "data_cache" / "outputs" / a.model / z.name / a.season / "roads.gpkg")
        crs = pred.crs
        osm = pyogrio.read_dataframe(a.pbf, layer="lines", bbox=tuple(z.bbox), where=where,
                                     columns=["highway"]).set_crs(4326, allow_override=True).to_crs(crs)
        clip = gpd.GeoSeries([box(*z.bbox)], crs=4326).to_crs(crs).iloc[0]
        osm = osm.clip(clip)
        pred = pred.clip(clip)
        res = {}
        closed = close_gaps(pred)  # ADR-028: dangling ends joined within 30 m (3 px), direction-checked
        for name, ref in (("all roads", osm), ("major roads", osm[osm.highway.isin(MAJOR)])):
            for variant, lines in (("", pred), (" + gap closing", closed)):
                r = apls(list(ref.geometry), list(lines.geometry), p)
                res[name + variant] = r | {"ref_km": round(float(ref.length.sum()) / 1000, 1)}
                print(f"{z.name} {name}{variant}: APLS {r['apls']:.3f} (ref->prop {r['ref_to_prop']:.3f}, "
                      f"prop->ref {r['prop_to_ref']:.3f}, {r['pairs']} pairs)", flush=True)
        rows[z.name] = res | {"pred_km": round(float(pred.length.sum()) / 1000, 1),
                              "gap_links": int(closed.gap_fill.sum())}
    payload = {"generated_utc": datetime.now(UTC).isoformat(timespec="seconds"), "model": a.model,
               "season": a.season, "params": p.__dict__, "zones": rows}
    (ROOT / "reports" / "apls_zones.json").write_text(json.dumps(payload, indent=1, default=float), encoding="utf-8")
    md = ["# KPI-1 graph metric — APLS on holdout zones A–C", "",
          f"_Generated {datetime.now(UTC).date().isoformat()} by `scripts/apls_report.py`. Model `{a.model}`, "
          f"season {a.season}. Reference = OpenStreetMap roads in the zone (© OpenStreetMap contributors, ODbL). "
          f"APLS = harmonic mean of both directions; control points every {p.step_m:.0f} m, snap ≤ {p.snap_m:.0f} m, "
          f"{p.n_pairs} pairs per direction, paths ≥ {p.min_path_m:.0f} m (`src/roadwatch/qa/apls.py`)._", "",
          "| Zone | Reference | OSM km | Our km | APLS | ref → ours | ours → ref |", "|---|---|---|---|---|---|---|"]
    for zn, res in rows.items():
        for name in ("all roads", "all roads + gap closing", "major roads", "major roads + gap closing"):
            r = res[name]
            md.append(f"| {zn} | {name} | {r['ref_km']} | {res['pred_km']} | **{r['apls']:.3f}** | "
                      f"{r['ref_to_prop']:.3f} | {r['prop_to_ref']:.3f} |")
    md += ["", "Gap closing (ADR-028): links added per zone — "
           + ", ".join(f"{zn} {res['gap_links']}" for zn, res in rows.items()) + "."]
    md += ["", "**Reading it:** *ref → ours* asks whether routes on the real network can be driven on our map "
           "(low = missing or broken roads); *ours → ref* asks whether routes on our map exist for real (low = false "
           "or wrongly connected roads). Against all OSM roads the score is held down by residential lanes that "
           "10 m pixels cannot resolve; the major-road row is the fairer reading for a Sentinel-2 model.", ""]
    (ROOT / "reports" / "apls_zones.md").write_text("\n".join(md), encoding="utf-8")
    print("wrote reports/apls_zones.md")
    return 0


if __name__ == "__main__":
    sys.exit(main())
