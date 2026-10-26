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
from shapely.geometry import Point  # noqa: E402
from shapely.prepared import prep  # noqa: E402

from roadwatch.config import load_config  # noqa: E402

OUT = ROOT / "data_cache" / "outputs"
ALERTS = OUT / "alerts" / "alerts.json"
ZONE_ALERTS = OUT / "alerts" / "alerts_zones.json"  # the pilot-zone run, kept as the source of truth
SW = OUT / "statewide"


REGION_CONFIGS = {"ap": "statewide", "tn": "tamil_nadu", "hyd": "hyderabad", "blr": "bangalore"}


def season_key(s: str) -> tuple[int, int]:
    return int(s[:4]), 0 if "pre" in s else 1


def _region(cfg: Path):
    """The AOI boundary of a run config (lon/lat polygon)."""
    import geopandas as gpd

    return gpd.read_file(ROOT / load_config(cfg).aoi.boundary).to_crs(4326).union_all()


def _mid(a: dict) -> tuple[float, float]:
    """Centre of an alert's bounding box (lon, lat)."""
    xs = [c[0] for c in a["geometry"]["coordinates"]]
    ys = [c[1] for c in a["geometry"]["coordinates"]]
    return (min(xs) + max(xs)) / 2, (min(ys) + max(ys)) / 2


def main(dirs: list[str]) -> None:
    if not ZONE_ALERTS.exists():  # first merge: keep the zone-only run before overwriting alerts.json
        shutil.copy2(ALERTS, ZONE_ALERTS)
    zone = json.loads(ZONE_ALERTS.read_text(encoding="utf-8"))
    zone_dates = [d["id"] if isinstance(d, dict) else d for d in zone["dates"]]
    bboxes = [z.bbox for z in load_config(ROOT / "configs" / "pilot.yaml").aoi.zones]

    # Each run screened its own region, but tiles at a region's edge reach into the neighbour, so border
    # blocks were screened twice (and the two runs number their alerts in the same block alike). An alert
    # is kept only inside its own run's region; a city box wins over the state around it. Tamil Nadu
    # alerts carry a "TN-" id prefix so they can never collide with an AP id from the same block.
    regions = {k: _region(ROOT / "configs" / f"{c}.yaml") for k, c in REGION_CONFIGS.items()}
    cities = regions["hyd"].union(regions["blr"])
    own_area = {"ap": regions["ap"].difference(cities), "tn": regions["tn"].difference(cities),
                "hyd": regions["hyd"], "blr": regions["blr"]}
    sw_alerts, blocks, seasons, models, roads = [], [], set(), set(), []
    ev_src: dict[str, Path] = {}  # published alert id -> its run's evidence folder
    n_outside = 0
    for d in map(Path, dirs):
        reg = next((k for k in ("tn", "hyd", "blr") if f"_{k}_" in f"{d.name}_"), "ap")
        area = prep(own_area[reg])
        for f in sorted(d.glob("alerts_s*.json")):
            p = json.loads(f.read_text(encoding="utf-8"))
            seasons.update(p["seasons"])
            models.add(p["model_id"])
            for a in p["alerts"]:
                if not area.contains(Point(_mid(a))):
                    n_outside += 1
                    continue
                src_id = a["id"]
                if reg == "tn":
                    a["id"] = src_id.replace("RW-", "RW-TN-", 1)
                ev_src[a["id"]] = d / "evidence" / src_id
                a["_seasons"] = p["seasons"]
                sw_alerts.append(a)
        for f in sorted(d.glob("blocks_s*.json")):
            blocks += json.loads(f.read_text(encoding="utf-8"))
        roads += sorted(d.glob("roads_s*.parquet"))

    def in_zone(a: dict) -> bool:
        x, y = _mid(a)
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
    n_chips = 0
    for a in kept:
        src = ev_src[a["id"]]
        if src.is_dir():
            shutil.copytree(src, ev_dst / a["id"], dirs_exist_ok=True)
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
        "alerts_dropped_outside_own_region": n_outside,  # border blocks screened by a neighbouring run
        "alerts_pilot_zones": len(zone["alerts"]),
        "evidence_chips": n_chips,
        "alert_rule": "screening: length >= 300 m AP (ADR-023), >= 200 m cities and Tamil Nadu; "
                      "pilot zones: roadwatch detect (ADR-020)",
    }
    SW.mkdir(parents=True, exist_ok=True)
    (SW / "summary.json").write_text(json.dumps(summary, indent=1), encoding="utf-8")
    if roads:
        # arrow concat, geometry stays WKB: ~1 M road lines (AP + cities + Tamil Nadu) never get decoded
        import pyarrow as pa
        import pyarrow.parquet as pq

        tables = [pq.read_table(r) for r in roads]
        meta = tables[0].schema.metadata  # GeoParquet "geo" metadata (WKB, EPSG:4326)
        t = pa.concat_tables([x.replace_schema_metadata(meta) for x in tables], promote_options="default")
        pq.write_table(t.replace_schema_metadata(meta), SW / "roads_latest.parquet")

    payload = {
        "demo": False,
        "model_id": " + ".join([zone.get("model_id", "")] + sorted(models - {zone.get("model_id")})),
        "generated_utc": summary["generated_utc"],
        "params": zone.get("params"),
        "note": (
            "Real alerts: pilot zones A-C from 9-season change detection; the rest of Andhra Pradesh, "
            "Hyderabad, Bengaluru and Tamil Nadu from screening runs (alerts >= 200-300 m). "
            "Null persistence = date not analysed."
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
