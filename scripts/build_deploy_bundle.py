"""Build the data bundle a deployed RoadWatch (Docker / Render) serves.

The 500 MB of composite GeoTIFFs stay on the laptop. The bundle holds only what the API reads:
pre-rendered zone images + their metadata, the composite index, run metrics, predicted roads,
alerts and every alert's before/after evidence chips.
Licences: Sentinel-2 derived (Copernicus open data, attributed) and RoadWatch model outputs.

    uv run python scripts/prefetch_sharp.py                 # optional: sharp lookups for every alert
    uv run python scripts/build_deploy_bundle.py            # -> data_cache/deploy/roadwatch_data.tar.gz
    gh release upload data-v1 data_cache/deploy/roadwatch_data.tar.gz --clobber
    git add data_version.txt && git commit && git push     # Render redeploys and fetches the new bundle
"""

from __future__ import annotations

import hashlib
import json
import shutil
import tarfile
import time
from pathlib import Path

from fastapi.testclient import TestClient

from roadwatch.api import app as api

SRC = api.DATA_CACHE
OUT = SRC / "deploy"
STAGE = OUT / "roadwatch_data"
RUN_FILES = ("metrics.json", "timing.json", "per_image_*.csv")


def copy(src: Path, rel: str) -> None:
    dst = STAGE / rel
    dst.parent.mkdir(parents=True, exist_ok=True)
    shutil.copy2(src, dst)


def main() -> None:
    import argparse

    ap = argparse.ArgumentParser()
    ap.add_argument("--scope", choices=("all", "zones"), default="all",
                    help="zones: publish only the pilot-zone alerts (statewide/city alerts not yet flagged)")
    ap.add_argument("--pack-only", action="store_true",
                    help="only write the manifest + tar.gz of an already staged bundle (an interrupted build)")
    args = ap.parse_args()
    scope = args.scope
    if args.pack_only:
        n = lambda pat: sum(1 for _ in STAGE.glob(pat))  # noqa: E731
        pack(n("web_cache/zone_*.webp"), n("web_cache/chips/*.webp"), n("outputs/*/*/*/roads.geojson"))
        return
    if STAGE.exists():
        shutil.rmtree(STAGE)
    STAGE.mkdir(parents=True)
    client = TestClient(api.app)

    # 1. composite index (tile ids only) + every zone/season image rendered through the API itself
    idx = api.composite_index()
    if any(v is None for t in idx.values() for v in t.values()):
        raise SystemExit("data_cache has no GeoTIFFs (it is itself a bundle) - build on the laptop")
    (STAGE / "composites_manifest.json").write_text(
        json.dumps({s: sorted(t) for s, t in idx.items()}), encoding="utf-8")
    n_img = 0
    for code in ("A", "B", "C"):
        for s in client.get(f"/api/imagery/zones/{code}/seasons").json()["seasons"]:
            for suffix in (f"{s['id']}/meta", f"{s['id']}.webp"):
                r = client.get(f"/api/imagery/zones/{code}/{suffix}")
                r.raise_for_status()
            for name in (f"zone_{code}_{s['id']}.webp", f"zone_{code}_{s['id']}.meta.json"):
                copy(api.WEB_CACHE / name, f"web_cache/{name}")
            n_img += 1

    # 2. run metrics (KPIs), predicted roads, alerts
    for run in sorted((SRC / "runs").iterdir()):
        for pat in RUN_FILES:
            for f in run.glob(pat):
                copy(f, f"runs/{run.name}/{f.name}")
    roads = sorted(SRC.glob("outputs/*/*/*/roads.geojson"))
    for f in roads:
        copy(f, f.relative_to(SRC).as_posix())
    # statewide screening (merge_statewide.py): pre-cut evidence chips + summary + the zone-only run
    sw = SRC / "outputs" / "statewide"
    for f in sorted(sw.rglob("*")) if sw.exists() and scope == "all" else []:
        if f.is_file() and f.suffix in (".webp", ".json"):
            copy(f, f.relative_to(SRC).as_posix())
    # extracted road network of every screened state as vector tiles (scripts/build_road_tiles.py)
    rt = SRC / "outputs" / "road_tiles"
    for f in sorted(rt.rglob("*")) if rt.exists() and scope == "all" else []:
        if f.is_file():
            copy(f, f.relative_to(SRC).as_posix())
    zone_alerts = SRC / "outputs" / "alerts" / "alerts_zones.json"
    if zone_alerts.exists():
        copy(zone_alerts, "outputs/alerts/alerts_zones.json")
    alerts = zone_alerts if scope == "zones" else SRC / "outputs" / "alerts" / "alerts.json"
    if alerts.exists():
        copy(alerts, "outputs/alerts/alerts.json")
    published = json.loads(alerts.read_text(encoding="utf-8")).get("alerts", []) if alerts.exists() else []
    flags = SRC / "outputs" / "alerts" / "alert_flags.json"  # scripts/alert_flags.py (plan Phase 1)
    if flags.exists():
        copy(flags, "outputs/alerts/alert_flags.json")
    # sharp before/after lookups (Esri Wayback capture dates per alert), pre-resolved by
    # scripts/prefetch_sharp.py so the deployed server does not query Esri for every visitor; an alert
    # without one is resolved live on first view (the deployed server is online)
    n_sharp = 0
    ids = {a["id"] for a in published}
    wb = api.WEB_CACHE / "wayback"
    for f in sorted(wb.glob("*.json")) if wb.exists() else []:
        if f.name.rsplit("_", 1)[0] in ids:  # cache name = <alert id>_<geometry hash>.json
            copy(f, f"web_cache/wayback/{f.name}")
            n_sharp += 1
    print(f"{n_sharp} of {len(ids)} alerts have a pre-resolved sharp before/after lookup")
    # 3. evidence chips for every alert x season, so the deployed server never decodes a zone image
    #    (zone by zone, season by season: the API keeps one decoded zone image in memory)
    chips_dir = api.WEB_CACHE / "chips"
    if chips_dir.exists():
        shutil.rmtree(chips_dir)  # drop chips of alerts from older detection runs
    by_zone: dict[str, list[str]] = {}
    for a in published:
        try:
            by_zone.setdefault(api._alert_zone(a), []).append(a["id"])
        except Exception:
            continue  # outside the pilot zones: no chips
    n_chips = 0
    for code, ids in sorted(by_zone.items()):
        for s in client.get(f"/api/imagery/zones/{code}/seasons").json()["seasons"]:
            for aid in ids:
                n_chips += client.get(f"/api/alerts/{aid}/evidence/{s['id']}.webp").status_code == 200
    for f in sorted(chips_dir.glob("*.webp")) if chips_dir.exists() else []:
        copy(f, f"web_cache/chips/{f.name}")
    print(f"{n_chips} evidence chips")
    pack(n_img, n_chips, len(roads))


