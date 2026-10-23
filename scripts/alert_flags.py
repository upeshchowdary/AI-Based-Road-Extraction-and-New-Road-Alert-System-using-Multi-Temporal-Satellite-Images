"""Flag pilot-zone alerts that are probably not new roads (Phase 1 of docs/PLAN_accurate_road_change.md).

Usage: uv run python scripts/alert_flags.py
Writes data_cache/outputs/alerts/alert_flags.json  {alert id: {flags, existing_road_share, builtup_share}}.
The API attaches these to each alert; the Alerts page shows flagged alerts under "Needs review" instead of
the default list. Nothing is deleted.

- existing_road_2022: >= 50 % of the alert lies within 25 m of a road OpenStreetMap had on 2022-01-01
  (ohsome history, cached by scripts/change_eval_report.py). OSM's "construction" roads are not counted,
  so roads being built in 2021-22 (e.g. RW-C001) are not flagged.
- short_in_builtup: shorter than 300 m and >= 50 % of a 30 m buffer is built-up in ESA WorldCover 2021
  (10 m, CC BY 4.0, via Planetary Computer): 10 m pixels cannot tell a lane from house roofs there.
"""

from __future__ import annotations

import json
import sys
from pathlib import Path

import geopandas as gpd
import numpy as np
from shapely.geometry import shape

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "src"))
from roadwatch.config import load_config  # noqa: E402
from roadwatch.qa.change_eval import fetch_osm_history, line_points  # noqa: E402

ALERTS = ROOT / "data_cache" / "outputs" / "alerts" / "alerts_zones.json"
OUT = ROOT / "data_cache" / "outputs" / "alerts" / "alert_flags.json"
T0, T1 = "2022-01-01", "2026-06-01"
NEAR_M, SHARE = 25.0, 0.5
SHORT_M, BUILT = 300.0, 0.5


def worldcover_builtup(bbox):
    """Built-up mask (class 50) of ESA WorldCover 2021 over a lon/lat bbox -> (mask, transform, crs)."""
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
    crs = srcs[0].crs
    for s in srcs:
        s.close()
    return arr[0] == 50, tr, crs


def main() -> int:
    alerts = json.loads(ALERTS.read_text(encoding="utf-8"))["alerts"]
    cfg = load_config(ROOT / "configs" / "pilot.yaml")
    flags = {}
    for z in cfg.aoi.zones:
        code = z.name.split("_")[0]
        za = [a for a in alerts if a.get("zone") == code]
        if not za:
            continue
        g = gpd.GeoDataFrame({"id": [a["id"] for a in za]},
                             geometry=[shape(a["geometry"]) for a in za], crs=4326)
        utm = g.estimate_utm_crs()
        gm = g.to_crs(utm)
        old, _ = fetch_osm_history(tuple(z.bbox), T0, T1,
                                   ROOT / "data_cache" / "osm_history" / f"{z.name}_{T0}_{T1}.geojson")
        old_buf = old.to_crs(utm).buffer(NEAR_M).union_all() if len(old) else None
        built, tr, wcrs = worldcover_builtup(tuple(z.bbox))
        inv = ~tr
        gw = g.to_crs(wcrs)
        for i, a in enumerate(za):
            line = gm.geometry.iloc[i]
            pts = line_points(line, 10.0)
            from shapely.geometry import Point

            ex = float(np.mean([old_buf.contains(Point(p)) for p in pts])) if old_buf is not None and len(pts) else 0.0
            ring = gw.geometry.iloc[i].buffer(30 / 111_000)  # ~30 m in degrees (WorldCover is EPSG:4326)
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
            flags[a["id"]] = {"flags": f, "existing_road_share": round(ex, 3), "builtup_share": round(bshare, 3)}
        n = sum(1 for a in za if flags[a["id"]]["flags"])
        print(f"zone {code}: {len(za)} alerts, {n} flagged "
              f"(existing road {sum('existing_road_2022' in flags[a['id']]['flags'] for a in za)}, "
              f"short in built-up {sum('short_in_builtup' in flags[a['id']]['flags'] for a in za)})", flush=True)
    OUT.write_text(json.dumps({"sources": {"existing_road_2022": f"OpenStreetMap via ohsome, snapshot {T0}",
                                           "short_in_builtup": "ESA WorldCover 2021 v200 (CC BY 4.0)"},
                               "rules": {"near_m": NEAR_M, "share": SHARE, "short_m": SHORT_M, "builtup": BUILT},
                               "alerts": flags}, indent=1), encoding="utf-8")
    tot = sum(1 for v in flags.values() if v["flags"])
    print(f"wrote {OUT.relative_to(ROOT)}: {tot} of {len(flags)} alerts flagged")
    return 0


if __name__ == "__main__":
    sys.exit(main())
