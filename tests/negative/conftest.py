"""Evidence capture for the mandatory negative tests (PROJECT_PROMPT 8.1, charter NT-1..NT-5).

Each test fills the `evidence` dict (nt, case, expected, observed); with RW_NT_EVIDENCE=<path> set,
the session writes every record (plus outcome and duration) to that JSON file for
scripts/negative_report.py.
"""

from __future__ import annotations

import json
import os
import time
from pathlib import Path

import pytest

_RECORDS: list[dict] = []
_OUTCOME = pytest.StashKey[str]()


@pytest.hookimpl(hookwrapper=True)
def pytest_runtest_makereport(item, call):
    outcome = yield
    rep = outcome.get_result()
    if rep.when == "call":
        item.stash[_OUTCOME] = rep.outcome


@pytest.fixture
def evidence(request):
    rec: dict = {"test": request.node.name}
    t0 = time.perf_counter()
    yield rec
    rec["seconds"] = round(time.perf_counter() - t0, 4)
    rec["outcome"] = request.node.stash.get(_OUTCOME, "error")
    _RECORDS.append(rec)


def pytest_sessionfinish(session, exitstatus):
    out = os.environ.get("RW_NT_EVIDENCE")
    if out and _RECORDS:
        Path(out).parent.mkdir(parents=True, exist_ok=True)
        Path(out).write_text(json.dumps(_RECORDS, indent=1), encoding="utf-8")
