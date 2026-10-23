"""RoadWatch API (FastAPI). Serves the web UI's data from the real project files.

Run:  uv run roadwatch serve            (API + built UI on http://127.0.0.1:8000)
Dev:  uv run roadwatch serve --reload   and `pnpm dev` in web/ (Vite proxies /api)

Everything here reads real outputs (configs, tile registry, composites, run log, metrics, alerts).
If no change-detection output exists, /api/alerts falls back to the demo set and says so (`demo: true`).
"""

from __future__ import annotations

import csv
import hashlib
import json
import logging
import os
import re
import threading
import time
from functools import lru_cache
from pathlib import Path

import numpy as np
from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.gzip import GZipMiddleware
from fastapi.responses import FileResponse, JSONResponse, Response
from fastapi.staticfiles import StaticFiles

from roadwatch import __version__
from roadwatch.config import ROOT, load_config

log = logging.getLogger("roadwatch.api")
CFG_PATH = Path(os.environ.get("ROADWATCH_CONFIG", ROOT / "configs" / "pilot.yaml"))
# a deploy (Docker / Render) points this at the extracted data bundle (scripts/build_deploy_bundle.py)
DATA_CACHE = Path(os.environ.get("ROADWATCH_DATA", ROOT / "data_cache"))
WEB_CACHE = DATA_CACHE / "web_cache"
WEB_DIST = ROOT / "web" / "dist"
OFFLINE = os.environ.get("ROADWATCH_OFFLINE", "0") == "1"
USER_AGENT = "RoadWatchAP/0.1 (KL University capstone; github.com/upeshchowdary)"
SEASON_LABEL = {"pre_monsoon": "Pre-monsoon (Mar–May)", "post_monsoon": "Post-monsoon (Oct–Dec)"}

# API reference lives under /api so the web UI's own /docs route is not shadowed
app = FastAPI(title="RoadWatch AP API", version=__version__,
              description="Road extraction & new-road alerting — pilot NTR/Krishna, Andhra Pradesh",
              docs_url="/api/docs", redoc_url=None, openapi_url="/api/openapi.json")
app.add_middleware(GZipMiddleware, minimum_size=1024)


# ------------------------------------------------------------------ helpers
@lru_cache(maxsize=1)
def cfg():
    return load_config(CFG_PATH)


def zone_by_code(code: str):
    for z in cfg().aoi.zones:
        if z.name.split("_")[0].upper() == code.upper():
            return z
    raise HTTPException(404, f"unknown zone {code!r} (use A, B or C)")


def registry_df():
    from roadwatch.data import registry

    return registry.load()


def composite_index() -> dict[str, dict[str, Path | None]]:
    """{season: {tile_id: path}} for every composite GeoTIFF in the data cache.

    A deploy bundle ships no GeoTIFFs, only their index (path None) and the pre-rendered zone images.
    """
    idx: dict[str, dict[str, Path | None]] = {}
    for p in DATA_CACHE.glob("runs/*/s2/*/*.tif"):
        idx.setdefault(p.parent.name, {}).setdefault(p.stem, p)
    manifest = DATA_CACHE / "composites_manifest.json"
    if not idx and manifest.exists():
        idx = {s: dict.fromkeys(t) for s, t in json.loads(manifest.read_text(encoding="utf-8")).items()}
    return idx


_SEASON = re.compile(r"^\d{4}_(pre|post)_monsoon$")


def check_season(season: str) -> str:
    if not _SEASON.match(season):
        raise HTTPException(404, f"unknown season {season!r} (e.g. 2024_pre_monsoon)")
    return season


def zone_tiles(z) -> list:
    from shapely.geometry import box

    from roadwatch.data.grid import iter_tiles

    return [k for k, _ in iter_tiles(box(*z.bbox), cfg().aoi.grid)]


def season_sort_key(s: str) -> tuple[int, int]:
    y, name = s.split("_", 1)
    return int(y), 0 if name.startswith("pre") else 1


# ------------------------------------------------------------------ meta
@app.get("/api/health")
def health():
    idx = composite_index()
    reg = registry_df()
    return {
        "status": "ok",
        "version": __version__,
        "config": CFG_PATH.name,
        "config_hash": cfg().config_hash(),
        "offline": OFFLINE,
        "aoi": cfg().aoi.name,
        "composites": sum(len(v) for v in idx.values()),
        "seasons": sorted(idx, key=season_sort_key),
        "registry_rows": int(len(reg)),
        "time": time.strftime("%Y-%m-%dT%H:%M:%S%z"),
    }


# ------------------------------------------------------------------ search (geocoding)
_DOWN: dict[str, float] = {}
_NOMINATIM_LOCK = threading.Lock()
_NOMINATIM_LAST = [0.0]
_COORD = re.compile(r"^\s*(-?\d+(?:\.\d+)?)\s*[,; ]\s*(-?\d+(?:\.\d+)?)\s*$")


