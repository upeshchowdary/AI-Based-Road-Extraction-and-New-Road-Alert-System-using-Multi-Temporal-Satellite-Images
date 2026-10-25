"""Flag alerts that are probably not new roads (Phase 1 of docs/PLAN_accurate_road_change.md).

Usage:
  uv run python scripts/alert_flags.py                              # pilot-zone alerts (alerts_zones.json)
  uv run python scripts/alert_flags.py --extra data_cache/runs/statewide_v1_s0/alerts_s0.json ...
Writes / updates data_cache/outputs/alerts/alert_flags.json  {alert id: {flags, shares}}. The API attaches
them to each alert; flagged alerts are listed under "Flagged: probably not new". Nothing is deleted.

- existing_road_2022: >= 50 % of the alert lies within 25 m of a road OpenStreetMap already had before
  2022. Zones: the exact OSM snapshot of 2022-01-01 (ohsome full history). Elsewhere (statewide, cities):
  today's OSM minus ways first created after 2022-01-01 (version 1 with a later timestamp, Geofabrik
  extract) — an approximation: an old way edited later still counts as old, a way split/re-created after
  2022 counts as new. Roads OSM tags as "construction" are not road classes, so roads being built in
  2021-22 (e.g. RW-C001) are not flagged.
- short_in_builtup: shorter than 300 m and >= 50 % of a 30 m buffer is built-up in ESA WorldCover 2021
  (10 m, CC BY 4.0, via Planetary Computer): 10 m pixels cannot tell a lane from house roofs there.
"""

from __future__ import annotations

import argparse
import json
import math
import re
import sys
from collections import defaultdict
from pathlib import Path

import geopandas as gpd
import numpy as np
from shapely.geometry import shape

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "src"))
from roadwatch.config import load_config  # noqa: E402
from roadwatch.labels.osm import ROAD_CLASSES  # noqa: E402
from roadwatch.qa.change_eval import fetch_osm_history, line_points  # noqa: E402

ALERTS = ROOT / "data_cache" / "outputs" / "alerts" / "alerts_zones.json"
OUT = ROOT / "data_cache" / "outputs" / "alerts" / "alert_flags.json"
PBF = ROOT / "data_cache" / "osm" / "southern-zone-latest.osm.pbf"
T0, T1 = "2022-01-01", "2026-06-01"
NEAR_M, SHARE = 25.0, 0.5
SHORT_M, BUILT = 300.0, 0.5
CELL_DEG = 1.0  # one OSM extract scan (~40 s, whatever the bbox) per cell: big cells, few scans


def worldcover_builtup(bbox):
    """Built-up mask (class 50) of ESA WorldCover 2021 over a lon/lat bbox -> (mask, transform)."""
    import planetary_computer
    import pystac_client
    import rasterio
    from rasterio.merge import merge

    cat = pystac_client.Client.open("https://planetarycomputer.microsoft.com/api/stac/v1",
                                    modifier=planetary_computer.sign_inplace)
    items = list(cat.search(collections=["esa-worldcover"], bbox=bbox,
                            query={"esa_worldcover:product_version": {"eq": "2.0.0"}}).items())
    srcs = [rasterio.open(it.assets["map"].href) for it in items]
    arr, tr = merge(srcs, bounds=bbox)
    for s in srcs:
        s.close()
    return arr[0] == 50, tr  # WorldCover is EPSG:4326


def osm_old_roads(bbox) -> gpd.GeoDataFrame:
    """Roads OSM had before T0, approximated from today's extract + way version/timestamp (see docstring)."""
    import pyogrio

    conf_src = Path(pyogrio.__file__).parent / "gdal_data" / "osmconf.ini"
    conf = ROOT / "data_cache" / "osm" / "osmconf_dated.ini"
    if not conf.exists():
        txt = re.sub(r"osm_version=no", "osm_version=yes", conf_src.read_text())
        conf.write_text(re.sub(r"osm_timestamp=no", "osm_timestamp=yes", txt))
    pyogrio.set_gdal_config_options({"OSM_CONFIG_FILE": str(conf)})
    where = "highway IN (" + ",".join(f"'{c}'" for c in ROAD_CLASSES) + ")"
    r = pyogrio.read_dataframe(PBF, layer="lines", bbox=bbox, where=where,
                               columns=["highway", "osm_version", "osm_timestamp"])
    new = (r.osm_version.astype(int) == 1) & (r.osm_timestamp.astype(str).str[:10] > T0)
    return r[~new].set_crs(4326, allow_override=True)


