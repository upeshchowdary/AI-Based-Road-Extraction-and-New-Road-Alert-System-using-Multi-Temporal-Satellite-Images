"""Cut the extracted road network (every screened state) into vector map tiles for the website.

The screening runs keep ~1 M road lines (AP + Hyderabad + Bengaluru + Tamil Nadu): far too much for a
GeoJSON layer or for the 512 MB deployed server. This writes plain Mapbox Vector Tiles, one small file per
tile, which the API serves as static files and MapLibre draws as the "Extracted roads" layer.

    pip install mapbox-vector-tile        # laptop-only tool (not needed by the server)
    uv run python scripts/build_road_tiles.py   # -> data_cache/outputs/road_tiles/{z}/{x}/{y}.pbf

Zoom 8-13; MapLibre over-zooms z13 beyond that. At each zoom lines are simplified to one tile pixel and
lines shorter than 2 pixels are dropped (they are invisible there anyway).
"""

from __future__ import annotations

import json
import math
import shutil
import time
from pathlib import Path

import mapbox_vector_tile
import numpy as np
import pyarrow.parquet as pq
import shapely

ROOT = Path(__file__).resolve().parents[1]
SRC = ROOT / "data_cache" / "outputs" / "statewide" / "roads_latest.parquet"
OUT = ROOT / "data_cache" / "outputs" / "road_tiles"
Z_MIN, Z_MAX = 8, 13
EXTENT = 4096
R = 6378137.0
HALF = math.pi * R  # web-mercator half width (m)


def to_mercator(g):
    def f(xy):
        x = np.radians(xy[:, 0]) * R
        y = np.log(np.tan(np.pi / 4 + np.radians(np.clip(xy[:, 1], -85, 85)) / 2)) * R
        return np.column_stack([x, y])
    return shapely.transform(g, f)


def tile_bounds(z: int, x: int, y: int) -> tuple[float, float, float, float]:
    size = 2 * HALF / 2 ** z
    x0 = -HALF + x * size
    y1 = HALF - y * size
    return x0, y1 - size, x0 + size, y1


def main() -> None:
    t0 = time.time()
    geoms = []
    for batch in pq.ParquetFile(SRC).iter_batches(columns=["geometry"], batch_size=100_000):
        g = shapely.from_wkb(batch.column("geometry").to_numpy(zero_copy_only=False))
        geoms.append(shapely.simplify(to_mercator(g), 2.0))  # ~1/5 of a 10 m pixel
    geoms = np.concatenate(geoms)
    geoms = geoms[~shapely.is_empty(geoms)]
    lengths = shapely.length(geoms)
    print(f"{len(geoms):,} road lines, {lengths.sum() / 1000:,.0f} km, loaded in {time.time() - t0:.0f} s",
          flush=True)
    tree = shapely.STRtree(geoms)
    b = shapely.bounds(geoms)

    if OUT.exists():
        shutil.rmtree(OUT)
    n_tiles, n_bytes = 0, 0
    for z in range(Z_MIN, Z_MAX + 1):
        size = 2 * HALF / 2 ** z
        px = size / EXTENT
        x0 = np.floor((b[:, 0] + HALF) / size).astype(int)
        x1 = np.floor((b[:, 2] + HALF) / size).astype(int)
        y0 = np.floor((HALF - b[:, 3]) / size).astype(int)
        y1 = np.floor((HALF - b[:, 1]) / size).astype(int)
        tiles = set()
        for a, c, d, e in zip(x0, x1, y0, y1, strict=True):
            for tx in range(a, c + 1):
                for ty in range(d, e + 1):
                    tiles.add((tx, ty))
        zt = time.time()
        for tx, ty in sorted(tiles):
            tb = tile_bounds(z, tx, ty)
            idx = tree.query(shapely.box(*tb))
            idx = idx[lengths[idx] >= 2 * px]  # shorter than 2 pixels: invisible at this zoom
            if not len(idx):
                continue
            # clip with a small buffer so lines run under the tile edge (no seams), simplify to a pixel
            pad = 8 * px
            g = shapely.clip_by_rect(geoms[idx], tb[0] - pad, tb[1] - pad, tb[2] + pad, tb[3] + pad)
            g = shapely.simplify(g, px)
            g = g[~shapely.is_empty(g)]
            if not len(g):
                continue
            data = mapbox_vector_tile.encode(
                [{"name": "roads", "features": [{"geometry": x, "properties": {}} for x in g]}],
                default_options={"quantize_bounds": tb, "extents": EXTENT, "y_coord_down": False},
            )
            p = OUT / str(z) / str(tx) / f"{ty}.pbf"
            p.parent.mkdir(parents=True, exist_ok=True)
            p.write_bytes(data)
            n_tiles += 1
            n_bytes += len(data)
        print(f"z{z}: {len(tiles):,} tiles in {time.time() - zt:.0f} s", flush=True)

    lon = np.degrees(np.array([b[:, 0].min(), b[:, 2].max()]) / R)
    lat = np.degrees(2 * np.arctan(np.exp(np.array([b[:, 1].min(), b[:, 3].max()]) / R)) - np.pi / 2)
    meta = {"minzoom": Z_MIN, "maxzoom": Z_MAX, "layer": "roads", "tiles": n_tiles, "bytes": n_bytes,
            "lines": int(len(geoms)), "km": round(float(lengths.sum()) / 1000),  # mercator km (~3 % long)
            "bounds": [round(float(lon[0]), 4), round(float(lat[0]), 4),
                       round(float(lon[1]), 4), round(float(lat[1]), 4)],
            "source": "RoadWatch screening runs, newest pre-monsoon season (roads_latest.parquet)"}
    (OUT / "meta.json").write_text(json.dumps(meta, indent=1), encoding="utf-8")
    print(f"{n_tiles:,} tiles, {n_bytes / 1e6:.1f} MB -> {OUT} ({time.time() - t0:.0f} s)")


if __name__ == "__main__":
    main()
