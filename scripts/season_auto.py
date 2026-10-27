"""Automatic season updates (ADR-031): new roads screened, flagged and published twice a year, with no
laptop and no person in the loop (the owner chose "fully automatic", 2026-10-27).

.github/workflows/season-update.yml runs `python scripts/season_auto.py tick` every 3 hours. A tick reads
pipeline/season_state.json, advances at most one stage and exits (the Kaggle jobs run for hours):

  idle     a season window closed (pre-monsoon 31 May, post-monsoon 31 Dec; +5 days for the archive)
           that is newer than every screened season -> push its Sentinel-2 composite builds
           for Andhra Pradesh, Tamil Nadu, Hyderabad and Bengaluru                            -> build
  build    every build COMPLETE (an errored build is resumed from its own output, twice at most) -> screen
  screen   the 14 screening runs re-run with the new season (models and code unchanged), pushed
           as Kaggle CPU slots free                                                          -> pack
  pack     the evidence packer COMPLETE                                                      -> publish
  publish  fetch -> merge (stable ids) -> flag new alerts -> road tiles -> sharp lookups -> bundle
           -> release upload -> commit data_version.txt (Render redeploys)                   -> verify
  verify   the live site lists the new season                                                -> idle

The pilot zones A-C keep their 9-season run (laptop only: it needs local road layers); a road first seen
inside a zone on a newer season is alerted by the screening run (merge_statewide.py).
A stage that fails for good sets "failed": the workflow run fails (GitHub e-mails the owner) and later
ticks do nothing until `reset`.

  python scripts/season_auto.py plan [--today YYYY-MM-DD]   # what the next tick would do; changes nothing
  python scripts/season_auto.py tick                         # one step (KAGGLE_USERNAME / KAGGLE_KEY)
  python scripts/season_auto.py reset                        # clear a failed state, retry the stage
"""

from __future__ import annotations

import argparse
import json
import os
import re
import shutil
import subprocess
import sys
import tarfile
import time
import urllib.request
from datetime import UTC, date, datetime, timedelta
from pathlib import Path

import yaml

ROOT = Path(__file__).resolve().parents[1]
STATE = ROOT / "pipeline" / "season_state.json"
DATA = ROOT / "data_cache"
WORK = DATA / "season_auto"
BUNDLE_URL = ("https://github.com/upeshchowdary/AI-Based-Road-Extraction-and-New-Road-Alert-System-using-"
              "Multi-Temporal-Satellite-Images/releases/download/data-v1/roadwatch_data.tar.gz")
SITE = os.environ.get("ROADWATCH_SITE", "https://roadwatch-ap.onrender.com")
PBF_URL = "https://download.geofabrik.de/asia/india/southern-zone-latest.osm.pbf"

# season windows end (MM-DD) and the archive delay before a window counts as available
SEASON_END = {"pre_monsoon": "05-31", "post_monsoon": "12-31"}
DELAY = timedelta(days=5)
CPU_SLOTS = int(os.environ.get("KAGGLE_CPU_SLOTS", "5"))  # Kaggle: 5 CPU sessions at once
MAX_PUSH_FAILS = 16  # ~2 days of ticks (slots taken by other jobs, API hiccups) before giving up
MAX_BUILD_RESUMES = 2
MAX_SCREEN_RETRIES = 1
VERIFY_TICKS = 8  # ~1 day for Render to redeploy

# region -> (s2_build run used as the template for a new season, statewide screening runs)
REGIONS = {
    "ap": ("ap_2026_pre", [f"v1_s{i}" for i in range(6)]),
    "tn": ("tn_2026_pre", [f"tn_v2_s{i}" for i in range(6)]),
    "hyd": ("hyd_build", ["hyd_v1"]),
    "blr": ("blr_build", ["blr_v1"]),
}


# ------------------------------------------------------------------ planning (pure, tested)
def load_spec(model: str) -> dict:
    return yaml.safe_load((ROOT / "kaggle" / model / "runs.yaml").read_text(encoding="utf-8"))


def slug(model: str, run: str, user: str) -> str:
    prefix = load_spec(model)["kernel"]["title_prefix"]
    return f"{user}/{prefix}-{run}".replace("_", "-")


