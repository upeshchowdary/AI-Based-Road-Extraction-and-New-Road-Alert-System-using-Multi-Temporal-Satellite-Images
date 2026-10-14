"""CPU smoke test for kaggle/<model>/train.py on synthetic DeepGlobe-like data.

Catches crashes before spending Kaggle GPU quota. Run with the smoke venv (torch CPU):
  data_cache/smoke_venv/Scripts/python.exe scripts/smoke_train.py baseline_a
Exercises: multi-crop training, val_every, early-stop bookkeeping, test eval with per-image
CSVs, ONNX export, and resume from ckpt_last.pt.
"""

from __future__ import annotations

import os
import pprint
import re
import subprocess
import sys
from pathlib import Path

import cv2
import numpy as np

ROOT = Path(__file__).resolve().parents[1]


def make_data(root: Path, n: int = 24, size: int = 256) -> None:
    rng = np.random.default_rng(0)
    (root / "train").mkdir(parents=True, exist_ok=True)
    rows = ["image_id,split,sat_image_path,mask_path"]
    for i in range(n):
        img = rng.integers(0, 255, (size, size, 3), dtype=np.uint8)
        m = np.zeros((size, size), np.uint8)
        r = int(rng.integers(20, size - 20))
        m[r - 4:r + 4, :] = 255
        img[m > 0] = 200
        cv2.imwrite(str(root / "train" / f"{i}_sat.jpg"), img)
        cv2.imwrite(str(root / "train" / f"{i}_mask.png"), m)
        rows.append(f"{i},train,train/{i}_sat.jpg,train/{i}_mask.png")
    (root / "metadata.csv").write_text("\n".join(rows) + "\n")


def make_s2_data(root: Path, size: int = 256) -> None:
    """Synthetic 4-band uint8 tiles + 1-bit-style label PNGs + a registry, all splits present."""
    import pandas as pd
    import tifffile

    rng = np.random.default_rng(0)
    splits = ["train"] * 10 + ["val"] * 3 + ["test"] * 2 + ["zone_test"] * 2
    rows = []
    for i, sp in enumerate(splits):
        tid = f"T32644_10m_512_{i}_7"
        m = np.zeros((size, size), np.uint8)
        r = int(rng.integers(20, size - 20))
        m[r - 2:r + 2, :] = 255
        img = rng.integers(20, 120, (size, size, 4), dtype=np.uint8)
        img[m > 0] = 200
        for dk in ("2025_pre_monsoon", "2026_pre_monsoon"):
            (root / "s2" / dk).mkdir(parents=True, exist_ok=True)
            tifffile.imwrite(root / "s2" / dk / f"{tid}.tif", img, compression="zlib")
        (root / "labels" / "osm").mkdir(parents=True, exist_ok=True)
        cv2.imwrite(str(root / "labels" / "osm" / f"{tid}.png"), m)
        rows.append({"tile_id": tid, "sensor": "osm_label", "date_key": "osm_x", "split": sp,
                     "zone": "B_machilipatnam_port" if sp == "zone_test" else "",
                     "status": "included"})
    pd.DataFrame(rows).to_parquet(root / "tile_registry.parquet")


def run(model: str, cfg: dict, out: Path, data: Path) -> subprocess.CompletedProcess:
    import yaml

    k = yaml.safe_load((ROOT / "kaggle" / model / "runs.yaml").read_text(encoding="utf-8"))["kernel"]
    source = k.get("source", f"{model}/{k.get('code_file', 'train.py')}")
    src = (ROOT / "kaggle" / source).read_text(encoding="utf-8")
    block = "RUN_CONFIG = " + pprint.pformat(cfg, sort_dicts=False) + "\n"
    src = re.sub(r"RUN_CONFIG = \{.*?\n\}\n", lambda _: block, src, count=1, flags=re.S)
    script = out / "train_smoke.py"
    script.write_text(src.replace('os.path.abspath("./out")', repr(str(out / "work"))),
                      encoding="utf-8")
    env = {**os.environ, "ROADWATCH_DATA_ROOT": str(data), "PYTHONIOENCODING": "utf-8"}
    return subprocess.run([sys.executable, str(script)], capture_output=True, text=True,
                          encoding="utf-8", errors="replace", env=env, timeout=1200)


def main() -> int:
    model = sys.argv[1] if len(sys.argv) > 1 else "baseline_a"
    base = ROOT / "data_cache" / "smoke" / model
    data = base / "data"
    import yaml

    spec = yaml.safe_load((ROOT / "kaggle" / model / "runs.yaml").read_text(encoding="utf-8"))
    # the model's real defaults, shrunk to a few tiny CPU batches
    cfg = {**spec["defaults"], "run_id": "smoke", "epochs": 3, "timing_only": False,
           "crop": 128, "batch_size": 8, "crops_per_image": 4, "val_every": 2, "num_workers": 0,
           "max_train_batches": 2, "eval_test": True, "export_onnx": True, "config_hash": "smoke"}
    if cfg["arch"] != "DinoV3Frozen":
        cfg["encoder_weights"] = None  # no ImageNet download in the smoke test
    import shutil

    shutil.rmtree(data, ignore_errors=True)
    if cfg.get("data") == "s2_tiles":
        make_s2_data(data)
    else:
        make_data(data)
    import shutil

    shutil.rmtree(base / "work", ignore_errors=True)
    # 1) run 2 epochs, 2) resume to epoch 3 (resume path)
    r1 = run(model, {**cfg, "epochs": 2, "export_onnx": False}, base, data)
    print(r1.stdout[-1500:], r1.stderr[-3000:])
    if r1.returncode:
        return 1
    r2 = run(model, cfg, base, data)
    print(r2.stdout[-2500:], r2.stderr[-3000:])
    if r2.returncode:
        return 1
    work = base / "work"
    need = ["ckpt_last.pt", "ckpt_best.pt", "train_log.csv", "timing.json", "metrics.json",
            "per_image_val.csv", "per_image_test.csv"]
    if cfg["arch"] != "DinoV3Frozen":
        need.append("model_best.onnx")
    else:  # frozen backbone must NOT be in the checkpoint
        import torch

        sd = torch.load(work / "ckpt_last.pt", map_location="cpu", weights_only=False)["model"]
        size_mb = sum(v.numel() * v.element_size() for v in sd.values()) / 1e6
        print(f"checkpoint tensors: {len(sd)}  size={size_mb:.1f} MB  "
              f"backbone keys={sum(k.startswith('backbone.') for k in sd)}")
        if any(k.startswith("backbone.") for k in sd) or size_mb > 100:
            return 1
    missing = [f for f in need if not (work / f).exists()]
    resumed = "resumed from" in r2.stdout
    print(f"missing={missing} resumed={resumed}")
    return 0 if not missing and resumed else 1


if __name__ == "__main__":
    sys.exit(main())
