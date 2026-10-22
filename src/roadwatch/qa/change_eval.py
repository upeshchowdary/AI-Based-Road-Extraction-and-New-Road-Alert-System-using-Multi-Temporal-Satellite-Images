"""KPI-2 / KPI-3: score new-road alerts against dated OpenStreetMap history (PROJECT_PROMPT Section 8).

Ground truth (per zone, in the zone's metric CRS):
- ``old``  = OSM roads already mapped at T0 (before the 2022 baseline imagery);
- ``new``  = OSM roads mapped at T1 (after the latest imagery) that lie more than ``match_m`` from
  any T0 road, kept where at least ``min_length_m`` long.

Each alert (a line from change detection, or a pixel blob from a baseline) is classed by the share of
its sample points near each layer:
- ``confirmed``   - mostly within ``near_new_m`` of a newly mapped road;
- ``known_false`` - mostly within ``near_old_m`` of a road OSM already had before the baseline;
- ``unverified``  - neither (an unmapped real road, or a false alert: OSM cannot tell).

Caveats (reported with every number): "newly mapped" is not "newly built" (old roads mapped late make
precision optimistic and recall pessimistic), and OSM misses many village roads.
"""

from __future__ import annotations

import json
from dataclasses import dataclass
from pathlib import Path

import geopandas as gpd
import numpy as np
from shapely.geometry import LineString, MultiLineString
from shapely.geometry.base import BaseGeometry
from shapely.ops import unary_union

from roadwatch.labels.osm import ROAD_CLASSES

OHSOME = "https://api.ohsome.org/v1/elementsFullHistory/geometry"


@dataclass(frozen=True)
class EvalParams:
    match_m: float = 25.0       # a T1 road within this of a T0 road is not "new" (same as change detection)
    min_length_m: float = 100.0  # shortest newly mapped piece counted as ground truth
    near_new_m: float = 40.0    # alert point "on" a new road (S2 pixel 10 m + OSM digitising error)
    near_old_m: float = 25.0    # alert point "on" a road that existed before the baseline
    majority: float = 0.5       # share of an alert's points needed for a class
    res_m: float = 10.0         # grid for point-in-buffer lookups (= S2 pixel; 5 m ran a laptop out of RAM)


def fetch_osm_history(bbox: tuple[float, float, float, float], t0: str, t1: str,
                      cache: Path) -> tuple[gpd.GeoDataFrame, gpd.GeoDataFrame]:
    """Vehicle roads (same classes as the training labels) as mapped in OSM at ``t0`` and at ``t1``,
    EPSG:4326, from one full-history request: every way version carries @validFrom / @validTo clipped
    to [t0, t1], so versions valid at t0 start exactly at t0 and versions valid at t1 end exactly at t1.
    (The snapshot endpoint ``elements/geometry`` answers 403 on the public API, seen 2026-10-22.)
    Cached as GeoJSON so a report can be regenerated offline."""
    if not cache.exists():
        import requests

        flt = "type:way and highway in (" + ", ".join(ROAD_CLASSES) + ")"
        r = requests.get(OHSOME, params={"bboxes": ",".join(map(str, bbox)), "time": f"{t0},{t1}",
                                         "filter": flt}, timeout=600,
                         headers={"User-Agent": "RoadWatch-AP research (KL University capstone)"})
        r.raise_for_status()
        cache.parent.mkdir(parents=True, exist_ok=True)
        cache.write_text(r.text, encoding="utf-8")
    fc = json.loads(cache.read_text(encoding="utf-8"))
    if not fc.get("features"):
        empty = gpd.GeoDataFrame(geometry=[], crs=4326)
        return empty, empty
    g = gpd.GeoDataFrame.from_features(fc["features"], crs=4326)
    g = g[g.geometry.geom_type.isin(["LineString", "MultiLineString"])]
    vf, vt = g["@validFrom"].str[:10], g["@validTo"].str[:10]
    return (g[vf == t0[:10]].reset_index(drop=True), g[vt == t1[:10]].reset_index(drop=True))


def _lines(g: BaseGeometry) -> list[LineString]:
    if g.is_empty:
        return []
    if isinstance(g, LineString):
        return [g]
    if isinstance(g, MultiLineString):
        return list(g.geoms)
    return [x for part in getattr(g, "geoms", []) for x in _lines(part)]


def ground_truth(old: gpd.GeoDataFrame, now: gpd.GeoDataFrame, p: EvalParams) -> gpd.GeoDataFrame:
    """Newly mapped road pieces: ``now`` minus a ``match_m`` buffer of ``old`` (both metric CRS)."""
    old_buf = unary_union(list(old.geometry)).buffer(p.match_m) if len(old) else None
    now_u = unary_union(list(now.geometry)) if len(now) else LineString()
    diff = now_u.difference(old_buf) if old_buf is not None else now_u
    from shapely.ops import linemerge

    merged = linemerge(_lines(diff)) if not diff.is_empty else diff
    parts = [x for x in _lines(merged) if x.length >= p.min_length_m]
    return gpd.GeoDataFrame(geometry=parts, crs=now.crs)


class _Near:
    """Buffer of a line layer burned into a grid: O(1) 'is this point within d of the layer?'."""

    def __init__(self, geoms, d: float, bounds, res: float):
        from rasterio.features import rasterize
        from rasterio.transform import from_origin

        x0, y0, x1, y1 = bounds
        self.x0, self.y1, self.res = x0, y1, res
        self.w, self.h = int(np.ceil((x1 - x0) / res)) + 1, int(np.ceil((y1 - y0) / res)) + 1
        shapes = [(g.buffer(d, quad_segs=2), 1) for g in geoms if not g.is_empty]
        self.mask = (rasterize(shapes, out_shape=(self.h, self.w), transform=from_origin(x0, y1, res, res),
                               fill=0, all_touched=True, dtype="uint8").astype(bool)
                     if shapes else np.zeros((self.h, self.w), bool))

    def hits(self, xy: np.ndarray) -> np.ndarray:
        c = ((xy[:, 0] - self.x0) / self.res).astype(int)
        r = ((self.y1 - xy[:, 1]) / self.res).astype(int)
        inside = (c >= 0) & (c < self.w) & (r >= 0) & (r < self.h)
        out = np.zeros(len(xy), bool)
        out[inside] = self.mask[r[inside], c[inside]]
        return out