def season_end(key: str) -> date:
    year, name = int(key[:4]), key[5:]
    return date.fromisoformat(f"{year}-{SEASON_END[name]}")


def season_order(key: str) -> tuple[int, int]:
    return int(key[:4]), 0 if "pre" in key else 1


def screened_seasons(state: dict) -> list[str]:
    base = list(load_spec("statewide")["defaults"]["seasons"])
    return base + [s["season"] for s in state.get("seasons", []) if s["season"] not in base]


def next_season(state: dict, today: date) -> str | None:
    """The oldest closed season newer than every screened one (older gaps are not back-filled)."""
    have = screened_seasons(state)
    newest = max(have, key=season_order)
    for year in range(int(newest[:4]), today.year + 1):
        for name in SEASON_END:
            key = f"{year}_{name}"
            if season_order(key) > season_order(newest) and season_end(key) + DELAY <= today:
                return key
    return None


def build_run_name(region: str, season: str, attempt: int = 0) -> str:
    base = f"{region}_{season[:4]}_{'pre' if 'pre' in season else 'post'}"
    return base if attempt == 0 else f"{base}_r{attempt + 1}"


def build_config(region: str, season: str, attempt: int, user: str) -> dict:
    """A new season's composite build, copied from the region's last build; a resume attaches the earlier
    attempts' outputs (the builder skips tiles it finds there)."""
    tmpl = dict(load_spec("s2_build")["runs"][REGIONS[region][0]])
    tmpl.pop("labels", None)  # training labels are built once, not per season
    year = season[:4]
    cfg = {**tmpl, "seasons_only": season, "years": f"{year}-{year}", "attempts": 8, "stagger_s": 30}
    if region == "ap":
        cfg["shards"] = 6  # 4 builds at once: fewer workers per build, under Planetary Computer's limit
    if attempt:
        cfg["kernel_sources"] = [slug("s2_build", build_run_name(region, season, a), user)
                                 for a in range(attempt)]
    return cfg


def auto_runs(state: dict, user: str) -> dict[str, dict]:
    """kaggle/<model>/runs.auto.yaml contents for the current state (regenerated every tick)."""
    sw = load_spec("statewide")
    seasons = screened_seasons(state)
    builds: dict[str, dict] = {}
    extra_sources: dict[str, list[str]] = {r: [] for r in REGIONS}
    for s in state.get("seasons", []):
        for region, attempts in s.get("builds", {}).items():
            for a in range(attempts):
                builds[build_run_name(region, s["season"], a)] = build_config(region, s["season"], a, user)
                extra_sources[region].append(slug("s2_build", build_run_name(region, s["season"], a), user))
    screens = {}
    if state.get("seasons"):
        for region, (_, runs) in REGIONS.items():
            for r in runs:
                base = dict(sw["runs"][r])
                src = base.get("kernel_sources", sw["kernel"]["kernel_sources"])
                screens[r] = {**base, "seasons": seasons, "kernel_sources": src + extra_sources[region]}
    pack = {"all": {"kernel_sources": [slug("statewide", r, user) for _, rs in REGIONS.values() for r in rs]}}
    return {"s2_build": builds, "statewide": screens, "pack_evidence": pack if screens else {}}


def write_auto_runs(state: dict, user: str) -> None:
    for model, runs in auto_runs(state, user).items():
        p = ROOT / "kaggle" / model / "runs.auto.yaml"
        if runs:
            head = "# GENERATED by scripts/season_auto.py from pipeline/season_state.json - do not edit\n"
            p.write_text(head + yaml.safe_dump({"runs": runs}, sort_keys=False, width=110), encoding="utf-8")
        else:
            p.unlink(missing_ok=True)


# ------------------------------------------------------------------ Kaggle + shell
def sh(*cmd: str, timeout: int = 7200, check: bool = True) -> str:
    print("+", " ".join(cmd), flush=True)
    r = subprocess.run(cmd, cwd=ROOT, capture_output=True, text=True, encoding="utf-8", errors="replace",
                       timeout=timeout)
    out = (r.stdout + r.stderr).strip()
    print(out[-3000:], flush=True)
    if check and r.returncode:
        raise RuntimeError(f"{cmd[1] if len(cmd) > 1 else cmd[0]} failed ({r.returncode})")
    return out


