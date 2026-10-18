"""KPI-6: measured multi-date registration error of the Sentinel-2 composites (pixels, 10 m).

    uv run python scripts/registration_report.py

For every zone tile, each season is compared with the 2022 pre-monsoon reference composite by
sub-pixel phase correlation on B08 (NIR) over pixels valid in both (roadwatch.qa.checks). Real
land-cover change between seasons also moves the correlation peak, so the numbers are an upper
bound on geometric misregistration. Writes reports/kpi6_registration.md (+ .json).
"""

from __future__ import annotations

import json
import sys
from datetime import UTC, datetime
from pathlib import Path

import numpy as np
import pandas as pd
import rasterio

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "src"))
from roadwatch.config import load_config  # noqa: E402
from roadwatch.qa.checks import registration_shift_px  # noqa: E402

S2 = ROOT / "data_cache" / "runs" / "s2_build_zones" / "s2"
REF = "2022_pre_monsoon"
NIR = 4  # band order B02 B03 B04 B08
WATER_DN = 30       # NIR below this (uint8) = open water: no texture for phase correlation
MAX_WATER = 0.5     # a tile mostly water cannot be measured
IMPLAUSIBLE_PX = 5  # S2 L2A geolocation is ~1 px; a larger "shift" is a failed correlation, not geometry


def season_key(s: str) -> tuple[int, int]:
    return int(s[:4]), 0 if "pre" in s else 1


def boot_ci(v: np.ndarray, n: int = 2000, seed: int = 1564) -> tuple[float, float]:
    rng = np.random.default_rng(seed)
    means = rng.choice(v, size=(n, len(v)), replace=True).mean(axis=1)
    return float(np.percentile(means, 2.5)), float(np.percentile(means, 97.5))


