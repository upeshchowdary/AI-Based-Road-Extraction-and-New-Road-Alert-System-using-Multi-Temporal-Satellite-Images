"""Merge statewide screening outputs (kaggle/statewide shards) with the pilot-zone alerts.

    uv run python scripts/merge_statewide.py data_cache/runs/statewide_s0 data_cache/runs/statewide_s1 ...

- Pilot-zone alerts (9 seasons, `roadwatch detect`) keep their ids (RW-A001 ...) and win inside the
  zones; statewide alerts whose midpoint falls in a zone are dropped (Section 14.5: stable ids).
- Every alert's `persistence` is re-aligned to the union of dates; a date that was not analysed for
  that alert is null ("not checked"), never "absent".
- Evidence chips -> data_cache/outputs/statewide/evidence/<id>/<season>.webp (served by the API).
Writes data_cache/outputs/alerts/alerts.json and data_cache/outputs/statewide/summary.json.
"""

from __future__ import annotations

import json
import shutil
import sys
from datetime import UTC, datetime
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "src"))
from roadwatch.config import load_config  # noqa: E402

OUT = ROOT / "data_cache" / "outputs"
ALERTS = OUT / "alerts" / "alerts.json"
ZONE_ALERTS = OUT / "alerts" / "alerts_zones.json"  # the pilot-zone run, kept as the source of truth
SW = OUT / "statewide"


def season_key(s: str) -> tuple[int, int]:
    return int(s[:4]), 0 if "pre" in s else 1


def main(dirs: list[str]) -> None:
    if not ZONE_ALERTS.exists():  # first merge: keep the zone-only run before overwriting alerts.json
        shutil.copy2(ALERTS, ZONE_ALERTS)
    zone = json.loads(ZONE_ALERTS.read_text(encoding="utf-8"))
    zone_dates = [d["id"] if isinstance(d, dict) else d for d in zone["dates"]]
    bboxes = [z.bbox for z in load_config(ROOT / "configs" / "pilot.yaml").aoi.zones]

    sw_alerts, blocks, seasons, models, roads = [], [], set(), set(), []
    for d in map(Path, dirs):
        for f in sorted(d.glob("alerts_s*.json")):
            p = json.loads(f.read_text(encoding="utf-8"))
            seasons.update(p["seasons"])
            models.add(p["model_id"])
            for a in p["alerts"]:
                a["_seasons"] = p["seasons"]
                sw_alerts.append(a)
        for f in sorted(d.glob("blocks_s*.json")):
            blocks += json.loads(f.read_text(encoding="utf-8"))
        roads += sorted(d.glob("roads_s*.parquet"))

    def in_zone(a: dict) -> bool:
        xs = [c[0] for c in a["geometry"]["coordinates"]]
        ys = [c[1] for c in a["geometry"]["coordinates"]]
        x, y = (min(xs) + max(xs)) / 2, (min(ys) + max(ys)) / 2
        return any(b[0] <= x <= b[2] and b[1] <= y <= b[3] for b in bboxes)

    kept = [a for a in sw_alerts if not in_zone(a)]
    dates = sorted(set(zone_dates) | seasons, key=season_key)

    def realign(a: dict, own: list[str]) -> dict:
        state = dict(zip(own, a["persistence"], strict=False))
        return {**a, "persistence": [state.get(s) for s in dates]}

    merged = [realign(a, zone_dates) | {"scope": "pilot zone"} for a in zone["alerts"]]
    for a in kept:
        # newer shards list the dates each alert was analysed on (dates with no roads in the block
        # are dropped as abstain); older shards analysed every season of the run
        run_seasons = a.pop("_seasons")
        own = a.pop("dates", None) or run_seasons
        merged.append(realign(a, own) | {"scope": "statewide"})

    # evidence chips for the statewide alerts that were kept
    ev_dst = SW / "evidence"
    keep_ids = {a["id"] for a in kept}
    n_chips = 0
    for d in map(Path, dirs):
        for src in (d / "evidence").glob("*"):
            if src.name in keep_ids:
                shutil.copytree(src, ev_dst / src.name, dirs_exist_ok=True)
                n_chips += len(list(src.glob("*.webp")))

    done = [b for b in blocks if "skipped" not in b]
    summary = {
        "generated_utc": datetime.now(UTC).isoformat(timespec="seconds"),
        "models": sorted(models),
        "seasons": sorted(seasons, key=season_key),
        "blocks_processed": len(done),
        "blocks_skipped": len(blocks) - len(done),
        "tiles": sum(b["tiles"] for b in done),
        "road_km_latest": round(sum(b.get("road_km_latest", 0) for b in done), 1),
        "candidates": sum(b.get("candidates", 0) for b in done),
        "alerts_statewide": len(sw_alerts),
        "alerts_kept_outside_zones": len(kept),
        "alerts_pilot_zones": len(zone["alerts"]),
        "evidence_chips": n_chips,
        "alert_rule": "statewide: length >= 300 m (ADR-023); pilot zones: roadwatch detect (ADR-020)",
    }
    SW.mkdir(parents=True, exist_ok=True)
    (SW / "summary.json").write_text(json.dumps(summary, indent=1), encoding="utf-8")
    if roads:
        import geopandas as gpd
        import pandas as pd

        gpd.GeoDataFrame(
            pd.concat([gpd.read_parquet(r) for r in roads], ignore_index=True), crs=4326
        ).to_parquet(SW / "roads_latest.parquet")

    payload = {
        "demo": False,
        "model_id": " + ".join([zone.get("model_id", "")] + sorted(models - {zone.get("model_id")})),
        "generated_utc": summary["generated_utc"],
        "params": zone.get("params"),
        "note": (
            "Real alerts: pilot zones A-C from 9-season change detection; the rest of Andhra Pradesh from "
            "statewide screening (6 seasons, alerts >= 300 m). Null persistence = date not analysed."
        ),
        "dates": [
            {"id": s, "label": s.replace("_", " "), "month": "Apr" if "pre" in s else "Nov"} for s in dates
        ],
        "statewide": summary,
        "alerts": sorted(merged, key=lambda a: -a["score"]),
    }
    ALERTS.write_text(json.dumps(payload), encoding="utf-8")
    print(json.dumps(summary, indent=1))
    print(f"alerts.json: {len(merged)} alerts ({len(zone['alerts'])} pilot zone + {len(kept)} statewide)")


if __name__ == "__main__":
    main(sys.argv[1:])