@lru_cache(maxsize=2048)
def _photon(q: str, limit: int, lat: float | None, lon: float | None) -> tuple:
    import httpx

    params = {"q": q, "limit": limit, "lang": "en"}
    if lat is not None and lon is not None:
        params |= {"lat": lat, "lon": lon}  # bias towards the current view, never a hard filter
    r = httpx.get("https://photon.komoot.io/api/", params=params, timeout=3,
                  headers={"User-Agent": USER_AGENT})
    r.raise_for_status()
    out = []
    for f in r.json().get("features", []):
        p = f["properties"]
        lon_, lat_ = f["geometry"]["coordinates"]
        parts = [p.get("name"), p.get("city") if p.get("city") != p.get("name") else None,
                 p.get("district") or p.get("county"), p.get("state"), p.get("country")]
        ext = p.get("extent")  # [minLon, maxLat, maxLon, minLat]
        out.append({
            "name": p.get("name") or p.get("street") or q,
            "label": ", ".join(dict.fromkeys(x for x in parts if x)),
            "type": p.get("osm_value") or p.get("type"),
            "center": [lon_, lat_],
            "bbox": [ext[0], ext[3], ext[2], ext[1]] if ext else None,
            "source": "photon (OpenStreetMap)",
        })
    return tuple(json.dumps(o) for o in out)


@lru_cache(maxsize=2048)
def _nominatim(q: str, limit: int) -> tuple:
    """Fallback geocoder (OSM Nominatim; policy: <=1 req/s, no autocomplete -> UI searches on Enter)."""
    import httpx

    with _NOMINATIM_LOCK:  # usage policy: max 1 request/second
        wait = _NOMINATIM_LAST[0] + 1.05 - time.time()
        if wait > 0:
            time.sleep(wait)
        _NOMINATIM_LAST[0] = time.time()
    r = httpx.get("https://nominatim.openstreetmap.org/search",
                  params={"q": q, "format": "jsonv2", "limit": limit}, timeout=10,
                  headers={"User-Agent": USER_AGENT})
    r.raise_for_status()
    out = []
    for p in r.json():
        bb = [float(v) for v in p.get("boundingbox", [])]  # [minLat, maxLat, minLon, maxLon]
        out.append({
            "name": p.get("name") or p["display_name"].split(",")[0],
            "label": p["display_name"], "type": p.get("type"),
            "center": [float(p["lon"]), float(p["lat"])],
            "bbox": [bb[2], bb[0], bb[3], bb[1]] if len(bb) == 4 else None,
            "source": "nominatim (OpenStreetMap)",
        })
    return tuple(json.dumps(o) for o in out)


@app.get("/api/search")
def search(q: str = Query(..., min_length=1, max_length=200), limit: int = Query(8, ge=1, le=15),
           lat: float | None = None, lon: float | None = None):
    """Place search for the map. Accepts names ("Gannavaram") or coordinates ("16.53, 80.80")."""
    m = _COORD.match(q)
    if m:
        a, b = float(m.group(1)), float(m.group(2))
        la, lo = (a, b) if abs(a) <= 90 else (b, a)
        return {"results": [{"name": f"{la:.5f}, {lo:.5f}", "label": "Coordinates", "type": "coordinates",
                             "center": [lo, la], "bbox": None, "source": "input"}]}
    if OFFLINE:
        raise HTTPException(503, "offline mode: place search needs the internet (coordinates still work)")
    errors = []
    for name, fn in (("photon", lambda: _photon(q.strip(), limit, round(lat, 1) if lat is not None else None,
                                                round(lon, 1) if lon is not None else None)),
                     ("nominatim", lambda: _nominatim(q.strip(), limit))):
        if _DOWN.get(name, 0) > time.time():
            continue  # circuit breaker: skip a geocoder that just failed
        try:
            res = fn()
            if res:
                return {"results": [json.loads(r) for r in res]}
        except Exception as e:  # noqa: BLE001 — try the next geocoder
            _DOWN[name] = time.time() + 300
            errors.append(f"{name}: {type(e).__name__}")
            log.warning("search via %s failed (skipped for 5 min): %s", name, e)
    if errors:
        raise HTTPException(502, f"search services unavailable ({'; '.join(errors)}), try again")
    return {"results": []}


# ------------------------------------------------------------------ boundaries & zones
BOUNDARIES = {"ap": "andhra_pradesh", "ntr": "ntr_district", "krishna": "krishna_district",
              "pilot": "ntr_krishna"}


@app.get("/api/boundaries/{name}")
def boundary(name: str):
    if name == "districts":
        feats = []
        for key in ("ntr", "krishna"):
            fc = json.loads((ROOT / "configs" / "boundaries" / f"{BOUNDARIES[key]}.geojson").read_text())
            for f in fc["features"]:
                f["properties"] = {"name": "NTR" if key == "ntr" else "Krishna"}
                feats.append(f)
        return {"type": "FeatureCollection", "features": feats}
    if name not in BOUNDARIES:
        raise HTTPException(404, f"unknown boundary {name!r}; one of {sorted(BOUNDARIES) + ['districts']}")
    return FileResponse(ROOT / "configs" / "boundaries" / f"{BOUNDARIES[name]}.geojson",
                        media_type="application/geo+json")


