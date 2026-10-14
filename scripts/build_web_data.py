"""Build the small static data files the web UI reads (web/public/data/).

Run:  uv run python scripts/build_web_data.py

Inputs (git-ignored, already built by the data pipeline):
  data_cache/runs/s2_build_zones/s2/<year>_<season>/*.tif   zone Sentinel-2 composites
                                          (B02,B03,B04,B08, uint8; Kaggle CPU build, ADR-014)
  evidence/tile_registry.parquet          tile registry (zones, abstained/cloudy tiles)
  data_cache/osm/roads_ntr_krishna_pilot.parquet   OSM roads (ODbL)
  configs/boundaries/*.geojson, configs/zones.yaml

Outputs are real data except web/public/data/demo/*, which is demo data and is labelled as such
in every file and in the UI. Nothing here is a RoadWatch model result yet.
"""

from __future__ import annotations

import json
import random
from pathlib import Path

import geopandas as gpd
import numpy as np
import rasterio
import yaml
from PIL import Image
from pyproj import Transformer
from rasterio.merge import merge
from scipy import ndimage
from shapely.geometry import LineString, MultiLineString, box, mapping
from shapely.ops import linemerge, unary_union

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "web" / "public" / "data"
CACHE = ROOT / "data_cache"

DATES = [  # (folder, label, iso month used for display)
    ("2022_pre_monsoon", "Pre-monsoon 2022", "2022-04"),
    ("2022_post_monsoon", "Post-monsoon 2022", "2022-11"),
    ("2023_pre_monsoon", "Pre-monsoon 2023", "2023-04"),
    ("2023_post_monsoon", "Post-monsoon 2023", "2023-11"),
    ("2024_pre_monsoon", "Pre-monsoon 2024", "2024-04"),
    ("2024_post_monsoon", "Post-monsoon 2024", "2024-11"),
    ("2025_pre_monsoon", "Pre-monsoon 2025", "2025-04"),
    ("2025_post_monsoon", "Post-monsoon 2025", "2025-11"),
    ("2026_pre_monsoon", "Pre-monsoon 2026", "2026-04"),
]
S2_DIR = CACHE / "runs" / "s2_build_zones" / "s2"
if not S2_DIR.exists():  # older local builds
    S2_DIR = CACHE / "s2"
ZONE_A = "A_vijayawada_west_bypass"
UTM = 32644
ROAD_CLASSES = {
    "motorway": "major",
    "trunk": "major",
    "trunk_link": "major",
    "primary": "major",
    "primary_link": "major",
    "secondary": "secondary",
    "secondary_link": "secondary",
    "tertiary": "secondary",
    "tertiary_link": "secondary",
    "unclassified": "minor",
    "residential": "minor",
    "living_street": "minor",
    "road": "minor",
    "service": "minor",
    "track": "track",
}
SEED = 1564  # SIH problem number; makes the demo data deterministic


def rnd(coords, nd=5):
    if isinstance(coords, (list, tuple)) and coords and isinstance(coords[0], (int, float)):
        return [round(c, nd) for c in coords]
    return [rnd(c, nd) for c in coords]


def write_json(path: Path, obj) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(obj, separators=(",", ":")), encoding="utf-8")
    print(f"  {path.relative_to(ROOT)}  {path.stat().st_size / 1024:.0f} KB")


def fc(gdf: gpd.GeoDataFrame, props: list[str], nd: int = 5) -> dict:
    feats = []
    for _, r in gdf.iterrows():
        g = mapping(r.geometry)
        g = {"type": g["type"], "coordinates": rnd(g["coordinates"], nd)}
        feats.append({"type": "Feature", "properties": {p: r[p] for p in props}, "geometry": g})
    return {"type": "FeatureCollection", "features": feats}


