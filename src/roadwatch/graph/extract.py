"""Road probability mask -> skeleton -> graph -> simplified LineStrings (PROJECT_PROMPT.md 7.2).

threshold -> clean (small blobs, holes) -> skeletonize -> pixel graph (junctions/ends = nodes,
traced pixel chains = edges) -> prune short spurs -> merge degree-2 chains -> Douglas-Peucker
simplify -> per-segment confidence (mean probability along the path) -> GeoDataFrame in the
tile CRS -> GeoJSON / GeoPackage / Shapefile.
"""

from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path

import geopandas as gpd
import networkx as nx
import numpy as np
from affine import Affine
from shapely.geometry import LineString
from skimage.morphology import remove_small_holes, remove_small_objects, skeletonize

OFFSETS = [(-1, -1), (-1, 0), (-1, 1), (0, -1), (0, 1), (1, -1), (1, 0), (1, 1)]


@dataclass(frozen=True)
class GraphParams:
    threshold: float = 0.5
    min_blob_px: int = 30          # remove isolated specks smaller than this
    max_hole_px: int = 30          # fill holes (e.g. cars, tree crowns) smaller than this
    min_spur_px: int = 10          # prune dead-end branches shorter than this
    min_segment_px: int = 8        # drop isolated segments shorter than this
    simplify_px: float = 1.0       # Douglas-Peucker tolerance in pixels


def clean_mask(prob: np.ndarray, p: GraphParams) -> np.ndarray:
    m = prob >= p.threshold
    m = remove_small_objects(m, max_size=p.min_blob_px - 1) if p.min_blob_px > 1 else m
    return remove_small_holes(m, max_size=p.max_hole_px) if p.max_hole_px > 0 else m


def skeleton_graph(skel: np.ndarray) -> nx.MultiGraph:
    """Nodes = skeleton pixels with degree != 2 (ends, junctions); edges carry the pixel path."""
    sk = skel.astype(bool)
    H, W = sk.shape
    ys, xs = np.nonzero(sk)
    pix = set(zip(ys.tolist(), xs.tolist(), strict=True))

    def nbrs(y, x):
        return [(y + dy, x + dx) for dy, dx in OFFSETS
                if 0 <= y + dy < H and 0 <= x + dx < W and (y + dy, x + dx) in pix]

    deg = {q: len(nbrs(*q)) for q in pix}
    node_pix = {q for q, d in deg.items() if d != 2}

    # junction pixels come in adjacent clusters: one graph node per cluster (like sknw)
    cid: dict[tuple, int] = {}
    centroid: dict[int, np.ndarray] = {}
    for q in node_pix:
        if q in cid:
            continue
        k = len(centroid)
        stack, members = [q], []
        cid[q] = k
        while stack:
            a = stack.pop()
            members.append(a)
            for b in nbrs(*a):
                if b in node_pix and b not in cid:
                    cid[b] = k
                    stack.append(b)
        centroid[k] = np.array(members, float).mean(axis=0)

    g = nx.MultiGraph()
    for k, o in centroid.items():
        g.add_node(k, o=o)
    seen: set[tuple] = set()
    used_pix: set[tuple] = set(node_pix)
    for s in node_pix:
        for nb in nbrs(*s):
            if nb in node_pix or (s, nb) in seen:
                continue
            path, prev, cur = [nb], s, nb
            seen.add((s, nb))
            end = None
            while True:
                seen.add((prev, cur))
                seen.add((cur, prev))
                nxt = [n for n in nbrs(*cur) if n != prev and (cur, n) not in seen]
                hit = [n for n in nxt if n in node_pix]
                if hit:
                    end = hit[0]
                    seen.add((hit[0], cur))
                    break
                if not nxt:
                    break
                prev, cur = cur, nxt[0]
                path.append(cur)
            if end is None:
                continue  # duplicate trace of a chain already walked from its other side
            used_pix.update(path)
            a, b = cid[s], cid[end]
            pts = np.vstack([centroid[a], np.array(path, float), centroid[b]])
            g.add_edge(a, b, pts=pts, src=a)

    # pure loops with no junction (all degree-2): seed one node per loop
    loop_pix = pix - used_pix
    while loop_pix:
        s = next(iter(loop_pix))
        path, prev, cur = [s], None, s
        while True:
            nxt = [n for n in nbrs(*cur) if n != prev and n in loop_pix and n not in path]
            if not nxt:
                break
            prev, cur = cur, nxt[0]
            path.append(cur)
        loop_pix -= set(path)
        if len(path) >= 3:
            k = len(centroid)
            centroid[k] = np.array(s, float)
            g.add_node(k, o=centroid[k])
            g.add_edge(k, k, pts=np.array(path + [s], float), src=k)
    return g


