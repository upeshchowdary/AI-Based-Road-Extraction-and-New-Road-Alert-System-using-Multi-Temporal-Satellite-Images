"""Graph-level new-road detection across seasons (PROJECT_PROMPT.md 7.3, O3 — first version).

For one zone, given the model's road centre-lines for every season:
  1. baseline = roads seen in the baseline seasons (default: both 2022 seasons), buffered;
  2. candidates = roads in the latest season that lie outside the baseline buffer, merged into
     continuous segments, at least `min_length_m` long;
  3. each candidate gets a presence vector over the later seasons: seen / absent / abstain
     (abstain = the season's tile was marked unreliable — never counted as "absent");
  4. persistence rule: seen in >= `persistence_min_dates` later seasons;
  5. score = model confidence x persistence x connectivity x data quality.

This compares road *vectors* (graphs), not pixels, so a road must exist as a connected line
over several dates to alert. Width, surface and construction stage are NOT estimated yet (CP2).
"""

from __future__ import annotations

from dataclasses import dataclass

import geopandas as gpd
import numpy as np
from shapely import STRtree
from shapely.geometry import LineString, MultiLineString, Point
from shapely.geometry.base import BaseGeometry
from shapely.ops import linemerge, unary_union


@dataclass(frozen=True)
class ChangeParams:
    baseline: tuple[str, ...] = ("2022_pre_monsoon", "2022_post_monsoon")
    match_buffer_m: float = 25.0      # a road counts as "the same" within this distance
    seen_overlap: float = 0.6         # share of a candidate's length that must match to count as seen
    min_length_m: float = 100.0       # config change.min_length_m
    persistence_min_dates: int = 2    # config change.persistence_min_dates
    min_seen: int = 3                 # seen in at least this many later seasons
    min_stability: float = 0.75       # once it appears, seen in >= this share of the clear seasons after
    connect_dist_m: float = 30.0      # endpoint within this of the old network = connected


def _lines(g: BaseGeometry) -> list[LineString]:
    if g.is_empty:
        return []
    if isinstance(g, LineString):
        return [g]
    if isinstance(g, MultiLineString):
        return list(g.geoms)
    return [x for part in getattr(g, "geoms", []) for x in _lines(part)]


class _SeasonMask:
    """A season's roads, buffered and burned into a 5 m grid: O(1) "is this point near a road?".

    Replaces per-candidate geometry unions (minutes, GBs of RAM) with point sampling (seconds).
    """

    def __init__(self, geoms, bounds: tuple[float, float, float, float], buf: float, res: float = 5.0):
        from rasterio.features import rasterize
        from rasterio.transform import from_origin

        x0, y0, x1, y1 = bounds
        self.x0, self.y1, self.res = x0, y1, res
        self.w, self.h = int(np.ceil((x1 - x0) / res)) + 1, int(np.ceil((y1 - y0) / res)) + 1
        shapes = ((g.buffer(buf, quad_segs=2), 1) for g in geoms if not g.is_empty)
        self.mask = rasterize(shapes, out_shape=(self.h, self.w), transform=from_origin(x0, y1, res, res),
                              fill=0, all_touched=True, dtype="uint8").astype(bool)

    def seen_fraction(self, line: LineString) -> float:
        n = max(int(line.length / self.res), 2)
        pts = [line.interpolate(t, normalized=True) for t in np.linspace(0, 1, n)]
        cols = np.clip(((np.array([q.x for q in pts]) - self.x0) / self.res).astype(int), 0, self.w - 1)
        rows = np.clip(((self.y1 - np.array([q.y for q in pts])) / self.res).astype(int), 0, self.h - 1)
        return float(self.mask[rows, cols].mean())


def detect_new_roads(
    lines: dict[str, gpd.GeoDataFrame],
    seasons: list[str],
    abstain: dict[str, BaseGeometry] | None = None,
    p: ChangeParams | None = None,
) -> gpd.GeoDataFrame:
    """lines: season -> road lines (metric CRS, column `confidence`); seasons in time order."""
    p = p or ChangeParams()
    abstain = abstain or {}
    crs = next(iter(lines.values())).crs
    base_seasons = [s for s in seasons if s in p.baseline and s in lines]
    later = [s for s in seasons if s not in p.baseline and s in lines]
    cols = ["geometry", "length_m", "confidence", "persistence", "seen", "first_seen",
            "connectivity", "quality", "score"]
    if not base_seasons or not later:
        return gpd.GeoDataFrame(columns=cols, geometry="geometry", crs=crs)

    base_geoms = np.array([g for s in base_seasons for g in lines[s].geometry])
    base_buf = unary_union(list(base_geoms)).buffer(p.match_buffer_m)
    base_tree = STRtree(base_geoms)

    latest = later[-1]
    new_parts = unary_union(list(lines[latest].geometry)).difference(base_buf)
    merged = linemerge(_lines(new_parts)) if not new_parts.is_empty else new_parts
    cands = [c for c in _lines(merged) if c.length >= p.min_length_m]

    pad = p.match_buffer_m + 10
    xs0, ys0, xs1, ys1 = np.array([lines[s].total_bounds for s in seasons if s in lines]).T
    bounds = (xs0.min() - pad, ys0.min() - pad, xs1.max() + pad, ys1.max() + pad)
    masks = {s: _SeasonMask(lines[s].geometry, bounds, p.match_buffer_m) for s in later}
    latest_tree = STRtree(np.array(lines[latest].geometry))
    latest_conf = lines[latest]["confidence"].to_numpy()

    rows = []
    for c in cands:
        status = []
        for s in seasons:
            if s in base_seasons:
                status.append("absent")
                continue
            ab = abstain.get(s)
            if ab is not None and not ab.is_empty and ab.contains(c.interpolate(0.5, normalized=True)):
                status.append("abstain")
                continue
            frac = masks[s].seen_fraction(c)
            status.append("seen" if frac >= p.seen_overlap else "absent")
        later_status = status[len(seasons) - len(later):]
        n_seen = later_status.count("seen")
        n_valid = sum(x != "abstain" for x in later_status)
        if n_seen < max(p.persistence_min_dates, p.min_seen) or status[-1] != "seen":
            continue
        # first season from which the road stays visible in >= persistence_min_dates seasons
        i0 = next(i for i, st in enumerate(status)
                  if st == "seen" and status[i:].count("seen") >= p.persistence_min_dates)
        first_seen = seasons[i0]
        # stability: a real new road appears and stays; model flicker comes and goes
        after = [x for x in status[i0:] if x != "abstain"]
        if after.count("seen") / max(len(after), 1) < p.min_stability:
            continue
        idx = latest_tree.query(c.buffer(p.match_buffer_m))
        conf = float(np.mean(latest_conf[idx])) if len(idx) else 0.5
        ends = [Point(c.coords[0]), Point(c.coords[-1])]
        connected = any(len(base_tree.query(e.buffer(p.connect_dist_m))) > 0 for e in ends)
        connectivity = 1.0 if connected else 0.6
        persistence = n_seen / max(n_valid, 1)
        quality = n_valid / len(later_status)
        rows.append({
            "geometry": c, "length_m": round(c.length, 1), "confidence": round(conf, 3),
            "persistence": persistence, "seen": status, "first_seen": first_seen,
            "connectivity": connectivity, "quality": round(quality, 3),
            "score": round(conf * persistence * connectivity * quality, 3),
        })
    out = gpd.GeoDataFrame(rows, columns=cols, geometry="geometry", crs=crs)
    return out.sort_values("score", ascending=False).reset_index(drop=True)