@app.get("/api/zones")
def zones():
    idx = composite_index()
    feats = []
    for z in cfg().aoi.zones:
        code, *rest = z.name.split("_")
        tiles = {k.tile_id for k in zone_tiles(z)}
        seasons = sorted((s for s, t in idx.items() if tiles & set(t)), key=season_sort_key)
        x0, y0, x1, y1 = z.bbox
        feats.append({
            "type": "Feature",
            "properties": {"code": code, "name": " ".join(w.capitalize() for w in rest),
                           "description": z.description, "bbox": list(z.bbox), "tiles": len(tiles),
                           "seasons": seasons, "split": "zone_test (evaluation only)"},
            "geometry": {"type": "Polygon",
                         "coordinates": [[[x0, y0], [x1, y0], [x1, y1], [x0, y1], [x0, y0]]]},
        })
    return {"type": "FeatureCollection", "features": feats}


# ------------------------------------------------------------------ imagery (our Sentinel-2 composites)
def _zone_layout(code: str, season: str):
    """Pixel grid of a zone mosaic for one season, from tile ids only (works from a deploy bundle).

    -> (keys, paths, affine UTM transform of pixel (0, 0), width px, height px, c0, r1)
    """
    from roadwatch.data.sentinel2 import tile_transform

    paths = composite_index().get(season, {})
    keys = [k for k in zone_tiles(zone_by_code(code)) if k.tile_id in paths]
    if not keys:
        raise HTTPException(404, f"no composites for zone {code} season {season}")
    n = keys[0].size_px
    c0, c1 = min(k.col for k in keys), max(k.col for k in keys)
    r0, r1 = min(k.row for k in keys), max(k.row for k in keys)
    t = tile_transform(keys[0].__class__(keys[0].epsg, keys[0].res_m, n, c0, r1))
    return keys, paths, t, (c1 - c0 + 1) * n, (r1 - r0 + 1) * n, c0, r1


@lru_cache(maxsize=8)
def _zone_stretch(code: str) -> list[tuple[float, float]]:
    """Per-band (lo, hi) for a zone from a sample of every season's pixels (pre-monsoon weighted the same
    as post-monsoon). A per-season stretch made every before/after look different (owner review)."""
    import rasterio

    samples = [[], [], []]
    for season in composite_index():
        try:
            keys, paths, *_ = _zone_layout(code, season)
        except HTTPException:
            continue
        for k in keys[::3]:
            p = paths.get(k.tile_id)
            if p is None:
                continue
            with rasterio.open(p) as src:
                a = src.read([3, 2, 1])[:, ::8, ::8]
            ok = (a > 0).all(axis=0)
            for b in range(3):
                samples[b].append(a[b][ok])
    out = []
    for b in range(3):
        v = np.concatenate(samples[b]) if samples[b] else np.array([0, 255])
        lo, hi = np.percentile(v, [2, 98])
        out.append((float(lo), float(hi)))
    return out


def _zone_mosaic(code: str, season: str):
    """Stitch a zone's composite tiles for one season -> (rgb uint8 HxWx3, corners lonlat, scenes)."""
    import rasterio
    from pyproj import Transformer

    keys, paths, t, W, H, c0, r1 = _zone_layout(code, season)
    if any(paths[k.tile_id] is None for k in keys):
        raise HTTPException(404, f"zone {code} {season} is not pre-rendered in this deploy bundle")
    n = keys[0].size_px
    img = np.zeros((3, H, W), np.uint8)
    scenes: set[str] = set()
    for k in keys:
        with rasterio.open(paths[k.tile_id]) as src:
            a = src.read([3, 2, 1])  # B04, B03, B02 -> R, G, B
            scenes.update(t for t in (src.tags().get("scenes") or "").split(",") if t)
        y, x = (r1 - k.row) * n, (k.col - c0) * n
        img[:, y:y + n, x:x + n] = a
    valid = (img > 0).all(axis=0)
    out = np.zeros_like(img)
    stretch = _zone_stretch(code)
    for b in range(3):  # one 2-98 % stretch per zone for ALL seasons: colour differences are real
        lo, hi = stretch[b]
        out[b] = np.clip((img[b].astype(np.float32) - lo) / max(hi - lo, 1) * 255, 0, 255)
    out[:, ~valid] = 0
    tr = Transformer.from_crs(f"EPSG:{keys[0].epsg}", "EPSG:4326", always_xy=True)
    corners = [list(tr.transform(*(t @ (px, py)))) for px, py in ((0, 0), (W, 0), (W, H), (0, H))]
    return np.transpose(out, (1, 2, 0)), valid, corners, sorted(scenes)


