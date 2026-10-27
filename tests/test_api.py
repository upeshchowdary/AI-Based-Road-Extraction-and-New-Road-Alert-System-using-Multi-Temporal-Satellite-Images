"""API tests on the real repo files (no network: search tests use coordinates only)."""

from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from roadwatch.api.app import app

client = TestClient(app)


def test_health():
    r = client.get("/api/health")
    assert r.status_code == 200
    d = r.json()
    assert d["status"] == "ok" and d["aoi"] == "ntr_krishna_pilot" and len(d["config_hash"]) == 12


def test_boundaries_and_zones():
    assert client.get("/api/boundaries/ap").json()["type"] == "FeatureCollection"
    d = client.get("/api/boundaries/districts").json()
    assert {f["properties"]["name"] for f in d["features"]} == {"NTR", "Krishna"}
    z = client.get("/api/zones").json()
    assert [f["properties"]["code"] for f in z["features"]] == ["A", "B", "C"]
    assert client.get("/api/boundaries/nope").status_code == 404


def test_search_coordinates_offline_safe():
    r = client.get("/api/search", params={"q": "16.53, 80.80"})
    res = r.json()["results"]
    assert res[0]["center"] == [80.8, 16.53]
    # default order is "lat, lon"; lon-first is detected only when the first value can't be a latitude
    r = client.get("/api/search", params={"q": "120.5 30.25"})
    assert r.json()["results"][0]["center"] == [120.5, 30.25]


def test_api_reference_under_api_not_ui_docs():
    # /docs is the web UI's documentation page; the API reference must not shadow it
    assert client.get("/api/docs").status_code == 200
    assert client.get("/api/openapi.json").json()["info"]["title"] == "RoadWatch AP API"
    assert "swagger" not in client.get("/docs").text.lower()


def test_unknown_zone_404():
    assert client.get("/api/imagery/zones/Z/seasons").status_code == 404


def test_malformed_season_404():
    # season names become cache file names: only YYYY_(pre|post)_monsoon is accepted
    assert client.get("/api/imagery/zones/A/2024_winter/meta").status_code == 404
    assert client.get("/api/imagery/zones/A/..%2Fx.webp").status_code == 404


def test_runs_and_alerts_flagged_demo():
    r = client.get("/api/runs").json()
    assert "runs" in r and r["quota_per_account_week"] == 30
    d = client.get("/api/alerts").json()
    assert isinstance(d["demo"], bool)
    if not d["demo"]:  # real alerts from `roadwatch detect` (local data); CI has none -> demo set
        assert d["alerts"] and d["model_id"] and all(a["demo"] is False for a in d["alerts"])


def test_alerts_cached_gzip_etag_and_summary():
    r = client.get("/api/alerts")
    assert r.headers["content-encoding"] == "gzip" and r.headers["etag"]
    assert client.get("/api/alerts", headers={"If-None-Match": r.headers["etag"]}).status_code == 304
    plain = client.get("/api/alerts", headers={"Accept-Encoding": "identity"})
    assert "content-encoding" not in plain.headers and plain.json() == r.json()
    s = client.get("/api/alerts/summary").json()
    assert s["n_alerts"] == len(r.json()["alerts"]) and s["dates"] == r.json()["dates"]
    assert "alerts" not in s


@pytest.mark.skipif(not list(Path(__file__).parents[1].glob("data_cache/runs/*/s2/*/*.tif")),
                    reason="no local composites")
def test_zone_imagery_when_data_present():
    seasons = client.get("/api/imagery/zones/A/seasons").json()["seasons"]
    assert seasons
    s = seasons[-1]["id"]
    meta = client.get(f"/api/imagery/zones/A/{s}/meta").json()
    assert len(meta["corners_lonlat"]) == 4
    img = client.get(f"/api/imagery/zones/A/{s}.webp")
    assert img.status_code == 200 and img.headers["content-type"] == "image/webp"


def test_alert_evidence_unknown_or_malformed_404():
    assert client.get("/api/alerts/NOPE-404/evidence").status_code == 404
    assert client.get("/api/alerts/bad%20id!/evidence").status_code == 404
    assert client.get("/api/alerts/NOPE-404/evidence/2024_pre_monsoon.webp").status_code == 404


@pytest.mark.skipif(not list(Path(__file__).parents[1].glob("data_cache/runs/*/s2/*/*.tif")),
                    reason="no local composites")