def push(model: str, run: str) -> bool:
    out = sh(sys.executable, "scripts/kaggle_push.py", model, run, check=False, timeout=900)
    return "successfully pushed" in out.lower() and "error" not in out.lower()


def status(kernel: str) -> str:
    out = sh(sys.executable, "-m", "kaggle", "kernels", "status", kernel, check=False, timeout=300)
    m = re.search(r"KernelWorkerStatus\.(\w+)|has status \"?(\w+)", out)
    return (m.group(1) or m.group(2)).upper() if m else "UNKNOWN"


def now() -> str:
    return datetime.now(UTC).isoformat(timespec="seconds")


def job_state(job: dict, kernel: str) -> str:
    """QUEUED/RUNNING/COMPLETE/ERROR/... of a pushed job; a fresh push is never read as the previous
    version's COMPLETE (a re-pushed kernel keeps its slug)."""
    s = status(kernel)
    if s == "COMPLETE" and job.get("pushed_at"):
        if datetime.now(UTC) - datetime.fromisoformat(job["pushed_at"]) < timedelta(minutes=15):
            return "RUNNING"
    return s


# ------------------------------------------------------------------ stages
def stage_idle(state: dict, today: date, user: str) -> str:
    season = next_season(state, today)
    if not season:
        return "no new season"
    state.setdefault("seasons", []).append({"season": season, "started": now(),
                                            "builds": dict.fromkeys(REGIONS, 1), "jobs": {}})
    state["stage"] = "build"
    write_auto_runs(state, user)
    return f"new season {season}: building composites"


def advance_jobs(state: dict, jobs: list[tuple[str, str, str]], user: str, retry) -> tuple[bool, str]:
    """Push / poll a set of (key, model, run) jobs within the CPU slots. retry(key) -> new (model, run) or
    None when out of retries. Returns (all complete, message)."""
    cur = state["seasons"][-1]["jobs"]
    running = 0
    done = 0
    for key, model, run in jobs:
        j = cur.setdefault(key, {"model": model, "run": run, "fails": 0})
        if not j.get("pushed_at"):
            continue
        st = job_state(j, slug(j["model"], j["run"], user))
        j["status"] = st
        if st == "COMPLETE":
            done += 1
        elif st in ("ERROR", "CANCEL_ACKNOWLEDGED", "CANCEL_REQUESTED"):
            nxt = retry(key)
            if nxt is None:
                raise RuntimeError(f"{key}: {j['model']} {j['run']} ended {st}, no retries left")
            j.update(model=nxt[0], run=nxt[1], pushed_at=None, status="retry")
            write_auto_runs(state, user)
        else:
            running += 1
    for key, _, _ in jobs:
        j = cur[key]
        if j.get("pushed_at") or running >= CPU_SLOTS:
            continue
        if push(j["model"], j["run"]):
            j["pushed_at"], j["status"] = now(), "PUSHED"
            running += 1
        else:
            j["fails"] += 1
            if j["fails"] >= MAX_PUSH_FAILS:
                raise RuntimeError(f"{key}: push failed {j['fails']} times")
            break  # most likely no free slot: try again next tick
    return done == len(jobs), f"{done}/{len(jobs)} complete, {running} running"


def stage_build(state: dict, user: str) -> str:
    s = state["seasons"][-1]
    jobs = [(f"build:{r}", "s2_build", build_run_name(r, s["season"], s["builds"][r] - 1)) for r in REGIONS]

    def retry(key: str):
        r = key.split(":")[1]
        if s["builds"][r] > MAX_BUILD_RESUMES:
            return None
        s["builds"][r] += 1  # resume from the earlier attempts' outputs
        return "s2_build", build_run_name(r, s["season"], s["builds"][r] - 1)

    ok, msg = advance_jobs(state, jobs, user, retry)
    if ok:
        state["stage"] = "screen"
    return f"builds: {msg}"


def stage_screen(state: dict, user: str) -> str:
    jobs = [(f"screen:{r}", "statewide", r) for _, rs in REGIONS.values() for r in rs]
    tries: dict[str, int] = state["seasons"][-1].setdefault("screen_retries", {})

    def retry(key: str):
        tries[key] = tries.get(key, 0) + 1
        return None if tries[key] > MAX_SCREEN_RETRIES else ("statewide", key.split(":")[1])

    ok, msg = advance_jobs(state, jobs, user, retry)
    if ok:
        state["stage"] = "pack"
    return f"screening: {msg}"