@app.get("/api/imagery/zones/{code}/seasons")
def zone_seasons(code: str):
    z = zone_by_code(code)
    tiles = {k.tile_id for k in zone_tiles(z)}
    reg = registry_df()
    reg = reg[(reg.sensor == "s2") & reg.tile_id.isin(tiles)]
    out = []
    for s, t in sorted(composite_index().items(), key=lambda kv: season_sort_key(kv[0])):
        have = tiles & set(t)
        if not have:
            continue
        y, name = s.split("_", 1)
        r = reg[reg.date_key == s]
        out.append({"id": s, "label": f"{SEASON_LABEL.get(name, name)} {y}", "year": int(y),
                    "tiles": len(have), "of": len(tiles),
                    "unreliable_tiles": int((r.status == "reserved").sum()) if len(r) else 0})
    return {"zone": code.upper(), "seasons": out}


@app.get("/api/imagery/zones/{code}/{season}/meta")
def zone_image_meta(code: str, season: str):
    zone_by_code(code)
    check_season(season)
    cached = WEB_CACHE / f"zone_{code.upper()}_{season}.meta.json"
    if cached.exists():
        return json.loads(cached.read_text(encoding="utf-8"))
    _, valid, corners, scenes = _zone_mosaic(code, season)
    meta = {"zone": code.upper(), "season": season, "corners_lonlat": corners,
            "valid_fraction": round(float(valid.mean()), 4), "scenes": scenes,
            "image": f"/api/imagery/zones/{code.upper()}/{season}.webp",
            "attribution": f"Contains modified Copernicus Sentinel data {season[:4]}"}
    WEB_CACHE.mkdir(parents=True, exist_ok=True)
    cached.write_text(json.dumps(meta), encoding="utf-8")
    return meta


@app.get("/api/imagery/zones/{code}/{season}.webp")
def zone_image(code: str, season: str):
    from PIL import Image

    zone_by_code(code)
    check_season(season)
    WEB_CACHE.mkdir(parents=True, exist_ok=True)
    cached = WEB_CACHE / f"zone_{code.upper()}_{season}.webp"
    if not cached.exists():
        rgb, valid, _, _ = _zone_mosaic(code, season)
        rgba = np.dstack([rgb, (valid * 255).astype(np.uint8)])
        Image.fromarray(rgba, "RGBA").save(cached, "WEBP", quality=88, method=4)
    return FileResponse(cached, media_type="image/webp",
                        headers={"Cache-Control": "public, max-age=86400"})


# ------------------------------------------------------------------ quality, runs, KPIs
@app.get("/api/quality/abstain")
def abstain(season: str | None = None):
    """Tiles marked unreliable (cloud / QA) by the Sentinel-2 build — the abstain rule, real data."""
    from shapely.geometry import box, mapping

    from roadwatch.data.grid import TileKey, _to_crs

    reg = registry_df()
    r = reg[(reg.sensor == "s2") & (reg.status == "reserved")]
    if season:
        r = r[r.date_key == season]
    feats = []
    for row in r.itertuples():
        k = TileKey.parse(row.tile_id)
        g = _to_crs(box(*k.bounds()), k.epsg, 4326)
        feats.append({"type": "Feature", "geometry": mapping(g),
                      "properties": {"tile_id": row.tile_id, "date": row.date_key,
                                     "reason": row.reserve_reason, "zone": row.zone,
                                     "valid_fraction": row.valid_fraction}})
    return {"type": "FeatureCollection", "features": feats}


@app.get("/api/registry/summary")
def registry_summary():
    reg = registry_df()
    g = (reg.assign(reason=reg.reserve_reason.fillna(""))
         .groupby(["sensor", "status", "reason"]).size().reset_index(name="n"))
    return {"rows": int(len(reg)), "tiles": int(reg.tile_id.nunique()),
            "by_status": g.to_dict("records")}


@app.get("/api/runs")
def runs():
    with (ROOT / "runs" / "RUN_LOG.csv").open(encoding="utf-8") as f:
        rows = list(csv.DictReader(f))
    hours = sum(float(r["gpu_hours"]) for r in rows if r.get("gpu_hours"))
    return {"runs": rows, "gpu_hours_total": round(hours, 2), "quota_per_account_week": 30}


@app.get("/api/runs/log")
def runs_log():
    """Run log rows as a plain list (the shape the System page reads)."""
    return runs()["runs"]


@app.get("/api/quality/summary")
def quality_summary():
    """Composite / abstain counts per zone and season, from the tile registry."""
    reg = registry_df()
    s2 = reg[reg.sensor == "s2"]
    rows = []
    for (zone, date), g in s2.groupby(["zone", "date_key"]):
        rows.append({"zone": zone, "date": date, "tiles": int(len(g)),
                     "abstained": int((g.status == "reserved").sum()),
                     "mean_valid": round(float(g.valid_fraction.astype(float).mean()), 4)})
    n_abstained = int((s2.status == "reserved").sum())
    return {"composites": int(len(s2)), "abstained": n_abstained, "by_zone_date": rows}


