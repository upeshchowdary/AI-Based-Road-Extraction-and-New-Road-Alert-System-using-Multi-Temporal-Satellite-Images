"""RoadWatch AP — statewide Tier-1 screening on a Kaggle CPU session (no GPU quota used).

For every 5x5-tile block (25.6 km) of Andhra Pradesh, in this shard:
  Sentinel-2 composites (attached build outputs) -> ONNX road model -> road graph per season
  -> graph-level change detection (baseline 2022, persistence, stability, abstain on cloudy tiles)
  -> alerts with before/after evidence chips for every season.
Composites are read, never copied; outputs are small (alerts JSON, chips, road lines).
Push with: scripts/kaggle_push.py statewide <run>   (local test: python kaggle/statewide/run.py --local ...)
"""

# --- RUN_CONFIG (injected by scripts/kaggle_push.py; do not edit by hand) ---
RUN_CONFIG = {
    "run_id": "local-debug",
    "commit": "main",
    "config": "configs/statewide.yaml",
    "seasons": [
        "2022_pre_monsoon",
        "2022_post_monsoon",
        "2023_pre_monsoon",
        "2024_pre_monsoon",
        "2025_pre_monsoon",
        "2026_pre_monsoon",
    ],
    "shard": 0,
    "shards": 1,
    "model_onnx": "model_best.onnx",
    "model_meta": {
        "model_id": "s2_model_full_s0_6e9081638291",
        "mean": [0.2142, 0.2997, 0.3221, 0.7128],
        "std": [0.0877, 0.1038, 0.1687, 0.2976],
        "bands": ["B02", "B03", "B04", "B08"],
        "threshold": 0.5,
    },
    "alert_min_length_m": 300,  # statewide alert rule (ADR-023): shorter candidates are counted, not alerted
    "chip_min_px": 64,
    "chip_pad_px": 16,
    "threads": 4,
    "config_hash": "none",
}
# --- END RUN_CONFIG ---

import argparse
import glob
import json
import os
import shutil
import subprocess
import sys
import time
from collections import defaultdict

REPO = "https://github.com/upeshchowdary/AI-Based-Road-Extraction-and-New-Road-Alert-System-using-Multi-Temporal-Satellite-Images"
C = RUN_CONFIG
T0 = time.time()


def log(msg):
    print(f"[{time.time() - T0:7.0f}s] {msg}", flush=True)


def setup(src, local):
    if not local:
        if os.path.exists(src):
            shutil.rmtree(src)
        subprocess.run(["git", "clone", "-q", REPO, src], check=True)
        subprocess.run(["git", "-C", src, "checkout", "-q", C["commit"]], check=True)
        subprocess.run(
            [
                sys.executable,
                "-m",
                "pip",
                "install",
                "-q",
                "onnxruntime",
                "rasterio",
                "geopandas",
                "pyogrio",
                "scikit-image>=0.26",  # remove_small_objects(max_size=...); Kaggle's image is older
                "networkx",
                "typer",
                "pydantic>=2.7",
                # imported at module level by roadwatch.data.sentinel2 (via models.infer)
                "pystac-client",
                "planetary-computer",
            ],
            check=True,
        )
    sys.path.insert(0, os.path.join(src, "src"))
    os.chdir(src)


def index_inputs(roots, seasons):
    """{season: {tile_id: path}} of composites + {season: set(reserved tile ids)} from registries."""
    import pandas as pd

    comp = defaultdict(dict)
    for root in roots:
        for p in glob.glob(os.path.join(root, "**", "s2", "*", "*.tif"), recursive=True):
            s = os.path.basename(os.path.dirname(p))
            if s in seasons:
                comp[s].setdefault(os.path.splitext(os.path.basename(p))[0], p)
    reserved = defaultdict(set)
    regs = [
        p for root in roots for p in glob.glob(os.path.join(root, "**", "*registry*.parquet"), recursive=True)
    ]
    for p in regs:
        try:
            r = pd.read_parquet(p, columns=["tile_id", "sensor", "date_key", "status"])
        except Exception as e:  # noqa: BLE001 - a broken registry must not stop the run
            log(f"skip registry {p}: {e}")
            continue
        r = r[(r.sensor == "s2") & (r.status == "reserved")]
        for t, s in zip(r.tile_id, r.date_key, strict=True):
            reserved[s].add(t)
    return comp, reserved