# --------------------------------------------------------------------------- boundaries
def boundaries() -> gpd.GeoDataFrame:
    print("boundaries")
    b = ROOT / "configs" / "boundaries"
    ap = gpd.read_file(b / "andhra_pradesh.geojson")
    for tol, name in [(0.004, "ap.json"), (0.03, "ap_globe.json")]:
        s = ap.copy()
        s["geometry"] = s.geometry.simplify(tol, preserve_topology=True)
        s["name"] = "Andhra Pradesh"
        write_json(OUT / "boundaries" / name, fc(s, ["name"], 4))
    d = []
    for f, name in [("ntr_district.geojson", "NTR"), ("krishna_district.geojson", "Krishna")]:
        g = gpd.read_file(b / f)
        g["geometry"] = g.geometry.simplify(0.002, preserve_topology=True)
        g["name"] = name
        d.append(g[["name", "geometry"]])
    districts = gpd.GeoDataFrame(
        np.concatenate([x.values for x in d]), columns=["name", "geometry"], crs=4326
    )
    write_json(OUT / "boundaries" / "districts.json", fc(districts, ["name"], 4))

    zones = yaml.safe_load((ROOT / "configs" / "zones.yaml").read_text())["aoi"]["zones"]
    zf = []
    for z in zones:
        code, *rest = z["name"].split("_")
        zf.append(
            {
                "type": "Feature",
                "properties": {
                    "code": code,
                    "name": " ".join(w.capitalize() for w in rest),
                    "description": z["description"],
                },
                "geometry": mapping(box(*z["bbox"])),
            }
        )
    write_json(OUT / "boundaries" / "zones.json", {"type": "FeatureCollection", "features": zf})
    return districts