def prune_spurs(g: nx.MultiGraph, min_len: int) -> nx.MultiGraph:
    """Iteratively remove dead-end edges shorter than min_len that hang off a junction."""
    changed = True
    while changed:
        changed = False
        for u, v, k, d in list(g.edges(keys=True, data=True)):
            if not g.has_edge(u, v, k):
                continue
            du, dv = g.degree(u), g.degree(v)
            is_spur = (du == 1) != (dv == 1)  # one free end, other end attached elsewhere
            if is_spur and len(d["pts"]) < min_len and max(du, dv) >= 3:
                g.remove_edge(u, v, k)
                changed = True
        g.remove_nodes_from([n for n in list(g.nodes) if g.degree(n) == 0])
    return g


def merge_degree2(g: nx.MultiGraph) -> nx.MultiGraph:
    """After pruning, join edges through nodes that now have exactly two edges."""
    for n in [n for n in list(g.nodes) if g.degree(n) == 2]:
        es = list(g.edges(n, keys=True, data=True))
        if len(es) != 2 or es[0][1] == n or es[1][1] == n:
            continue
        (_, a, ka, da), (_, b, kb, db) = es
        pa = da["pts"] if da["src"] == a else da["pts"][::-1]   # oriented a -> n
        pb = db["pts"] if db["src"] == n else db["pts"][::-1]   # oriented n -> b
        g.remove_edge(n, a, ka)
        g.remove_edge(n, b, kb)
        g.remove_node(n)
        g.add_edge(a, b, pts=np.vstack([pa, pb[1:]]), src=a)
    return g


def mask_to_lines(prob: np.ndarray, transform: Affine, crs: str,
                  p: GraphParams | None = None) -> gpd.GeoDataFrame:
    """Probability raster (H, W in [0,1]) -> road centre-lines with confidence, in `crs`."""
    p = p or GraphParams()
    m = clean_mask(prob, p)
    g = merge_degree2(prune_spurs(skeleton_graph(skeletonize(m)), p.min_spur_px))
    rows = []
    for u, v, d in g.edges(data=True):
        pts = d["pts"]
        if len(pts) < p.min_segment_px and g.degree(u) == 1 and g.degree(v) == 1:
            continue
        r, c = pts[:, 0].astype(int), pts[:, 1].astype(int)
        conf = float(prob[r, c].mean())
        # pixel centres -> map coords
        xs, ys = transform * (pts[:, 1] + 0.5, pts[:, 0] + 0.5)
        line = LineString(np.column_stack([xs, ys])).simplify(p.simplify_px * abs(transform.a))
        rows.append({"confidence": round(conf, 4), "length_m": round(line.length, 1),
                     "n_px": len(pts), "geometry": line})
    return gpd.GeoDataFrame(rows, columns=["confidence", "length_m", "n_px", "geometry"],
                            geometry="geometry", crs=crs)