def rgb_mosaic(paths, transform, shape):
    """B04/B03/B02 of the block's tiles on the prediction grid, 2-98 % stretched -> uint8 HxWx3."""
    import numpy as np
    import rasterio

    img = np.zeros((3, *shape), np.uint8)
    for p in paths.values():
        with rasterio.open(p) as src:
            x0 = round((src.transform.c - transform.c) / transform.a)
            y0 = round((src.transform.f - transform.f) / transform.e)
            a = src.read([3, 2, 1])
            img[:, y0 : y0 + a.shape[1], x0 : x0 + a.shape[2]] = a
    valid = (img > 0).all(axis=0)
    out = np.zeros_like(img)
    for b in range(3):
        v = img[b][valid]
        lo, hi = np.percentile(v, [2, 98]) if v.size else (0, 255)
        out[b] = np.clip((img[b].astype(np.float32) - lo) / max(hi - lo, 1) * 255, 0, 255)
    out[:, ~valid] = 0
    return np.transpose(out, (1, 2, 0)), valid


def chip(rgb, valid, transform, coords_utm, cmin, pad):
    """Square crop around the alert -> (RGBA image, path string in chip pixels) or None."""
    import numpy as np
    from PIL import Image

    inv = ~transform
    pts = [inv * xy for xy in coords_utm]
    H, W = valid.shape
    if any(not (0 <= x <= W and 0 <= y <= H) for x, y in pts):
        return None
    xs, ys = [p[0] for p in pts], [p[1] for p in pts]
    size = int(min(W, H, max(cmin, max(xs) - min(xs) + 2 * pad, max(ys) - min(ys) + 2 * pad)))
    x = int(min(W - size, max(0, (min(xs) + max(xs) - size) / 2)))
    y = int(min(H - size, max(0, (min(ys) + max(ys) - size) / 2)))
    rgba = np.dstack(
        [rgb[y : y + size, x : x + size], (valid[y : y + size, x : x + size] * 255).astype(np.uint8)]
    )
    path = "M" + "L".join(f"{px - x:.1f},{py - y:.1f}" for px, py in pts)
    return Image.fromarray(rgba, "RGBA"), size, path


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--local", action="store_true", help="test on this laptop instead of Kaggle")
    ap.add_argument("--src", default="/kaggle/temp/rw")
    ap.add_argument("--inputs", nargs="*", default=["/kaggle/input"])
    ap.add_argument("--out", default="/kaggle/working")
    ap.add_argument("--model-dir", default="")
    ap.add_argument("--max-blocks", type=int, default=0)
    args = ap.parse_args()
    setup(args.src, args.local)

    import geopandas as gpd
    from shapely.geometry import box
    from shapely.ops import unary_union

    from roadwatch.change.detect import ChangeParams, detect_new_roads
    from roadwatch.config import load_config
    from roadwatch.data.grid import TileKey
    from roadwatch.graph.extract import GraphParams, mask_to_lines
    from roadwatch.models.infer import ModelMeta, OnnxRoadModel, mosaic_predict

    cfg = load_config(C["config"])
    seasons = list(C["seasons"])
    comp, reserved = index_inputs(args.inputs, set(seasons))
    log("composites per season: " + ", ".join(f"{s}={len(comp[s])}" for s in seasons))
    onnx = glob.glob(os.path.join(args.model_dir or args.inputs[0], "**", C["model_onnx"]), recursive=True)
    if not onnx:
        raise SystemExit(f"model {C['model_onnx']} not found")
    mm = C["model_meta"]
    meta = ModelMeta(
        mean=mm["mean"], std=mm["std"], bands=mm["bands"], threshold=mm["threshold"], model_id=mm["model_id"]
    )
    net = OnnxRoadModel(onnx[0], meta, threads=C["threads"])
    params = ChangeParams(
        min_length_m=cfg.change.min_length_m, persistence_min_dates=cfg.change.persistence_min_dates
    )
    gp = GraphParams(threshold=meta.threshold)

    # blocks = the s2-build groups (epsg, col // 5, row // 5) of every tile with any composite
    blocks = defaultdict(set)
    for s in seasons:
        for t in comp[s]:
            k = TileKey.parse(t)
            blocks[(k.epsg, k.col // 5, k.row // 5)].add(t)
    todo = sorted(blocks)[C["shard"] :: C["shards"]]
    if args.max_blocks:
        todo = todo[: args.max_blocks]
    log(f"{len(blocks)} blocks in total, {len(todo)} in shard {C['shard']}/{C['shards']}")

    out = args.out
    os.makedirs(os.path.join(out, "evidence"), exist_ok=True)
    alerts, roads, stats = [], [], []

    def do_block(bi, b):
        bid = f"{b[0] % 100}{b[1]:03d}{b[2]:03d}"
        tiles = sorted(blocks[b])
        lines, grids, here = {}, {}, []
        for s in seasons:
            paths = {t: comp[s][t] for t in tiles if t in comp[s]}
            if not paths:
                continue
            prob, transform, crs, valid = mosaic_predict(net, paths)
            lines[s] = mask_to_lines(prob, transform, crs, gp)
            grids[s] = (paths, transform, prob.shape, crs)
            here.append(s)
        # a date on which the model finds no road at all in a block (fully cloudy / no data) cannot say
        # "absent": treat it as abstain. (The pinned detect_new_roads also crashes on an empty layer.)
        empty = [s for s in here if not len(lines[s])]
        here = [s for s in here if len(lines[s])]
        row = {"block": bid, "tiles": len(tiles), "seasons": len(here), "empty_seasons": empty}
        if not all(s in here for s in params.baseline) or len(here) < len(params.baseline) + 2:
            stats.append(row | {"skipped": "missing baseline or later seasons"})
            return
        abstain = {
            s: (
                unary_union([box(*TileKey.parse(t).bounds()) for t in tiles if t in reserved[s]])
                or box(0, 0, 0, 0)
            )
            for s in here
        }
        cand = detect_new_roads({s: lines[s] for s in here}, here, abstain, params)
        found = cand[cand.length_m >= C["alert_min_length_m"]]
        latest = lines[here[-1]]
        if len(latest):
            roads.append(
                latest.assign(block=bid, season=here[-1])[["block", "season", "geometry"]].to_crs(4326)
            )
        row |= {
            "road_km_latest": round(float(latest.length.sum()) / 1000, 1),
            "candidates": len(cand),
            "alerts": len(found),
        }
        stats.append(row)
        if found.empty:
            return
        ll = found.to_crs(4326)
        rgbs = {}
        for i, (r, g4326, gutm) in enumerate(
            zip(found.itertuples(), ll.geometry, found.geometry, strict=True), 1
        ):
            aid = f"RW-{bid}-{i:02d}"
            ev, state = [], dict(zip(here, r.seen, strict=False))
            for s in here:
                paths, transform, shape, _ = grids[s]
                if s not in rgbs:
                    rgbs[s] = rgb_mosaic(paths, transform, shape)
                c = chip(*rgbs[s], transform, list(gutm.coords), C["chip_min_px"], C["chip_pad_px"])
                if c is None:
                    continue
                im, size, path = c
                os.makedirs(os.path.join(out, "evidence", aid), exist_ok=True)
                im.save(os.path.join(out, "evidence", aid, f"{s}.webp"), "WEBP", quality=88, method=4)
                ev.append({"season": s, "state": state.get(s), "size_px": size, "path": path})
            alerts.append(
                {
                    "id": aid,
                    "zone": None,
                    "block": bid,
                    "geometry": {
                        "type": "LineString",
                        "coordinates": [[round(x, 6), round(y, 6)] for x, y in g4326.coords],
                    },
                    "length_km": round(r.length_m / 1000, 3),
                    "width_m": None,
                    "surface": None,
                    "stage": None,
                    "district": C.get("district_label", "Andhra Pradesh"),
                    "score": r.score,
                    "factors": {
                        "model": r.confidence,
                        "persistence": round(r.persistence, 3),
                        "connectivity": r.connectivity,
                        "quality": r.quality,
                    },
                    "status": "pending",
                    "priority": "normal",
                    "first_seen": r.first_seen,
                    "persistence": r.seen,
                    "dates": list(here),  # the dates `persistence` refers to (empty dates dropped)
                    "sensor": f"Sentinel-2 L2A · RoadWatch {mm['model_id']}",
                    "demo": False,
                    "evidence": ev,
                }
            )
        rgbs.clear()
        if bi % 10 == 0:
            log(f"block {bi + 1}/{len(todo)} {bid}: {row}")

    for bi, b in enumerate(todo):
        try:
            do_block(bi, b)
        except Exception as e:  # noqa: BLE001 - one bad block must not lose the shard's output
            bid = f"{b[0] % 100}{b[1]:03d}{b[2]:03d}"
            stats.append({"block": bid, "error": f"{type(e).__name__}: {str(e)[:300]}"})
            log(f"block {bid} FAILED: {type(e).__name__}: {str(e)[:300]}")

    tag = f"s{C['shard']}"
    payload = {
        "run_id": C["run_id"],
        "model_id": mm["model_id"],
        "seasons": seasons,
        "params": params.__dict__ | {"baseline": list(params.baseline)},
        "alerts": alerts,
    }
    with open(os.path.join(out, f"alerts_{tag}.json"), "w") as f:
        json.dump(payload, f)
    with open(os.path.join(out, f"blocks_{tag}.json"), "w") as f:
        json.dump(stats, f)
    if roads:
        import pandas as pd

        gpd.GeoDataFrame(pd.concat(roads, ignore_index=True), crs=4326).to_parquet(
            os.path.join(out, f"roads_{tag}.parquet")
        )
    log(f"done: {len(todo)} blocks, {len(alerts)} alerts, run_id={C['run_id']}")


if __name__ == "__main__":
    main()
