"""Download the official DINOv3 satellite ViT-L weights (gated; licence accepted by the user on HF)
into data_cache/models/dinov3-vitl16-sat493m, for a PRIVATE Kaggle dataset shared only with the team.

Usage: uv run --extra kaggle python scripts/fetch_dinov3.py [--list]
Licence: DINOv3 License (Meta). Weights are never committed to Git or published publicly.
"""

from __future__ import annotations

import os
import sys
from pathlib import Path

from dotenv import load_dotenv

ROOT = Path(__file__).resolve().parents[1]
REPO_ID = "facebook/dinov3-vitl16-pretrain-sat493m"
DEST = ROOT / "data_cache" / "models" / "dinov3-vitl16-sat493m"


def main() -> int:
    load_dotenv(ROOT / ".env")
    from huggingface_hub import HfApi, snapshot_download

    token = os.environ.get("HF_TOKEN")
    info = HfApi(token=token).model_info(REPO_ID, files_metadata=True)
    for s in info.siblings:
        print(f"  {s.rfilename:40s} {(s.size or 0) / 1e6:8.1f} MB")
    if "--list" in sys.argv:
        return 0
    path = snapshot_download(REPO_ID, token=token, local_dir=DEST,
                             allow_patterns=["*.json", "*.safetensors", "*.md", "LICENSE*"])
    print(f"downloaded -> {path}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
