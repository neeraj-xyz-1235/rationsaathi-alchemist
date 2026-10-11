from datetime import date, datetime

import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.proof import receipt_check
from app.proof.vision import ReceiptReading, VisionUnavailable
from app.routers.entitlements import _IST
from tests.test_entitlements import verified
from tests.test_household import PW

TODAY = datetime.now(_IST).date()
JPEG = b"\xff\xd8\xff\xe0" + b"0" * 200


def reading(**over):
    base = dict(is_receipt=True, item_text="Rice", quantity_text="2", unit_text="kg",
                date_text=TODAY.strftime("%d/%m/%Y"), receipt_ref=None)
    base.update(over)
    return ReceiptReading(**base)


def decide(r, **over):
    args = dict(item="Rice", qty_base=2000, on=TODAY, reference=None)
    args.update(over)
    return receipt_check.decide(r, **args)


# ── rules ────────────────────────────────────────────────

def test_matching_receipt_is_verified():
    status, res = decide(reading())
    assert status == "verified" and res["reason"] == "MATCHED"
    assert res["checks"] == {"item": "match", "quantity": "match", "date": "match"}


def test_wrong_quantity_is_a_mismatch():
    status, res = decide(reading(quantity_text="3"))
    assert status == "mismatch" and res["checks"]["quantity"] == "mismatch"
    assert res["read_quantity_g"] == 3000 and res["recorded_quantity_g"] == 2000


def test_grams_and_kg_are_compared_exactly():
    assert decide(reading(quantity_text="2000", unit_text="g"))[0] == "verified"
    assert decide(reading(quantity_text="1.999", unit_text="kg"))[0] == "mismatch"


def test_wrong_item_is_a_mismatch():
    assert decide(reading(item_text="Wheat"))[0] == "mismatch"


def test_hindi_and_marathi_names_and_units_work():
    assert decide(reading(item_text="चावल", quantity_text="२", unit_text="किलो"))[0] == "verified"
    assert decide(reading(item_text="तांदूळ"))[0] == "verified"
    assert decide(reading(item_text="गहू", quantity_text="2"), item="Wheat")[0] == "verified"


def test_wrong_date_is_a_mismatch_but_missing_date_is_not():
    assert decide(reading(date_text="01/01/2020"))[0] == "mismatch"
    status, res = decide(reading(date_text=None))
    assert status == "verified" and res["checks"]["date"] == "unreadable"


def test_unreadable_item_or_quantity():
    assert decide(reading(quantity_text=None))[0] == "unreadable"
    assert decide(reading(item_text=None))[0] == "unreadable"


def test_not_a_receipt_is_a_mismatch():
    status, res = decide(reading(is_receipt=False))
    assert status == "mismatch" and res["reason"] == "NOT_A_RECEIPT"


def test_reference_compared_when_both_present():
    assert decide(reading(receipt_ref="S-7"), reference="s-7")[0] == "verified"
    assert decide(reading(receipt_ref="S-8"), reference="S-7")[0] == "mismatch"
    assert decide(reading(receipt_ref=None), reference="S-7")[0] == "verified"


# ── route ────────────────────────────────────────────────

@pytest.fixture
def user():
    with TestClient(app, raise_server_exceptions=False) as c:
        assert c.post("/api/auth/signup", json={"email": "r@example.com", "password": PW}
                      ).status_code == 201
        verified(c)                                   # PHH, 3 members: rice 9 kg
        c.post("/api/entitlements/allocate", json={})
        yield c


def withdraw(c, qty=2):
    r = c.post("/api/withdrawals", json={"item": "rice", "quantity": qty, "unit": "kg",
                                         "withdrawal_date": TODAY.isoformat()})
    assert r.status_code == 201, r.text
    return r.json()["receipt"]


def upload(c, wid, data=JPEG, name="r.jpg", ctype="image/jpeg"):
    return c.post(f"/api/withdrawals/{wid}/proof", files={"file": (name, data, ctype)})


def fake_ai(monkeypatch, result):
    def _read(image, mime):
        if isinstance(result, Exception):
            raise result
        return result
    monkeypatch.setattr("app.routers.withdrawals.read_receipt", _read)