# --------------------------------------------------------------------------- zone A imagery
def zone_a(roads: gpd.GeoDataFrame) -> None:
    print("zone A imagery")
    out = OUT / "zoneA"
    out.mkdir(parents=True, exist_ok=True)
    stacks = {}
    scenes: dict[str, int] = {}
    valid: dict[str, float] = {}
    transform = None
    reg = __import__("pandas").read_parquet(ROOT / "evidence" / "tile_registry.parquet")
    tile_ids = sorted(set(reg.loc[(reg["zone"] == ZONE_A) & (reg["sensor"] == "s2"), "tile_id"]))
    for folder, _, _ in DATES:
        files = [str(S2_DIR / folder / f"{t}.tif") for t in tile_ids]
        srcs = [rasterio.open(f) for f in files]
        ids = set()
        for src in srcs:
            # one acquisition can appear twice (original + reprocessed baseline); count datatakes
            ids |= {"_".join(sc.split("_")[:3]) for sc in src.tags().get("scenes", "").split(",") if sc}
        scenes[folder] = len(ids)
        valid[folder] = round(float(np.mean([float(src.tags().get("valid_fraction", 0)) for src in srcs])), 4)
        arr, transform = merge(srcs)
        for s in srcs:
            s.close()
        stacks[folder] = arr
    h, w = stacks[DATES[0][0]].shape[1:]
    left, top = transform.c, transform.f
    right, bottom = left + w * 10, top - h * 10
    to_ll = Transformer.from_crs(UTM, 4326, always_xy=True)
    corners = [
        list(map(lambda v: round(v, 6), to_ll.transform(x, y)))
        for x, y in [(left, top), (right, top), (right, bottom), (left, bottom)]
    ]

    def rgb(a: np.ndarray) -> np.ndarray:
        x = np.stack([a[2], a[1], a[0]], -1).astype(np.float32)
        x = np.clip((x - 4) * 1.25, 0, 255)  # gentle stretch; composites are dark-ish
        return x.astype(np.uint8)

    for folder, _, _ in DATES:
        Image.fromarray(rgb(stacks[folder])).save(out / f"s2_{folder}.webp", quality=74, method=6)
        print(f"  zoneA/s2_{folder}.webp  {(out / f's2_{folder}.webp').stat().st_size / 1024:.0f} KB")

    # --- roads in zone A (OSM, real) ---------------------------------------------------
    zbox = box(*to_ll.transform(left, bottom), *to_ll.transform(right, top))
    za = roads[roads.intersects(zbox)].copy()
    za["geometry"] = za.geometry.intersection(zbox)
    za = za[~za.geometry.is_empty]
    za["c"] = za["highway"].map(ROAD_CLASSES).fillna("minor")
    za["n"] = za["name"].fillna("")
    za["is_bypass"] = za["n"].str.contains("West Bypass", case=False)
    za = za[za["highway"] != "service"]
    za.loc[za["c"].isin(["minor", "track"]), "n"] = ""
    zu = za.to_crs(UTM)
    zu["geometry"] = zu.geometry.simplify(6)
    za = zu.to_crs(4326)
    existing = za[~za["is_bypass"]]
    write_json(out / "roads_existing.json", fc(existing, ["c", "n"]))
    bypass = za[za["is_bypass"]]
    bypass_len_km = float(bypass.to_crs(UTM).length.sum()) / 1000 / 2  # dual carriageway → centreline
    write_json(out / "road_new_reference.json", fc(bypass.assign(c="new"), ["c", "n"]))

    # --- pixel difference baseline (real, on these two composites) -----------------------
    # Change-vector analysis: z-score each band per date (removes overall brightness shifts),
    # then flag pixels whose change magnitude is above mean + 2 sigma.
    def z(a: np.ndarray) -> np.ndarray:
        a = a.astype(np.float32)
        m = a.reshape(4, -1).mean(1)[:, None, None]
        sd = a.reshape(4, -1).std(1)[:, None, None]
        return (a - m) / sd

    diff = np.sqrt(((z(stacks["2024_pre_monsoon"]) - z(stacks["2022_pre_monsoon"])) ** 2).sum(0))
    thr = float(diff.mean() + 2 * diff.std())
    mask = ndimage.binary_opening(diff > thr, structure=np.ones((2, 2)))
    lab, n = ndimage.label(mask, structure=np.ones((3, 3)))
    sizes = ndimage.sum(mask, lab, range(1, n + 1))
    keep = np.isin(lab, np.nonzero(sizes >= 4)[0] + 1)
    n_blobs = int((sizes >= 4).sum())
    ov = np.zeros((h, w, 4), np.uint8)
    ov[keep] = (255, 92, 108, 210)
    Image.fromarray(ov).save(out / "pixeldiff.png", optimize=True)
    print(f"  pixel-diff blobs: {n_blobs} (CVA threshold {thr:.2f}, >=4 px, {keep.mean():.1%} of pixels)")

    # --- hero crop around the new bridge -------------------------------------------------
    inv = ~transform
    bridge = (
        bypass[bypass["other_tags"].fillna("").str.contains('"bridge"=>"yes"')]
        if "other_tags" in bypass
        else bypass
    )
    cx, cy = bridge.to_crs(UTM).union_all().centroid.coords[0]
    px, py = inv * (cx, cy)
    size = 1100
    x0 = int(np.clip(px - size * 0.42, 0, w - size))
    y0 = int(np.clip(py - size * 0.5, 0, h - size))
    for folder in ("2022_pre_monsoon", "2024_pre_monsoon"):
        crop = rgb(stacks[folder])[y0 : y0 + size, x0 : x0 + size]
        Image.fromarray(crop).save(out / f"hero_{folder}.webp", quality=78, method=6)
    Image.fromarray(ov[y0 : y0 + size, x0 : x0 + size]).save(out / "hero_pixeldiff.png", optimize=True)
    crop_box_px = (x0, y0, x0 + size, y0 + size)
    crop_n = int(len(np.unique(lab[y0 : y0 + size, x0 : x0 + size][keep[y0 : y0 + size, x0 : x0 + size]])))

    def svg_paths(gdf: gpd.GeoDataFrame) -> list[dict]:
        res = []
        for _, r in gdf.to_crs(UTM).iterrows():
            geoms = r.geometry.geoms if isinstance(r.geometry, MultiLineString) else [r.geometry]
            for g in geoms:
                if not isinstance(g, LineString):
                    continue
                pts = [inv * (x, y) for x, y in g.coords]
                pts = [(x - x0, y - y0) for x, y in pts]
                if all(not (0 <= x <= size and 0 <= y <= size) for x, y in pts):
                    continue
                d = "M" + " L".join(f"{x:.1f},{y:.1f}" for x, y in pts)
                res.append({"c": r["c"], "d": d})
        return res

    hero_existing = svg_paths(existing[existing["c"].isin(["major", "secondary", "minor"])])
    merged = linemerge(unary_union(list(bypass.geometry)))
    parts = list(merged.geoms) if isinstance(merged, MultiLineString) else [merged]
    parts = sorted((g for g in parts if g.length > 0.002), key=lambda g: -max(y for _, y in g.coords))
    hero_new = svg_paths(gpd.GeoDataFrame({"c": ["new"] * len(parts)}, geometry=parts, crs=4326))
    write_json(out / "hero_paths.json", {"size": size, "existing": hero_existing, "new": hero_new})

    ctr = to_ll.transform(
        *(transform * ((crop_box_px[0] + crop_box_px[2]) / 2, (crop_box_px[1] + crop_box_px[3]) / 2))
    )
    meta = {
        "name": "Zone A · Vijayawada West Bypass corridor",
        "tile_ids": tile_ids,
        "crs": f"EPSG:{UTM}",
        "resolution_m": 10,
        "size_px": [w, h],
        "corners_lonlat": corners,  # TL, TR, BR, BL (MapLibre image-source order)
        "center_lonlat": [round(v, 5) for v in to_ll.transform((left + right) / 2, (top + bottom) / 2)],
        "hero": {
            "crop_px": crop_box_px,
            "center_lonlat": [round(v, 5) for v in ctr],
            "pixeldiff_blobs": crop_n,
        },
        "dates": [
            {
                "id": f,
                "label": lbl,
                "month": m,
                "image": f"s2_{f}.webp",
                "scenes": scenes[f],
                "valid": valid[f],
            }
            for f, lbl, m in DATES
        ],
        "pixeldiff": {
            "before": "2022_pre_monsoon",
            "after": "2024_pre_monsoon",
            "method": "change vector analysis on z-scored B2,B3,B4,B8; threshold mean+2sd",
            "threshold": round(thr, 3),
            "min_blob_px": 4,
            "blobs": n_blobs,
        },
        "reference_new_road": {
            "name": "Vijayawada West Bypass (NH16)",
            "source": "OpenStreetMap",
            "length_km_in_zone": round(bypass_len_km, 1),
        },
        "attribution": (
            "Contains modified Copernicus Sentinel data 2022–2026 · Roads © OpenStreetMap contributors (ODbL)"
        ),
    }
    write_json(out / "meta.json", meta)


