from datetime import datetime

import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.routers.entitlements import _IST
from tests.test_entitlements import verified
from tests.test_household import PW

TODAY = datetime.now(_IST).date().isoformat()
MONTH = TODAY[:7]


def body(**over):
    b = {"item": "rice", "quantity": 2, "unit": "kg", "withdrawal_date": TODAY,
         "receipt_reference": ""}
    b.update(over)
    return b


@pytest.fixture
def user():
    with TestClient(app, raise_server_exceptions=False) as c:
        assert c.post("/api/auth/signup", json={"email": "w@example.com", "password": PW}
                      ).status_code == 201
        verified(c)                                             # PHH, 3 members: rice 9, wheat 6
        assert c.post("/api/entitlements/allocate", json={}).status_code == 200
        yield c


def test_login_required():
    with TestClient(app, raise_server_exceptions=False) as c:
        assert c.get("/api/withdrawals").status_code == 401
        assert c.post("/api/withdrawals", json=body()).status_code == 401


def test_record_and_list(user):
    r = user.post("/api/withdrawals", json=body(quantity=2.5, receipt_reference=" S-7 "))
    assert r.status_code == 201
    rc = r.json()["receipt"]
    assert rc["receipt_id"].startswith("RS-") and len(rc["verification_code"]) == 10
    assert rc["item"] == "Rice" and rc["quantity"] == "2.5" and rc["reference"] == "S-7"
    rows = user.get(f"/api/withdrawals?month={MONTH}").json()["items"]
    assert [x["receipt_id"] for x in rows] == [rc["receipt_id"]]
    assert "verification_code" not in rows[0]


def test_balance_is_enforced_exactly(user):
    assert user.post("/api/withdrawals", json=body(quantity=8.5)).status_code == 201
    over = user.post("/api/withdrawals", json=body(quantity=0.501))
    assert over.status_code == 409 and over.json() == {"error": {"code": "EXCEEDS_BALANCE"}}
    assert user.post("/api/withdrawals", json=body(quantity=0.5)).status_code == 201   # exactly 9
    assert user.post("/api/withdrawals", json=body(quantity=0.001)).status_code == 409
    assert user.post("/api/withdrawals", json=body(item="wheat", quantity=6)).status_code == 201


def test_grams_count_against_kg(user):
    assert user.post("/api/withdrawals", json=body(quantity=9000, unit="g")).status_code == 201
    assert user.post("/api/withdrawals", json=body(quantity=1, unit="g")).status_code == 409


@pytest.mark.parametrize("bad,code", [
    ({"quantity": 0}, 422), ({"quantity": -1}, 422), ({"quantity": 1.0001}, 422),
    ({"item": "sugar"}, 422), ({"item": ""}, 422), ({"unit": "lb"}, 422),
    ({"withdrawal_date": "2999-01-01"}, 422), ({"surprise": 1}, 422),
])
def test_invalid_rejected(user, bad, code):
    assert user.post("/api/withdrawals", json=body(**bad)).status_code == code


def test_no_allocation_for_that_month(user):
    r = user.post("/api/withdrawals", json=body(withdrawal_date="2020-01-15"))
    assert r.status_code == 409 and r.json()["error"]["code"] == "NO_ALLOCATION"


def test_month_filter_and_bad_month(user):
    user.post("/api/withdrawals", json=body())
    assert user.get("/api/withdrawals?month=2020-01").json() == {"items": []}
    assert user.get("/api/withdrawals?month=nope").status_code == 422
    assert len(user.get("/api/withdrawals").json()["items"]) == 1       # default: this month


def test_withdrawals_are_per_user(user):
    user.post("/api/withdrawals", json=body())
    with TestClient(app, raise_server_exceptions=False) as other:
        other.post("/api/auth/signup", json={"email": "x@example.com", "password": PW})
        assert other.get(f"/api/withdrawals?month={MONTH}").json() == {"items": []}


def test_receipt_verification_is_public_and_private(user):
    rc = user.post("/api/withdrawals", json=body(quantity=1)).json()["receipt"]
    with TestClient(app, raise_server_exceptions=False) as anon:
        for code in (rc["verification_code"], rc["receipt_id"], rc["verification_code"].lower()):
            r = anon.get(f"/api/receipts/verify/{code}")
            assert r.status_code == 200 and r.json()["valid"] is True
            assert r.json()["quantity"] == "1"
        assert "w@example.com" not in r.text and "user" not in r.text
        miss = anon.get("/api/receipts/verify/NOPE123456")
        assert miss.status_code == 200 and miss.json()["valid"] is False
        assert miss.json()["message"]


def test_verification_is_rate_limited():
    with TestClient(app, raise_server_exceptions=False) as anon:
        codes = [anon.get("/api/receipts/verify/ABC").status_code for _ in range(31)]
    assert codes[:30] == [200] * 30 and codes[30] == 429