@app.get("/api/kpis")
def kpis():
    """Extraction metrics per finished run, with 95% bootstrap CIs where per-image counts exist."""
    from roadwatch.qa.metrics import from_csv

    out = []
    for mpath in sorted(DATA_CACHE.glob("runs/*/metrics.json")):
        m = json.loads(mpath.read_text(encoding="utf-8"))
        run_dir = mpath.parent
        splits = {}
        for csvp in sorted(run_dir.glob("per_image_*.csv")):
            split = csvp.stem.removeprefix("per_image_")
            ci = from_csv(csvp)
            splits[split] = {k: {"value": round(v.value, 4), "lo": round(v.lo, 4), "hi": round(v.hi, 4),
                                 "n": v.n} for k, v in ci.items()}
        timing = {}
        if (run_dir / "timing.json").exists():
            t = json.loads((run_dir / "timing.json").read_text(encoding="utf-8"))
            keys = ("gpus", "epochs_run", "mean_sec_per_epoch", "wall_sec", "stop_reason")
            timing = {k: t.get(k) for k in keys}
        out.append({"run": run_dir.name, "run_id": m.get("run_id"), "config_hash": m.get("config_hash"),
                    "best_val_iou": m.get("best_val_iou"), "stop_reason": m.get("stop_reason"),
                    "splits": splits, "timing": timing})
    return {"kpis": out, "ci_method": "95% percentile bootstrap over images (2000 resamples)"}


# ------------------------------------------------------------------ roads & alerts
@app.get("/api/roads/predicted")
def predicted_roads(zone: str, season: str):
    hits = sorted(DATA_CACHE.glob(f"outputs/*/{zone_by_code(zone).name}/{season}/roads.geojson"))
    if not hits:
        return {"type": "FeatureCollection", "features": [],
                "note": f"no model output for zone {zone.upper()} {season} yet"}
    return JSONResponse(json.loads(hits[-1].read_text(encoding="utf-8")))


@app.get("/api/roads/predicted/index")
def predicted_index():
    out = []
    for p in sorted(DATA_CACHE.glob("outputs/*/*/*/roads.geojson")):
        model_id, zone, season = p.parts[-4], p.parts[-3], p.parts[-2]
        out.append({"model_id": model_id, "zone": zone.split("_")[0], "season": season})
    return {"outputs": out}


@lru_cache(maxsize=4)
def _read_json(path: Path, mtime_ns: int) -> dict:
    return json.loads(path.read_text(encoding="utf-8"))


def _alerts_payload() -> dict:
    real = DATA_CACHE / "outputs" / "alerts" / "alerts.json"
    if real.exists():
        return _read_json(real, real.stat().st_mtime_ns)
    p = ROOT / "web" / "public" / "data" / "demo" / "alerts.json"
    if not p.exists():
        return {"demo": True, "alerts": [], "note": "change detection not built yet (CP2)"}
    d = dict(_read_json(p, p.stat().st_mtime_ns))
    d["demo"] = True
    d["note"] = ("DEMO: real OSM road geometry with invented scores/statuses for UI design. "
                 "Real alerts arrive with graph-level change detection (CP2).")
    return d


@app.get("/api/alerts")
def alerts():
    """Real alerts from `roadwatch detect` when they exist; otherwise the labelled demo set.

    Review decisions stored on the server (POST /api/reviews) are applied to `status`.
    """
    d = _alerts_payload()
    latest = _review_state()[0]
    fp = DATA_CACHE / "outputs" / "alerts" / "alert_flags.json"  # scripts/alert_flags.py (plan Phase 1)
    fl = _read_json(fp, fp.stat().st_mtime_ns) if fp.exists() else {}
    flags = fl.get("alerts", {})

    def slim(a: dict) -> dict:
        # evidence chip lists stay server-side (GET /api/alerts/{id}/evidence): keeps the list small
        a = {k: v for k, v in a.items() if k != "evidence"}
        if a["id"] in flags:
            a["flags"] = flags[a["id"]]["flags"]
            a["flag_detail"] = {k: v for k, v in flags[a["id"]].items() if k != "flags"}
        return {**a, "status": latest[a["id"]]["status"]} if a["id"] in latest else a

    measured = ("Screening candidates from 10 m Sentinel-2. Measured against OpenStreetMap history "
                "(zones A–C): "
                "about 1 in 3 lies on a road that already existed in 2022; those are flagged and listed "
                "separately ('Flagged: probably not new').")
    return JSONResponse({**d, "quality_note": measured, "flag_sources": fl.get("sources", {}),
                         "alerts": [slim(a) for a in d.get("alerts", [])]})


# ------------------------------------------------------------------ review decisions (training labels)
# "server": decisions are appended to reviews.jsonl (local / team install). "browser": the server
# refuses writes and each viewer's decisions stay in their browser (public read-only deployments).
REVIEWS_MODE = os.environ.get("ROADWATCH_REVIEWS", "server")
REVIEW_STATUSES = {"accepted", "rejected", "flagged", "pending"}
_REVIEW_LOCK = threading.Lock()
_VERB = {"accepted": "Accepted", "rejected": "Rejected", "flagged": "Flagged for field check",
         "pending": "Reopened"}


def _reviews_path() -> Path:
    return DATA_CACHE / "outputs" / "alerts" / "reviews.jsonl"


