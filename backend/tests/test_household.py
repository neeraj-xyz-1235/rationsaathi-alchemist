import pytest
from fastapi.testclient import TestClient

from app.main import app

PW = "correct-horse-battery"


def profile(**over):
    p = {"head_name": "Sita Devi", "head_age": 42, "head_gender": "female",
         "state": "Maharashtra", "district": "Pune", "locality": "", "card_type": "PHH",
         "card_colour": "orange", "card_number_last4": "", "household_member_count": 3,
         "members": [
             {"name": "Sita Devi", "age": 42, "gender": "female", "relationship": "head"},
             {"name": "Ram", "age": 45, "gender": "male", "relationship": "member"},
             {"name": "Gita", "age": 12, "gender": "female", "relationship": "member"}]}
    p.update(over)
    return p


@pytest.fixture
def user():
    with TestClient(app, raise_server_exceptions=False) as c:
        assert c.post("/api/auth/signup", json={"email": "h@example.com", "password": PW}
                      ).status_code == 201
        yield c


def test_requires_login():
    with TestClient(app, raise_server_exceptions=False) as c:
        assert c.get("/api/household/profile").status_code == 401
        assert c.put("/api/household/profile", json=profile()).status_code == 401


def test_no_profile_is_404(user):
    assert user.get("/api/household/profile").status_code == 404


def test_put_then_get(user):
    r = user.put("/api/household/profile", json=profile())
    assert r.status_code == 200
    p = r.json()["profile"]
    assert p["is_complete"] is True
    assert p["proof_status"] == "not_submitted"
    assert p["household_member_count"] == 3
    assert p["locality"] is None and p["card_number_last4"] is None   # blanks become null
    assert user.get("/api/household/profile").json() == r.json()


def test_post_works_too_and_replaces(user):
    assert user.post("/api/household/profile", json=profile()).status_code == 200
    r = user.put("/api/household/profile", json=profile(district="Nashik"))
    assert r.json()["profile"]["district"] == "Nashik"


def test_head_alone_is_household_of_one(user):
    p = user.put("/api/household/profile", json=profile(members=[], household_member_count=1)
                 ).json()["profile"]
    assert p["household_member_count"] == 1
    assert p["members"][0]["relationship"] == "head"


def test_changing_card_details_resets_proof(user):
    from app.db import models as m
    from app.db.session import SessionLocal
    user.put("/api/household/profile", json=profile())
    with SessionLocal() as db:
        h = db.query(m.Household).one()
        h.proof_status, h.proof_result = "verified", {"x": 1}
        db.commit()
    # unrelated change keeps it
    user.put("/api/household/profile", json=profile(district="Nashik"))
    assert user.get("/api/household/profile").json()["profile"]["proof_status"] == "verified"
    # card change clears it
    user.put("/api/household/profile", json=profile(card_type="AAY"))
    p = user.get("/api/household/profile").json()["profile"]
    assert p["proof_status"] == "not_submitted" and p["proof_result"] is None


@pytest.mark.parametrize("bad", [
    {"head_name": "  "}, {"head_age": -1}, {"head_age": 200}, {"state": ""},
    {"card_type": "GOLD"}, {"card_colour": "pink"}, {"card_number_last4": "12ab"},
    {"head_gender": "x"}, {"surprise": 1},
    {"members": [{"name": "", "age": 3, "gender": "male", "relationship": "member"}]},
])
def test_invalid_profile_rejected(user, bad):
    r = user.put("/api/household/profile", json=profile(**bad))
    assert r.status_code == 422
    assert r.json()["error"]["code"] == "VALIDATION_FAILED"


def test_profiles_are_per_user(user):
    user.put("/api/household/profile", json=profile())
    with TestClient(app, raise_server_exceptions=False) as other:
        other.post("/api/auth/signup", json={"email": "o@example.com", "password": PW})
        assert other.get("/api/household/profile").status_code == 404
