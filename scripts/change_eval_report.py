"""KPI-2 / KPI-3 report: new-road alerts vs dated OSM history, our method vs baselines and ablations.

Usage: uv run python scripts/change_eval_report.py [--t0 2022-01-01] [--t1 2026-06-01]
Writes reports/kpi23_change_eval.md + .json. OSM snapshots (ohsome API, (c) OSM contributors, ODbL)
are cached under data_cache/osm_history/ so the report regenerates offline.
"""

from __future__ import annotations

import argparse
import gc
import json
import sys
from datetime import UTC, datetime
from pathlib import Path

import geopandas as gpd
import numpy as np
import rasterio
from shapely.geometry import box
from shapely.ops import unary_union

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "src"))
from roadwatch.change.detect import ChangeParams, detect_new_roads, season_key  # noqa: E402
from roadwatch.config import load_config  # noqa: E402
from roadwatch.data import registry  # noqa: E402
from roadwatch.data.grid import TileKey  # noqa: E402
from roadwatch.graph.extract import GraphParams, mask_to_lines  # noqa: E402
from roadwatch.qa.change_eval import (  # noqa: E402
    EvalParams,
    bootstrap_share,
    classify,
    fetch_osm_history,
    ground_truth,
    line_points,
    pixel_diff_blobs,
    recall_length,
)

MODEL = "s2_model_full_s0_6e9081638291"
BASE = ("2022_pre_monsoon", "2022_post_monsoon")
BASE_THRESHOLD = 0.3  # hysteresis variant: fixed a priori (0.6 x the 0.5 operating threshold), not tuned
METHODS = {
    "ours": "RoadWatch (graph change + persistence ≥ 3 + stability + abstain)",
    "ours_hyst": f"RoadWatch + hysteresis baseline (2022 roads at p ≥ {BASE_THRESHOLD})",
    "no_stability": "Ablation: without the stability rule",
    "no_abstain": "Ablation: without abstain (cloudy tiles count as 'absent')",
    "graph_2date": "Ablation: graph difference, 2 dates only (2022 vs 2026, no persistence)",
    "pixel_tol": "Baseline: pixel difference with 30 m tolerance",
    "pixel": "Baseline: pixel difference (post-classification, same model)",
}


def zone_inputs(z, cfg_reg):
    zdir = ROOT / "data_cache" / "outputs" / MODEL / z.name
    seasons = sorted((d.name for d in zdir.iterdir() if (d / "roads.gpkg").exists()), key=season_key)
    lines = {s: gpd.read_file(zdir / s / "roads.gpkg") for s in seasons}
    abstain = {}
    for s in seasons:
        tiles = cfg_reg[(cfg_reg.date_key == s) & (cfg_reg.zone == z.name)].tile_id
        polys = [box(*TileKey.parse(t).bounds()) for t in tiles]
        abstain[s] = unary_union(polys) if polys else box(0, 0, 0, 0)
    probs, transform, bounds = {}, None, None
    for s in (*BASE, seasons[-1]):
        with rasterio.open(zdir / s / "prob.tif") as src:
            probs[s] = src.read(1).astype(np.float32) / 255.0
            transform, bounds = src.transform, tuple(src.bounds)
    return seasons, lines, abstain, probs, transform, bounds


def run_methods(seasons, lines, abstain, probs, transform, cp: ChangeParams):
    """{method: (alert sample points, alert length km or None)}"""
    out = {}

    def as_points(found):
        return [line_points(g) for g in found.geometry], float(found.length_m.sum() / 1000) if len(found) else 0.0

    out["ours"] = as_points(detect_new_roads(lines, seasons, abstain, cp))
    # hysteresis: a road the model saw even faintly in 2022 counts as existing; new roads still need
    # p >= 0.5 in the later seasons (old roads under-extracted in 2022 imagery otherwise look "new")
    crs = lines[seasons[-1]].crs
    hyst = dict(lines)
    for s in BASE:
        hyst[s] = mask_to_lines(probs[s], transform, str(crs), GraphParams(threshold=BASE_THRESHOLD))
    out["ours_hyst"] = as_points(detect_new_roads(hyst, seasons, abstain, cp))
    out["no_stability"] = as_points(detect_new_roads(lines, seasons, abstain, ChangeParams(
        min_length_m=cp.min_length_m, persistence_min_dates=cp.persistence_min_dates, min_stability=0.0)))
    out["no_abstain"] = as_points(detect_new_roads(lines, seasons, {}, cp))
    two = [s for s in seasons if s in BASE] + [seasons[-1]]
    out["graph_2date"] = as_points(detect_new_roads({s: lines[s] for s in two}, two, abstain, ChangeParams(
        min_length_m=cp.min_length_m, persistence_min_dates=1, min_seen=1, min_stability=0.0)))
    latest = probs[seasons[-1]]
    out["pixel"] = (pixel_diff_blobs([probs[s] for s in BASE], latest, transform), None)
    out["pixel_tol"] = (pixel_diff_blobs([probs[s] for s in BASE], latest, transform, tolerance_px=3), None)
    return out