def close_gaps(lines: gpd.GeoDataFrame, max_gap_m: float = 30.0, max_angle_deg: float = 45.0,
               touch_m: float = 1.0) -> gpd.GeoDataFrame:
    """Join dangling road ends to the nearest other road within `max_gap_m` (ADR-028).

    A road broken by a tree, shadow or a cloudy pixel row is one road; left broken, every route
    across the break is lost (APLS). Only *dangling* ends (not within `touch_m` of another line) are
    joined, and only if the link continues the road's own direction within `max_angle_deg`, so
    parallel roads are not stitched together. Links carry `gap_fill=True` and the mean confidence of
    the two roads they join. Defaults: 3 pixels at 10 m, fixed a priori.
    """
    from shapely.geometry import Point
    from shapely.ops import nearest_points

    if lines.empty:
        return lines.assign(gap_fill=False)
    geoms = list(lines.geometry)
    conf = lines["confidence"].to_numpy() if "confidence" in lines else np.full(len(geoms), 0.5)
    sidx = lines.sindex
    cos_max = np.cos(np.radians(max_angle_deg))
    links = []
    for i, g in enumerate(geoms):
        if g.is_empty or g.length == 0:
            continue
        cs = list(g.coords)
        ends = ((cs[0], cs[1] if len(cs) > 1 else cs[0]), (cs[-1], cs[-2] if len(cs) > 1 else cs[-1]))
        for end, prev in ends:
            e = Point(end)
            near = [j for j in sidx.query(e.buffer(max_gap_m)) if j != i]
            if any(geoms[j].distance(e) <= touch_m for j in near):
                continue  # already connected
            if any(lk["geometry"].distance(e) <= touch_m for lk in links):
                continue  # the other side of this gap already made the link
            d = np.array([end[0] - prev[0], end[1] - prev[1]])
            if not np.linalg.norm(d):
                continue
            d = d / np.linalg.norm(d)  # direction the road is heading at this end
            best = None
            for j in near:
                q = nearest_points(e, geoms[j])[1]
                v = np.array([q.x - end[0], q.y - end[1]])
                dist = float(np.linalg.norm(v))
                if dist > max_gap_m or dist <= touch_m or float(v @ d) / dist < cos_max:
                    continue
                if best is None or dist < best[0]:
                    best = (dist, j, q)
            if best:
                dist, j, q = best
                # overshoot 0.5 m so the link really crosses road j (an end exactly on a line can miss
                # it by floating-point error and leave the gap open when the network is noded)
                f = (dist + 0.5) / dist
                link = LineString([end, (end[0] + (q.x - end[0]) * f, end[1] + (q.y - end[1]) * f)])
                c = round(float((conf[i] + conf[j]) / 2), 4)
                links.append({"confidence": c, "length_m": round(link.length, 1), "n_px": 0,
                              "geometry": link})
    out = lines.assign(gap_fill=False)
    if not links:
        return out
    add = gpd.GeoDataFrame(links, geometry="geometry", crs=lines.crs).assign(gap_fill=True)
    import pandas as pd

    return gpd.GeoDataFrame(pd.concat([out, add], ignore_index=True), geometry="geometry", crs=lines.crs)


def export(lines: gpd.GeoDataFrame, out_base: Path, formats=("geojson", "gpkg", "shp")) -> list[Path]:
    """Write QGIS-friendly files. GeoJSON is reprojected to EPSG:4326 (RFC 7946)."""
    out_base.parent.mkdir(parents=True, exist_ok=True)
    paths = []
    if "geojson" in formats:
        pth = out_base.with_suffix(".geojson")
        lines.to_crs(4326).to_file(pth, driver="GeoJSON")
        paths.append(pth)
    if "gpkg" in formats:
        pth = out_base.with_suffix(".gpkg")
        lines.to_file(pth, driver="GPKG", layer="roads")
        paths.append(pth)
    if "shp" in formats:
        pth = out_base.with_suffix(".shp")
        lines.to_file(pth, driver="ESRI Shapefile")
        paths.append(pth)
    return paths
