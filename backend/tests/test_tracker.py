import copy
import logging
import uuid
from datetime import date

import pytest
from fastapi.testclient import TestClient

from app.engine.tracker import is_whole_month, next_period, shift_month
from app.main import app
from tests.conftest import make_case, make_record, rice_rule

PW = "correct-horse-battery"


def user(email):
    c = TestClient(app, raise_server_exceptions=False)
    c.__enter__()
    assert c.post("/api/auth/signup", json={"email": email, "password": PW}).status_code == 201
    return c


@pytest.fixture
def alice():
    c = user("alice@example.com")
    yield c
    c.__exit__(None, None, None)


@pytest.fixture
def bob():
    c = user("bob@example.com")
    yield c
    c.__exit__(None, None, None)


@pytest.fixture
def anon():
    with TestClient(app, raise_server_exceptions=False) as c:
        yield c


def d(s):
    return date.fromisoformat(s)


def month_case(ref, start, end, received_kg, members=4, rule_kg="5"):
    recs = [make_record("a", "r", received_kg, "kg", start)] if received_kg else []
    case = make_case([rice_rule(rule_kg)], recs, members=members, start=start, end=end)
    case["household_ref"] = ref
    return case


def save(c, case):
    r = c.post("/api/cases", json=case)
    assert r.status_code == 201, r.text
    return r.json()["id"]


# ── date shifting (pure) ─────────────────────────────────

@pytest.mark.parametrize("start,end,want_start,want_end", [
    ("2026-09-01", "2026-09-30", "2026-10-01", "2026-10-31"),
    ("2027-01-01", "2027-01-31", "2027-02-01", "2027-02-28"),     # not leap
    ("2028-01-01", "2028-01-31", "2028-02-01", "2028-02-29"),     # leap
    ("2026-12-01", "2026-12-31", "2027-01-01", "2027-01-31"),     # year roll
    ("2026-09-15", "2026-10-14", "2026-10-15", "2026-11-14"),     # not a whole month
    ("2026-01-31", "2026-02-27", "2026-02-28", "2026-03-27"),     # day numbers clamped
])
def test_next_period(start, end, want_start, want_end):
    assert next_period(d(start), d(end)) == (d(want_start), d(want_end))


def test_shift_month_clamps():
    assert shift_month(d("2026-01-31")) == d("2026-02-28")
    assert shift_month(d("2026-12-15")) == d("2027-01-15")
    assert shift_month(d("2026-03-31")) == d("2026-04-30")


def test_whole_month_detection():
    assert is_whole_month(d("2026-09-01"), d("2026-09-30"))
    assert not is_whole_month(d("2026-09-01"), d("2026-09-29"))
    assert not is_whole_month(d("2026-09-01"), d("2026-10-31"))
    assert not is_whole_month(d("2026-09-02"), d("2026-09-30"))


# ── tracker ──────────────────────────────────────────────

def test_tracker_requires_login(anon):
    assert anon.get("/api/tracker").status_code == 401


def test_tracker_empty(alice):
    assert alice.get("/api/tracker").json() == {"households": []}


def test_grouped_by_household_newest_first_and_equal_to_calculate(alice, anon):
    cases = [
        month_case("Home", "2026-07-01", "2026-07-31", "12"),
        month_case("Home", "2026-09-01", "2026-09-30", "14"),
        month_case("Home", "2026-08-01", "2026-08-31", "20"),
        month_case("Grandparents", "2026-10-01", "2026-10-31", "7", members=2),
    ]
    ids = {c["period"]["start"] + str(c["household_ref"]): save(alice, c) for c in cases}
    body = alice.get("/api/tracker").json()

    refs = [h["household_ref"] for h in body["households"]]
    assert sorted(refs) == ["Grandparents", "Home"]
    assert refs[0] == "Grandparents"                      # its month (Oct) is the newest
    home = next(h for h in body["households"] if h["household_ref"] == "Home")
    assert [m["period"]["start"] for m in home["months"]] == ["2026-09-01", "2026-08-01", "2026-07-01"]

    # numbers equal /api/calculate for each case
    for h in body["households"]:
        for month in h["months"]:
            case = alice.get(f"/api/cases/{month['case_id']}").json()
            live = anon.post("/api/calculate", json=case).json()
            for t, it in zip(month["items"], live["items"]):
                assert t["expected"] == it["expected"]["value"]
                assert t["received"] == it["received"]["value"]
                assert t["remaining"] == it["balance"]["remaining"]
                assert t["over_by"] == it["balance"]["over_by"]
                assert t["percent_used"] == it["balance"]["percent_used"]
    assert ids  # all saved


