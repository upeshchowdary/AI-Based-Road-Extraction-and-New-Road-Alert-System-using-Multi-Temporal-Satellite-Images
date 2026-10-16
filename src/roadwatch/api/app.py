"""RoadWatch API (FastAPI). Serves the web UI's data from the real project files.

Run:  uv run roadwatch serve            (API + built UI on http://127.0.0.1:8000)
Dev:  uv run roadwatch serve --reload   and `pnpm dev` in web/ (Vite proxies /api)

Everything here reads real outputs (configs, tile registry, composites, run log, metrics).
The only demo content is /api/alerts (change detection is CP2) and it says so in the payload.
"""

from __future__ import annotations

import csv
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
DATA_CACHE = ROOT / "data_cache"
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


def composite_index() -> dict[str, dict[str, Path]]:
    """{season: {tile_id: path}} for every composite GeoTIFF in the data cache."""
    idx: dict[str, dict[str, Path]] = {}
    for p in DATA_CACHE.glob("runs/*/s2/*/*.tif"):
        idx.setdefault(p.parent.name, {}).setdefault(p.stem, p)
    return idx


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
def _zone_mosaic(code: str, season: str):
    """Stitch a zone's composite tiles for one season -> (rgb uint8 HxWx3, corners lonlat, scenes)."""
    import rasterio
    from pyproj import Transformer

    from roadwatch.data.sentinel2 import tile_transform

    z = zone_by_code(code)
    keys = zone_tiles(z)
    paths = composite_index().get(season, {})
    keys = [k for k in keys if k.tile_id in paths]
    if not keys:
        raise HTTPException(404, f"no composites for zone {code} season {season}")
    n = keys[0].size_px
    c0, c1 = min(k.col for k in keys), max(k.col for k in keys)
    r0, r1 = min(k.row for k in keys), max(k.row for k in keys)
    img = np.zeros((3, (r1 - r0 + 1) * n, (c1 - c0 + 1) * n), np.uint8)
    scenes: set[str] = set()
    for k in keys:
        with rasterio.open(paths[k.tile_id]) as src:
            a = src.read([3, 2, 1])  # B04, B03, B02 -> R, G, B
            scenes.update(t for t in (src.tags().get("scenes") or "").split(",") if t)
        y, x = (r1 - k.row) * n, (k.col - c0) * n
        img[:, y:y + n, x:x + n] = a
    valid = (img > 0).all(axis=0)
    out = np.zeros_like(img)
    for b in range(3):  # 2-98 % stretch per band over valid pixels
        v = img[b][valid]
        lo, hi = (np.percentile(v, [2, 98]) if v.size else (0, 255))
        out[b] = np.clip((img[b].astype(np.float32) - lo) / max(hi - lo, 1) * 255, 0, 255)
    out[:, ~valid] = 0
    t = tile_transform(keys[0].__class__(keys[0].epsg, keys[0].res_m, n, c0, r1))
    W, H = img.shape[2], img.shape[1]
    tr = Transformer.from_crs(f"EPSG:{keys[0].epsg}", "EPSG:4326", always_xy=True)
    corners = [list(tr.transform(*(t * (px, py)))) for px, py in ((0, 0), (W, 0), (W, H), (0, H))]
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
    _, valid, corners, scenes = _zone_mosaic(code, season)
    return {"zone": code.upper(), "season": season, "corners_lonlat": corners,
            "valid_fraction": round(float(valid.mean()), 4), "scenes": scenes,
            "image": f"/api/imagery/zones/{code.upper()}/{season}.webp",
            "attribution": f"Contains modified Copernicus Sentinel data {season[:4]}"}


@app.get("/api/imagery/zones/{code}/{season}.webp")
def zone_image(code: str, season: str):
    from PIL import Image

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
    return {"runs": rows, "gpu_hours_total": round(hours, 2), "quota_per_account_week": 6}


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


@app.get("/api/alerts")
def alerts():
    """Real alerts from `roadwatch detect` when they exist; otherwise the labelled demo set."""
    real = DATA_CACHE / "outputs" / "alerts" / "alerts.json"
    if real.exists():
        return JSONResponse(json.loads(real.read_text(encoding="utf-8")))
    p = ROOT / "web" / "public" / "data" / "demo" / "alerts.json"
    if not p.exists():
        return {"demo": True, "alerts": [], "note": "change detection not built yet (CP2)"}
    d = json.loads(p.read_text(encoding="utf-8"))
    d["demo"] = True
    d["note"] = ("DEMO: real OSM road geometry with invented scores/statuses for UI design. "
                 "Real alerts arrive with graph-level change detection (CP2).")
    return d


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