def _review_state() -> tuple[dict[str, dict], dict[str, list[dict]]]:
    """Append-only log -> (latest decision per alert, full log per alert)."""
    p = _reviews_path()
    latest: dict[str, dict] = {}
    log: dict[str, list[dict]] = {}
    if not p.exists():
        return latest, log
    with p.open(encoding="utf-8") as f:
        for line in f:
            if not line.strip():
                continue
            r = json.loads(line)
            latest[r["alert_id"]] = {"status": r["status"], "reason": r.get("reason"), "at": r["at"]}
            log.setdefault(r["alert_id"], []).append(
                {"at": r["at"], "who": r.get("who", "Analyst"), "action": _VERB[r["status"]],
                 "note": r.get("reason")})
    return latest, log


@app.get("/api/reviews")
def reviews():
    latest, log = _review_state()
    return {"mode": REVIEWS_MODE, "statuses": latest, "log": log}


@app.post("/api/reviews")
def add_review(body: dict):
    """Record a decision for one or more alerts: {"ids": [...], "status": "...", "reason": "..."}."""
    if REVIEWS_MODE != "server":
        raise HTTPException(403, "this deployment is read-only: decisions stay in your browser")
    ids, status = body.get("ids"), body.get("status")
    reason = body.get("reason")
    if status not in REVIEW_STATUSES or not isinstance(ids, list) or not 0 < len(ids) <= 500:
        raise HTTPException(422, "need ids (1-500) and status in " + ", ".join(sorted(REVIEW_STATUSES)))
    if reason is not None and (not isinstance(reason, str) or len(reason) > 500):
        raise HTTPException(422, "reason must be text up to 500 characters")
    known = {a["id"] for a in _alerts_payload().get("alerts", [])}
    if unknown := [i for i in ids if i not in known]:
        raise HTTPException(404, f"unknown alert ids: {unknown[:5]}")
    at = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())
    model = _alerts_payload().get("model_id")
    lines = [json.dumps({"at": at, "alert_id": i, "status": status, "reason": reason, "who": "Analyst",
                         "alerts_model_id": model}) for i in ids]
    with _REVIEW_LOCK:
        _reviews_path().parent.mkdir(parents=True, exist_ok=True)
        with _reviews_path().open("a", encoding="utf-8") as f:
            f.write("\n".join(lines) + "\n")
    return reviews()


@app.get("/api/reviews/labels.geojson")
def review_labels():
    """Reviewed alerts as training labels: accepted = new road, rejected = not a road (+ reason)."""
    latest = _review_state()[0]
    d = _alerts_payload()
    feats = [{"type": "Feature", "geometry": a["geometry"],
              "properties": {"alert_id": a["id"], "label": latest[a["id"]]["status"],
                             "reason": latest[a["id"]]["reason"], "reviewed_at": latest[a["id"]]["at"],
                             "zone": a.get("zone"), "first_seen": a.get("first_seen"),
                             "length_km": a.get("length_km"), "model_id": d.get("model_id")}}
             for a in d.get("alerts", []) if a["id"] in latest and latest[a["id"]]["status"] != "pending"]
    name = "roadwatch_review_labels.geojson"
    return JSONResponse({"type": "FeatureCollection", "features": feats},
                        headers={"Content-Disposition": f'attachment; filename="{name}"'})


# ------------------------------------------------------------------ alert evidence (before / after chips)
_ALERT_ID = re.compile(r"^[A-Za-z0-9_-]{1,40}$")
_CHIP_LOCK = threading.Lock()
CHIP_MIN_PX, CHIP_PAD_PX = 150, 40  # >= 1.5 km square, 400 m margin: enough context to judge a road


def _find_alert(alert_id: str) -> tuple[dict, list[str]]:
    if not _ALERT_ID.match(alert_id):
        raise HTTPException(404, "unknown alert")
    d = _alerts_payload()
    for a in d.get("alerts", []):
        if a["id"] == alert_id:
            return a, [x["id"] if isinstance(x, dict) else x for x in d.get("dates", [])]
    raise HTTPException(404, f"unknown alert {alert_id!r}")


def _lines(a: dict) -> list[list[tuple[float, float]]]:
    g = a["geometry"]
    parts = [g["coordinates"]] if g["type"] == "LineString" else g["coordinates"]
    return [[(float(x), float(y)) for x, y, *_ in part] for part in parts]


def _alert_zone(a: dict) -> str:
    if a.get("zone"):
        return str(a["zone"]).upper()
    lon, lat = _lines(a)[0][0]
    for z in cfg().aoi.zones:
        x0, y0, x1, y1 = z.bbox
        if x0 <= lon <= x1 and y0 <= lat <= y1:
            return z.name.split("_")[0].upper()
    raise HTTPException(404, "alert is outside the pilot zones")


@lru_cache(maxsize=8)
def _to_utm(epsg: int):
    from pyproj import Transformer

    return Transformer.from_crs("EPSG:4326", f"EPSG:{epsg}", always_xy=True)


