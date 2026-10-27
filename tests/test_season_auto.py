"""Automatic season updates (scripts/season_auto.py): planning and generated Kaggle runs (no network)."""

import importlib.util
from datetime import date
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location("season_auto", ROOT / "scripts" / "season_auto.py")
sa = importlib.util.module_from_spec(spec)
spec.loader.exec_module(sa)


def test_next_season_waits_for_closed_window_plus_delay():
    idle = {"stage": "idle", "seasons": []}
    assert sa.next_season(idle, date(2026, 10, 28)) is None
    assert sa.next_season(idle, date(2027, 1, 4)) is None  # window closed 31 Dec, archive delay
    assert sa.next_season(idle, date(2027, 1, 5)) == "2026_post_monsoon"
    done = {"stage": "idle", "seasons": [{"season": "2026_post_monsoon", "builds": {}}]}
    assert sa.next_season(done, date(2027, 3, 1)) is None
    assert sa.next_season(done, date(2027, 6, 6)) == "2027_pre_monsoon"
    # a long outage catches up one season at a time, oldest first, never back-filling older gaps
    assert sa.next_season(idle, date(2028, 7, 1)) == "2026_post_monsoon"


def test_build_config_is_a_new_season_copy_and_resumes_from_earlier_attempts():
    c = sa.build_config("ap", "2026_post_monsoon", 0, "u")
    assert c["seasons_only"] == "2026_post_monsoon" and c["years"] == "2026-2026"
    assert "labels" not in c and "kernel_sources" not in c and c["shards"] == 6
    r = sa.build_config("tn", "2026_post_monsoon", 2, "u")
    assert r["embed_files"] and r["kernel_sources"] == ["u/roadwatch-s2-build-tn-2026-post",
                                                         "u/roadwatch-s2-build-tn-2026-post-r2"]
    assert sa.build_run_name("hyd", "2027_pre_monsoon", 1) == "hyd_2027_pre_r2"


def test_auto_runs_add_the_season_and_its_builds_to_every_screening_run():
    state = {"stage": "screen", "seasons": [{"season": "2026_post_monsoon",
                                             "builds": {"ap": 2, "tn": 1, "hyd": 1, "blr": 1}}]}
    runs = sa.auto_runs(state, "u")
    assert set(runs["s2_build"]) == {"ap_2026_post", "ap_2026_post_r2", "tn_2026_post", "hyd_2026_post",
                                     "blr_2026_post"}
    sw = runs["statewide"]
    assert len(sw) == 14 and all(r["seasons"][-1] == "2026_post_monsoon" for r in sw.values())
    assert sw["v1_s3"]["shard"] == 3
    assert sw["v1_s3"]["kernel_sources"][-2:] == ["u/roadwatch-s2-build-ap-2026-post",
                                                  "u/roadwatch-s2-build-ap-2026-post-r2"]
    tn = sw["tn_v2_s1"]
    assert tn["shard"] == 1 and tn["model_meta"]["model_id"].startswith("s2_model_v2")
    assert tn["kernel_sources"][-1] == "u/roadwatch-s2-build-tn-2026-post"
    assert not any("tn-2026-post" in k for k in sw["hyd_v1"]["kernel_sources"])
    assert len(runs["pack_evidence"]["all"]["kernel_sources"]) == 14
    # nothing generated while idle with no automatic season yet
    assert sa.auto_runs({"stage": "idle", "seasons": []}, "u") == {"s2_build": {}, "statewide": {},
                                                                   "pack_evidence": {}}


def test_refresh_bundle_skips_working_material():
    spec_b = importlib.util.spec_from_file_location("bundle", ROOT / "scripts" / "build_deploy_bundle.py")
    src = spec_b.loader.get_source("bundle")
    assert "def refresh_skip" in src
    ns: dict = {}
    exec(src[src.index("def refresh_skip"):src.index("def pack(")], ns)
    skip = ns["refresh_skip"]
    assert skip("runs/statewide_v1_s0/alerts_s0.json") and skip("osm/x.osm.pbf")
    assert skip("outputs/statewide/roads_latest.parquet") and skip("deploy/roadwatch_data.tar.gz")
    assert not skip("runs/s2_model_v2_s0/metrics.json")
    assert not skip("outputs/statewide/evidence/RW-1-01/2026_pre_monsoon.webp")
    assert not skip("outputs/road_tiles/10/1/2.pbf")