def summarise(classes: list[str]) -> dict:
    n = len(classes)
    prec = bootstrap_share(classes, ("confirmed",), ("confirmed", "known_false"))
    false = bootstrap_share(classes, ("known_false",))
    return {"n": n, "confirmed": classes.count("confirmed"), "known_false": classes.count("known_false"),
            "unverified": classes.count("unverified"),
            "precision_verifiable": prec, "known_false_rate": false}


def fmt_ci(t) -> str:
    v, lo, hi, n = t
    return "–" if n == 0 or np.isnan(v) else f"{v:.3f} [{lo:.3f}, {hi:.3f}]"


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--t0", default="2022-01-01", help="OSM snapshot before the 2022 baseline imagery")
    ap.add_argument("--t1", default="2026-06-01", help="OSM snapshot after the latest imagery")
    a = ap.parse_args()
    cfg = load_config(ROOT / "configs" / "pilot.yaml")
    reg = registry.load()
    reserved = reg[(reg.sensor == "s2") & (reg.status == "reserved")]
    cp = ChangeParams(min_length_m=cfg.change.min_length_m,
                      persistence_min_dates=cfg.change.persistence_min_dates)
    p = EvalParams()
    cache = ROOT / "data_cache" / "osm_history"
    per_zone, pooled = {}, {m: [] for m in METHODS}
    gt_stats = {}
    key = json.dumps([a.t0, a.t1, p.__dict__, cp.__dict__, MODEL, list(METHODS)], sort_keys=True, default=str)
    for z in cfg.aoi.zones:
        # per-zone cache: a zone is ~1-3 GB of work on a 16 GB laptop; a rerun only does missing zones
        zcache = cache / f"eval_{z.name}.json"
        if zcache.exists() and json.loads(zcache.read_text(encoding="utf-8"))["key"] == key:
            got = json.loads(zcache.read_text(encoding="utf-8"))
            gt_stats[z.name], per_zone[z.name] = got["gt"], got["methods"]
            for m in METHODS:
                pooled[m] += got["classes"][m]
            print(f"{z.name}: cached", flush=True)
            continue
        seasons, lines, abstain, probs, transform, bounds = zone_inputs(z, reserved)
        crs = lines[seasons[-1]].crs
        old, now = fetch_osm_history(tuple(z.bbox), a.t0, a.t1, cache / f"{z.name}_{a.t0}_{a.t1}.geojson")
        old, now = old.to_crs(crs), now.to_crs(crs)
        gt_new = ground_truth(old, now, p)
        gt_stats[z.name] = {"osm_km_t0": round(float(old.length.sum()) / 1000, 1),
                            "osm_km_t1": round(float(now.length.sum()) / 1000, 1),
                            "new_km": round(float(gt_new.length.sum()) / 1000, 1), "new_pieces": len(gt_new)}
        print(f"{z.name}: OSM {gt_stats[z.name]}", flush=True)
        per_zone[z.name], zclasses = {}, {}
        for m, (pts, km) in run_methods(seasons, lines, abstain, probs, transform, cp).items():
            classes = classify(pts, gt_new, old, bounds, p)
            pooled[m] += classes
            zclasses[m] = classes
            s = summarise(classes)
            s["recall_new_length"] = recall_length(gt_new, pts, bounds, p)
            s["alert_km"] = km
            per_zone[z.name][m] = s
            print(f"  {m:13s} n={s['n']:5d} conf={s['confirmed']:4d} false={s['known_false']:4d} "
                  f"prec={fmt_ci(s['precision_verifiable'])} recall={s['recall_new_length']:.3f}", flush=True)
        zcache.write_text(json.dumps({"key": key, "gt": gt_stats[z.name], "methods": per_zone[z.name],
                                      "classes": zclasses}, default=float), encoding="utf-8")
        del lines, probs, old, now, gt_new
        gc.collect()
    total = {m: summarise(c) for m, c in pooled.items()}
    for m in METHODS:  # pooled recall = length-weighted mean of the zones
        w = [gt_stats[z]["new_km"] for z in per_zone]
        r = [per_zone[z][m]["recall_new_length"] for z in per_zone]
        total[m]["recall_new_length"] = float(np.average(r, weights=w)) if sum(w) else float("nan")
    fr = {m: total[m]["known_false_rate"][0] for m in METHODS}
    gain_vs_pixel = (fr["pixel"] - fr["ours"]) / fr["pixel"] if fr["pixel"] else float("nan")
    gain_vs_tol = (fr["pixel_tol"] - fr["ours"]) / fr["pixel_tol"] if fr["pixel_tol"] else float("nan")

    payload = {"generated_utc": datetime.now(UTC).isoformat(timespec="seconds"), "model": MODEL,
               "osm_t0": a.t0, "osm_t1": a.t1, "params": p.__dict__, "change_params": cp.__dict__ |
               {"baseline": list(cp.baseline)}, "ground_truth": gt_stats, "per_zone": per_zone,
               "total": total, "kpi3_false_rate_rel_reduction": {"vs_pixel": gain_vs_pixel,
                                                                 "vs_pixel_tol": gain_vs_tol}}
    (ROOT / "reports" / "kpi23_change_eval.json").write_text(json.dumps(payload, indent=1, default=float),
                                                              encoding="utf-8")

    md = ["# KPI-2 / KPI-3 — New-road alerts vs dated OpenStreetMap history", "",
          f"_Generated {datetime.now(UTC).date().isoformat()} by `scripts/change_eval_report.py`. Zones A–C "
          f"(evaluation-only holdout), Tier-1 model `{MODEL}`, imagery 2022 → 2026 pre-monsoon. "
          f"Ground truth from OSM history (ohsome API, © OpenStreetMap contributors, ODbL): roads mapped "
          f"on {a.t1} lying > {p.match_m:.0f} m from every road mapped on {a.t0}, pieces ≥ "
          f"{p.min_length_m:.0f} m. 95% CIs = percentile bootstrap over alerts (2000 resamples)._", "",
          "## How each alert is judged", "",
          f"- **confirmed** — ≥ {p.majority:.0%} of the alert lies within {p.near_new_m:.0f} m of a road "
          "OSM mapped after the baseline;",
          f"- **known false** — ≥ {p.majority:.0%} lies within {p.near_old_m:.0f} m of a road OSM already had "
          "before the baseline (so it is not new);",
          "- **unverified** — neither: a real road OSM has not mapped yet, or a false alert. OSM cannot "
          "tell, so these are reported, not guessed.", "",
          "**Precision (verifiable)** = confirmed / (confirmed + known false). **Known-false rate** = "
          "known false / all alerts (KPI-3 proxy). **Recall** = share of newly mapped road length within "
          f"{p.near_new_m:.0f} m of an alert.", "",
          "## Ground truth per zone", "", "| Zone | OSM roads T0 (km) | OSM roads T1 (km) | Newly mapped (km) "
          "| Pieces |", "|---|---|---|---|---|"]
    md += [f"| {z} | {g['osm_km_t0']} | {g['osm_km_t1']} | {g['new_km']} | {g['new_pieces']} |"
           for z, g in gt_stats.items()]
    md += ["", "## All zones pooled", "",
           "| Method | Alerts | Confirmed | Known false | Unverified | Precision (verifiable) [95% CI] | "
           "Known-false rate [95% CI] | Recall (length) |", "|---|---|---|---|---|---|---|---|"]
    for m, name in METHODS.items():
        t = total[m]
        md.append(f"| {name} | {t['n']} | {t['confirmed']} | {t['known_false']} | {t['unverified']} | "
                  f"{fmt_ci(t['precision_verifiable'])} | {fmt_ci(t['known_false_rate'])} | "
                  f"{t['recall_new_length']:.3f} |")
    md += ["", f"**KPI-3 (false-alert rate vs pixel-difference baseline, target ≥ 5% relative gain):** "
           f"{gain_vs_pixel:+.1%} vs naive pixel difference, {gain_vs_tol:+.1%} vs pixel difference with "
           "30 m tolerance (positive = fewer known-false alerts per alert).", "",
           "## Per zone", ""]
    for z, ms in per_zone.items():
        md += [f"### {z}", "", "| Method | Alerts | Confirmed | Known false | Unverified | Precision "
               "(verifiable) | Known-false rate | Recall |", "|---|---|---|---|---|---|---|---|"]
        md += [f"| {METHODS[m]} | {s['n']} | {s['confirmed']} | {s['known_false']} | {s['unverified']} | "
               f"{fmt_ci(s['precision_verifiable'])} | {fmt_ci(s['known_false_rate'])} | "
               f"{s['recall_new_length']:.3f} |" for m, s in ms.items()]
        md.append("")
    md += ["## Reading these numbers honestly", "",
           "- **Newly mapped ≠ newly built.** Old village roads mapped after 2022 count as 'new' ground "
           "truth: precision is optimistic for alerts on them, and recall is pessimistic (we should not "
           "alert on roads that already existed).",
           "- **OSM is incomplete**, especially for village and layout roads, so many alerts stay "
           "unverified; the review loop (accept / reject in the app) is the way to resolve them.",
           "- Pixel-difference alerts are blobs, line alerts are road segments; counts are compared as "
           "'things an analyst must check', the known-false rate as a share of them.",
           "- Same model, same imagery, same zones for every method: differences come from the change "
           "logic alone (ablation).", ""]
    (ROOT / "reports" / "kpi23_change_eval.md").write_text("\n".join(md), encoding="utf-8")
    print("wrote reports/kpi23_change_eval.md")
    return 0


if __name__ == "__main__":
    sys.exit(main())
