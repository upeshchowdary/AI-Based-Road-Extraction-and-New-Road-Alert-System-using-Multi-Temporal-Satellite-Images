"""All-India map check (ADR-025): every expected tile accounted for, gaps explained, inaccurate tiles flagged.

Usage: uv run python scripts/india_check.py [--runs data_cache/runs] [--halves south,north]
Reads the fetched Kaggle outputs data_cache/runs/india_map_<half>_s*/tiles_*.parquet (+ roads_*.parquet)
and writes reports/india_map_check.md, reports/india_coverage.png and data_cache/outputs/india/rerun_blocks.json
(blocks to run again: never processed, or crashed).
"""

from __future__ import annotations

import argparse
import json
import sys
from datetime import UTC, datetime
from pathlib import Path

import geopandas as gpd
import numpy as np
import pandas as pd
import yaml
from shapely.geometry import box

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "src"))
from roadwatch.config import load_config  # noqa: E402
from roadwatch.data.grid import TileKey, tiles_frame  # noqa: E402

# a tile is flagged when OSM has a real network there but the model's roads barely agree with it,
# or when the model draws many roads where OSM has almost none (possible false roads)
LOW_IOU, MIN_OSM_PX = 0.10, 500
OVER_PRED_PX, MAX_OSM_PX_FOR_OVER = 5000, 100


def bid(k: TileKey) -> str:
    return f"{k.epsg % 100}{k.col // 5:04d}{k.row // 5:04d}"


