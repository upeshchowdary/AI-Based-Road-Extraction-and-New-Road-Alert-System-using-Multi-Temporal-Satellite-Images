"""Build and push a Kaggle kernel run from kaggle/<model>/runs.yaml.

Usage:
  uv run --extra kaggle --env-file .env python scripts/kaggle_push.py baseline_a timing [--dry-run]
  uv run --extra kaggle --env-file .env python scripts/kaggle_push.py baseline_a timing --status
  uv run --extra kaggle --env-file .env python scripts/kaggle_push.py baseline_a timing --fetch

- Injects the run config into the script, stamps a config hash, writes kernel-metadata.json
  into kaggle/build/<model>_<run>/ (git-ignored) and runs `kaggle kernels push`.
- Appends a row to runs/RUN_LOG.csv (contribution evidence).
- --fetch downloads outputs to data_cache/runs/<model>_<run>/ (git-ignored).
"""

from __future__ import annotations

import argparse
import csv
import hashlib
import json
import os
import pprint
import re
import subprocess
import sys
import time
from datetime import UTC, datetime
from pathlib import Path

import yaml

ROOT = Path(__file__).resolve().parents[1]
RUN_LOG = ROOT / "runs" / "RUN_LOG.csv"


def kaggle(*args: str) -> subprocess.CompletedProcess:
    env = {**os.environ, "PYTHONIOENCODING": "utf-8", "PYTHONUTF8": "1"}
    return subprocess.run([sys.executable, "-m", "kaggle", *args], capture_output=True, text=True,
                          encoding="utf-8", errors="replace", timeout=7200, env=env)


def build(model: str, run: str, require_pushed: bool = True) -> tuple[Path, dict, dict]:
    spec = yaml.safe_load((ROOT / "kaggle" / model / "runs.yaml").read_text(encoding="utf-8"))
    cfg = {**spec.get("defaults", {}), **spec["runs"][run]}
    if cfg.get("commit") == "HEAD":  # pin code version; must already be on GitHub
        sha = subprocess.run(["git", "rev-parse", "HEAD"], capture_output=True, text=True,
                             cwd=ROOT, check=True).stdout.strip()
        remote = subprocess.run(["git", "branch", "-r", "--contains", sha], capture_output=True,
                                text=True, cwd=ROOT).stdout
        if require_pushed and "origin/" not in remote:
            raise RuntimeError(f"commit {sha[:8]} is not pushed to GitHub yet (git push first)")
        cfg["commit"] = sha
    cfg_hash = hashlib.sha256(json.dumps(cfg, sort_keys=True).encode()).hexdigest()[:12]
    cfg["run_id"] = f"{model}_{run}_{cfg_hash}"
    cfg["config_hash"] = cfg_hash

    code_file = spec["kernel"].get("code_file", "train.py")
    source = spec["kernel"].get("source", f"{model}/{code_file}")
    src = (ROOT / "kaggle" / source).read_text(encoding="utf-8")
    block = "RUN_CONFIG = " + pprint.pformat(cfg, sort_dicts=False) + "\n"
    new_src, n = re.subn(r"RUN_CONFIG = \{.*?\n\}\n", lambda _: block, src, count=1, flags=re.S)
    if n != 1:
        raise RuntimeError("RUN_CONFIG block not found in train.py")

    user = os.environ.get("KAGGLE_USERNAME")
    if not user:
        raise RuntimeError("KAGGLE_USERNAME missing (.env)")
    k = spec["kernel"]
    slug = f"{k['title_prefix']}-{run}".replace("_", "-")
    out = ROOT / "kaggle" / "build" / f"{model}_{run}"
    out.mkdir(parents=True, exist_ok=True)
    (out / code_file).write_text(new_src, encoding="utf-8")
    meta = {
        "id": f"{user}/{slug}",
        "title": slug,
        "code_file": code_file,
        "language": "python",
        "kernel_type": "script",
        "is_private": k["is_private"],
        "enable_gpu": k.get("enable_gpu", True),
        "enable_tpu": False,
        "enable_internet": k["enable_internet"],
        "dataset_sources": k["dataset_sources"],
        "competition_sources": [],
        # a run may attach other kernels' outputs (e.g. resume a build from an earlier version)
        "kernel_sources": cfg.get("kernel_sources", k.get("kernel_sources", [])),
        "model_sources": [],
        "machine_shape": k.get("accelerator") or "",
    }
    (out / "kernel-metadata.json").write_text(json.dumps(meta, indent=2), encoding="utf-8")
    return out, cfg, meta


def log_run(cfg: dict, meta: dict, result: str) -> None:
    with RUN_LOG.open("a", newline="", encoding="utf-8") as f:
        csv.writer(f).writerow([cfg["run_id"], os.environ.get("ROADWATCH_PERSON", "lead"),
                                meta["id"].split("/")[0], meta["id"], cfg["config_hash"],
                                datetime.now(UTC).isoformat(timespec="seconds"), "", "", result, ""])


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("model")
    ap.add_argument("run")
    ap.add_argument("--dry-run", action="store_true")
    ap.add_argument("--status", action="store_true")
    ap.add_argument("--fetch", action="store_true")
    ap.add_argument("--pattern", default="", help="with --fetch: only files matching this regex")
    a = ap.parse_args()

    out, cfg, meta = build(a.model, a.run, require_pushed=not (a.status or a.fetch or a.dry_run))
    if a.status:
        r = kaggle("kernels", "status", meta["id"])
        print((r.stdout + r.stderr).strip())
        return r.returncode
    if a.fetch:
        dest = ROOT / "data_cache" / "runs" / f"{a.model}_{a.run}"
        dest.mkdir(parents=True, exist_ok=True)
        # outputs are paged; follow "Next Page Token" until every file is downloaded. Kaggle answers
        # bursts with 429 / timeouts (thousands of evidence chips): wait and retry the SAME page.
        pat = ["--file-pattern", a.pattern] if a.pattern else []
        token, n_pages = "", 0
        while True:
            extra = ["--page-token", token] if token else []
            for attempt in range(8):
                r = kaggle("kernels", "output", meta["id"], "-p", str(dest), "-o",
                           "--page-size", "200", *pat, *extra)
                text = r.stdout + r.stderr
                if not re.search(r"429|Too Many Requests|timed out|ConnectTimeout|ConnectionError", text):
                    break
                wait = min(300, 30 * 2 ** attempt)
                print(f"page {n_pages + 1}: rate-limited / timeout, retry in {wait}s", flush=True)
                time.sleep(wait)
            n_pages += 1
            m = re.search(r"Next Page Token = (\S+)", r.stdout + r.stderr)
            if r.returncode or not m or m.group(1) == token:
                break
            token = m.group(1)
        print((r.stdout + r.stderr).strip()[-800:])
        print(f"pages fetched: {n_pages}")
        print(f"outputs -> {dest}")
        return r.returncode
    print(f"run_id={cfg['run_id']}  kernel={meta['id']}  build={out.relative_to(ROOT)}")
    if a.dry_run:
        return 0
    acc = ["--accelerator", meta["machine_shape"]] if meta["machine_shape"] else []
    r = kaggle("kernels", "push", "-p", str(out), *acc)
    print((r.stdout + r.stderr).strip())
    # the Kaggle CLI exits 0 even on "Kernel push error: ..." -> check the text too
    ok = r.returncode == 0 and "error" not in (r.stdout + r.stderr).lower()
    log_run(cfg, meta, "pushed" if ok else "push_failed: " + (r.stdout + r.stderr).strip()[:120])
    return 0 if ok else 1


if __name__ == "__main__":
    sys.exit(main())
