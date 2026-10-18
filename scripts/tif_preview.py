"""Turn 4-band Sentinel-2 composite GeoTIFFs into true-colour PNGs anyone can open.

Usage: uv run python scripts/tif_preview.py <folder-or-tif> [--out data_cache/previews]
Bands B04 B03 B02 (red, green, blue) with a 2-98% stretch; band 4 (near-infrared) is not shown.
No-data pixels (0) stay black.
"""

from __future__ import annotations

import argparse
from pathlib import Path

import numpy as np
import rasterio
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]


def to_png(tif: Path, out: Path) -> None:
    with rasterio.open(tif) as src:
        a = src.read([3, 2, 1]).astype(np.float32)  # B04 B03 B02 = true colour
    valid = a.max(axis=0) > 0
    lo, hi = np.percentile(a[:, valid], (2, 98)) if valid.any() else (0, 1)
    rgb = (np.clip((a - lo) / max(hi - lo, 1), 0, 1) * 255).astype(np.uint8).transpose(1, 2, 0)
    rgb[~valid] = 0
    Image.fromarray(rgb).save(out)


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("src", type=Path)
    ap.add_argument("--out", type=Path, default=ROOT / "data_cache" / "previews")
    a = ap.parse_args()
    tifs = [a.src] if a.src.is_file() else sorted(a.src.glob("*.tif"))
    dest = a.out / (a.src.parent.name if a.src.is_file() else a.src.name)
    dest.mkdir(parents=True, exist_ok=True)
    for t in tifs:
        to_png(t, dest / f"{t.stem}.png")
    print(f"{len(tifs)} PNGs -> {dest}")


if __name__ == "__main__":
    main()
