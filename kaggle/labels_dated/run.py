"""RoadWatch — dated OSM road labels for older imagery (ADR-027), Kaggle CPU session (no GPU quota).

The current OSM snapshot labels roads that did not exist yet on 2022 imagery, and the model trained only on
2025-26 imagery under-extracts old roads in 2022 composites (so they look "new" -> false alerts, ADR-024).
For multi-year training each year gets its own labels: an OSM way created after the cutoff (version 1 with a
later timestamp) is *uncertain* on that year's imagery — it may be a new road or an old road mapped late —
so it is written as ignore (128) instead of road (255) or background (0). Output: labels_<year>/<tile>.png
(8-bit) for every tile of the AOI; the trainer uses them for that year's composites.
Push with: scripts/kaggle_push.py labels_dated <run>
"""

# --- RUN_CONFIG (injected by scripts/kaggle_push.py; do not edit by hand) ---
RUN_CONFIG = {
    "run_id": "local-debug",
    "commit": "main",
    "config": "configs/statewide.yaml",
    "year": "2022",
    "cutoff": "2022-03-01",
    "osm_pbf": "https://download.geofabrik.de/asia/india/southern-zone-latest.osm.pbf",
    "config_hash": "none",
}
# --- END RUN_CONFIG ---

import argparse
import os
import re
import shutil
import subprocess
import sys
import time

REPO = "https://github.com/upeshchowdary/AI-Based-Road-Extraction-and-New-Road-Alert-System-using-Multi-Temporal-Satellite-Images"
C = RUN_CONFIG
T0 = time.time()


def log(msg):
    print(f"[{time.time() - T0:7.0f}s] {msg}", flush=True)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--local", action="store_true")
    ap.add_argument("--src", default="/kaggle/temp/rw")
    ap.add_argument("--work", default="/kaggle/temp")
    ap.add_argument("--out", default="/kaggle/working")
    ap.add_argument("--pbf", default="")
    ap.add_argument("--max-tiles", type=int, default=0)
    args = ap.parse_args()
    if not args.local:
        if os.path.exists(args.src):
            shutil.rmtree(args.src)
        subprocess.run(["git", "clone", "-q", REPO, args.src], check=True)
        subprocess.run(["git", "-C", args.src, "checkout", "-q", C["commit"]], check=True)
        subprocess.run([sys.executable, "-m", "pip", "install", "-q", "rasterio", "geopandas", "pyogrio",
                        "typer", "pydantic>=2.7", "pystac-client", "planetary-computer"], check=True)
        os.chdir(args.src)
    sys.path.insert(0, os.path.join(args.src, "src"))

    import numpy as np
    import pyogrio
    from PIL import Image
    from rasterio.features import rasterize
    from shapely.geometry import box

    from roadwatch.config import load_config
    from roadwatch.data.grid import TileKey, tiles_frame
    from roadwatch.data.sentinel2 import tile_transform
    from roadwatch.labels.osm import ROAD_CLASSES, ROAD_WIDTH_M

    cfg = load_config(C["config"])
    aoi = cfg.aoi.geometry()
    tiles = tiles_frame(aoi, cfg.aoi.grid)
    if args.max_tiles:
        tiles = tiles.head(args.max_tiles)
    log(f"{len(tiles)} tiles in {cfg.aoi.name}")

    # GDAL's OSM driver hides way version/timestamp unless osmconf.ini turns them on
    conf_src = os.path.join(os.path.dirname(pyogrio.__file__), "gdal_data", "osmconf.ini")
    conf = os.path.join(args.work, "osmconf_dated.ini")
    os.makedirs(args.work, exist_ok=True)
    with open(conf_src) as f:
        txt = re.sub(r"osm_timestamp=no", "osm_timestamp=yes", re.sub(r"osm_version=no", "osm_version=yes", f.read()))
    with open(conf, "w") as f:
        f.write(txt)
    pyogrio.set_gdal_config_options({"OSM_CONFIG_FILE": conf})
    pbf = args.pbf or os.path.join(args.work, "osm.pbf")
    if not os.path.exists(pbf):
        subprocess.run(["wget", "-q", "-O", pbf, C["osm_pbf"]], check=True)
    where = "highway IN (" + ",".join(f"'{c}'" for c in ROAD_CLASSES) + ")"
    roads = pyogrio.read_dataframe(pbf, layer="lines", bbox=tuple(tiles.total_bounds), where=where,
                                   columns=["osm_id", "highway", "osm_version", "osm_timestamp"])
    roads = roads.set_crs(4326, allow_override=True)
    ts = roads.osm_timestamp.astype(str).str[:10]
    roads["uncertain"] = (roads.osm_version.astype(int) == 1) & (ts > C["cutoff"])
    roads["width_m"] = roads.highway.map(ROAD_WIDTH_M).astype(float)
    log(f"OSM roads: {len(roads):,}; created after {C['cutoff']} (uncertain on {C['year']} imagery): "
        f"{int(roads.uncertain.sum()):,} ({roads.uncertain.mean():.1%})")
    by_epsg = {e: roads.to_crs(e) for e in sorted(tiles.epsg.unique())}
    for g in by_epsg.values():
        _ = g.sindex

    out = os.path.join(args.out, f"labels_{C['year']}")
    os.makedirs(out, exist_ok=True)
    n_unc = 0
    for i, t in enumerate(tiles.tile_id):
        k = TileKey.parse(t)
        r = by_epsg[k.epsg]
        sub = r.iloc[r.sindex.query(box(*k.bounds()), predicate="intersects")]
        n = k.size_px
        m = np.zeros((n, n), np.uint8)
        for unc, val in ((True, 128), (False, 255)):  # certain roads drawn last: they win where both overlap
            s = sub[sub.uncertain == unc]
            if len(s):
                shapes = ((g.buffer(max(w / 2, 5.0), cap_style="flat"), val)
                          for g, w in zip(s.geometry, s.width_m, strict=True))
                burn = rasterize(shapes, out_shape=(n, n), transform=tile_transform(k), fill=0, all_touched=True,
                                 dtype="uint8")
                m = np.where(burn > 0, burn, m)
        n_unc += int((m == 128).sum())
        Image.fromarray(m, "L").save(os.path.join(out, f"{t}.png"), optimize=True)
        if i % 1000 == 0:
            log(f"{i + 1}/{len(tiles)} tiles")
    log(f"done: {len(tiles)} label tiles -> labels_{C['year']}/ ; ignored pixels {n_unc:,}; run_id={C['run_id']}")


if __name__ == "__main__":
    main()