def test_new_withdrawal_has_no_proof(user):
    rc = withdraw(user)
    assert rc["proof_status"] == "none"
    assert user.get(f"/api/withdrawals?month={TODAY:%Y-%m}").json()["items"][0]["proof_status"] == "none"


def test_verified_upload_shows_everywhere(user, monkeypatch):
    rc = withdraw(user)
    fake_ai(monkeypatch, reading())
    r = upload(user, rc["id"])
    assert r.status_code == 200
    assert r.json()["proof"] == {"status": "verified", "reason": "MATCHED",
                                 "checks": {"item": "match", "quantity": "match", "date": "match"}}
    assert user.get(f"/api/withdrawals?month={TODAY:%Y-%m}").json()["items"][0]["proof_status"] == "verified"
    with TestClient(app, raise_server_exceptions=False) as anon:
        v = anon.get(f"/api/receipts/verify/{rc['verification_code']}").json()
    assert v["valid"] is True and v["proof_status"] == "verified"
    pdf = user.get(f"/api/withdrawals/{rc['id']}/receipt.pdf")
    assert pdf.status_code == 200 and pdf.content.startswith(b"%PDF-")


def test_mismatch_and_replace(user, monkeypatch):
    rc = withdraw(user, qty=2)
    fake_ai(monkeypatch, reading(quantity_text="5"))
    assert upload(user, rc["id"]).json()["proof"]["status"] == "mismatch"
    fake_ai(monkeypatch, reading())
    assert upload(user, rc["id"], JPEG + b"1").json()["proof"]["status"] == "verified"


def test_ai_down_or_pdf_is_unreadable(user, monkeypatch):
    rc = withdraw(user)
    fake_ai(monkeypatch, VisionUnavailable("down"))
    assert upload(user, rc["id"]).json()["proof"]["reason"] == "AI_UNAVAILABLE"
    fake_ai(monkeypatch, AssertionError("not called"))
    p = upload(user, rc["id"], b"%PDF-1.4 " + b"0" * 50, "r.pdf", "application/pdf").json()["proof"]
    assert p["status"] == "unreadable" and p["reason"] == "PDF_NOT_READ"


def test_not_configured_is_unreadable(user):
    rc = withdraw(user)
    assert upload(user, rc["id"]).json()["proof"]["status"] == "unreadable"


def test_same_photo_cannot_verify_two_withdrawals(user, monkeypatch):
    a, b = withdraw(user), withdraw(user)
    fake_ai(monkeypatch, reading())
    assert upload(user, a["id"]).json()["proof"]["status"] == "verified"
    second = upload(user, b["id"]).json()["proof"]
    assert second["status"] == "unreadable" and second["reason"] == "PHOTO_ALREADY_USED"


def test_access_and_validation(user, monkeypatch):
    rc = withdraw(user)
    fake_ai(monkeypatch, reading())
    assert upload(user, "not-a-uuid").status_code == 404
    assert upload(user, rc["id"], b"MZ\x90 nope", "r.jpg", "image/jpeg").status_code == 422
    assert upload(user, rc["id"], b"").status_code == 422
    assert upload(user, rc["id"], JPEG + b"0" * (8 * 1024 * 1024)).status_code == 413
    with TestClient(app, raise_server_exceptions=False) as anon:
        assert upload(anon, rc["id"]).status_code == 401
        anon.post("/api/auth/signup", json={"email": "z2@example.com", "password": PW})
        assert upload(anon, rc["id"]).status_code == 404         # someone else's withdrawal


def test_multipart_still_refused_on_other_routes(user):
    rc = withdraw(user)
    r = user.post("/api/withdrawals", files={"file": ("a.jpg", JPEG, "image/jpeg")})
    assert r.status_code == 415
    assert user.post(f"/api/withdrawals/{rc['id']}/proof", json={}).status_code == 415