# --------------------------------------------------------------------------- pilot roads + demo alerts
def pilot(roads: gpd.GeoDataFrame, districts: gpd.GeoDataFrame) -> None:
    print("pilot layers")
    major = roads[
        roads["highway"].isin(["motorway", "trunk", "primary", "secondary", "trunk_link", "primary_link"])
    ].copy()
    major["c"] = major["highway"].map(ROAD_CLASSES)
    major["n"] = major["name"].fillna("")
    mu = major.to_crs(UTM)
    mu["geometry"] = mu.geometry.simplify(15)
    major = mu.to_crs(4326)
    write_json(OUT / "pilot" / "roads_major.json", fc(major, ["c", "n"], 5))

    # ---- DEMO alerts: real OSM road geometry, invented scores (labelled "demo" everywhere) ----
    rng = random.Random(SEED)
    cand = roads[
        roads["highway"].isin(["residential", "unclassified", "track", "tertiary", "service"])
    ].copy()
    cu = cand.to_crs(UTM)
    cu["len"] = cu.length
    cu = cu[(cu["len"] > 350) & (cu["len"] < 3200)]
    cand = cu.to_crs(4326)
    cand = gpd.sjoin(cand, districts, predicate="within", how="inner")
    picks = cand.sample(n=46, random_state=SEED)
    stages = ["cleared", "earthwork", "gravel", "paved"]
    statuses = ["pending"] * 6 + ["accepted"] * 3 + ["rejected"] * 1 + ["flagged"] * 1
    alerts = []
    for i, (_, r) in enumerate(picks.iterrows(), start=2):
        first = rng.randint(1, len(DATES) - 2)
        pers = []
        for k in range(len(DATES)):
            if k < first:
                pers.append("absent")
            else:
                pers.append(rng.choices(["seen", "abstain"], [0.85, 0.15])[0])
        f = {
            "model": round(rng.uniform(0.70, 0.99), 2),
            "persistence": round(min(1.0, 0.55 + 0.15 * pers.count("seen")), 2),
            "connectivity": round(rng.uniform(0.75, 1.0), 2),
            "quality": round(rng.uniform(0.80, 1.0), 2),
        }
        score = round(f["model"] * f["persistence"] * f["connectivity"] * f["quality"], 2)
        stage = rng.choices(stages, [0.15, 0.25, 0.3, 0.3])[0]
        prio = "high" if rng.random() < 0.18 else ("normal" if rng.random() < 0.75 else "low")
        g = r.geometry
        alerts.append(
            {
                "id": f"RW-{24000 + i * 7}",
                "geometry": {
                    "type": "LineString",
                    "coordinates": rnd(
                        list(g.coords) if isinstance(g, LineString) else list(g.geoms[0].coords)
                    ),
                },
                "length_km": round(r["len"] / 1000, 2),
                "width_m": float(r.get("width_m") or 5.0),
                "district": r["name_right"],
                "score": score,
                "factors": f,
                "stage": stage,
                "surface": "paved" if stage == "paved" else "unpaved",
                "status": rng.choice(statuses),
                "priority": prio,
                "first_seen": DATES[first][0],
                "persistence": pers,
                "sensor": "Sentinel-2 L2A" if rng.random() < 0.7 else "Sentinel-2 + Sentinel-1",
            }
        )
    # featured demo alert: the real new bypass (OSM geometry), scores invented
    zr = gpd.read_file(OUT / "zoneA" / "road_new_reference.json")
    line = zr.to_crs(UTM).union_all()
    meta = json.loads((OUT / "zoneA" / "meta.json").read_text())
    merged = line if isinstance(line, LineString) else max(line.geoms, key=lambda g: g.length)
    feat_geom = gpd.GeoSeries([merged], crs=UTM).to_crs(4326).iloc[0]
    alerts.insert(
        0,
        {
            "id": "RW-24001",
            "geometry": {"type": "LineString", "coordinates": rnd(list(feat_geom.coords))},
            "length_km": meta["reference_new_road"]["length_km_in_zone"],
            "width_m": 30.0,
            "district": "NTR",
            "score": 0.93,
            "factors": {"model": 0.97, "persistence": 1.0, "connectivity": 0.99, "quality": 0.97},
            "stage": "paved",
            "surface": "paved",
            "status": "pending",
            "priority": "high",
            "first_seen": "2022_post_monsoon",
            "persistence": ["absent", "seen", "seen", "seen", "seen"],
            "sensor": "Sentinel-2 L2A",
            "featured": True,
            "name": "Vijayawada West Bypass corridor",
        },
    )
    write_json(
        OUT / "demo" / "alerts.json",
        {
            "demo": True,
            "note": (
                "DEMO DATA. Geometry is real OpenStreetMap road geometry; scores, stages, statuses and "
                "dates are invented for UI design. Not RoadWatch model output."
            ),
            "dates": [{"id": f, "label": lbl, "month": m} for f, lbl, m in DATES],
            "alerts": alerts,
        },
    )


