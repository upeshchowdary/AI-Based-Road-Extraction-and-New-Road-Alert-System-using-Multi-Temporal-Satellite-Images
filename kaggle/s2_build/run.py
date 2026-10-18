"""RoadWatch AP — Sentinel-2 composite build on a Kaggle CPU session (no GPU quota used).

Clones the public repo at a pinned commit, runs `roadwatch s2-build` for each zone in parallel
processes (network-bound), writes GeoTIFFs + registry rows to /kaggle/working.
Push with: scripts/kaggle_push.py s2_build zones
"""

# --- RUN_CONFIG (injected by scripts/kaggle_push.py; do not edit by hand) ---
RUN_CONFIG = {
    "run_id": "local-debug",
    "commit": "main",
    "config": "configs/pilot.yaml",
    "zones": ["A", "B", "C"],          # used when zones_only
    "zones_only": True,
    "shards": 4,                        # parallel workers when not zones_only
    "seasons_only": "",                 # e.g. "2025_post_monsoon,2026_pre_monsoon"
    "years": "2022-2026",
    "config_hash": "none",
}
# --- END RUN_CONFIG ---

import glob
import os
import shutil
import subprocess
import sys
import time
from concurrent.futures import ThreadPoolExecutor

REPO = "https://github.com/upeshchowdary/AI-Based-Road-Extraction-and-New-Road-Alert-System-using-Multi-Temporal-Satellite-Images"
WORK = "/kaggle/working"
SRC = "/kaggle/temp/rw"
C = RUN_CONFIG
T0 = time.time()


def sh(cmd, **kw):
    print("+", " ".join(cmd), flush=True)
    return subprocess.run(cmd, check=True, **kw)


def resume():
    """Copy composites + registry rows from earlier runs attached as kernel_sources."""
    for src in glob.glob("/kaggle/input/*/"):
        tifs = glob.glob(os.path.join(src, "**", "s2", "*", "*.tif"), recursive=True)
        for t in tifs:
            dst = os.path.join(WORK, "s2", os.path.basename(os.path.dirname(t)), os.path.basename(t))
            if not os.path.exists(dst):
                os.makedirs(os.path.dirname(dst), exist_ok=True)
                shutil.copy2(t, dst)
        regs = glob.glob(os.path.join(src, "**", "registry_*.parquet"), recursive=True)
        tag = os.path.basename(src.rstrip("/"))
        for r in regs:
            shutil.copy2(r, os.path.join(WORK, f"prev_{tag}_{os.path.basename(r)}"))
        if tifs:
            print(f"resume: {len(tifs)} composites + {len(regs)} registries from {src}", flush=True)


def main():
    if os.path.exists(SRC):
        shutil.rmtree(SRC)
    sh(["git", "clone", "-q", REPO, SRC])
    sh(["git", "-C", SRC, "checkout", "-q", C["commit"]])
    sh([sys.executable, "-m", "pip", "install", "-q", "pystac-client", "planetary-computer",
        "rasterio", "geopandas", "pyogrio", "typer", "pydantic>=2.7", "scikit-image"])
    env = {**os.environ, "PYTHONPATH": os.path.join(SRC, "src"), "PYTHONUNBUFFERED": "1"}
    base = [sys.executable, "-m", "roadwatch.cli", "s2-build", "--config", C["config"],
            "--years", C["years"], "--out-dir", os.path.join(WORK, "s2"),
            "--seasons-only", C.get("seasons_only", "")]
    if not C.get("build", True):  # labels-only run
        jobs = []
    elif C.get("zones_only", True):
        jobs = [(z, ["--zones-only", "--zone", z]) for z in C["zones"]]
    else:
        n = C["shards"]
        jobs = [(f"s{i}", ["--no-zones-only", "--shard", f"{i}/{n}"]) for i in range(n)]
    if jobs:
        resume()

    def run_job(i, name, extra):
        """One worker; restarted with back-off when Planetary Computer rate-limits it (s2-build
        skips tiles already written, so a restart only fetches what is missing)."""
        time.sleep(i * C.get("stagger_s", 20))  # spread the first STAC/SAS requests
        e = {**env, "ROADWATCH_REGISTRY": os.path.join(WORK, f"registry_{name}.parquet")}
        rc = -1
        for attempt in range(C.get("attempts", 8)):
            with open(os.path.join(WORK, f"log_{name}.txt"), "a") as log:
                log.write(f"\n=== attempt {attempt + 1} at {time.time() - T0:.0f}s ===\n")
                log.flush()
                rc = subprocess.run(base + extra, cwd=SRC, env=e, stdout=log,
                                    stderr=subprocess.STDOUT).returncode
            print(f"worker {name}: attempt {attempt + 1} rc={rc} at {time.time() - T0:.0f}s", flush=True)
            if rc == 0:
                break
            time.sleep(min(900, 60 * 2 ** attempt))
        return name, rc

    results = []
    if jobs:
        with ThreadPoolExecutor(len(jobs)) as ex:
            results = list(ex.map(lambda a: run_job(*a), [(i, n, x) for i, (n, x) in enumerate(jobs)]))
    for name, rc in results:
        print(f"worker {name}: final rc={rc}", flush=True)
        print(open(os.path.join(WORK, f"log_{name}.txt")).read()[-1500:], flush=True)
    n = len(glob.glob(os.path.join(WORK, "s2", "*", "*.tif")))
    print(f"done: {n} tiles in {time.time() - T0:.0f}s  run_id={C['run_id']} commit={C['commit']}")
    if C.get("labels"):  # OSM road labels for every AOI tile (training targets), from a Geofabrik extract
        pbf = "/kaggle/temp/osm.pbf"
        sh(["wget", "-q", "-O", pbf, C["labels"]])
        # labels-build caches roads under data_cache/osm; commits before the fix don't create it
        os.makedirs(os.path.join(SRC, "data_cache", "osm"), exist_ok=True)
        e = {**env, "ROADWATCH_REGISTRY": os.path.join(WORK, "registry_labels.parquet")}
        sh([sys.executable, "-m", "roadwatch.cli", "labels-build", "--config", C["config"], "--pbf", pbf,
            "--out-dir", os.path.join(WORK, "labels")], cwd=SRC, env=e)
        print(f"labels: {len(glob.glob(os.path.join(WORK, 'labels', '*.png')))} tiles", flush=True)


if __name__ == "__main__":
    main()