def test_grandparents_ongoing_month_matches_the_brief(alice):
    # period "ongoing" depends on today's date, so use a period far in the future
    save(alice, month_case("Grandparents", "2099-10-01", "2099-10-31", None, members=2))
    case = month_case("Grandparents", "2099-10-01", "2099-10-31", "7", members=2)
    case["records"][0]["date"] = "2099-10-04"
    alice_cases = alice.get("/api/cases").json()
    cid = alice_cases[0]["id"]
    alice.put(f"/api/cases/{cid}", json=case)
    month = alice.get("/api/tracker").json()["households"][0]["months"][0]
    item = month["items"][0]
    assert month["period"]["status"] == "ongoing"
    assert (item["expected"], item["received"], item["remaining"], item["percent_used"]) == \
        ("10", "7", "3", "70.0")
    assert item["labels"] == ["unclear"]


def test_null_and_empty_household_are_the_same(alice):
    a = month_case(None, "2026-08-01", "2026-08-31", "1")
    b = month_case("", "2026-09-01", "2026-09-30", "1")
    save(alice, a)
    save(alice, b)
    households = alice.get("/api/tracker").json()["households"]
    assert len(households) == 1 and households[0]["household_ref"] is None
    assert len(households[0]["months"]) == 2


def test_months_limit_and_validation(alice):
    for i in range(1, 9):
        save(alice, month_case("Home", f"2026-0{i}-01", f"2026-0{i}-28", "1"))
    assert len(alice.get("/api/tracker").json()["households"][0]["months"]) == 6      # default
    assert len(alice.get("/api/tracker?months=2").json()["households"][0]["months"]) == 2
    assert len(alice.get("/api/tracker?months=24").json()["households"][0]["months"]) == 8
    assert alice.get("/api/tracker?months=0").status_code == 422
    assert alice.get("/api/tracker?months=25").status_code == 422


def test_case_without_rules_has_no_items(alice):
    save(alice, make_case([], [], start="2026-09-01", end="2026-09-30"))
    month = alice.get("/api/tracker").json()["households"][0]["months"][0]
    assert month["items"] == []


def test_tracker_shows_only_my_cases(alice, bob):
    save(alice, month_case("Home", "2026-09-01", "2026-09-30", "1"))
    save(bob, month_case("Bobs", "2026-09-01", "2026-09-30", "1"))
    refs = [h["household_ref"] for h in alice.get("/api/tracker").json()["households"]]
    assert refs == ["Home"]


# ── next month ───────────────────────────────────────────

def test_next_month_copies_rules_not_records(alice, demo):
    demo["household_ref"] = "Home"
    demo["rules"][0]["due_by"] = "2026-09-10"
    cid = save(alice, demo)
    r = alice.post(f"/api/cases/{cid}/next-month")
    assert r.status_code == 201
    new = alice.get(f"/api/cases/{r.json()['id']}").json()
    assert new["period"] == {"start": "2026-10-01", "end": "2026-10-31"}
    assert new["members"] == 4 and new["household_ref"] == "Home"
    assert new["records"] == []
    assert [x["id"] for x in new["rules"]] == ["r-rice", "r-wheat"]
    assert new["rules"][0]["quantity"] == demo["rules"][0]["quantity"]
    assert new["rules"][0]["due_by"] == "2026-10-10"                  # shifted with the month
    assert new["rules"][1]["due_by"] is None
    assert alice.get(f"/api/cases/{cid}").json() == demo              # original untouched


def test_next_month_has_no_carry_over(alice, demo):
    """Unused ration is never added to the next month: expected is the plain rule."""
    cid = save(alice, demo)                                           # rice 14 of 20 used
    new_id = alice.post(f"/api/cases/{cid}/next-month").json()["id"]
    report = alice.post(f"/api/cases/{new_id}/reports").json()["result"]
    assert report["items"][0]["expected"]["value"] == "20"
    assert report["items"][0]["received"]["value"] == "0"


