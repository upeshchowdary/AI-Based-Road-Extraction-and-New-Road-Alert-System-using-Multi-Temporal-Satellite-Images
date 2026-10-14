"""Segmentation metrics with 95% bootstrap confidence intervals (PROJECT_PROMPT.md Section 8).

Input: per-image pixel counts (tp, fp, fn) written by the trainer (per_image_<split>.csv).
Metrics are pooled (global) over the resampled images, matching the trainer's reported IoU/F1.
"""

from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path

import numpy as np
import pandas as pd


@dataclass(frozen=True)
class MetricCI:
    name: str
    value: float
    lo: float
    hi: float
    n: int

    def fmt(self, digits: int = 3) -> str:
        return f"{self.value:.{digits}f} [{self.lo:.{digits}f}, {self.hi:.{digits}f}]"


def _pooled(tp: np.ndarray, fp: np.ndarray, fn: np.ndarray) -> dict[str, np.ndarray]:
    tp, fp, fn = tp.sum(-1), fp.sum(-1), fn.sum(-1)
    iou = tp / np.maximum(tp + fp + fn, 1)
    prec = tp / np.maximum(tp + fp, 1)
    rec = tp / np.maximum(tp + fn, 1)
    f1 = 2 * prec * rec / np.maximum(prec + rec, 1e-12)
    return {"iou": iou, "f1": f1, "precision": prec, "recall": rec}


def bootstrap(per_image: pd.DataFrame, n_boot: int = 2000, seed: int = 1564,
              alpha: float = 0.05) -> dict[str, MetricCI]:
    """Percentile bootstrap over images (images are the independent unit)."""
    tp, fp, fn = (per_image[c].to_numpy(np.float64) for c in ("tp", "fp", "fn"))
    point = _pooled(tp, fp, fn)
    rng = np.random.default_rng(seed)
    idx = rng.integers(0, len(tp), size=(n_boot, len(tp)))
    boot = _pooled(tp[idx], fp[idx], fn[idx])
    out = {}
    for k, v in point.items():
        lo, hi = np.quantile(boot[k], [alpha / 2, 1 - alpha / 2])
        out[k] = MetricCI(k, float(v), float(lo), float(hi), len(tp))
    return out


def from_csv(path: str | Path, **kw) -> dict[str, MetricCI]:
    return bootstrap(pd.read_csv(path), **kw)
