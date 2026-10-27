"""Stable alert ids across detection runs (PROJECT_PROMPT Section 14.5).

`detect` numbers alerts by score, so a new season would renumber everything and reviews (stored by
id) would land on the wrong road. Here a new alert that overlaps an earlier alert of the same zone
keeps that alert's id; genuinely new alerts get the next free number. Ids are never reused.
"""

from __future__ import annotations

import re

from shapely.geometry import shape
from shapely.geometry.base import BaseGeometry

# 25 m in degrees at AP latitudes (~16-19 N): alerts are compared in EPSG:4326 as stored in alerts.json
MATCH_DEG = 25.0 / 111_000


def _overlap(a: BaseGeometry, b: BaseGeometry, tol: float) -> float:
    """Share of the shorter line lying within `tol` of the other line."""
    short, other = (a, b) if a.length <= b.length else (b, a)
    if short.length == 0:
        return 0.0
    return short.intersection(other.buffer(tol)).length / short.length


def stable_ids(new: list[dict], previous: list[dict], prefix_of, min_overlap: float = 0.5,
               tol: float = MATCH_DEG, width: int = 3) -> list[dict]:
    """Give each alert in `new` an id: the id of the best-overlapping previous alert with the same
    prefix (if overlap >= min_overlap and that id is not taken yet), else the next unused number.

    prefix_of(alert) -> e.g. "RW-A"; ids look like f"{prefix}{n:0{width}d}" (statewide blocks: width 2)."""
    prev_geom = {p["id"]: shape(p["geometry"]) for p in previous}
    prev_by_prefix: dict[str, list[str]] = {}
    for p in previous:
        prev_by_prefix.setdefault(prefix_of(p), []).append(p["id"])
    taken: set[str] = set()
    out = [dict(a) for a in new]
    pending = []
    # best matches first, so a strong match is not stolen by a weaker one
    cands = []
    for i, a in enumerate(out):
        g = shape(a["geometry"])
        for pid in prev_by_prefix.get(prefix_of(a), []):
            ov = _overlap(g, prev_geom[pid], tol)
            if ov >= min_overlap:
                cands.append((ov, i, pid))
    assigned: dict[int, str] = {}
    for _, i, pid in sorted(cands, reverse=True):
        if i not in assigned and pid not in taken:
            assigned[i] = pid
            taken.add(pid)
    for i, a in enumerate(out):
        if i in assigned:
            a["id"] = assigned[i]
        else:
            pending.append(i)
    # next free number per prefix, above every id ever issued (previous + matched)
    used_num: dict[str, int] = {}
    for pid in [p["id"] for p in previous]:
        m = re.match(r"^(.*?)(\d+)$", pid)
        if m:
            used_num[m.group(1)] = max(used_num.get(m.group(1), 0), int(m.group(2)))
    for i in pending:
        pre = prefix_of(out[i])
        used_num[pre] = used_num.get(pre, 0) + 1
        out[i]["id"] = f"{pre}{used_num[pre]:0{width}d}"
    return out