def test_alert_evidence_chips_when_data_present():
    a = client.get("/api/alerts").json()["alerts"][0]
    ev = client.get(f"/api/alerts/{a['id']}/evidence").json()
    assert ev["chips"] and ev["m_per_px"] == 10
    c = ev["chips"][-1]
    assert c["size_px"] >= 64 and c["path"].startswith("M")
    # the road is drawn inside its chip
    nums = [float(v) for v in c["path"].replace("M", " ").replace("L", " ").replace(",", " ").split()]
    assert all(0 <= v <= c["size_px"] for v in nums)
    img = client.get(c["image"])
    assert img.status_code == 200 and img.headers["content-type"] == "image/webp"

def test_reviews_are_stored_applied_and_exported(tmp_path, monkeypatch):
    import roadwatch.api.app as api

    monkeypatch.setattr(api, "_reviews_path", lambda: tmp_path / "reviews.jsonl")
    first = client.get("/api/alerts").json()["alerts"][0]["id"]
    assert client.get("/api/reviews").json() == {"mode": "server", "statuses": {}, "log": {}}
    r = client.post("/api/reviews", json={"ids": [first], "status": "rejected", "reason": "Field boundary"})
    assert r.status_code == 200 and r.json()["statuses"][first]["status"] == "rejected"
    assert r.json()["log"][first][-1]["note"] == "Field boundary"
    alert = next(a for a in client.get("/api/alerts").json()["alerts"] if a["id"] == first)
    assert alert["status"] == "rejected"
    labels = client.get("/api/reviews/labels.geojson").json()["features"]
    assert [f["properties"]["label"] for f in labels] == ["rejected"]
    # reopening keeps the history but drops it from the labels
    client.post("/api/reviews", json={"ids": [first], "status": "pending"})
    assert len(client.get("/api/reviews").json()["log"][first]) == 2
    assert client.get("/api/reviews/labels.geojson").json()["features"] == []


def test_reviews_validation_and_read_only(tmp_path, monkeypatch):
    import roadwatch.api.app as api

    monkeypatch.setattr(api, "_reviews_path", lambda: tmp_path / "reviews.jsonl")
    first = client.get("/api/alerts").json()["alerts"][0]["id"]
    assert client.post("/api/reviews", json={"ids": ["NOPE"], "status": "accepted"}).status_code == 404
    assert client.post("/api/reviews", json={"ids": [first], "status": "maybe"}).status_code == 422
    assert client.post("/api/reviews", json={"ids": [], "status": "accepted"}).status_code == 422
    monkeypatch.setattr(api, "REVIEWS_MODE", "browser")
    assert client.post("/api/reviews", json={"ids": [first], "status": "accepted"}).status_code == 403
    assert not (tmp_path / "reviews.jsonl").exists()

def test_statewide_alert_evidence_from_stored_chips(tmp_path, monkeypatch):
    import roadwatch.api.app as api

    line = {"type": "LineString", "coordinates": [[80.6, 16.5], [80.61, 16.5]]}
    a = {"id": "RW-44017071-02", "geometry": line,
         "first_seen": "2023_pre_monsoon", "persistence": ["absent", "seen"], "score": 0.8,
         "status": "pending",
         "evidence": [{"season": "2023_pre_monsoon", "state": "seen", "size_px": 64, "path": "M1,1L60,60"}]}
    monkeypatch.setattr(api, "_alerts_payload", lambda: {"demo": False, "dates": [], "alerts": [a]})
    monkeypatch.setattr(api, "DATA_CACHE", tmp_path)
    monkeypatch.setattr(api, "_reviews_path", lambda: tmp_path / "reviews.jsonl")
    assert "evidence" not in client.get("/api/alerts").json()["alerts"][0]  # list stays slim
    ev = client.get(f"/api/alerts/{a['id']}/evidence").json()
    assert ev["chips"][0]["image"] == f"/api/alerts/{a['id']}/evidence/2023_pre_monsoon.webp"
    assert client.get(ev["chips"][0]["image"]).status_code == 404  # chip file not there yet
    f = tmp_path / "outputs" / "statewide" / "evidence" / a["id"] / "2023_pre_monsoon.webp"
    f.parent.mkdir(parents=True)
    f.write_bytes(b"RIFF0000WEBP")
    r = client.get(ev["chips"][0]["image"])
    assert r.status_code == 200 and r.headers["content-type"] == "image/webp"