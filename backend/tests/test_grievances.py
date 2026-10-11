import uuid

import pytest
from fastapi.testclient import TestClient

from app.db.models import GrievanceNote
from app.db.session import SessionLocal
from app.main import app

PW = "correct-horse-battery"

NOTE = {"portal_key": "cpgrams", "reference_no": "ABC123", "filed_on": "2026-10-03",
        "status": "filed", "note": "Raised after the September check."}


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


@pytest.fixture
def case_id(alice, demo):
    return alice.post("/api/cases", json=demo).json()["id"]


def url(cid, gid=""):
    return f"/api/cases/{cid}/grievances" + (f"/{gid}" if gid else "")


def test_login_required(anon):
    cid = str(uuid.uuid4())
    assert anon.get(url(cid)).status_code == 401
    assert anon.post(url(cid), json=NOTE).status_code == 401
    assert anon.put(url(cid, uuid.uuid4()), json=NOTE).status_code == 401
    assert anon.delete(url(cid, uuid.uuid4())).status_code == 401


def test_empty_list(alice, case_id):
    assert alice.get(url(case_id)).json() == []


def test_create_list_update_delete(alice, case_id):
    r = alice.post(url(case_id), json=NOTE)
    assert r.status_code == 201
    gid = r.json()["id"]

    listing = alice.get(url(case_id)).json()
    assert len(listing) == 1
    n = listing[0]
    assert {k: n[k] for k in NOTE} == NOTE
    assert n["id"] == gid and n["created_at"].endswith("Z") and n["updated_at"].endswith("Z")

    changed = {**NOTE, "status": "resolved", "note": "Reply received."}
    r = alice.put(url(case_id, gid), json=changed)
    assert r.status_code == 200
    assert {k: r.json()[k] for k in NOTE} == changed
    assert alice.get(url(case_id)).json()[0]["status"] == "resolved"

    assert alice.delete(url(case_id, gid)).status_code == 204
    assert alice.get(url(case_id)).json() == []
    assert alice.delete(url(case_id, gid)).status_code == 404


def test_optional_fields_can_be_null(alice, case_id):
    minimal = {"portal_key": "state-portal", "reference_no": None, "filed_on": None,
               "status": "prepared", "note": None}
    gid = alice.post(url(case_id), json=minimal).json()["id"]
    n = alice.get(url(case_id)).json()[0]
    assert n["id"] == gid and n["reference_no"] is None and n["filed_on"] is None and n["note"] is None


def test_list_is_in_the_order_written(alice, case_id):
    ids = [alice.post(url(case_id), json={**NOTE, "reference_no": f"R{i}"}).json()["id"]
           for i in range(3)]
    assert [n["id"] for n in alice.get(url(case_id)).json()] == ids


def test_put_replaces_all_fields(alice, case_id):
    gid = alice.post(url(case_id), json=NOTE).json()["id"]
    cleared = {"portal_key": "cpgrams", "reference_no": None, "filed_on": None,
               "status": "closed", "note": None}
    alice.put(url(case_id, gid), json=cleared)
    n = alice.get(url(case_id)).json()[0]
    assert n["reference_no"] is None and n["note"] is None and n["status"] == "closed"


# ── ownership ────────────────────────────────────────────

def test_other_users_case_is_404_everywhere(alice, bob, case_id):
    gid = alice.post(url(case_id), json=NOTE).json()["id"]
    expected = {"error": {"code": "NOT_FOUND"}}
    r = bob.get(url(case_id))
    assert r.status_code == 404 and r.json() == expected
    assert bob.post(url(case_id), json=NOTE).status_code == 404
    assert bob.put(url(case_id, gid), json=NOTE).status_code == 404
    assert bob.delete(url(case_id, gid)).status_code == 404
    assert bob.get(url(uuid.uuid4())).status_code == 404          # same as "never existed"
    assert bob.get(url("not-a-uuid")).status_code == 404
    with SessionLocal() as db:                                   # nothing was written or removed
        assert db.query(GrievanceNote).count() == 1


def test_note_of_another_case_is_404(alice, demo, case_id):
    other_case = alice.post("/api/cases", json=demo).json()["id"]
    gid = alice.post(url(case_id), json=NOTE).json()["id"]
    assert alice.put(url(other_case, gid), json=NOTE).status_code == 404
    assert alice.delete(url(other_case, gid)).status_code == 404
    assert alice.get(url(other_case)).json() == []


def test_unknown_or_malformed_note_id_is_404(alice, case_id):
    assert alice.put(url(case_id, uuid.uuid4()), json=NOTE).status_code == 404
    assert alice.delete(url(case_id, "nope")).status_code == 404


def test_deleting_the_case_deletes_its_notes(alice, case_id):
    alice.post(url(case_id), json=NOTE)
    assert alice.delete(f"/api/cases/{case_id}").status_code == 204
    with SessionLocal() as db:
        assert db.query(GrievanceNote).count() == 0


# ── validation ───────────────────────────────────────────

@pytest.mark.parametrize("patch", [
    {"portal_key": "CPGRAMS"}, {"portal_key": "has space"}, {"portal_key": ""},
    {"portal_key": "a" * 41}, {"portal_key": "../etc"}, {"portal_key": "x\n"},
    {"status": "pending"}, {"status": "FILED"},
    {"reference_no": "r" * 61}, {"note": "n" * 501},
    {"filed_on": "03-10-2026"}, {"filed_on": "not a date"},
    {"unknown_field": 1}, {"id": "forced-id"},
])
def test_validation_failures(alice, case_id, patch):
    r = alice.post(url(case_id), json={**NOTE, **patch})
    assert r.status_code == 422
    assert r.json()["error"]["code"] == "VALIDATION_FAILED"


def test_missing_required_fields(alice, case_id):
    assert alice.post(url(case_id), json={"status": "filed"}).status_code == 422
    assert alice.post(url(case_id), json={"portal_key": "cpgrams"}).status_code == 422


def test_boundary_lengths_are_accepted(alice, case_id):
    ok = {**NOTE, "portal_key": "a" * 40, "reference_no": "r" * 60, "note": "n" * 500}
    assert alice.post(url(case_id), json=ok).status_code == 201


def test_invalid_put_changes_nothing(alice, case_id):
    gid = alice.post(url(case_id), json=NOTE).json()["id"]
    assert alice.put(url(case_id, gid), json={**NOTE, "status": "bad"}).status_code == 422
    assert alice.get(url(case_id)).json()[0]["status"] == "filed"


def test_notes_are_stored_as_typed_and_not_in_reports(alice, case_id):
    text = "<b>raised</b> ’ नोट"
    alice.post(url(case_id), json={**NOTE, "note": text})
    assert alice.get(url(case_id)).json()[0]["note"] == text
    report = alice.post(f"/api/cases/{case_id}/reports").json()
    assert "grievance" not in str(report).lower() and "Raised" not in str(report)