def expected_tiles(half: str, split_lat: float) -> gpd.GeoDataFrame:
    """The same AOI construction as kaggle/india/run.py (simplify ~200 m, pad 500 m, cut at split_lat)."""
    cfg = load_config(ROOT / "configs" / "statewide.yaml")
    path = ROOT / "configs" / "boundaries" / "india_official.geojson"  # 10.7 MB: fetched, not committed
    if not path.exists():
        import urllib.request

        spec = yaml.safe_load((ROOT / "kaggle" / "india" / "runs.yaml").read_text(encoding="utf-8"))
        urllib.request.urlretrieve(spec["defaults"]["boundary_url"], path)
    india = gpd.read_file(path).to_crs(4326)
    india = india.geometry.union_all().buffer(0).simplify(0.002).buffer(0.005)
    cut = box(60, 0, 100, split_lat) if half == "south" else box(60, split_lat, 100, 40)
    t = tiles_frame(india.intersection(cut), cfg.aoi.grid)
    t["block"] = [bid(TileKey.parse(x)) for x in t.tile_id]
    t["half"] = half
    return t


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--runs", type=Path, default=ROOT / "data_cache" / "runs")
    ap.add_argument("--halves", default="south,north")
    a = ap.parse_args()
    spec = yaml.safe_load((ROOT / "kaggle" / "india" / "runs.yaml").read_text(encoding="utf-8"))
    split_lat = spec["defaults"]["split_lat"]
    halves = [h for h in a.halves.split(",") if h]

    exp = pd.concat([expected_tiles(h, split_lat) for h in halves], ignore_index=True)
    got = [pd.read_parquet(p) for h in halves for p in sorted(a.runs.glob(f"india_map_{h}_s*/tiles_*.parquet"))]
    got = pd.concat(got, ignore_index=True) if got else pd.DataFrame(columns=["tile_id", "status"])
    # a tile re-run after an error keeps its best row: ok > cloudy_all > no_imagery > error
    rank = {"ok": 0, "cloudy_all": 1, "no_imagery": 2, "error": 3}
    got = got.assign(_r=got.status.map(rank).fillna(9)).sort_values("_r").drop_duplicates("tile_id")
    m = exp.merge(got.drop(columns=["epsg", "col", "row", "block"], errors="ignore"), on="tile_id", how="left")
    m["status"] = m.status.fillna("missing")

    for c in ("osm_tp", "osm_fp", "osm_fn"):
        if c not in m:
            m[c] = np.nan
    osm_px = m.osm_tp + m.osm_fn
    pred_px = m.osm_tp + m.osm_fp
    m["osm_iou"] = m.osm_tp / (m.osm_tp + m.osm_fp + m.osm_fn).where(lambda s: s > 0)
    m["flag"] = ""
    m.loc[(m.status == "ok") & (osm_px >= MIN_OSM_PX) & (m.osm_iou < LOW_IOU), "flag"] = "low_osm_agreement"
    m.loc[(m.status == "ok") & (osm_px < MAX_OSM_PX_FOR_OVER) & (pred_px > OVER_PRED_PX), "flag"] = "possible_false_roads"

    out_dir = ROOT / "data_cache" / "outputs" / "india"
    out_dir.mkdir(parents=True, exist_ok=True)
    m.drop(columns="geometry").to_parquet(out_dir / "coverage.parquet")
    rerun = sorted(set(m.loc[m.status.isin(["missing", "error"]), "block"]))
    (out_dir / "rerun_blocks.json").write_text(json.dumps(rerun), encoding="utf-8")

    # coverage image: one dot per tile, coloured by status / flag
    try:
        import matplotlib

        matplotlib.use("Agg")
        import matplotlib.pyplot as plt

        colours = {"ok": "#2f7d4f", "cloudy_all": "#d9a400", "no_imagery": "#8a8a8a", "error": "#c0392b",
                   "missing": "#000000"}
        fig, ax = plt.subplots(figsize=(9, 10), dpi=110)
        cen = m.geometry.centroid
        for s, col in colours.items():
            sel = (m.status == s).to_numpy()
            if sel.any():
                ax.scatter(cen.x[sel], cen.y[sel], s=0.4, c=col, label=f"{s} ({int(sel.sum()):,})", linewidths=0)
        fl = (m.flag != "").to_numpy()
        if fl.any():
            ax.scatter(cen.x[fl], cen.y[fl], s=1.2, c="#7b2cbf", label=f"flagged vs OSM ({int(fl.sum()):,})",
                       linewidths=0)
        ax.axhline(split_lat, color="#555", lw=0.6, ls="--")
        ax.set_aspect("equal")
        ax.set_title("RoadWatch India Tier-1 map: tile status (Sentinel-2, 10 m)")
        ax.legend(markerscale=12, loc="lower left", fontsize=8)
        fig.tight_layout()
        fig.savefig(ROOT / "reports" / "india_coverage.png")
        plt.close(fig)
    except ImportError:
        print("matplotlib not installed - coverage image skipped")

    rows = []
    for h in halves:
        x = m[m.half == h]
        vc = x.status.value_counts()
        ok = x[x.status == "ok"]
        tp, fp, fn = (ok[c].sum() for c in ("osm_tp", "osm_fp", "osm_fn"))
        iou = tp / (tp + fp + fn) if (tp + fp + fn) else float("nan")
        seas = ok.season_used.value_counts().to_dict() if "season_used" in ok else {}
        rows.append((h, len(x), {s: int(vc.get(s, 0)) for s in ("ok", "cloudy_all", "no_imagery", "error", "missing")},
                     iou, int((x.flag != "").sum()), seas))
    md = ["# All-India Tier-1 road map — coverage and accuracy check (ADR-025)", "",
          f"_Generated {datetime.now(UTC).date().isoformat()} by `scripts/india_check.py` from the Kaggle map runs. "
          f"Expected tiles = official India boundary (DataMeet, CC BY 2.5 IN) on the 10 m / 512 px grid, split at "
          f"{split_lat}° N._", "",
          "| Half | Expected tiles | Mapped (ok) | Cloudy in all seasons | No imagery | Error | Never processed | "
          "Pixel IoU vs OSM | Flagged tiles | Season used (ok tiles) |", "|---|---|---|---|---|---|---|---|---|---|"]
    for h, n, s, iou, nf, seas in rows:
        md.append(f"| {h} | {n:,} | {s['ok']:,} | {s['cloudy_all']:,} | {s['no_imagery']:,} | {s['error']:,} | "
                  f"{s['missing']:,} | {iou:.3f} | {nf:,} | {', '.join(f'{k}: {v:,}' for k, v in seas.items())} |")
    gaps = int(m.status.isin(["missing", "error"]).sum())
    md += ["", f"**Unprocessed or failed tiles: {gaps:,}** ({len(rerun):,} blocks listed in "
           "`data_cache/outputs/india/rerun_blocks.json` for a re-run). "
           + ("**No processing gaps.**" if gaps == 0 else "The map is not complete until this is 0."), "",
           "Tiles that are cloudy in all three pre-monsoon seasons, or have no imagery, are real data gaps of "
           "Sentinel-2 optical imagery (Sentinel-1 radar is the planned fill, CP2) — they are shown, not guessed.", "",
           "## Accuracy flags", "",
           f"- `low_osm_agreement`: OSM has ≥ {MIN_OSM_PX} road pixels in the tile but pixel IoU with our roads "
           f"< {LOW_IOU} — {int((m.flag == 'low_osm_agreement').sum()):,} tiles.",
           f"- `possible_false_roads`: OSM has < {MAX_OSM_PX_FOR_OVER} road pixels but we draw > {OVER_PRED_PX} — "
           f"{int((m.flag == 'possible_false_roads').sum()):,} tiles (either OSM is unmapped there, or false roads).",
           "", "OSM is a consistency reference, not ground truth: its coverage varies by state. Flagged tiles "
           "are listed in `data_cache/outputs/india/coverage.parquet` (`flag` column) for review.", "",
           "![coverage](india_coverage.png)", ""]
    (ROOT / "reports" / "india_map_check.md").write_text("\n".join(md), encoding="utf-8")
    print("\n".join(md[4:4 + len(rows) + 3]))
    return 0


if __name__ == "__main__":
    sys.exit(main())
