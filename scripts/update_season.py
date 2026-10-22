"""Ingest newly finished seasons: composites -> road maps -> alerts -> deploy bundle (ADR-026).

Usage:
  uv run python scripts/update_season.py --dry-run     # what is new, nothing changed
  uv run python scripts/update_season.py               # build, infer, detect, bundle (local only)

A season becomes available when its window closes (pre-monsoon Mar-May -> after 31 May, post-monsoon
mid-Oct-Dec -> after 31 Dec). Every new composite is logged in the tile registry (s2-build), alerts keep
stable ids (change/ids.py), so reviews stay on the same roads. Publishing the new bundle (release upload,
Render redeploy) is a separate, explicit step: see docs/guides/data_updates.md.
"""

from __future__ import annotations

import argparse
import json
import subprocess
import sys
from datetime import date
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "src"))
from roadwatch.config import load_config  # noqa: E402
from roadwatch.data.sentinel2 import season_window  # noqa: E402

ZONES_S2 = ROOT / "data_cache" / "runs" / "s2_build_zones" / "s2"
MODEL = ROOT / "data_cache" / "runs" / "s2_model_full_s0"


def finished_seasons(cfg, today: date) -> list[str]:
    out = []
    for year in range(2022, today.year + 1):
        for season in list(cfg.data.seasons)[: cfg.data.dates_per_year]:
            if season_window(cfg.data, season, year)[1] < today:
                out.append(f"{year}_{season}")
    return out


def run(cmd: list[str]) -> None:
    print("+", " ".join(cmd), flush=True)
    subprocess.run(cmd, cwd=ROOT, check=True)


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--dry-run", action="store_true")
    ap.add_argument("--today", default="", help="pretend date (tests), YYYY-MM-DD")
    a = ap.parse_args()
    cfg = load_config(ROOT / "configs" / "pilot.yaml")
    today = date.fromisoformat(a.today) if a.today else date.today()
    have = set()
    if ZONES_S2.exists():
        have = {p.name for p in ZONES_S2.iterdir() if p.is_dir() and any(p.glob("*.tif"))}
    done = finished_seasons(cfg, today)
    new = [s for s in done if s not in have]
    status = {"today": today.isoformat(), "seasons_available": done, "seasons_built": sorted(have),
              "new": new}
    print(json.dumps(status, indent=1))
    if a.dry_run or not new:
        print("nothing to do" if not new else "dry run: no changes")
        return 0
    py = [sys.executable, "-m", "roadwatch.cli"]
    years = f"{min(int(s[:4]) for s in new)}-{max(int(s[:4]) for s in new)}"
    run([*py, "s2-build", "--zones-only", "--seasons-only", ",".join(new), "--years", years,
         "--out-dir", str(ZONES_S2)])
    run([*py, "infer", "--model", str(MODEL / "model_best.onnx"), "--meta", str(MODEL / "model_meta.json"),
         "--seasons", ",".join(new)])
    run([*py, "detect"])
    run([sys.executable, "scripts/build_deploy_bundle.py"])
    print(f"ingested {new}. Publish (release upload + redeploy) only when approved: "
          "docs/guides/data_updates.md")
    return 0


if __name__ == "__main__":
    sys.exit(main())