def _alert_crop(a: dict, code: str, season: str) -> tuple[int, int, int, str]:
    """Square crop of the zone image around the alert -> (x, y, size px, SVG path in crop px)."""
    keys, _, t, W, H, _, _ = _zone_layout(code, season)
    inv, tr = ~t, _to_utm(keys[0].epsg)
    parts = [[inv @ tr.transform(lon, lat) for lon, lat in line] for line in _lines(a)]
    pts = [p for part in parts for p in part]
    if any(not (0 <= x <= W and 0 <= y <= H) for x, y in pts):
        raise HTTPException(404, f"alert {a['id']} is outside the zone {code} image")
    xs, ys = [p[0] for p in pts], [p[1] for p in pts]
    size = int(min(W, H, max(CHIP_MIN_PX, max(xs) - min(xs) + 2 * CHIP_PAD_PX,
                             max(ys) - min(ys) + 2 * CHIP_PAD_PX)))
    x = int(min(W - size, max(0, (min(xs) + max(xs) - size) / 2)))
    y = int(min(H - size, max(0, (min(ys) + max(ys) - size) / 2)))
    path = " ".join("M" + "L".join(f"{px - x:.1f},{py - y:.1f}" for px, py in part) for part in parts)
    return x, y, size, path


@app.get("/api/alerts/{alert_id}/evidence")
def alert_evidence(alert_id: str):
    """Every season's image chip around one alert, with what change detection saw on that date."""
    a, dates = _find_alert(alert_id)
    attribution = "Contains modified Copernicus Sentinel data 2022–2026"
    if a.get("evidence"):  # statewide alerts: chips were cut on Kaggle next to the detection
        chips = [{**c, "image": f"/api/alerts/{a['id']}/evidence/{c['season']}.webp"} for c in a["evidence"]]
        return {"id": a["id"], "zone": a.get("zone"), "first_seen": a.get("first_seen"), "m_per_px": 10,
                "chips": chips, "attribution": attribution}
    code = _alert_zone(a)
    state = dict(zip(dates, a.get("persistence", []), strict=False))
    chips = []
    for season in sorted(composite_index(), key=season_sort_key):
        try:
            _, _, size, path = _alert_crop(a, code, season)
        except HTTPException:
            continue  # zone has no image for this season, or the road leaves it
        chips.append({"season": season, "state": state.get(season), "size_px": size, "path": path,
                      "image": f"/api/alerts/{a['id']}/evidence/{season}.webp"})
    if not chips:
        raise HTTPException(404, f"no imagery around alert {alert_id}")
    return {"id": a["id"], "zone": code, "first_seen": a.get("first_seen"), "m_per_px": 10,
            "chips": chips, "attribution": attribution}


@lru_cache(maxsize=1)
def _zone_rgba(code: str, season: str):
    """Decoded zone image (~40 MB): one at a time, chips are rendered zone by zone."""
    from PIL import Image

    zone_image(code, season)  # makes sure the webp exists
    with Image.open(WEB_CACHE / f"zone_{code}_{season}.webp") as im:
        return im.convert("RGBA")


@app.get("/api/alerts/{alert_id}/evidence/{season}.webp")
def alert_chip(alert_id: str, season: str):
    check_season(season)
    a, _ = _find_alert(alert_id)
    if a.get("evidence"):
        f = DATA_CACHE / "outputs" / "statewide" / "evidence" / a["id"] / f"{season}.webp"
        if not f.exists():
            raise HTTPException(404, f"no {season} chip for alert {alert_id}")
        return FileResponse(f, media_type="image/webp", headers={"Cache-Control": "public, max-age=86400"})
    # geometry hash in the name: a re-run of change detection may reuse an id for another road
    g = hashlib.sha1(json.dumps(a["geometry"], sort_keys=True).encode()).hexdigest()[:10]
    # v2: one colour stretch per zone + 1.5 km window (2026-10-22); older chips are not reused
    cached = WEB_CACHE / "chips" / f"{a['id']}_{season}_{g}_v2.webp"
    if not cached.exists():
        code = _alert_zone(a)
        x, y, size, _ = _alert_crop(a, code, season)
        with _CHIP_LOCK:
            chip = _zone_rgba(code, season).crop((x, y, x + size, y + size))
        cached.parent.mkdir(parents=True, exist_ok=True)
        chip.save(cached, "WEBP", quality=90, method=4)
    return FileResponse(cached, media_type="image/webp",
                        headers={"Cache-Control": "public, max-age=86400"})


# ------------------------------------------------------------------ sharp before / after (Esri Wayback)
WAYBACK_CONFIG = "https://s3-us-west-2.amazonaws.com/config.maptiles.arcgis.com/waybackconfig.json"
BASELINE_END = "2022-05-31"  # end of the 2022 pre-monsoon window: "before" must be captured by then
_WB_LOCK = threading.Lock()


