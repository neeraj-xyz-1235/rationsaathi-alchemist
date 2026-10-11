import copy
import uuid

import pytest
from fastapi.testclient import TestClient

from app.db.models import DistributionRecord, EntitlementRule, Report
from app.db.session import SessionLocal
from app.main import app

PW = "correct-horse-battery"


def new_user(email):
    c = TestClient(app, raise_server_exceptions=False)
    c.__enter__()
    assert c.post("/api/auth/signup", json={"email": email, "password": PW}).status_code == 201
    return c


@pytest.fixture
def alice():
    c = new_user("alice@example.com")
    yield c
    c.__exit__(None, None, None)


@pytest.fixture
def bob():
    c = new_user("bob@example.com")
    yield c
    c.__exit__(None, None, None)


@pytest.fixture
def anon():
    with TestClient(app, raise_server_exceptions=False) as c:
        yield c


def save(client, case):
    r = client.post("/api/cases", json=case)
    assert r.status_code == 201, r.text
    return r.json()["id"]


def test_login_required(anon, demo):
    for method, url in [("get", "/api/cases"), ("post", "/api/cases"),
                        ("get", f"/api/cases/{uuid.uuid4()}"),
                        ("put", f"/api/cases/{uuid.uuid4()}"),
                        ("delete", f"/api/cases/{uuid.uuid4()}"),
                        ("post", f"/api/cases/{uuid.uuid4()}/reports")]:
        r = getattr(anon, method)(url, **({"json": demo} if method in ("post", "put") else {}))
        assert r.status_code == 401, (method, url)
        assert r.json() == {"error": {"code": "UNAUTHENTICATED"}}


def test_save_and_load_round_trips(alice, demo):
    cid = save(alice, demo)
    got = alice.get(f"/api/cases/{cid}").json()
    assert got == demo


def test_round_trip_normalises_trailing_zeros_and_units(alice, demo):
    demo["rules"][0]["quantity"] = {"value": "5.000", "unit": "kg"}
    demo["records"][0]["quantity"] = {"value": "500", "unit": "g"}
    got = alice.get(f"/api/cases/{save(alice, demo)}").json()
    assert got["rules"][0]["quantity"] == {"value": "5", "unit": "kg"}
    assert got["records"][0]["quantity"] == {"value": "500", "unit": "g"}


def test_pending_record_without_quantity_and_unknown_date(alice, demo):
    demo["records"].append({"id": "p1", "rule_id": "r-rice", "item": "Rice", "quantity": None,
                            "date": None, "status": "pending", "entry_method": "manual",
                            "evidence": {"receipt_ref": None, "note": None, "no_receipt": False,
                                         "receipt_text": "Rice ?? kg"}})
    demo["records"].append({"id": "u1", "rule_id": None, "item": "Sugar",
                            "quantity": {"value": "1", "unit": "kg"}, "date": "2026-09-12",
                            "status": "confirmed", "entry_method": "manual",
                            "evidence": {"receipt_ref": None, "note": None, "no_receipt": False,
                                         "receipt_text": None}})
    got = alice.get(f"/api/cases/{save(alice, demo)}").json()
    assert got == demo
    assert got["records"][3]["evidence"]["receipt_text"] == "Rice ?? kg"   # verbatim


def test_order_is_preserved(alice, demo):
    demo["records"].reverse()
    got = alice.get(f"/api/cases/{save(alice, demo)}").json()
    assert [r["id"] for r in got["records"]] == ["d3", "d2", "d1"]


def test_list_shows_only_mine(alice, bob, demo):
    mine = save(alice, demo)
    save(bob, demo)
    listing = alice.get("/api/cases").json()
    assert [c["id"] for c in listing] == [mine]
    assert listing[0]["period"] == demo["period"]
    assert set(listing[0]) == {"id", "household_ref", "period", "updated_at"}


