"""Run Kaggle jobs in order as slots free (Kaggle allows 2 GPU / 5 CPU sessions at once).

Usage: python scripts/kaggle_queue.py --running s2_model:cities_s0 s2_model:v2_r50_ssl \
                                      --queue s2_model:v2_r50_in s2_model:v3_long
Polls every 3 min; when a running job finishes (COMPLETE / ERROR / CANCEL), pushes the next queued job.
Every call is retried (a flaky laptop must not drop a launch). Exits when the queue is empty, printing
what happened; the log also goes to data_cache/kaggle_queue.log.
"""

from __future__ import annotations

import argparse
import re
import subprocess
import sys
import time
from datetime import datetime
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
LOG = ROOT / "data_cache" / "kaggle_queue.log"


def say(msg: str) -> None:
    line = f"{datetime.now():%H:%M} {msg}"
    print(line, flush=True)
    with LOG.open("a", encoding="utf-8") as f:
        f.write(line + "\n")


def push(job: str, *extra: str, tries: int = 6) -> str:
    model, run = job.split(":")
    for i in range(tries):
        try:
            r = subprocess.run([sys.executable, str(ROOT / "scripts" / "kaggle_push.py"), model, run, *extra],
                               capture_output=True, text=True, timeout=600, cwd=ROOT)
            out = (r.stdout + r.stderr).strip()
            if "status" in " ".join(extra) and "has status" in out:
                return out
            if not extra and ("successfully pushed" in out or "error" in out.lower()):
                return out
        except Exception as e:  # noqa: BLE001 - retry anything (process start, timeouts)
            out = f"{type(e).__name__}: {e}"
        time.sleep(20 * (i + 1))
    return out


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--running", nargs="*", default=[])
    ap.add_argument("--queue", nargs="*", default=[])
    ap.add_argument("--every", type=int, default=180)
    a = ap.parse_args()
    running, queue = list(a.running), list(a.queue)
    say(f"start: running {running}, queue {queue}")
    while queue:
        time.sleep(a.every)
        for job in list(running):
            st = push(job, "--status")
            m = re.search(r"KernelWorkerStatus\.(COMPLETE|ERROR|CANCEL\w*)", st)
            if not m:
                continue
            say(f"{job} finished: {m.group(1)}")
            running.remove(job)
            if queue:
                nxt = queue[0]
                out = push(nxt)
                if "successfully pushed" in out:
                    say(f"launched {nxt}")
                    queue.pop(0)
                    running.append(nxt)
                else:
                    say(f"launch of {nxt} failed: {out[-200:]}")
    say(f"queue empty; still running: {running}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