def stage_pack(state: dict, user: str) -> str:
    ok, msg = advance_jobs(state, [("pack", "pack_evidence", "all")], user, lambda _k: None)
    if ok:
        state["stage"] = "publish"
    return f"evidence pack: {msg}"


def fetch_bundle() -> None:
    """The published bundle becomes data_cache (zone images, chips, metrics, previous alerts)."""
    print(f"downloading {BUNDLE_URL}", flush=True)
    with urllib.request.urlopen(BUNDLE_URL, timeout=600) as r, tarfile.open(fileobj=r, mode="r|gz") as t:
        t.extractall(DATA, filter="data")


def stage_publish(state: dict, user: str) -> str:
    if not os.environ.get("GITHUB_ACTIONS"):
        raise RuntimeError("publish runs on the GitHub runner only (it replaces data_cache with the bundle)")
    s = state["seasons"][-1]
    py = sys.executable
    fetch_bundle()
    runs = [r for _, rs in REGIONS.values() for r in rs]
    dirs = []
    for r in runs:
        sh(py, "scripts/kaggle_push.py", "statewide", r, "--fetch", "--pattern", r"^(alerts|blocks|roads)_s")
        dirs.append(f"data_cache/runs/statewide_{r}")
    sh(py, "scripts/kaggle_push.py", "pack_evidence", "all", "--fetch")
    for t in sorted((DATA / "runs" / "pack_evidence_all").glob("evidence_*.tar")):
        m = re.search(r"statewide-(.+)$", t.stem)
        if m:
            dst = DATA / "runs" / f"statewide_{m.group(1).replace('-', '_')}" / "evidence"
            dst.mkdir(parents=True, exist_ok=True)
            with tarfile.open(t) as tf:
                tf.extractall(dst, filter="data")
    shutil.rmtree(DATA / "outputs" / "statewide" / "evidence", ignore_errors=True)  # stale chips
    sh(py, "scripts/merge_statewide.py", *dirs)

    # flags for alerts that have none yet (earlier alerts keep theirs; zones keep their ohsome-based flags)
    flags_p = DATA / "outputs" / "alerts" / "alert_flags.json"
    have = json.loads(flags_p.read_text(encoding="utf-8"))["alerts"] if flags_p.exists() else {}
    alerts = json.loads((DATA / "outputs" / "alerts" / "alerts.json").read_text(encoding="utf-8"))["alerts"]
    new = [a for a in alerts if a["id"] not in have and a.get("scope") == "statewide"]
    if new:
        WORK.mkdir(parents=True, exist_ok=True)
        (WORK / "new_alerts.json").write_text(json.dumps({"alerts": new}), encoding="utf-8")
        pbf = DATA / "osm" / "southern-zone-latest.osm.pbf"
        pbf.parent.mkdir(parents=True, exist_ok=True)
        with urllib.request.urlopen(PBF_URL, timeout=1800) as r, pbf.open("wb") as f:
            shutil.copyfileobj(r, f, 1 << 20)
        sh(py, "scripts/alert_flags.py", "--skip-zones", "--extra", str(WORK / "new_alerts.json"))
    sh(py, "scripts/build_road_tiles.py")
    try:  # optional: an alert without a pre-resolved lookup is resolved live on first view
        sh(py, "scripts/prefetch_sharp.py", check=False, timeout=90 * 60)
    except subprocess.TimeoutExpired:
        print("sharp prefetch stopped after 90 min (the rest resolve live)", flush=True)
    sh(py, "scripts/build_deploy_bundle.py", "--refresh")

    s["published"] = now()
    s["alerts"] = len(alerts)
    s["new_alerts"] = len(new)
    state["stage"] = "verify"
    state["verify_ticks"] = 0
    save(state)
    write_auto_runs(state, user)
    sh("gh", "release", "upload", "data-v1", "data_cache/deploy/roadwatch_data.tar.gz", "--clobber",
       timeout=3600)
    paths = ["data_version.txt", "pipeline/season_state.json", "runs/RUN_LOG.csv",
             *[str(p.relative_to(ROOT)) for p in ROOT.glob("kaggle/*/runs.auto.yaml")]]
    sh("git", "add", "--", *paths)
    sh("git", "commit", "-m", f"Season update {s['season']}: {len(alerts)} alerts ({len(new)} new)\n\n"
       "Automatic (scripts/season_auto.py, ADR-031): screened, flagged and published without a manual step.")
    sh("git", "push", "origin", "HEAD:main")
    return f"published {s['season']}: {len(alerts)} alerts, {len(new)} new"