def quality() -> None:
    """Real abstain decisions (tiles reserved as cloudy by the S2 build) and per-zone quality."""
    import pandas as pd

    from roadwatch.data.grid import TileKey

    print("quality")
    reg = pd.read_parquet(ROOT / "evidence" / "tile_registry.parquet")
    s2 = reg[reg["sensor"] == "s2"]
    to_ll = Transformer.from_crs(UTM, 4326, always_xy=True)
    feats = []
    for _, r in s2[s2["reserve_reason"] == "cloudy"].iterrows():
        x0, y0, x1, y1 = TileKey.parse(r["tile_id"]).bounds()
        ring = [
            list(map(lambda v: round(v, 5), to_ll.transform(x, y)))
            for x, y in [(x0, y0), (x1, y0), (x1, y1), (x0, y1), (x0, y0)]
        ]
        feats.append(
            {
                "type": "Feature",
                "properties": {
                    "tile_id": r["tile_id"],
                    "date": r["date_key"],
                    "zone": r["zone"],
                    "valid_fraction": round(float(r["valid_fraction"]), 3),
                    "cloud_fraction": round(float(r["cloud_fraction"]), 3),
                },
                "geometry": {"type": "Polygon", "coordinates": [ring]},
            }
        )
    write_json(OUT / "quality" / "abstain.json", {"type": "FeatureCollection", "features": feats})
    summary = [
        {
            "zone": z,
            "date": d,
            "tiles": int(len(g)),
            "abstained": int((g["reserve_reason"] == "cloudy").sum()),
            "mean_valid": round(float(g["valid_fraction"].mean()), 4),
        }
        for (z, d), g in s2.groupby(["zone", "date_key"])
    ]
    write_json(
        OUT / "quality" / "summary.json",
        {
            "composites": int(len(s2)),
            "abstained": int((s2["reserve_reason"] == "cloudy").sum()),
            "by_zone_date": summary,
        },
    )


