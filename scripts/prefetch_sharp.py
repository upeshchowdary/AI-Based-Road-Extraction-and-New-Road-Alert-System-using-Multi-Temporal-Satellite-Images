"""Pre-resolve the sharp before/after lookup (Esri Wayback capture dates) for every alert, in parallel.

The API resolves one alert at a time (a lock keeps visitors from bursting Esri); for thousands of new
alerts that takes hours, so this runs the same endpoint code on a few threads and fills the same cache
(web_cache/wayback/<id>_<geometry hash>.json) that build_deploy_bundle.py ships.

    uv run python scripts/prefetch_sharp.py [--threads 6]
"""

from __future__ import annotations

import argparse
import contextlib
import time
from concurrent.futures import ThreadPoolExecutor, as_completed

from roadwatch.api import app as api


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--threads", type=int, default=6)
    n_threads = ap.parse_args().threads
    api._WB_LOCK = contextlib.nullcontext()  # this script is the only client
    ids = [a["id"] for a in api._alerts_payload().get("alerts", [])]
    ok = failed = 0
    t0 = time.time()

    def one(aid: str) -> bool:
        for attempt in range(3):
            try:
                api.alert_sharp(aid)
                return True
            except Exception:  # noqa: BLE001 - Esri timeouts: back off and retry
                time.sleep(5 * (attempt + 1))
        return False

    with ThreadPoolExecutor(n_threads) as ex:
        for i, f in enumerate(as_completed(ex.submit(one, aid) for aid in ids), 1):
            ok += f.result()
            failed += not f.result()
            if i % 250 == 0 or i == len(ids):
                print(f"{i}/{len(ids)} done, {failed} failed, {time.time() - t0:.0f} s", flush=True)
    print(f"sharp lookups: {ok} ok, {failed} failed")


if __name__ == "__main__":
    main()