def test_next_month_conflict_409(alice, demo):
    cid = save(alice, demo)
    assert alice.post(f"/api/cases/{cid}/next-month").status_code == 201
    r = alice.post(f"/api/cases/{cid}/next-month")
    assert r.status_code == 409
    assert r.json() == {"error": {"code": "CASE_EXISTS_FOR_PERIOD"}}


def test_next_month_conflict_only_for_same_household(alice, demo):
    other = copy.deepcopy(demo)
    other["household_ref"] = "Elsewhere"
    other["period"] = {"start": "2026-10-01", "end": "2026-10-31"}
    save(alice, other)
    cid = save(alice, demo)                                           # household_ref null
    assert alice.post(f"/api/cases/{cid}/next-month").status_code == 201


def test_next_month_chain(alice, demo):
    cid = save(alice, demo)
    a = alice.post(f"/api/cases/{cid}/next-month").json()["id"]
    b = alice.post(f"/api/cases/{a}/next-month").json()["id"]
    assert alice.get(f"/api/cases/{b}").json()["period"] == {"start": "2026-11-01", "end": "2026-11-30"}


def test_next_month_other_users_case_404(alice, bob, demo):
    cid = save(alice, demo)
    assert bob.post(f"/api/cases/{cid}/next-month").status_code == 404
    assert bob.post(f"/api/cases/{uuid.uuid4()}/next-month").status_code == 404
    assert len(bob.get("/api/cases").json()) == 0


def test_next_month_requires_login(anon):
    assert anon.post(f"/api/cases/{uuid.uuid4()}/next-month").status_code == 401


def test_next_month_year_out_of_range(alice):
    case = make_case([rice_rule()], [], start="9999-12-01", end="9999-12-31")
    cid = save(alice, case)
    r = alice.post(f"/api/cases/{cid}/next-month")
    assert r.status_code == 422 and r.json()["error"]["code"] == "VALIDATION_FAILED"


# ── shops ────────────────────────────────────────────────

def test_shops_empty_is_honest(anon):
    r = anon.get("/api/shops/nearby?lat=19.07&lon=72.87&radius_km=5")
    assert r.status_code == 200
    assert r.json() == {"status": "empty", "shops": [], "message_code": "SHOPS_NONE_MAPPED"}


def test_shops_default_radius(anon):
    assert anon.get("/api/shops/nearby?lat=0&lon=0").status_code == 200


@pytest.mark.parametrize("qs", [
    "lat=91&lon=0", "lat=-91&lon=0", "lat=0&lon=181", "lat=0&lon=-181",
    "lat=0&lon=0&radius_km=0.5", "lat=0&lon=0&radius_km=26", "lat=abc&lon=0", "lon=0", "lat=0",
])
def test_shops_validation(anon, qs):
    r = anon.get(f"/api/shops/nearby?{qs}")
    assert r.status_code == 422 and r.json()["error"]["code"] == "VALIDATION_FAILED"


def test_shops_boundaries_ok(anon):
    for qs in ("lat=90&lon=180&radius_km=25", "lat=-90&lon=-180&radius_km=1"):
        assert anon.get(f"/api/shops/nearby?{qs}").status_code == 200


def test_shop_coordinates_are_redacted_from_access_logs():
    from app.main import _RedactShopCoords
    rec = logging.LogRecord("uvicorn.access", logging.INFO, "", 0,
                            '%s - "%s %s HTTP/%s" %d',
                            ("1.2.3.4:5", "GET", "/api/shops/nearby?lat=19.07&lon=72.87", "1.1", 200), None)
    _RedactShopCoords().filter(rec)
    assert "19.07" not in rec.getMessage() and "72.87" not in rec.getMessage()
    other = logging.LogRecord("uvicorn.access", logging.INFO, "", 0, '%s - "%s %s HTTP/%s" %d',
                              ("1.2.3.4:5", "GET", "/api/health?x=1", "1.1", 200), None)
    _RedactShopCoords().filter(other)
    assert "x=1" in other.getMessage()