def test_rate_limited(user, monkeypatch):
    rc = withdraw(user)
    fake_ai(monkeypatch, reading())
    codes = [upload(user, rc["id"], JPEG + bytes([i % 250, i // 250])).status_code for i in range(41)]
    assert codes[:40] == [200] * 40 and codes[40] == 429


def test_proofs_are_removed_with_the_withdrawal(user, monkeypatch):
    from app.db import models as m
    from app.db.session import SessionLocal
    rc = withdraw(user)
    fake_ai(monkeypatch, reading())
    upload(user, rc["id"])
    with SessionLocal() as db:
        assert db.query(m.WithdrawalProof).count() == 1
        db.delete(db.get(m.Withdrawal, __import__("uuid").UUID(rc["id"])))
        db.commit()
        assert db.query(m.WithdrawalProof).count() == 0


# ── reading a receipt to pre-fill the form ───────────────

def extract(c, data=JPEG, name="r.jpg", ctype="image/jpeg"):
    return c.post("/api/withdrawals/extract", files={"file": (name, data, ctype)})


def test_extract_fills_the_form_fields(user, monkeypatch):
    fake_ai(monkeypatch, reading(quantity_text="2", receipt_ref="S-77"))
    r = extract(user)
    assert r.status_code == 200
    body = r.json()
    assert body["extracted"] == {"item": "Rice", "quantity": "2", "date": TODAY.isoformat(),
                                 "reference": "S-77"}
    assert body["reason"] == "READ" and body["item"] == "Rice" and body["quantity"] == "2"


def test_extract_converts_grams_and_hindi(user, monkeypatch):
    fake_ai(monkeypatch, reading(item_text="गहू", quantity_text="१५००", unit_text="ग्राम"))
    body = extract(user).json()
    assert body["item"] == "Wheat" and body["quantity"] == "1.5"
    fake_ai(monkeypatch, reading(item_text="तांदूळ", quantity_text="2.5", unit_text="किलो"))
    assert extract(user).json()["quantity"] == "2.5"


def test_extract_leaves_unread_fields_empty(user, monkeypatch):
    fake_ai(monkeypatch, reading(item_text="Sugar", quantity_text=None, date_text=None))
    body = extract(user).json()
    assert body["item"] is None and body["quantity"] is None and body["date"] is None
    fake_ai(monkeypatch, reading(item_text=None, quantity_text=None, date_text=None))
    assert extract(user).json()["reason"] == "RECEIPT_UNREADABLE"


def test_extract_not_receipt_ai_down_and_pdf(user, monkeypatch):
    fake_ai(monkeypatch, reading(is_receipt=False))
    assert extract(user).json()["reason"] == "NOT_A_RECEIPT"
    fake_ai(monkeypatch, VisionUnavailable("down"))
    body = extract(user).json()
    assert body["reason"] == "AI_UNAVAILABLE" and body["extracted"] is None
    fake_ai(monkeypatch, AssertionError("not called"))
    assert extract(user, b"%PDF-1.4 " + b"0" * 50, "r.pdf", "application/pdf").json()["reason"] == "PDF_NOT_READ"


def test_extract_saves_nothing_and_is_protected(user, monkeypatch):
    from app.db import models as m
    from app.db.session import SessionLocal
    fake_ai(monkeypatch, reading())
    extract(user)
    with SessionLocal() as db:
        assert db.query(m.Withdrawal).count() == 0 and db.query(m.WithdrawalProof).count() == 0
    assert extract(user, b"MZ\x90 nope").status_code == 422
    assert extract(user, b"").status_code == 422
    with TestClient(app, raise_server_exceptions=False) as anon:
        assert extract(anon).status_code == 401
    assert user.post("/api/withdrawals/extract", json={}).status_code == 415


def test_extract_then_record_then_verify_round_trip(user, monkeypatch):
    fake_ai(monkeypatch, reading(quantity_text="2.5"))
    f = extract(user).json()
    r = user.post("/api/withdrawals", json={"item": f["item"].lower(), "quantity": float(f["quantity"]),
                                            "unit": "kg", "withdrawal_date": f["date"]})
    assert r.status_code == 201
    out = upload(user, r.json()["receipt"]["id"]).json()["proof"]
    assert out["status"] == "verified"