@lru_cache(maxsize=1)
def _wayback_releases(day: str) -> list[tuple[str, str, str, str]]:
    """(release date, release number, tile URL template, metadata URL), oldest first. Cached per day."""
    import httpx

    cfgw = httpx.get(WAYBACK_CONFIG, timeout=20, headers={"User-Agent": USER_AGENT}).json()
    out = []
    for num, v in cfgw.items():
        m = re.search(r"(\d{4}-\d{2}-\d{2})", v.get("itemTitle", ""))
        if m:
            out.append((m.group(1), num, v["itemURL"], v["metadataLayerUrl"]))
    return sorted(out)


def _wayback_capture(meta_url: str, lon: float, lat: float) -> dict | None:
    """When / how sharp / by whom the imagery at a point was captured (Esri imagery metadata)."""
    import httpx

    for layer in range(3, 10):  # 15 cm ... 9.6 m resolution layers
        q = httpx.get(f"{meta_url}/{layer}/query", timeout=20, headers={"User-Agent": USER_AGENT}, params={
            "geometry": f"{lon},{lat}", "geometryType": "esriGeometryPoint", "inSR": 4326,
            "spatialRel": "esriSpatialRelIntersects", "outFields": "SRC_DATE,SRC_RES,NICE_DESC",
            "returnGeometry": "false", "f": "json"}).json()
        if q.get("features"):
            a = q["features"][0]["attributes"]
            d = str(a.get("SRC_DATE") or "")
            return {"captured": f"{d[:4]}-{d[4:6]}-{d[6:8]}" if len(d) == 8 else None,
                    "res_m": a.get("SRC_RES"), "provider": a.get("NICE_DESC")}
    return None


@app.get("/api/alerts/{alert_id}/sharp")
def alert_sharp(alert_id: str):
    """Sub-metre before / after for one alert from Esri World Imagery Wayback (visual reference only).

    "before" = the newest imagery *captured* by the end of the 2022 baseline window, "after" = the newest
    imagery. Release dates are not capture dates, so the capture date at the alert is read from Esri's
    imagery metadata. Esri imagery is shown for human judgement only, never used to train or score.
    """
    a, _ = _find_alert(alert_id)
    g = hashlib.sha1(json.dumps(a["geometry"], sort_keys=True).encode()).hexdigest()[:10]
    cached = WEB_CACHE / "wayback" / f"{a['id']}_{g}.json"
    if cached.exists():
        return json.loads(cached.read_text(encoding="utf-8"))
    if OFFLINE:
        raise HTTPException(503, "offline mode: sharp imagery needs the internet")
    pts = [p for line in _lines(a) for p in line]
    lons, lats = [p[0] for p in pts], [p[1] for p in pts]
    lon, lat = (min(lons) + max(lons)) / 2, (min(lats) + max(lats)) / 2
    with _WB_LOCK:
        try:
            rel = _wayback_releases(time.strftime("%Y-%m-%d"))
            after = None
            for d, num, url, meta in reversed(rel):  # newest release with metadata at this point
                cap = _wayback_capture(meta, lon, lat)
                if cap:
                    after = {"release": d, "release_num": num, "tiles": url, **cap}
                    break
            before = None
            for d, num, url, meta in reversed([r for r in rel if r[0] <= "2022-12-31"]):
                cap = _wayback_capture(meta, lon, lat)
                if cap and cap["captured"] and cap["captured"] <= BASELINE_END:
                    before = {"release": d, "release_num": num, "tiles": url, **cap}
                    break
        except Exception as e:  # noqa: BLE001 - Esri unreachable: the Sentinel-2 evidence still works
            raise HTTPException(502, f"Esri Wayback unavailable: {type(e).__name__}") from e
    out = {"id": a["id"], "bbox": [min(lons), min(lats), max(lons), max(lats)],
           "before": before, "after": after,
           "baseline_end": BASELINE_END,
           "attribution": "Esri World Imagery Wayback" + "".join(
               f" · {x['provider']}" for x in (before, after) if x and x.get("provider")),
           "note": "Visual reference for people only (Esri terms); detection uses Sentinel-2."}
    cached.parent.mkdir(parents=True, exist_ok=True)
    cached.write_text(json.dumps(out), encoding="utf-8")
    return out


# ------------------------------------------------------------------ built UI (single-command run)
if WEB_DIST.exists():
    app.mount("/assets", StaticFiles(directory=WEB_DIST / "assets"), name="assets")

    @app.get("/{path:path}", include_in_schema=False)
    def spa(path: str):
        if path.startswith("api/"):
            raise HTTPException(404)
        f = WEB_DIST / path
        if path and f.is_file():
            return FileResponse(f)
        pub = ROOT / "web" / "public" / path
        if path and pub.is_file():
            return FileResponse(pub)
        # index.html names the hashed bundles: always revalidate so a rebuild shows up on refresh
        return FileResponse(WEB_DIST / "index.html", headers={"Cache-Control": "no-cache"})


@app.exception_handler(Exception)
def _unhandled(_, exc: Exception):  # degraded mode: never leak a stack trace to the browser
    log.exception("unhandled error: %s", exc)
    return Response(json.dumps({"detail": "internal error"}), status_code=500, media_type="application/json")
