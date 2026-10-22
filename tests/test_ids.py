"""Stable alert ids: a re-run keeps ids of the same roads, new roads get new numbers."""

from roadwatch.change.ids import stable_ids


def alert(aid, coords, zone="A"):
    return {"id": aid, "zone": zone, "geometry": {"type": "LineString", "coordinates": coords}}


def prefix(a):
    return f"RW-{a['zone']}"


ROAD1 = [[80.60, 16.50], [80.61, 16.50]]
ROAD2 = [[80.60, 16.55], [80.60, 16.56]]
ROAD3 = [[80.65, 16.52], [80.66, 16.53]]


def test_same_roads_keep_ids_even_if_scores_reorder_them():
    prev = [alert("RW-A001", ROAD1), alert("RW-A002", ROAD2)]
    new = [alert("RW-A001", ROAD2), alert("RW-A002", ROAD1)]   # detect renumbered by a new score order
    out = stable_ids(new, prev, prefix)
    assert [a["id"] for a in out] == ["RW-A002", "RW-A001"]


def test_new_road_gets_next_number_and_dropped_ids_are_not_reused():
    prev = [alert("RW-A001", ROAD1), alert("RW-A002", ROAD2)]
    new = [alert("x", ROAD1), alert("y", ROAD3)]               # ROAD2 no longer alerted
    out = stable_ids(new, prev, prefix)
    assert [a["id"] for a in out] == ["RW-A001", "RW-A003"]


def test_slightly_moved_line_still_matches_and_zones_are_separate():
    prev = [alert("RW-A001", ROAD1)]
    moved = [[80.60, 16.50005], [80.6101, 16.50005]]           # ~5 m north, a bit longer
    out = stable_ids([alert("x", moved), alert("y", ROAD1, zone="B")], prev, prefix)
    assert [a["id"] for a in out] == ["RW-A001", "RW-B001"]


def test_first_run_numbers_from_one():
    out = stable_ids([alert("x", ROAD1), alert("y", ROAD2)], [], prefix)
    assert [a["id"] for a in out] == ["RW-A001", "RW-A002"]