def stage_verify(state: dict) -> str:
    season = state["seasons"][-1]["season"]
    try:
        with urllib.request.urlopen(f"{SITE}/api/alerts/summary", timeout=180) as r:
            dates = [d["id"] for d in json.load(r).get("dates", [])]
    except Exception as e:  # Render asleep / redeploying
        dates = []
        print(f"site not answering yet: {e}", flush=True)
    if season in dates:
        state["seasons"][-1]["verified"] = now()
        state["stage"] = "idle"
        return f"live site shows {season}"
    state["verify_ticks"] = state.get("verify_ticks", 0) + 1
    if state["verify_ticks"] >= VERIFY_TICKS:
        raise RuntimeError(f"live site still does not list {season} after {VERIFY_TICKS} checks")
    return f"waiting for the redeploy ({state['verify_ticks']}/{VERIFY_TICKS})"


# ------------------------------------------------------------------ state + CLI
def load() -> dict:
    if STATE.exists():
        return json.loads(STATE.read_text(encoding="utf-8"))
    return {"stage": "idle", "seasons": []}


def save(state: dict) -> None:
    STATE.parent.mkdir(parents=True, exist_ok=True)
    STATE.write_text(json.dumps(state, indent=1) + "\n", encoding="utf-8")


def tick(state: dict, today: date, user: str) -> str:
    stage = state.get("stage", "idle")
    if stage == "failed":
        return f"failed earlier ({state.get('error')}); run `reset` after fixing it"
    write_auto_runs(state, user)  # a fresh checkout: kaggle_push reads the generated runs
    if stage == "idle":
        return stage_idle(state, today, user)
    if stage == "build":
        return stage_build(state, user)
    if stage == "screen":
        return stage_screen(state, user)
    if stage == "pack":
        return stage_pack(state, user)
    if stage == "publish":
        return stage_publish(state, user)
    if stage == "verify":
        return stage_verify(state)
    raise RuntimeError(f"unknown stage {stage!r}")


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("cmd", choices=("plan", "tick", "reset"))
    ap.add_argument("--today", default="", help="pretend date, YYYY-MM-DD (plan only)")
    a = ap.parse_args()
    state = load()
    user = os.environ.get("KAGGLE_USERNAME", "upeshchowdary")
    today = date.fromisoformat(a.today) if a.today else date.today()
    if a.cmd == "plan":
        season = next_season(state, today) if state.get("stage", "idle") == "idle" else None
        upcoming = min(season_end(f"{y}_{n}") + DELAY for y in (today.year, today.year + 1)
                       for n in SEASON_END if season_end(f"{y}_{n}") + DELAY > today)
        print(json.dumps({"stage": state.get("stage", "idle"), "screened": screened_seasons(state),
                          "next_season": season, "next_window_ready_on": str(upcoming)}, indent=1))
        return 0
    if a.cmd == "reset":
        if state.get("stage") == "failed":
            state["stage"] = state.pop("failed_stage", "idle")
            state.pop("error", None)
            save(state)
        print(f"stage: {state.get('stage')}")
        return 0
    t0 = time.time()
    stage = state.get("stage", "idle")
    code = 0  # an earlier failure was reported once (that run failed); later ticks just wait for `reset`
    try:
        msg = tick(state, today, user)
    except Exception as e:
        state.update(stage="failed", failed_stage=stage, error=f"{type(e).__name__}: {e}"[:500],
                     failed_at=now())
        msg, code = f"FAILED in {stage}: {e}", 1
    state["last_tick"] = {"at": now(), "stage": stage, "result": msg}
    save(state)
    print(f"[{stage} -> {state.get('stage')}] {msg} ({time.time() - t0:.0f} s)")
    return code


if __name__ == "__main__":
    sys.exit(main())