def pack(n_img: int, n_chips: int, n_roads: int) -> None:
    """Manifest + tar.gz of the staged bundle, and data_version.txt."""
    files = sorted(p for p in STAGE.rglob("*") if p.is_file() and p.name != "bundle_manifest.json")
    manifest = {
        "built": time.strftime("%Y-%m-%dT%H:%M:%S%z"),
        "zone_images": n_img, "evidence_chips": n_chips, "road_files": n_roads, "files": len(files),
        "bytes": sum(p.stat().st_size for p in files),
        "sha256": {p.relative_to(STAGE).as_posix(): hashlib.sha256(p.read_bytes()).hexdigest()[:16]
                   for p in files},
    }
    (STAGE / "bundle_manifest.json").write_text(json.dumps(manifest, indent=1), encoding="utf-8")

    tar = OUT / "roadwatch_data.tar.gz"
    with tarfile.open(tar, "w:gz", compresslevel=6) as t:  # most bytes are WebP chips: 9 buys nothing
        for p in sorted(STAGE.rglob("*")):
            if p.is_file():
                t.add(p, arcname=p.relative_to(STAGE).as_posix())
    print(f"{n_img} zone images, {n_roads} road files, {len(files)} files, "
          f"{manifest['bytes'] / 1e6:.1f} MB raw -> {tar} ({tar.stat().st_size / 1e6:.1f} MB)")
    # the Dockerfile COPYs this file before downloading the bundle: commit it with each upload so the
    # next deploy re-downloads instead of reusing Docker's cached layer
    h = hashlib.sha256()
    with tar.open("rb") as f:
        for block in iter(lambda: f.read(1 << 20), b""):
            h.update(block)
    sha = h.hexdigest()
    (Path(__file__).resolve().parents[1] / "data_version.txt").write_text(f"{sha}\n", encoding="utf-8")
    print(f"data_version.txt = {sha[:16]} (commit it after `gh release upload`)")


if __name__ == "__main__":
    main()
