"""Build the data bundle a deployed RoadWatch (Docker / Render) serves.

The 500 MB of composite GeoTIFFs stay on the laptop. The bundle holds only what the API reads:
pre-rendered zone images + their metadata, the composite index, run metrics, predicted roads,
alerts and every alert's before/after evidence chips.
Licences: Sentinel-2 derived (Copernicus open data, attributed) and RoadWatch model outputs.

    uv run python scripts/build_deploy_bundle.py            # -> data_cache/deploy/roadwatch_data.tar.gz
    gh release upload data-v1 data_cache/deploy/roadwatch_data.tar.gz --clobber
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
    for f in sorted(sw.rglob("*")) if sw.exists() else []:
        if f.is_file() and f.suffix in (".webp", ".json"):
            copy(f, f.relative_to(SRC).as_posix())
    zone_alerts = SRC / "outputs" / "alerts" / "alerts_zones.json"
    if zone_alerts.exists():
        copy(zone_alerts, "outputs/alerts/alerts_zones.json")
    alerts = SRC / "outputs" / "alerts" / "alerts.json"
    if alerts.exists():
        copy(alerts, "outputs/alerts/alerts.json")
    # 3. evidence chips for every alert x season, so the deployed server never decodes a zone image
    #    (zone by zone, season by season: the API keeps one decoded zone image in memory)
    chips_dir = api.WEB_CACHE / "chips"
    if chips_dir.exists():
        shutil.rmtree(chips_dir)  # drop chips of alerts from older detection runs
    by_zone: dict[str, list[str]] = {}
    for a in api._alerts_payload().get("alerts", []):
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

    files = sorted(p for p in STAGE.rglob("*") if p.is_file())
    manifest = {
        "built": time.strftime("%Y-%m-%dT%H:%M:%S%z"),
        "zone_images": n_img, "evidence_chips": n_chips, "road_files": len(roads), "files": len(files),
        "bytes": sum(p.stat().st_size for p in files),
        "sha256": {p.relative_to(STAGE).as_posix(): hashlib.sha256(p.read_bytes()).hexdigest()[:16]
                   for p in files},
    }
    (STAGE / "bundle_manifest.json").write_text(json.dumps(manifest, indent=1), encoding="utf-8")

    tar = OUT / "roadwatch_data.tar.gz"
    with tarfile.open(tar, "w:gz", compresslevel=9) as t:
        for p in sorted(STAGE.rglob("*")):
            if p.is_file():
                t.add(p, arcname=p.relative_to(STAGE).as_posix())
    print(f"{n_img} zone images, {len(roads)} road files, {len(files)} files, "
          f"{manifest['bytes'] / 1e6:.1f} MB raw -> {tar} ({tar.stat().st_size / 1e6:.1f} MB)")


if __name__ == "__main__":
    main()
