"""Pack the evidence chips of finished screening runs into one tar per run.

The Kaggle API downloads kernel outputs one file at a time (~30 files/min with rate limits), so the
~70,000 per-alert chips of AP + Tamil Nadu would take most of a day. This kernel mounts the runs as
kernel sources and writes evidence_<run>.tar (chips are WebP already: stored, not compressed), which
downloads in minutes:  scripts/kaggle_push.py pack_evidence all --fetch
"""

import glob
import os
import tarfile
import time

RUN_CONFIG = {
}

OUT = "/kaggle/working"
T0 = time.time()

dirs = sorted({os.path.dirname(p) for p in glob.glob("/kaggle/input/**/evidence/*/*.webp", recursive=True)})
runs = sorted({os.path.dirname(d) for d in dirs})  # .../<run>/evidence
print(f"{len(runs)} runs with evidence", flush=True)
for ev in runs:
    run = os.path.basename(os.path.dirname(ev))
    dst = os.path.join(OUT, f"evidence_{run}.tar")
    n = 0
    with tarfile.open(dst, "w") as t:
        for d in sorted(glob.glob(os.path.join(ev, "*"))):
            for f in sorted(glob.glob(os.path.join(d, "*.webp"))):
                t.add(f, arcname=f"{os.path.basename(d)}/{os.path.basename(f)}")
                n += 1
    print(f"{run}: {n} chips -> {dst} ({os.path.getsize(dst) / 1e6:.1f} MB, {time.time() - T0:.0f} s)", flush=True)
