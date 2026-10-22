"""RoadWatch India — streamed Tier-1 road map / training sample on Kaggle CPU sessions (no GPU quota).

India is ~128,500 tiles per date (19x Andhra Pradesh). Storing composites like the AP builds would need
~120 GB per date, over Kaggle's 20 GB output limit, so this script *streams*: per 5x5-tile block it
builds the composites in memory and keeps only what is needed.

mode "sample": composites + OSM road labels for an even sample of blocks (training data, ~1 GB/1,000
               tiles), with the same frozen holdout rule as AP (EPSG:7755 block hash) -> train on GPU.
mode "map":    every block of the half: composite -> ONNX road model -> road centre-lines. A tile that
               fails the cloud gate in the newest season falls back to the next season in `seasons`
               (gap filling); a tile that fails everywhere is recorded as a gap, never guessed.
               Writes roads_*.parquet (EPSG:4326) + tiles_*.parquet (one status row per tile).

The package code comes from the pinned commit on GitHub; India-specific logic lives here, so a run
needs no repo change. The boundary (official India boundary, DataMeet, CC BY 2.5 IN) is downloaded at
start. Push with: scripts/kaggle_push.py india <run>
"""

# --- RUN_CONFIG (injected by scripts/kaggle_push.py; do not edit by hand) ---
RUN_CONFIG = {
    "run_id": "local-debug",
    "commit": "main",
    "config": "configs/statewide.yaml",
    "mode": "map",
    "half": "south",
    "split_lat": 23.6,
    "boundary_url": "https://raw.githubusercontent.com/datameet/maps/master/Country/india-composite.geojson",
    "seasons": ["2026_pre_monsoon", "2025_pre_monsoon", "2024_pre_monsoon"],
    "shard": 0,
    "shards": 1,
    "workers": 3,          # blocks in parallel; composite_region adds 8 read threads each
    "threads": 4,
    "sample_every": 13,
    "osm_pbf": "https://download.geofabrik.de/asia/india-latest.osm.pbf",
    "model_onnx": "model_best.onnx",
    "model_meta": {},
    "max_hours": 11.0,
    "config_hash": "none",
}
# --- END RUN_CONFIG ---

import argparse
import glob
import hashlib
import json
import os
import shutil
import subprocess
import sys
import threading
import time
from concurrent.futures import ThreadPoolExecutor

REPO = "https://github.com/upeshchowdary/AI-Based-Road-Extraction-and-New-Road-Alert-System-using-Multi-Temporal-Satellite-Images"
C = RUN_CONFIG
T0 = time.time()
LOCK = threading.Lock()


def log(msg):
    print(f"[{time.time() - T0:7.0f}s] {msg}", flush=True)


def setup(src, local):
    if local:
        sys.path.insert(0, os.path.join(src, "src"))
        return
    if os.path.exists(src):
        shutil.rmtree(src)
    subprocess.run(["git", "clone", "-q", REPO, src], check=True)
    subprocess.run(["git", "-C", src, "checkout", "-q", C["commit"]], check=True)
    subprocess.run([sys.executable, "-m", "pip", "install", "-q", "onnxruntime", "rasterio", "geopandas",
                    "pyogrio", "scikit-image>=0.26", "networkx", "typer", "pydantic>=2.7", "pystac-client",
                    "planetary-computer"], check=True)
    sys.path.insert(0, os.path.join(src, "src"))
    os.chdir(src)


def half_aoi(work):
    """Official India boundary cut at split_lat: 'south' = below, 'north' = above (EPSG:4326)."""
    import urllib.request

    import geopandas as gpd
    from shapely.geometry import box

    path = os.path.join(work, "india_official.geojson")
    if not os.path.exists(path):
        urllib.request.urlretrieve(C["boundary_url"], path)
    india = gpd.read_file(path).to_crs(4326).geometry.union_all().buffer(0)
    # 5 km tiles need no 10 m boundary detail: simplify (~200 m) and pad 500 m so coastal tiles stay
    india = india.simplify(0.002).buffer(0.005)
    cut = box(60, 0, 100, C["split_lat"]) if C["half"] == "south" else box(60, C["split_lat"], 100, 40)
    return india.intersection(cut)