def line_points(g: BaseGeometry, step: float = 10.0) -> np.ndarray:
    """Points every ``step`` metres along a (multi)line."""
    pts = []
    for ln in _lines(g):
        n = max(int(ln.length / step), 1) + 1
        pts += [ln.interpolate(t, normalized=True).coords[0] for t in np.linspace(0, 1, n)]
    return np.array(pts, dtype=float).reshape(-1, 2)


def classify(alert_points: list[np.ndarray], gt_new: gpd.GeoDataFrame, gt_old: gpd.GeoDataFrame,
             bounds, p: EvalParams) -> list[str]:
    """One class per alert (``alert_points[i]`` = its sample points, metric CRS)."""
    near_new = _Near(gt_new.geometry, p.near_new_m, bounds, p.res_m)
    near_old = _Near(gt_old.geometry, p.near_old_m, bounds, p.res_m)
    out = []
    for xy in alert_points:
        if not len(xy):
            out.append("unverified")
        elif near_new.hits(xy).mean() >= p.majority:
            out.append("confirmed")
        elif near_old.hits(xy).mean() >= p.majority:
            out.append("known_false")
        else:
            out.append("unverified")
    return out


def recall_length(gt_new: gpd.GeoDataFrame, alert_points: list[np.ndarray], bounds, p: EvalParams) -> float:
    """Share of newly mapped road length lying within ``near_new_m`` of any alert point (works for
    line alerts and pixel blobs alike: alert points are burned into the grid, then a distance
    transform gives each cell its distance to the nearest alert)."""
    from scipy import ndimage

    if not len(gt_new):
        return float("nan")
    x0, y0, x1, y1 = bounds
    res = p.res_m
    w, h = int(np.ceil((x1 - x0) / res)) + 1, int(np.ceil((y1 - y0) / res)) + 1
    grid = np.ones((h, w), bool)  # True = no alert here
    pts = np.concatenate(alert_points) if alert_points else np.empty((0, 2))
    if len(pts):
        c = np.clip(((pts[:, 0] - x0) / res).astype(int), 0, w - 1)
        r = np.clip(((y1 - pts[:, 1]) / res).astype(int), 0, h - 1)
        grid[r, c] = False
    near = (ndimage.distance_transform_edt(grid) * res <= p.near_new_m) if len(pts) else ~grid
    xy = np.concatenate([line_points(g) for g in gt_new.geometry])
    c = ((xy[:, 0] - x0) / res).astype(int)
    r = ((y1 - xy[:, 1]) / res).astype(int)
    inside = (c >= 0) & (c < w) & (r >= 0) & (r < h)
    hits = np.zeros(len(xy), bool)
    hits[inside] = near[r[inside], c[inside]]
    return float(hits.mean())


def pixel_diff_blobs(prob_base: list[np.ndarray], prob_latest: np.ndarray, transform, threshold: float = 0.5,
                     tolerance_px: int = 0, min_px: int = 10) -> list[np.ndarray]:
    """Pixel-difference baseline (post-classification comparison): road pixels in the latest season
    that were not road in any baseline season; 8-connected blobs of >= ``min_px`` pixels are alerts.
    ``tolerance_px`` dilates the baseline mask (forgives small misregistration). Returns the pixel
    centres of each blob in map coordinates."""
    from scipy import ndimage

    base = np.zeros_like(prob_latest, bool)
    for pb in prob_base:
        base |= pb >= threshold
    if tolerance_px:
        base = ndimage.binary_dilation(base, iterations=tolerance_px)
    change = (prob_latest >= threshold) & ~base
    lab, n = ndimage.label(change, structure=np.ones((3, 3)))
    if not n:
        return []
    sizes = np.bincount(lab.ravel())
    rows, cols = np.nonzero(lab)
    ids = lab[rows, cols]
    order = np.argsort(ids, kind="stable")
    rows, cols, ids = rows[order], cols[order], ids[order]
    splits = np.searchsorted(ids, np.arange(1, n + 2))
    blobs = []
    for k in range(1, n + 1):
        if sizes[k] < min_px:
            continue
        r, c = rows[splits[k - 1]:splits[k]], cols[splits[k - 1]:splits[k]]
        xs, ys = transform * (c + 0.5, r + 0.5)
        blobs.append(np.column_stack([xs, ys]))
    return blobs


def bootstrap_share(classes: list[str], num: tuple[str, ...], den: tuple[str, ...] | None = None,
                    n_boot: int = 2000, seed: int = 1564) -> tuple[float, float, float, int]:
    """Share of alerts in ``num`` among alerts in ``den`` (all alerts if None), with a 95% percentile
    bootstrap CI over alerts. Returns (value, lo, hi, n_den)."""
    c = np.array(classes)
    keep = np.isin(c, den) if den else np.ones(len(c), bool)
    x = np.isin(c[keep], num).astype(float)
    if not len(x):
        return float("nan"), float("nan"), float("nan"), 0
    rng = np.random.default_rng(seed)
    boots = x[rng.integers(0, len(x), (n_boot, len(x)))].mean(1)
    return float(x.mean()), float(np.percentile(boots, 2.5)), float(np.percentile(boots, 97.5)), int(len(x))