def network(roads: gpd.GeoDataFrame, districts: gpd.GeoDataFrame) -> None:
    """Real OSM road inventory for the pilot: km by class, district and surface."""
    import re

    print("network")
    r = roads.copy()
    r["surface"] = (
        r["other_tags"]
        .fillna("")
        .map(lambda t: m.group(1) if (m := re.search(r'"surface"=>"([^"]+)"', t)) else "unknown")
    )
    paved = {"asphalt", "paved", "concrete", "concrete:plates", "paving_stones", "sett", "chipseal"}
    r["surface_class"] = r["surface"].map(
        lambda v: "paved" if v in paved else ("unknown" if v == "unknown" else "unpaved")
    )
    r = gpd.sjoin(r, districts, predicate="intersects", how="inner")
    r = r[~r.index.duplicated()]
    r["km"] = r.to_crs(UTM).length / 1000
    by_class = r.groupby(["name_right", "highway"])["km"].sum().round(1).reset_index()
    by_surface = r.groupby(["name_right", "surface_class"])["km"].sum().round(1).reset_index()
    out = {
        "source": "OpenStreetMap, Geofabrik southern-zone extract (ODbL); clipped to NTR and Krishna",
        "total_km": round(float(r["km"].sum()), 1),
        "segments": int(len(r)),
        "by_class": [
            {"district": d, "class": c, "km": float(k)} for d, c, k in by_class.itertuples(index=False)
        ],
        "by_surface": [
            {"district": d, "surface": c, "km": float(k)} for d, c, k in by_surface.itertuples(index=False)
        ],
    }
    write_json(OUT / "pilot" / "network_stats.json", out)


def system() -> None:
    """Real training/data run log for the app's System screen."""
    import csv

    print("system")
    rows = list(csv.DictReader((ROOT / "runs" / "RUN_LOG.csv").open(encoding="utf-8")))
    keep = ["run_id", "person", "notebook", "config_hash", "start_utc", "end_utc", "gpu_hours", "result"]
    write_json(OUT / "system" / "run_log.json", [{k: r.get(k, "") for k in keep} for r in rows])


def main() -> None:
    roads = gpd.read_parquet(CACHE / "osm" / "roads_ntr_krishna_pilot.parquet")
    districts = boundaries()
    zone_a(roads)
    pilot(roads, districts)
    network(roads, districts)
    quality()
    system()


if __name__ == "__main__":
    main()
