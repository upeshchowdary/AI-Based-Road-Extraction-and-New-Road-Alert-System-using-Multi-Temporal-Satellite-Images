"""APLS — Average Path Length Similarity (charter KPI-1; Van Etten et al., SpaceNet 2018).

Pixel IoU ignores connectivity: a road broken every 200 m scores well on IoU but is useless for routing.
APLS samples pairs of control points on the reference network, compares shortest-path lengths through the
reference and through the proposed network, and penalises missing or detoured paths:

    APLS(ref -> prop) = 1 - mean over pairs of min(1, |L_ref - L_prop| / L_ref)    (no path -> 1)

and the reported score is the harmonic mean of both directions (ref -> prop, prop -> ref).

Reimplemented from the published definition (reference code: github.com/CosmiQ/apls, whose PyPI release
pins GDAL 2.4 and no longer installs). Differences, stated: control points are graph nodes after densifying
every `step_m`, and snapping uses the nearest node within `snap_m` (scaled for 10 m imagery; SpaceNet used
~4 m for 0.3 m imagery).
"""

from __future__ import annotations

from dataclasses import dataclass

import numpy as np
from scipy.sparse import coo_matrix
from scipy.sparse.csgraph import connected_components, dijkstra
from scipy.spatial import cKDTree
from shapely.geometry import LineString, MultiLineString
from shapely.ops import unary_union


@dataclass(frozen=True)
class APLSParams:
    step_m: float = 25.0     # densify edges: nodes (and control points) at most this far apart
    snap_m: float = 25.0     # a control point maps to the other graph's nearest node within this distance
    n_pairs: int = 1000      # sampled control-point pairs per direction
    min_path_m: float = 200.0  # pairs closer than this along the road are skipped (too short to judge)
    seed: int = 1564


class RoadGraph:
    """Noded, densified road network: nodes (xy array) + sparse symmetric edge-length matrix."""

    def __init__(self, geoms, step_m: float):
        lines = []
        u = unary_union([g for g in geoms if g is not None and not g.is_empty])  # nodes all crossings
        for ln in getattr(u, "geoms", [u]) if not isinstance(u, LineString) else [u]:
            if isinstance(ln, MultiLineString):
                lines += list(ln.geoms)
            elif isinstance(ln, LineString) and ln.length > 0:
                lines.append(ln)
        index, xy, rows, cols, w = {}, [], [], [], []

        def node(p):
            key = (round(p[0], 1), round(p[1], 1))
            if key not in index:
                index[key] = len(xy)
                xy.append(key)
            return index[key]

        for ln in lines:
            n = max(int(np.ceil(ln.length / step_m)), 1)
            pts = [ln.interpolate(t, normalized=True).coords[0] for t in np.linspace(0, 1, n + 1)]
            ids = [node(p) for p in pts]
            for a, b, pa, pb in zip(ids[:-1], ids[1:], pts[:-1], pts[1:], strict=True):
                if a != b:
                    d = float(np.hypot(pa[0] - pb[0], pa[1] - pb[1]))
                    rows += [a, b]
                    cols += [b, a]
                    w += [d, d]
        self.xy = np.array(xy, float).reshape(-1, 2)
        n = len(self.xy)
        self.adj = coo_matrix((w, (rows, cols)), shape=(n, n)).tocsr()
        self.tree = cKDTree(self.xy) if n else None
        self.n_comp, self.comp = connected_components(self.adj, directed=False) if n else (0, np.array([]))

    def __len__(self):
        return len(self.xy)


def _one_way(ref: RoadGraph, prop: RoadGraph, p: APLSParams) -> tuple[float, int]:
    """1 - mean path-length penalty for paths on `ref`, looked up on `prop`."""
    if len(ref) < 2:
        return float("nan"), 0
    if len(prop) == 0:
        return 0.0, 0
    rng = np.random.default_rng(p.seed)
    src = rng.choice(len(ref), size=min(len(ref), max(1, p.n_pairs // 10)), replace=False)
    d_ref = dijkstra(ref.adj, indices=src, directed=False)
    dist, near = prop.tree.query(ref.xy, distance_upper_bound=p.snap_m)  # snap every ref node once
    snapped = np.where(np.isfinite(dist), near, -1)
    pens = []
    for i, s in enumerate(src):
        ok = np.flatnonzero(np.isfinite(d_ref[i]) & (d_ref[i] >= p.min_path_m))
        if not len(ok):
            continue
        tgt = rng.choice(ok, size=min(len(ok), 10), replace=False)
        a = snapped[s]
        if a < 0:
            pens += [1.0] * len(tgt)
            continue
        d_prop = dijkstra(prop.adj, indices=[a], directed=False)[0]
        for t in tgt:
            b = snapped[t]
            if b < 0 or not np.isfinite(d_prop[b]):
                pens.append(1.0)
            else:
                pens.append(min(1.0, abs(d_ref[i][t] - d_prop[b]) / d_ref[i][t]))
    return (1.0 - float(np.mean(pens)) if pens else float("nan")), len(pens)


def apls(ref_geoms, prop_geoms, p: APLSParams | None = None) -> dict:
    """Symmetric APLS (harmonic mean of both directions) for two line layers in the same metric CRS."""
    p = p or APLSParams()
    ref, prop = RoadGraph(ref_geoms, p.step_m), RoadGraph(prop_geoms, p.step_m)
    a, na = _one_way(ref, prop, p)
    b, nb = _one_way(prop, ref, p)
    h = 2 * a * b / (a + b) if a + b > 0 and np.isfinite(a) and np.isfinite(b) else 0.0
    return {"apls": h, "ref_to_prop": a, "prop_to_ref": b, "pairs": na + nb,
            "ref_nodes": len(ref), "prop_nodes": len(prop)}
