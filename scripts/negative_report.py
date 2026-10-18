"""Run the negative tests NT-1..NT-5 and write reports/negative_tests.md (charter evidence table).

    uv run python scripts/negative_report.py

Every row comes from the test run itself (tests/negative, evidence captured by its conftest).
"""

from __future__ import annotations

import json
import os
import subprocess
import sys
from datetime import UTC, datetime
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
EVID = ROOT / "reports" / "negative" / "evidence.json"

NT = {
    "NT-1": ("Occlusion (trees / shadows)",
             "Road partly hidden in one image; existing road hidden on some dates; new road hidden on one date.",
             "Extraction keeps the road; an occluded existing road never becomes a 'new road'; a real new "
             "road survives one hidden date.",
             "Re-run extraction on the next clear season; persistence over dates absorbs single-date occlusion.",
             "A new road hidden on most dates (dense canopy) is missed - recall loss, not a false alert."),
    "NT-2": ("Seasonal appearance (mud tracks, crop boundaries)",
             "A line that appears and disappears with the seasons.",
             "No alert unless seen on >= 3 later dates and staying (stability >= 0.75).",
             "Human review rejects the alert; the rejection is stored as a training label (ADR-022).",
             "With 4 later dates, a track seen 3 times is indistinguishable from an occluded road and alerts; "
             "more dates per year (Enhancement Pack C) narrow this."),
    "NT-3": ("Change versus noise",
             "Isolated noisy pixels; a road-like line on one date only.",
             "Specks are removed before graph extraction; single-date lines never alert (persistence).",
             "Nothing to recover: the noise never enters the alert list.",
             "Larger coherent noise blobs (e.g. a ploughed strip) can still pass extraction; persistence then "
             "decides."),
    "NT-4": ("CRS / registration / temporal mismatch",
             "Seasons in different UTM zones; degrees instead of metres; dates out of order; image shifted by "
             "pixels; tile off the grid.",
             "Change detection refuses mismatched or unordered inputs (error, no alerts); quality gates fail "
             "shifted or off-grid tiles -> marked unreliable.",
             "Reproject / re-sort / rebuild the tile on the grid (s2-build is idempotent per tile), then re-run.",
             "The registration gate is tested and measured (KPI-6) but not yet enforced per tile inside "
             "s2-build - planned."),
    "NT-5": ("Cloud / terrain / season / sensor / geography shift",
             "Cloudy composite; new road under cloud on some later dates.",
             "Cloudy tiles are reserved (abstain); cloudy dates count as 'abstain', never 'absent'; too few "
             "clear sightings -> no alert; alerts carry quality < 1.",
             "Next clear season fills the gap; Sentinel-1 radar for monsoon dates (CP2).",
             "Model shift to unseen geography (e.g. Rayalaseema dry land) is not covered by a unit test; "
             "measured instead by the per-region KPI-1 table and the statewide v2 model."),
}


def main() -> int:
    env = {**os.environ, "RW_NT_EVIDENCE": str(EVID)}
    r = subprocess.run([sys.executable, "-m", "pytest", "tests/negative", "-q", "-p", "no:warnings"],
                       cwd=ROOT, env=env, capture_output=True, text=True)
    recs = json.loads(EVID.read_text(encoding="utf-8")) if EVID.exists() else []
    passed = sum(x.get("outcome") == "passed" for x in recs)
    out = [
        "# Negative tests NT-1 to NT-5 (charter CLIMATE-06, PROJECT_PROMPT 8.1)", "",
        f"_Generated {datetime.now(UTC).isoformat(timespec='seconds')} by `scripts/negative_report.py` "
        f"from `tests/negative/`. Result: **{passed}/{len(recs)} passed** (pytest exit {r.returncode})._", "",
        "Each test builds a controlled fixture that triggers the failure and checks the safe response "
        "(abstain, refuse, or no alert) instead of a silent wrong result.", "",
    ]
    for nt, (name, trigger, expected, recovery, residual) in NT.items():
        out += [f"## {nt} — {name}", "", f"- **Trigger:** {trigger}", f"- **Expected safe behaviour:** {expected}",
                f"- **Recovery:** {recovery}", f"- **Residual risk:** {residual}", "",
                "| Test | Case | Expected | Observed | Result | Time |", "|---|---|---|---|---|---|"]
        for x in (x for x in recs if x.get("nt") == nt):
            out.append(f"| `{x['test']}` | {x['case']} | {x['expected']} | {x['observed']} | "
                       f"{'✅ pass' if x.get('outcome') == 'passed' else '❌ ' + str(x.get('outcome'))} | "
                       f"{x.get('seconds', 0):.2f} s |")
        out.append("")
    path = ROOT / "reports" / "negative_tests.md"
    path.write_text("\n".join(out), encoding="utf-8")
    print(f"wrote {path.relative_to(ROOT)}: {passed}/{len(recs)} passed")
    return r.returncode


if __name__ == "__main__":
    raise SystemExit(main())
