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
PARENT_Z = 6  # tiles are cut one zoom-6 region at a time (memory)
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


def tile_ranges(b: np.ndarray, z: int) -> tuple[np.ndarray, ...]:
    """Per line bbox (mercator) -> first/last tile column and row at zoom z."""
    size = 2 * HALF / 2 ** z
    return (np.floor((b[:, 0] + HALF) / size).astype(int), np.floor((b[:, 2] + HALF) / size).astype(int),
            np.floor((HALF - b[:, 3]) / size).astype(int), np.floor((HALF - b[:, 1]) / size).astype(int))


def read_lines(keep=None):
    """Stream the road lines (mercator, lightly simplified); `keep(bounds) -> mask` filters per batch."""
    for batch in pq.ParquetFile(SRC).iter_batches(columns=["geometry"], batch_size=100_000):
        g = shapely.from_wkb(batch.column("geometry").to_numpy(zero_copy_only=False))
        g = shapely.simplify(to_mercator(g), 2.0)  # ~1/5 of a 10 m pixel
        g = g[~shapely.is_empty(g)]
        yield g if keep is None else g[keep(shapely.bounds(g))]


def main() -> None:
    # Memory: ~1 M lines do not fit a laptop at once, so tiles are cut one zoom-6 region (~600 km) at a
    # time; every tile from zoom 8 up lies in exactly one zoom-6 region.
    t0 = time.time()
    regions, n_lines, km, lo, hi = set(), 0, 0.0, np.full(2, np.inf), np.full(2, -np.inf)
    for g in read_lines():
        b = shapely.bounds(g)
        for a, c, d, e in zip(*tile_ranges(b, PARENT_Z), strict=True):
            regions.update((x, y) for x in range(a, c + 1) for y in range(d, e + 1))
        n_lines += len(g)
        km += float(shapely.length(g).sum()) / 1000
        lo, hi = np.minimum(lo, b[:, :2].min(0)), np.maximum(hi, b[:, 2:].max(0))
    print(f"{n_lines:,} road lines, {km:,.0f} km, {len(regions)} zoom-{PARENT_Z} regions "
          f"({time.time() - t0:.0f} s)", flush=True)

    if OUT.exists():
        shutil.rmtree(OUT)
    n_tiles, n_bytes = 0, 0
    for rx, ry in sorted(regions):
        rb = tile_bounds(PARENT_Z, rx, ry)
        def inside(b, rb=rb):
            return (b[:, 2] >= rb[0]) & (b[:, 0] <= rb[2]) & (b[:, 3] >= rb[1]) & (b[:, 1] <= rb[3])

        geoms = np.concatenate(list(read_lines(inside)))
        lengths = shapely.length(geoms)
        tree = shapely.STRtree(geoms)
        b = shapely.bounds(geoms)
        rt = time.time()
        for z in range(Z_MIN, Z_MAX + 1):
            px = 2 * HALF / 2 ** z / EXTENT
            k = 2 ** (z - PARENT_Z)  # this region's tiles at zoom z: columns rx*k .. rx*k+k-1
            tiles = set()
            for a, c, d, e in zip(*tile_ranges(b, z), strict=True):
                tiles.update((x, y) for x in range(max(a, rx * k), min(c, rx * k + k - 1) + 1)
                             for y in range(max(d, ry * k), min(e, ry * k + k - 1) + 1))
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
        print(f"region {rx},{ry}: {len(geoms):,} lines, {n_tiles:,} tiles so far ({time.time() - rt:.0f} s)",
              flush=True)
        del geoms, tree, lengths, b

    lon = np.degrees(np.array([lo[0], hi[0]]) / R)
    lat = np.degrees(2 * np.arctan(np.exp(np.array([lo[1], hi[1]]) / R)) - np.pi / 2)
    meta = {"minzoom": Z_MIN, "maxzoom": Z_MAX, "layer": "roads", "tiles": n_tiles, "bytes": n_bytes,
            "lines": n_lines, "km": round(km),  # measured in web mercator: ~3-4 % longer than on the ground
            "bounds": [round(float(lon[0]), 4), round(float(lat[0]), 4),
                       round(float(lon[1]), 4), round(float(lat[1]), 4)],
            "source": "RoadWatch screening runs, newest pre-monsoon season (roads_latest.parquet)"}
    (OUT / "meta.json").write_text(json.dumps(meta, indent=1), encoding="utf-8")
    print(f"{n_tiles:,} tiles, {n_bytes / 1e6:.1f} MB -> {OUT} ({time.time() - t0:.0f} s)")


if __name__ == "__main__":
    main()
