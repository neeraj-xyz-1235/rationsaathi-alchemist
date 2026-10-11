import pytest
from fastapi.testclient import TestClient

from app.entitlements.rules import compute
from app.main import app
from tests.test_household import PW, profile


def qty(alloc, item):
    return next(i["allocated_quantity"] for i in alloc["items"] if i["item"] == item)


# ── rules ────────────────────────────────────────────────

def test_phh_is_per_member():
    a = compute("PHH", 4)
    assert (qty(a, "Rice"), qty(a, "Wheat")) == ("12", "8")        # 5 kg per person in total
    assert a["basis"] == "per_member" and a["assumed"] is False


def test_aay_is_per_household_whatever_the_size():
    for n in (1, 7):
        a = compute("AAY", n)
        assert (qty(a, "Rice"), qty(a, "Wheat")) == ("20", "15")   # 35 kg per household


def test_unknown_card_uses_phh_and_says_so():
    a = compute("UNKNOWN", 2)
    assert a["assumed"] is True and "assumed" in a["scheme_name"]
    assert qty(a, "Rice") == "6"
    assert compute("STATE_OTHER", 2)["assumed"] is True


# ── routes ───────────────────────────────────────────────

@pytest.fixture
def user():
    with TestClient(app, raise_server_exceptions=False) as c:
        assert c.post("/api/auth/signup", json={"email": "e@example.com", "password": PW}
                      ).status_code == 201
        yield c


def verified(c, **over):
    assert c.put("/api/household/profile", json=profile(**over)).status_code == 200
    # proof verified through the real upload path with auto-accept
    from app.config import settings
    settings.PROOF_AUTO_ACCEPT = True
    try:
        r = c.post("/api/household/proof",
                   files={"file": ("c.jpg", b"\xff\xd8\xff\xe0" + b"0" * 100, "image/jpeg")})
        assert r.json()["profile"]["proof_status"] == "verified"
    finally:
        settings.PROOF_AUTO_ACCEPT = False


def test_login_required():
    with TestClient(app, raise_server_exceptions=False) as c:
        assert c.get("/api/entitlements/current").status_code == 401
        assert c.post("/api/entitlements/allocate", json={}).status_code == 401


def test_current_is_404_before_allocating(user):
    verified(user)
    assert user.get("/api/entitlements/current").status_code == 404


def test_allocate_needs_a_profile(user):
    assert user.post("/api/entitlements/allocate", json={}).status_code == 404


def test_allocate_needs_verified_proof(user):
    user.put("/api/household/profile", json=profile())
    r = user.post("/api/entitlements/allocate", json={})
    assert r.status_code == 409 and r.json() == {"error": {"code": "PROOF_NOT_VERIFIED"}}


def test_allocate_then_current(user):
    verified(user)                                    # PHH, 3 members
    r = user.post("/api/entitlements/allocate", json={})
    assert r.status_code == 200
    a = r.json()["allocation"]
    assert qty(a, "Rice") == "9" and qty(a, "Wheat") == "6"
    assert a["items"][0]["unit"] == "kg"
    assert a["period_label"] and a["status"]
    assert user.get("/api/entitlements/current").json() == r.json()


def test_allocate_twice_is_idempotent(user):
    verified(user)
    first = user.post("/api/entitlements/allocate", json={}).json()
    assert user.post("/api/entitlements/allocate", json={}).json() == first


def test_reallocating_after_household_change(user):
    verified(user)
    user.post("/api/entitlements/allocate", json={})
    p = profile(members=profile()["members"][:1], household_member_count=1)
    user.put("/api/household/profile", json=p)       # members changed, proof stays verified
    a = user.post("/api/entitlements/allocate", json={}).json()["allocation"]
    assert qty(a, "Rice") == "3"


def test_allocations_are_per_user(user):
    verified(user)
    user.post("/api/entitlements/allocate", json={})
    with TestClient(app, raise_server_exceptions=False) as other:
        other.post("/api/auth/signup", json={"email": "f@example.com", "password": PW})
        assert other.get("/api/entitlements/current").status_code == 404