def test_other_users_case_is_404_for_get_put_delete_and_report(alice, bob, demo):
    cid = save(alice, demo)
    expected = {"error": {"code": "NOT_FOUND"}}
    r = bob.get(f"/api/cases/{cid}")
    assert r.status_code == 404 and r.json() == expected
    assert bob.put(f"/api/cases/{cid}", json=demo).status_code == 404
    assert bob.delete(f"/api/cases/{cid}").status_code == 404
    assert bob.post(f"/api/cases/{cid}/reports").status_code == 404
    # identical to a case that never existed
    ghost = bob.get(f"/api/cases/{uuid.uuid4()}")
    assert ghost.status_code == 404 and ghost.json() == expected
    # and alice's data is untouched
    assert alice.get(f"/api/cases/{cid}").json() == demo


def test_bad_id_is_404(alice):
    assert alice.get("/api/cases/not-a-uuid").status_code == 404


def test_owner_comes_from_session_not_body(alice, bob, demo):
    demo["user_id"] = "someone-else"
    assert alice.post("/api/cases", json=demo).status_code == 422


def test_put_replaces_everything(alice, demo):
    cid = save(alice, demo)
    new = copy.deepcopy(demo)
    new["members"] = 2
    new["household_ref"] = "Home"
    new["rules"] = [new["rules"][0]]
    new["records"] = [new["records"][0]]
    r = alice.put(f"/api/cases/{cid}", json=new)
    assert r.status_code == 200 and r.json() == new
    assert alice.get(f"/api/cases/{cid}").json() == new
    with SessionLocal() as db:           # no stale rows left behind
        assert db.query(EntitlementRule).count() == 1
        assert db.query(DistributionRecord).count() == 1


def test_put_invalid_keeps_old_data(alice, demo):
    cid = save(alice, demo)
    bad = copy.deepcopy(demo)
    bad["rules"][0]["quantity"]["value"] = "1.2345"
    assert alice.put(f"/api/cases/{cid}", json=bad).status_code == 422
    assert alice.get(f"/api/cases/{cid}").json() == demo


def test_save_validates_like_calculate(alice, demo):
    demo["records"][0]["rule_id"] = "missing"
    r = alice.post("/api/cases", json=demo)
    assert r.status_code == 422
    assert r.json()["error"]["code"] == "VALIDATION_FAILED"


def test_delete_cascades_to_reports(alice, demo):
    cid = save(alice, demo)
    rid = alice.post(f"/api/cases/{cid}/reports").json()["report_id"]
    assert alice.delete(f"/api/cases/{cid}").status_code == 204
    assert alice.get(f"/api/cases/{cid}").status_code == 404
    assert alice.get(f"/api/reports/{rid}").status_code == 404
    with SessionLocal() as db:
        assert db.query(EntitlementRule).count() == 0
        assert db.query(DistributionRecord).count() == 0
        assert db.query(Report).count() == 0


def test_report_matches_calculate(alice, anon, demo):
    cid = save(alice, demo)
    r = alice.post(f"/api/cases/{cid}/reports")
    assert r.status_code == 201
    body = r.json()
    assert body["case"] == demo
    live = anon.post("/api/calculate", json=demo).json()
    for key in ("items", "unmatched", "evidence_summary", "period", "members"):
        assert body["result"][key] == live[key]
    assert body["result"]["items"][0]["difference"] == {"value": "6", "direction": "below"}


def test_report_is_public_and_frozen(alice, anon, demo):
    cid = save(alice, demo)
    rid = alice.post(f"/api/cases/{cid}/reports").json()["report_id"]

    edited = copy.deepcopy(demo)
    edited["records"] = []                       # edit the case afterwards
    assert alice.put(f"/api/cases/{cid}", json=edited).status_code == 200

    r = anon.get(f"/api/reports/{rid}")          # no login needed
    assert r.status_code == 200
    body = r.json()
    assert body["report_id"] == rid
    assert body["case"] == demo                  # still the original records
    assert body["result"]["items"][0]["received"]["value"] == "14"
    assert body["generated_at"].endswith("Z")
    assert "user_id" not in r.text and "email" not in r.text


def test_unknown_report_404(anon):
    assert anon.get(f"/api/reports/{uuid.uuid4()}").status_code == 404
    assert anon.get("/api/reports/nope").status_code == 404


def test_each_report_is_its_own_snapshot(alice, demo):
    cid = save(alice, demo)
    a = alice.post(f"/api/cases/{cid}/reports").json()["report_id"]
    b = alice.post(f"/api/cases/{cid}/reports").json()["report_id"]
    assert a != b