def blocks_of(aoi, cfg):
    """{(epsg, col//5, row//5): [TileKey]} for every tile of the AOI, plus the tile frame."""
    from roadwatch.data.grid import TileKey, tiles_frame

    tiles = tiles_frame(aoi, cfg.aoi.grid)
    blocks = {}
    for t in tiles.tile_id:
        k = TileKey.parse(t)
        blocks.setdefault((k.epsg, k.col // 5, k.row // 5), []).append(k)
    return blocks, tiles


def bid(b):
    return f"{b[0] % 100}{b[1]:04d}{b[2]:04d}"


def composites(keys, date_key, cfg, tries=6):
    """composite_region with back-off on Planetary Computer errors (rate limits, timeouts)."""
    from roadwatch.data.sentinel2 import composite_region

    year, season = int(date_key[:4]), date_key[5:]
    for a in range(tries):
        try:
            return composite_region(keys, season, year, cfg.data)
        except Exception as e:  # noqa: BLE001 - network errors are retried, then reported
            if a == tries - 1:
                raise
            wait = min(600, 30 * 2 ** a)
            log(f"  retry {date_key} {len(keys)} tiles in {wait}s: {type(e).__name__}: {str(e)[:120]}")
            time.sleep(wait)


# ---------------------------------------------------------------- mode: map
def osm_roads(args, keys):
    """OSM vehicle roads over the given tiles (one scan of the India extract), as {epsg: frame}."""
    import geopandas as gpd
    import pyogrio
    from shapely.geometry import box

    from roadwatch.data.grid import _to_crs
    from roadwatch.labels.osm import ROAD_CLASSES, ROAD_WIDTH_M

    pbf = args.pbf or os.path.join(args.work, "india.osm.pbf")
    if not os.path.exists(pbf):
        subprocess.run(["wget", "-q", "-O", pbf, C["osm_pbf"]], check=True)
    fps = gpd.GeoSeries([_to_crs(box(*k.bounds()), k.epsg, 4326) for k in keys], crs=4326)
    where = "highway IN (" + ",".join(f"'{c}'" for c in ROAD_CLASSES) + ")"
    # mask = the tiles themselves (not their bbox): a sample spread over half of India would otherwise
    # load every road of the half (millions of lines) into memory
    mask = fps.union_all().buffer(0.001)
    roads = pyogrio.read_dataframe(pbf, layer="lines", mask=mask, where=where, columns=["osm_id", "highway"])
    roads["width_m"] = roads.highway.map(ROAD_WIDTH_M).astype(float)
    roads = roads.set_crs(4326, allow_override=True)
    snap = time.strftime("%Y-%m-%d", time.gmtime(os.path.getmtime(pbf)))
    log(f"OSM roads over {len(keys)} tiles: {len(roads):,} (extract of {snap})")
    out = {e: roads.to_crs(e) for e in sorted({k.epsg for k in keys})}
    for g in out.values():
        _ = g.sindex  # build once here; the worker threads then share it read-only
    return out, snap


def osm_mask(roads_utm, key, min_half_width_m=5.0):
    """Same rasterisation as labels.osm.rasterize_tile, but with a spatial-index lookup (millions of
    roads per shard instead of one district)."""
    import numpy as np
    from rasterio.features import rasterize
    from shapely.geometry import box

    from roadwatch.data.sentinel2 import tile_transform

    fp = box(*key.bounds())
    sub = roads_utm.iloc[roads_utm.sindex.query(fp, predicate="intersects")]
    n = key.size_px
    if sub.empty:
        return np.zeros((n, n), np.uint8)
    shapes = ((g.buffer(max(w / 2, min_half_width_m), cap_style="flat"), 1)
              for g, w in zip(sub.geometry, sub.width_m, strict=True))
    return rasterize(shapes, out_shape=(n, n), transform=tile_transform(key), fill=0, all_touched=True,
                     dtype="uint8")


def map_block(b, keys, cfg, net, gp, out_rows, out_roads, osm=None):
    """Fill every tile of the block from the newest season that passes the cloud gate; with `osm`,
    score every mapped tile against OSM (pixel tp/fp/fn) to flag inaccurate tiles."""
    import numpy as np

    from roadwatch.data.grid import TileKey
    from roadwatch.data.sentinel2 import tile_transform
    from roadwatch.graph.extract import mask_to_lines
    from roadwatch.qa.checks import check_valid

    n = keys[0].size_px
    c0, r1 = min(k.col for k in keys), max(k.row for k in keys)
    W = (max(k.col for k in keys) - c0 + 1) * n
    H = (r1 - min(k.row for k in keys) + 1) * n
    prob = np.zeros((H, W), np.float32)
    left, used, info = list(keys), {}, {}
    for date_key in C["seasons"]:
        if not left:
            break
        comps = composites(left, date_key, cfg)
        still = []
        for c, k in zip(comps, left, strict=True):
            ok = check_valid(c.valid_fraction, c.cloud_fraction, cfg.qa.max_cloud_fraction).passed
            info.setdefault(k.tile_id, []).append((date_key, round(c.valid_fraction, 4),
                                                   round(c.cloud_fraction, 4), ok))
            if not ok:
                still.append(k)
                continue
            y0, x0 = (r1 - k.row) * n, (k.col - c0) * n
            prob[y0:y0 + n, x0:x0 + n] = net.predict(c.data)
            used[k.tile_id] = date_key
        left = still
    # block grid origin = top-left tile (same construction as models.infer.mosaic_predict)
    t = tile_transform(TileKey(keys[0].epsg, keys[0].res_m, n, c0, r1))
    lines = mask_to_lines(prob, t, f"EPSG:{keys[0].epsg}", gp)
    rows = []
    for k in keys:
        tried = info.get(k.tile_id, [])
        if k.tile_id in used:
            status = "ok"
        elif tried and all(v == 0 for _, v, _, _ in tried):
            status = "no_imagery"  # no Sentinel-2 pixels at all (open sea at the edge, data gap)
        else:
            status = "cloudy_all"  # imagery exists but fails the cloud gate in every season tried
        row = {"tile_id": k.tile_id, "block": bid(b), "epsg": k.epsg, "col": k.col, "row": k.row,
               "season_used": used.get(k.tile_id), "status": status, "tried": json.dumps(tried)}
        if osm is not None and status == "ok":
            y0, x0 = (r1 - k.row) * n, (k.col - c0) * n
            pred = prob[y0:y0 + n, x0:x0 + n] >= gp.threshold
            ref = osm_mask(osm[k.epsg], k).astype(bool)
            row |= {"osm_tp": int((pred & ref).sum()), "osm_fp": int((pred & ~ref).sum()),
                    "osm_fn": int((~pred & ref).sum())}
        rows.append(row)
    with LOCK:
        out_rows.extend(rows)
        if len(lines):
            out_roads.append(lines.assign(block=bid(b))[["block", "confidence", "geometry"]].to_crs(4326))


def run_map(args, cfg, aoi):
    import geopandas as gpd
    import pandas as pd

    from roadwatch.graph.extract import GraphParams
    from roadwatch.models.infer import ModelMeta, OnnxRoadModel

    blocks, _ = blocks_of(aoi, cfg)
    allb = sorted(blocks)
    n_all = len(allb)  # contiguous regions per shard: each shard loads only its own region's OSM roads
    todo = allb[C["shard"] * n_all // C["shards"]:(C["shard"] + 1) * n_all // C["shards"]]
    done = set()
    for p in glob.glob(os.path.join(args.inputs[0], "**", "tiles_*.parquet"), recursive=True):
        done |= set(pd.read_parquet(p, columns=["block", "status"]).query("status != 'error'").block)
    todo = [b for b in todo if bid(b) not in done]
    if args.block:  # tests: one named block from anywhere in the half
        todo = [b for b in allb if bid(b) == args.block]
    if args.max_blocks:
        todo = todo[:args.max_blocks]
    log(f"{C['half']}: {len(blocks)} blocks, shard {C['shard']}/{C['shards']}: {len(todo)} to do "
        f"({len(done)} done in attached earlier runs)")
    onnx = glob.glob(os.path.join(args.model_dir or args.inputs[0], "**", C["model_onnx"]), recursive=True)
    if not onnx:
        raise SystemExit(f"model {C['model_onnx']} not found")
    mm = C["model_meta"] or json.load(open(glob.glob(os.path.join(os.path.dirname(onnx[0]),
                                                               "model_meta.json"))[0]))
    meta = ModelMeta(mean=mm["mean"], std=mm["std"], bands=mm["bands"], threshold=mm.get("threshold", 0.5),
                     model_id=mm.get("model_id", ""))
    net = OnnxRoadModel(onnx[0], meta, threads=C["threads"])
    gp = GraphParams(threshold=meta.threshold)
    osm = None
    if C.get("osm_check", True) and todo:
        osm, _ = osm_roads(args, [k for b in todo for k in blocks[b]])
    rows, roads, deadline = [], [], T0 + C["max_hours"] * 3600
    tag = f"{C['half']}_s{C['shard']}"

    def save():
        with LOCK:
            if rows:
                pd.DataFrame(rows).to_parquet(os.path.join(args.out, f"tiles_{tag}.parquet"))
            if roads:
                gpd.GeoDataFrame(pd.concat(roads, ignore_index=True), crs=4326).to_parquet(
                    os.path.join(args.out, f"roads_{tag}.parquet"))

    def one(i_b):
        i, b = i_b
        if time.time() > deadline:
            return "skipped (time)"
        try:
            map_block(b, blocks[b], cfg, net, gp, rows, roads, osm)
        except Exception as e:  # noqa: BLE001 - a failed block is recorded and re-run later
            with LOCK:
                rows.extend({"tile_id": k.tile_id, "block": bid(b), "epsg": k.epsg, "col": k.col,
                             "row": k.row, "season_used": None, "status": "error",
                             "tried": json.dumps(f"{type(e).__name__}: {str(e)[:200]}")} for k in blocks[b])
        if i % 20 == 0:
            log(f"block {i + 1}/{len(todo)}  tiles so far {len(rows)}  road parts {sum(len(r) for r in roads)}")
            save()
        return "ok"

    with ThreadPoolExecutor(C["workers"]) as ex:
        list(ex.map(one, enumerate(todo)))
    save()
    st = pd.DataFrame(rows).status.value_counts().to_dict() if rows else {}
    log(f"done: {len(todo)} blocks, tile status {st}, run_id={C['run_id']}")


# ---------------------------------------------------------------- mode: sample
def run_sample(args, cfg, aoi):
    """Training data: composites (newest clear season) + OSM road masks for every `sample_every`-th
    block (by hash, so the sample is spread evenly and is the same on every run)."""
    import pandas as pd
    from PIL import Image
    from shapely.geometry import box

    from roadwatch.data.sentinel2 import write_geotiff
    from roadwatch.data.splits import assign_splits
    from roadwatch.labels.osm import keep_empty_tile
    from roadwatch.qa.checks import check_valid

    blocks, tiles = blocks_of(aoi, cfg)
    pick = [b for b in sorted(blocks)
            if int(hashlib.sha256(f"india-sample:{bid(b)}".encode()).hexdigest()[:8], 16) % C["sample_every"] == 0]
    todo = pick[C["shard"]::C["shards"]]
    if args.max_blocks:
        todo = todo[:args.max_blocks]
    keys = [k for b in todo for k in blocks[b]]
    log(f"{C['half']}: {len(blocks)} blocks, sample {len(pick)} blocks, shard {C['shard']}: {len(todo)} blocks "
        f"/ {len(keys)} tiles")
    fr = tiles[tiles.tile_id.isin({k.tile_id for k in keys})].copy()
    fr = assign_splits(fr, cfg.split, [box(*z.bbox) for z in cfg.aoi.zones])  # same holdout rule as AP
    split = dict(zip(fr.tile_id, fr.split, strict=True))
    zone = {}  # AP evaluation zones (holdout) keep their names, so the trainer reports them per zone
    for z in cfg.aoi.zones:
        for t in fr.loc[fr.intersects(box(*z.bbox)), "tile_id"]:
            zone[t] = z.name

    by_epsg, snap = osm_roads(args, keys)  # OSM roads over the sampled tiles (one scan of the extract)

    rows = []

    errors = []

    def one(b):
        try:
            sample_block(b)
        except Exception as e:  # noqa: BLE001 - one bad block must not lose the shard's output
            with LOCK:
                errors.append(f"{bid(b)}: {type(e).__name__}: {str(e)[:200]}")
            log(f"block {bid(b)} failed: {type(e).__name__}: {str(e)[:200]}")

    def sample_block(b):
        ks = blocks[b]
        left, got = list(ks), {}
        for date_key in C["seasons"]:
            if not left:
                break
            comps = composites(left, date_key, cfg)
            still = []
            for c, k in zip(comps, left, strict=True):
                if check_valid(c.valid_fraction, c.cloud_fraction, cfg.qa.max_cloud_fraction).passed:
                    got[k.tile_id] = (c, date_key, k)
                else:
                    still.append(k)
            left = still
        out = []
        for tid, (c, date_key, k) in got.items():
            d = os.path.join(args.out, "s2", date_key)
            os.makedirs(d, exist_ok=True)
            write_geotiff(c, os.path.join(d, f"{tid}.tif"))
            m = osm_mask(by_epsg[k.epsg], k)
            Image.fromarray(m * 255).convert("1").save(os.path.join(args.out, "labels", f"{tid}.png"),
                                                       optimize=True)
            has_road = int(m.sum()) >= 20
            sp = split.get(tid, "train")
            status, reason = "included", None
            if sp == "buffer":
                status, reason = "reserved", "holdout_buffer"
            elif not has_road and sp in ("train", "val") and not keep_empty_tile(tid,
                                                                                 cfg.data.empty_tile_keep_ratio):
                status, reason = "reserved", "empty_tile"
            out.append({"tile_id": tid, "sensor": "osm_label", "date_key": f"osm_{snap}", "epsg": k.epsg,
                        "col": k.col, "row": k.row, "split": sp, "zone": zone.get(tid, ""), "stratum": C["half"],
                        "scene_ids": f"geofabrik:india@{snap}", "bands_used": "road", "bands_reserved": "",
                        "storage_dtype": "1bit", "valid_fraction": 1.0, "cloud_fraction": 0.0, "qa_pass": True,
                        "has_road": has_road, "status": status, "reserve_reason": reason,
                        "local_path": f"labels/{tid}.png", "config_hash": C["config_hash"],
                        "updated_utc": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
                        "season_used": date_key})
        with LOCK:
            rows.extend(out)
            if len(rows) % 200 < len(out):
                log(f"sample tiles so far {len(rows)}")

    os.makedirs(os.path.join(args.out, "labels"), exist_ok=True)
    with ThreadPoolExecutor(C["workers"]) as ex:
        list(ex.map(one, todo))
    df = pd.DataFrame(rows)
    df.to_parquet(os.path.join(args.out, f"registry_labels_{C['half']}_s{C['shard']}.parquet"))
    with open(os.path.join(args.out, f"errors_{C['half']}_s{C['shard']}.json"), "w") as f:
        json.dump(errors, f)
    log(f"{len(errors)} blocks failed (listed in errors_*.json, re-run them)")
    log(f"done: {len(df)} sample tiles, splits {df.split.value_counts().to_dict() if len(df) else {}}, "
        f"included {int((df.status == 'included').sum()) if len(df) else 0}")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--local", action="store_true")
    ap.add_argument("--src", default="/kaggle/temp/rw")
    ap.add_argument("--work", default="/kaggle/temp")
    ap.add_argument("--inputs", nargs="*", default=["/kaggle/input"])
    ap.add_argument("--out", default="/kaggle/working")
    ap.add_argument("--model-dir", default="")
    ap.add_argument("--max-blocks", type=int, default=0)
    ap.add_argument("--pbf", default="", help="local OSM extract instead of downloading (tests)")
    ap.add_argument("--half", default="", help="override RUN_CONFIG half (tests)")
    ap.add_argument("--block", default="", help="map only this block id, e.g. 4400910362 (tests)")
    ap.add_argument("--mode", default="", help="override RUN_CONFIG mode (tests)")
    args = ap.parse_args()
    C["half"] = args.half or C["half"]
    C["mode"] = args.mode or C["mode"]
    os.makedirs(args.work, exist_ok=True)
    os.makedirs(args.out, exist_ok=True)
    setup(args.src, args.local)
    from roadwatch.config import load_config

    cfg = load_config(C["config"])
    aoi = half_aoi(args.work)
    log(f"mode={C['mode']} half={C['half']} split_lat={C['split_lat']} seasons={C['seasons']}")
    (run_map if C["mode"] == "map" else run_sample)(args, cfg, aoi)


if __name__ == "__main__":
    main()
