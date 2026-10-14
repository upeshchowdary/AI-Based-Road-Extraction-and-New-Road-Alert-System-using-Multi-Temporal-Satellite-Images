"""Laptop inference with ONNX Runtime (CPU) — no PyTorch locally (PROJECT_PROMPT.md Section 4).

predict tiles -> stitch into one zone mosaic (so roads stay continuous across tile borders)
-> probability GeoTIFF + road centre-lines (graph/extract.py).
Normalisation comes from model_meta.json written next to the ONNX file by the trainer.
"""

from __future__ import annotations

import json
from dataclasses import dataclass
from pathlib import Path

import numpy as np
import rasterio
from affine import Affine

from roadwatch.data.grid import TileKey
from roadwatch.data.sentinel2 import tile_transform


@dataclass
class ModelMeta:
    mean: list[float]
    std: list[float]
    bands: list[str]
    threshold: float = 0.5
    model_id: str = ""

    @classmethod
    def load(cls, path: str | Path) -> ModelMeta:
        d = json.loads(Path(path).read_text(encoding="utf-8"))
        return cls(**{k: d[k] for k in ("mean", "std", "bands", "threshold", "model_id") if k in d})


class OnnxRoadModel:
    def __init__(self, onnx_path: str | Path, meta: ModelMeta, threads: int = 4):
        import onnxruntime as ort

        so = ort.SessionOptions()
        so.intra_op_num_threads = threads
        self.sess = ort.InferenceSession(str(onnx_path), so, providers=["CPUExecutionProvider"])
        self.inp = self.sess.get_inputs()[0].name
        self.meta = meta
        self.mean = np.array(meta.mean, np.float32)[:, None, None]
        self.std = np.array(meta.std, np.float32)[:, None, None]

    def predict(self, chw_uint8: np.ndarray) -> np.ndarray:
        """(bands, H, W) uint8 (0 = no data) -> road probability (H, W) float32; no-data -> 0."""
        x = (chw_uint8.astype(np.float32) / 255.0 - self.mean) / self.std
        logits = self.sess.run(None, {self.inp: x[None]})[0][0, 0]
        prob = 1.0 / (1.0 + np.exp(-logits))
        prob[(chw_uint8 == 0).all(axis=0)] = 0.0
        return prob.astype(np.float32)


def mosaic_predict(
    model: OnnxRoadModel, tile_paths: dict[str, Path]
) -> tuple[np.ndarray, Affine, str, np.ndarray]:
    """Predict every tile and place it in one array covering the tiles' bounding grid.

    Returns (prob, transform, crs, valid) where valid marks pixels that had imagery.
    """
    keys = {t: TileKey.parse(t) for t in tile_paths}
    epsgs = {k.epsg for k in keys.values()}
    if len(epsgs) != 1:
        raise ValueError(f"tiles span several UTM zones: {epsgs}")
    k0 = next(iter(keys.values()))
    n = k0.size_px
    c0 = min(k.col for k in keys.values())
    r1 = max(k.row for k in keys.values())
    W = (max(k.col for k in keys.values()) - c0 + 1) * n
    H = (r1 - min(k.row for k in keys.values()) + 1) * n
    prob = np.zeros((H, W), np.float32)
    valid = np.zeros((H, W), bool)
    for tid, path in tile_paths.items():
        k = keys[tid]
        with rasterio.open(path) as src:
            arr = src.read()
        y0, x0 = (r1 - k.row) * n, (k.col - c0) * n
        prob[y0:y0 + n, x0:x0 + n] = model.predict(arr)
        valid[y0:y0 + n, x0:x0 + n] = ~(arr == 0).all(axis=0)
    t0 = tile_transform(TileKey(k0.epsg, k0.res_m, n, c0, r1))
    return prob, t0, f"EPSG:{k0.epsg}", valid


def write_prob(prob: np.ndarray, transform: Affine, crs: str, path: Path, tags: dict | None = None) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with rasterio.open(path, "w", driver="GTiff", width=prob.shape[1], height=prob.shape[0], count=1,
                       dtype="uint8", crs=crs, transform=transform, nodata=None, compress="deflate",
                       tiled=True, blockxsize=256, blockysize=256) as dst:
        dst.write(np.round(prob * 255).astype(np.uint8), 1)
        if tags:
            dst.update_tags(**{k: str(v) for k, v in tags.items()})