def flag_group(alerts: list[dict], old_4326: gpd.GeoDataFrame, bbox) -> dict:
    """Flags for alerts that all lie inside `bbox` (lon/lat)."""
    g = gpd.GeoDataFrame({"id": [a["id"] for a in alerts]},
                         geometry=[shape(a["geometry"]) for a in alerts], crs=4326)
    utm = g.estimate_utm_crs()
    gm = g.to_crs(utm)
    # one buffer per old road + spatial index (a union of a whole 1-degree cell's roads is too slow)
    old_buf = old_4326.to_crs(utm).buffer(NEAR_M) if len(old_4326) else None
    built, tr = worldcover_builtup(bbox)
    inv = ~tr
    out = {}
    for i, a in enumerate(alerts):
        line = gm.geometry.iloc[i]
        pts = line_points(line, 10.0)
        ex = 0.0
        if old_buf is not None and len(pts):
            hit = old_buf.sindex.query(gpd.points_from_xy(pts[:, 0], pts[:, 1]), predicate="within")
            ex = len(np.unique(hit[0])) / len(pts)
        ring = g.geometry.iloc[i].buffer(30 / 111_000)  # ~30 m in degrees
        x0, y0, x1, y1 = ring.bounds
        c0, r0 = (int(v) for v in inv * (x0, y1))
        c1, r1 = (int(v) + 1 for v in inv * (x1, y0))
        sub = built[max(r0, 0):max(r1, 0), max(c0, 0):max(c1, 0)]
        bshare = float(sub.mean()) if sub.size else 0.0
        f = []
        if ex >= SHARE:
            f.append("existing_road_2022")
        if line.length < SHORT_M and bshare >= BUILT:
            f.append("short_in_builtup")
        out[a["id"]] = {"flags": f, "existing_road_share": round(ex, 3), "builtup_share": round(bshare, 3)}
    return out


def zones(flags: dict) -> None:
    alerts = json.loads(ALERTS.read_text(encoding="utf-8"))["alerts"]
    for z in load_config(ROOT / "configs" / "pilot.yaml").aoi.zones:
        code = z.name.split("_")[0]
        za = [a for a in alerts if a.get("zone") == code]
        if not za:
            continue
        old, _ = fetch_osm_history(tuple(z.bbox), T0, T1,
                                   ROOT / "data_cache" / "osm_history" / f"{z.name}_{T0}_{T1}.geojson")
        f = flag_group(za, old, tuple(z.bbox))
        flags.update(f)
        report(f"zone {code}", za, f)


def extra(paths: list[Path], flags: dict) -> None:
    """Statewide / city alert files: grouped into CELL_DEG cells, OSM read once per cell."""
    alerts = [a for p in paths for a in json.loads(p.read_text(encoding="utf-8"))["alerts"]]
    cells = defaultdict(list)
    for a in alerts:
        x, y = shape(a["geometry"]).centroid.coords[0]
        cells[(math.floor(x / CELL_DEG), math.floor(y / CELL_DEG))].append(a)
    for i, ((cx, cy), ca) in enumerate(sorted(cells.items())):
        b = [shape(a["geometry"]).bounds for a in ca]
        bbox = (min(v[0] for v in b) - 0.01, min(v[1] for v in b) - 0.01,
                max(v[2] for v in b) + 0.01, max(v[3] for v in b) + 0.01)
        f = flag_group(ca, osm_old_roads(bbox), bbox)
        flags.update(f)
        report(f"cell {i + 1}/{len(cells)} ({cx * CELL_DEG:.2f}, {cy * CELL_DEG:.2f})", ca, f)
        write(flags)  # progress survives an interrupted run


def report(name: str, alerts: list[dict], f: dict) -> None:
    n = sum(1 for a in alerts if f[a["id"]]["flags"])
    ex = sum("existing_road_2022" in f[a["id"]]["flags"] for a in alerts)
    sb = sum("short_in_builtup" in f[a["id"]]["flags"] for a in alerts)
    print(f"{name}: {len(alerts)} alerts, {n} flagged (existing road {ex}, short in built-up {sb})", flush=True)


def write(flags: dict) -> None:
    OUT.write_text(json.dumps({
        "sources": {"existing_road_2022": f"OpenStreetMap before {T0}: zones = ohsome snapshot; elsewhere = "
                                          "Geofabrik extract minus ways created after it (approximation)",
                    "short_in_builtup": "ESA WorldCover 2021 v200 (CC BY 4.0)"},
        "rules": {"near_m": NEAR_M, "share": SHARE, "short_m": SHORT_M, "builtup": BUILT},
        "alerts": flags}, indent=1), encoding="utf-8")


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--extra", nargs="*", type=Path, default=[], help="statewide / city alerts_*.json files")
    ap.add_argument("--skip-zones", action="store_true")
    a = ap.parse_args()
    flags = json.loads(OUT.read_text(encoding="utf-8"))["alerts"] if OUT.exists() else {}
    if not a.skip_zones:
        zones(flags)
    if a.extra:
        extra(a.extra, flags)
    write(flags)
    tot = sum(1 for v in flags.values() if v["flags"])
    print(f"wrote {OUT.relative_to(ROOT)}: {tot} of {len(flags)} alerts flagged")
    return 0


if __name__ == "__main__":
    sys.exit(main())
