from datetime import datetime

import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.routers.entitlements import _IST
from tests.test_entitlements import verified
from tests.test_household import PW, profile

TODAY = datetime.now(_IST).date().isoformat()


@pytest.fixture
def user():
    with TestClient(app, raise_server_exceptions=False) as c:
        assert c.post("/api/auth/signup", json={"email": "n@example.com", "password": PW}
                      ).status_code == 201
        yield c


def codes(c):
    return [n["code"] for n in c.get("/api/notifications").json()["notifications"]]


def withdraw(c, item, qty):
    r = c.post("/api/withdrawals", json={"item": item, "quantity": qty, "unit": "kg",
                                         "withdrawal_date": TODAY})
    assert r.status_code == 201, r.text


def test_login_required():
    with TestClient(app, raise_server_exceptions=False) as c:
        assert c.get("/api/notifications").status_code == 401


def test_follows_the_account_state(user):
    assert codes(user) == ["PROFILE_MISSING"]
    user.put("/api/household/profile", json=profile())
    assert "PROOF_MISSING" in codes(user)
    verified(user)
    assert codes(user) == ["ALLOCATION_MISSING"]
    user.post("/api/entitlements/allocate", json={})
    assert codes(user) == ["NO_WITHDRAWALS_YET"] or "NO_WITHDRAWALS_YET" in codes(user)


def test_low_balance_and_fully_collected(user):
    verified(user)                                         # rice 9 kg, wheat 6 kg
    user.post("/api/entitlements/allocate", json={})
    withdraw(user, "rice", 7.5)                            # 1.5 left = 16.7%
    withdraw(user, "wheat", 6)                             # all collected
    notes = user.get("/api/notifications").json()["notifications"]
    by_code = {n["code"]: n for n in notes}
    assert by_code["BALANCE_LOW"]["params"] == {"item": "Rice", "remaining": "1.5"}
    assert by_code["ITEM_FULLY_COLLECTED"]["params"] == {"item": "Wheat"}
    assert "NO_WITHDRAWALS_YET" not in by_code
    assert sum(1 for n in notes if n["code"] == "RECEIPT_RECORDED") == 2
    assert len({n["id"] for n in notes}) == len(notes)     # stable, unique ids


def test_ids_are_stable_between_calls(user):
    verified(user)
    user.post("/api/entitlements/allocate", json={})
    withdraw(user, "rice", 8)
    a = [n["id"] for n in user.get("/api/notifications").json()["notifications"]]
    b = [n["id"] for n in user.get("/api/notifications").json()["notifications"]]
    assert a == b


def test_private_to_each_user(user):
    verified(user)
    user.post("/api/entitlements/allocate", json={})
    withdraw(user, "rice", 8)
    with TestClient(app, raise_server_exceptions=False) as other:
        other.post("/api/auth/signup", json={"email": "n2@example.com", "password": PW})
        assert codes(other) == ["PROFILE_MISSING"]