def main() -> None:
    cfg = load_config(ROOT / "configs" / "pilot.yaml")
    gate = cfg.qa.max_registration_error_px
    reg = pd.read_parquet(ROOT / "evidence" / "tile_registry.parquet")
    zone_of = reg[reg.zone.fillna("") != ""].drop_duplicates("tile_id").set_index("tile_id").zone.to_dict()
    seasons = sorted((d.name for d in S2.iterdir() if d.is_dir() and d.name != REF), key=season_key)
    rows = []
    for ref_path in sorted((S2 / REF).glob("*.tif")):
        tid = ref_path.stem
        with rasterio.open(ref_path) as src:
            ref = src.read(NIR)
        valid = ref > 0
        water = float((ref[valid] < WATER_DN).mean()) if valid.any() else 1.0
        for s in seasons:
            p = S2 / s / f"{tid}.tif"
            if not p.exists():
                continue
            with rasterio.open(p) as src:
                mov = src.read(NIR)
            shift = registration_shift_px(ref, mov)
            rows.append({"tile_id": tid, "zone": str(zone_of.get(tid, "?")).split("_")[0], "season": s,
                         "shift_px": shift, "water_frac": round(water, 3)})
    df = pd.DataFrame(rows)
    df["status"] = np.select(
        [~np.isfinite(df.shift_px), df.water_frac > MAX_WATER, df.shift_px > IMPLAUSIBLE_PX],
        ["low_overlap", "mostly_water", "correlation_failed"], "measured")
    ok = df[df.status == "measured"]
    failed = df[df.status.isin(["mostly_water", "correlation_failed"])]

    def summary(g: pd.DataFrame) -> dict:
        v = g.shift_px.to_numpy()
        lo, hi = boot_ci(v)
        return {"n": len(v), "mean": float(v.mean()), "ci95": [lo, hi], "median": float(np.median(v)),
                "p90": float(np.percentile(v, 90)), "max": float(v.max()),
                "within_gate": float((v <= gate).mean()), "within_0_5": float((v <= 0.5).mean())}

    res = {"gate_px": gate, "reference": REF, "pairs_total": len(df), "pairs_measured": len(ok),
           "pairs_skipped": df.status.value_counts().drop("measured", errors="ignore").to_dict(),
           "unmeasurable": failed[["tile_id", "zone", "season", "shift_px", "water_frac", "status"]]
           .round(3).to_dict("records"), "all": summary(ok),
           "by_zone": {z: summary(g) for z, g in ok.groupby("zone")},
           "by_season": {s: summary(g) for s, g in ok.groupby("season")}}

    def line(name: str, x: dict) -> str:
        return (f"| {name} | {x['n']} | **{x['mean']:.3f}** [{x['ci95'][0]:.3f}, {x['ci95'][1]:.3f}] | "
                f"{x['median']:.3f} | {x['p90']:.3f} | {x['max']:.2f} | {x['within_0_5']:.0%} | {x['within_gate']:.0%} |")

    head = ["| Group | Tile pairs | Mean shift px [95% CI] | Median | P90 | Max | ≤ 0.5 px | ≤ gate |",
            "|---|---|---|---|---|---|---|---|"]
    a = res["all"]
    out = [
        "# KPI-6 — Multi-date registration error (Sentinel-2 composites)", "",
        f"_Generated {datetime.now(UTC).date().isoformat()} by `scripts/registration_report.py`. Each zone tile "
        f"of every season is compared with the {REF} composite: sub-pixel phase correlation on B08, over pixels "
        "valid in both; 95% CI = bootstrap over tile pairs. 1 px = 10 m._", "",
        f"**Result:** over {a['n']} measurable tile pairs the shift is median **{a['median']:.3f} px** "
        f"({a['median'] * 10:.1f} m), P90 {a['p90']:.3f} px, mean {a['mean']:.3f} px (95% CI "
        f"[{a['ci95'][0]:.3f}, {a['ci95'][1]:.3f}]); {a['within_gate']:.0%} are within the {gate:g} px quality gate "
        f"(`qa.max_registration_error_px`) and {a['within_0_5']:.0%} within 0.5 px.", "",
        f"**Not measurable ({len(failed)} pairs, listed below):** tiles that are mostly open water (> "
        f"{MAX_WATER:.0%} of pixels with NIR < {WATER_DN}) or whose correlation peak lands > {IMPLAUSIBLE_PX} px "
        "away - physically impossible for Sentinel-2 L2A, so a failed measurement, not a geometric error. "
        f"Also skipped: {res['pairs_skipped'].get('low_overlap', 0)} pairs with < 30% pixels valid in both (cloud).",
        "",
        "## By zone", "", *head, line("All zones", a),
        *[line(f"Zone {z}", x) for z, x in res["by_zone"].items()], "",
        "## By season (vs the 2022 pre-monsoon reference)", "", *head,
        *[line(s.replace("_", " "), x) for s, x in res["by_season"].items()], "",
        "## Not measurable", "",
        "| Tile | Zone | Season | Correlation result px | Water fraction | Reason |", "|---|---|---|---|---|---|",
        *[f"| `{x['tile_id']}` | {x['zone']} | {x['season']} | {x['shift_px']:.1f} | {x['water_frac']:.0%} | "
          f"{x['status'].replace('_', ' ')} |" for x in res["unmeasurable"]], "",
        "## Reading this honestly", "",
        "- These shifts are an **upper bound**: crop cycles, water levels and construction between seasons also "
        "move the correlation peak, so not all of the measured shift is geometric error.",
        "- No extra co-registration step exists yet: the composites rely on the Sentinel-2 L2A geolocation. "
        "The charter's KPI-6 target (≤ 0.80 × the O2 reference) therefore has no separate reference to beat "
        "yet - this table is that reference.",
        "- The gate is tested (NT-4, `reports/negative_tests.md`) but not yet enforced per tile inside `s2-build`.",
        "",
    ]
    (ROOT / "reports" / "kpi6_registration.md").write_text("\n".join(out), encoding="utf-8")
    (ROOT / "reports" / "kpi6_registration.json").write_text(json.dumps(res, indent=1), encoding="utf-8")
    print(f"pairs {len(ok)}/{len(df)} mean {a['mean']:.3f} px p90 {a['p90']:.3f} within gate {a['within_gate']:.0%}")


if __name__ == "__main__":
    main()
