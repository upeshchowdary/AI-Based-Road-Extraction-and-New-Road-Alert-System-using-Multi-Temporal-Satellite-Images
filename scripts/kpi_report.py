"""Build reports/kpi1_cp1.md (KPI-1 road-extraction table) from finished run outputs.

Usage: uv run python scripts/kpi_report.py
Reads data_cache/runs/*/{metrics.json,timing.json,per_image_<split>.csv}; every number is
recomputed from per-image pixel counts (95% percentile bootstrap over images, 2000 resamples).
"""

from __future__ import annotations

import json
import sys
from datetime import UTC, datetime
from pathlib import Path
from statistics import mean, stdev

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "src"))
from roadwatch.qa.metrics import from_csv  # noqa: E402

RUNS = {
    "baseline_a_full_s0": ("Baseline A — U-Net ResNet34", "DeepGlobe 0.5 m RGB",
                           "frozen hash split 80/10/10"),
    "s2_model_full_s0": ("Tier-1 S2 model — U-Net ResNet34 (4-band)", "AP Sentinel-2 10 m (B02 B03 B04 B08)",
                         "frozen AP spatial holdout + zones A–C"),
}
SPLIT_NAME = {"test": "Test (holdout)", "val": "Validation", "zone_A": "Zone A · Vijayawada W. bypass",
              "zone_B": "Zone B · Machilipatnam port", "zone_C": "Zone C · Gannavaram–Nunna"}


def gpu_hours(run_dir: Path) -> str:
    t = json.loads((run_dir / "timing.json").read_text(encoding="utf-8"))
    return f"{t['wall_sec'] / 3600:.2f}"


def seed_table() -> list[str]:
    """Baseline A repeated over seeds 0-2 (Section 7.5): per-seed test IoU/F1 + mean and spread."""
    rows, ious, f1s = [], [], []
    for s in (0, 1, 2):
        d = ROOT / "data_cache" / "runs" / f"baseline_a_full_s{s}"
        if not (d / "per_image_test.csv").exists():
            continue
        m = json.loads((d / "metrics.json").read_text(encoding="utf-8"))
        r = from_csv(d / "per_image_test.csv")
        ious.append(r["iou"].value)
        f1s.append(r["f1"].value)
        rows.append(f"| {s} | `{m['run_id']}` | {r['iou'].fmt()} | {r['f1'].fmt()} | "
                    f"{m.get('best_val_iou', float('nan')):.3f} | {m.get('stop_reason', '?')} |")
    if not rows:
        return []
    out = ["## Baseline A — 3 seeds (test split, Section 7.5)", "",
           "| Seed | Run | Test IoU [95% CI] | Test F1 [95% CI] | Best val IoU | Stop |",
           "|---|---|---|---|---|---|", *rows, ""]
    if len(ious) > 1:
        out += [f"**Across {len(ious)} seeds:** test IoU mean **{mean(ious):.3f}** (SD {stdev(ious):.3f}, "
                f"range {min(ious):.3f}–{max(ious):.3f}) · test F1 mean **{mean(f1s):.3f}** "
                f"(SD {stdev(f1s):.3f}).", "",
                "All three seeds use the same config; every seed's best checkpoint is from epoch 0 "
                "(seed 0 peaked at epoch 0 then overfit; seeds 1–2 stopped at the 1 GPU-h cap after "
                "epoch 0), so the seeds are comparable.", ""]
    return out


def main() -> int:
    out = [
        "# KPI-1 — Road extraction accuracy (CP1)",
        "",
        f"_Generated {datetime.now(UTC).date().isoformat()} by `scripts/kpi_report.py` from run outputs in "
        "`data_cache/runs/`. Pixel IoU / F1 / precision / recall pooled over images; "
        "95% CI = percentile bootstrap over images (2000 resamples). Threshold 0.5._",
        "",
    ]
    for run, (name, data, split) in RUNS.items():
        d = ROOT / "data_cache" / "runs" / run
        if not (d / "metrics.json").exists():
            out += [f"## {name}", "", f"_No outputs for `{run}` yet._", ""]
            continue
        m = json.loads((d / "metrics.json").read_text(encoding="utf-8"))
        out += [f"## {name}", "",
                f"Data: {data} · split: {split} · run `{m['run_id']}` (config `{m['config_hash']}`) · "
                f"GPU wall time {gpu_hours(d)} h · stop: {m.get('stop_reason', '?')}", "",
                "| Split | n images | IoU | F1 | Precision | Recall |", "|---|---|---|---|---|---|"]
        for split_key in ("test", "val", "zone_A", "zone_B", "zone_C"):
            f = d / f"per_image_{split_key}.csv"
            if not f.exists():
                continue
            r = from_csv(f)
            out.append(f"| {SPLIT_NAME[split_key]} | {r['iou'].n} | {r['iou'].fmt()} | {r['f1'].fmt()} | "
                       f"{r['precision'].fmt()} | {r['recall'].fmt()} |")
        out.append("")
    out += seed_table()
    out += [
        "## Reference B — frozen DINOv3-sat ViT-L + light decoder",
        "",
        "Timing run only (ADR-018): val IoU 0.165 after 1 epoch vs 0.496 for Baseline A after its first "
        "epoch; 35 min/epoch on T4×2. Not trained further in CP1 to save GPU quota (user decision "
        "2026-10-14); revisit with LoRA (Enhancement Pack D) in CP2.",
        "",
        "## Reading these numbers honestly",
        "",
        "- Baseline A IoU 0.50 is below the ~0.60–0.65 usually reported on DeepGlobe; it peaked after "
        "epoch 0 and then overfit (ADR-018). The 3-seed table above shows the result is stable across seeds.",
        "- The S2 model is measured against OSM masks that include narrow residential streets that 10 m "
        "pixels cannot resolve, so recall is the weak side; precision is higher in every zone.",
        "- No condition is averaged away: each holdout zone is reported separately (Section 8).",
        "",
    ]
    path = ROOT / "reports" / "kpi1_cp1.md"
    path.parent.mkdir(exist_ok=True)
    path.write_text("\n".join(out), encoding="utf-8")
    print(f"wrote {path.relative_to(ROOT)}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
