from datetime import datetime

import httpx
import pytest
from fastapi.testclient import TestClient

from app.config import settings
from app.documents import pdf
from app.email import sender
from app.main import app
from app.routers import shops
from app.routers.entitlements import _IST
from tests.test_entitlements import verified
from tests.test_household import PW

TODAY = datetime.now(_IST).date().isoformat()
MONTH = TODAY[:7]


@pytest.fixture
def user():
    with TestClient(app, raise_server_exceptions=False) as c:
        assert c.post("/api/auth/signup", json={"email": "d@example.com", "password": PW}
                      ).status_code == 201
        verified(c)                                       # PHH, 3 members: rice 9, wheat 6
        c.post("/api/entitlements/allocate", json={})
        yield c


def withdraw(c, **over):
    b = {"item": "rice", "quantity": 2, "unit": "kg", "withdrawal_date": TODAY}
    b.update(over)
    r = c.post("/api/withdrawals", json=b)
    assert r.status_code == 201, r.text
    return r.json()["receipt"]


# ── receipt PDF ──────────────────────────────────────────

def test_receipt_pdf_downloads(user):
    rc = withdraw(user)
    r = user.get(f"/api/withdrawals/{rc['id']}/receipt.pdf")
    assert r.status_code == 200
    assert r.headers["content-type"] == "application/pdf"
    assert "attachment" in r.headers["content-disposition"] and rc["receipt_id"] in \
        r.headers["content-disposition"]
    assert r.content.startswith(b"%PDF-")
    assert r.headers["cache-control"] == "no-store"


def test_receipt_pdf_is_private(user):
    rc = withdraw(user)
    with TestClient(app, raise_server_exceptions=False) as anon:
        assert anon.get(f"/api/withdrawals/{rc['id']}/receipt.pdf").status_code == 401
        anon.post("/api/auth/signup", json={"email": "z@example.com", "password": PW})
        assert anon.get(f"/api/withdrawals/{rc['id']}/receipt.pdf").status_code == 404
    assert user.get("/api/withdrawals/not-a-uuid/receipt.pdf").status_code == 404


def test_pdf_survives_non_latin_names():
    data = pdf.receipt_pdf(
        {"receipt_id": "RS-1", "verification_code": "X", "item": "Rice", "quantity": "1",
         "unit": "kg", "withdrawal_date": "2026-10-01", "reference": "सीता"},
        {"head_name": "सीता देवी", "state": "महाराष्ट्र", "district": "पुणे"})
    assert data.startswith(b"%PDF-")


# ── monthly report ───────────────────────────────────────

def test_report_json_numbers(user):
    withdraw(user, quantity=2.5)
    withdraw(user, item="wheat", quantity=6)
    rep = user.get(f"/api/monthly-report?month={MONTH}").json()["report"]
    rice = next(i for i in rep["items"] if i["item"] == "Rice")
    wheat = next(i for i in rep["items"] if i["item"] == "Wheat")
    assert (rice["allocated"], rice["withdrawn"], rice["remaining"], rice["over_by"]) == \
        ("9", "2.5", "6.5", "0")
    assert (wheat["remaining"], wheat["withdrawn"]) == ("0", "6")
    assert len(rep["withdrawals"]) == 2
    assert rep["household"]["head_name"] == "Sita Devi"
    assert "d@example.com" not in str(rep)


def test_report_pdf_downloads(user):
    withdraw(user)
    r = user.get(f"/api/monthly-report/pdf?month={MONTH}")
    assert r.status_code == 200 and r.content.startswith(b"%PDF-")
    assert f"rationsaathi-report-{MONTH}.pdf" in r.headers["content-disposition"]


def test_report_needs_allocation_login_and_valid_month(user):
    assert user.get("/api/monthly-report?month=2020-01").status_code == 404
    assert user.get("/api/monthly-report?month=nope").status_code == 422
    assert user.get("/api/monthly-report").status_code == 422
    with TestClient(app, raise_server_exceptions=False) as anon:
        assert anon.get(f"/api/monthly-report?month={MONTH}").status_code == 401
        assert anon.get(f"/api/monthly-report/pdf?month={MONTH}").status_code == 401


# ── emailing the report ──────────────────────────────────

@pytest.fixture
def mail(monkeypatch):
    monkeypatch.setattr(settings, "EMAIL_API_KEY", "key-123")
    monkeypatch.setattr(settings, "EMAIL_FROM", "RationSaathi <noreply@example.org>")
    box = type("Box", (), {})()
    box.sent = []

    def fake_send(to, subject, html, text, attachments=None):
        box.sent.append({"to": to, "subject": subject, "html": html, "text": text,
                         "attachments": attachments})

    monkeypatch.setattr(sender, "send", fake_send)
    return box


def test_email_goes_to_account_with_pdf(user, mail):
    withdraw(user)
    r = user.post("/api/monthly-report/email", json={"month": MONTH})
    assert r.status_code == 202
    assert r.json() == {"status": "queued", "sent_to": "d***@example.com"}
    [sent] = mail.sent
    assert sent["to"] == "d@example.com"
    name, data = sent["attachments"][0]
    assert name == f"rationsaathi-report-{MONTH}.pdf" and data.startswith(b"%PDF-")
    assert "allocated 9 kg" in sent["text"]


def test_email_cannot_choose_recipient(user, mail):
    for extra in ({"to": "x@y.co"}, {"subject": "s"}, {"body": "b"}):
        assert user.post("/api/monthly-report/email", json={"month": MONTH, **extra}
                         ).status_code == 422
    assert mail.sent == []


def test_email_not_configured_and_limits(user, monkeypatch):
    monkeypatch.setattr(settings, "EMAIL_API_KEY", "")
    r = user.post("/api/monthly-report/email", json={"month": MONTH})
    assert r.status_code == 503 and r.json()["error"]["code"] == "EMAIL_NOT_CONFIGURED"


def test_email_hourly_limit(user, mail):
    codes = [user.post("/api/monthly-report/email", json={"month": MONTH}).status_code
             for _ in range(4)]
    assert codes == [202, 202, 202, 429]


@pytest.mark.parametrize("provider,key", [("brevo", "attachment"), ("resend", "attachments")])
def test_provider_payload_carries_the_pdf(monkeypatch, provider, key):
    import json
    seen = {}

    def handler(request):
        seen["body"] = json.loads(request.content)
        return httpx.Response(200, json={})

    monkeypatch.setattr(settings, "EMAIL_API_KEY", "k")
    monkeypatch.setattr(settings, "EMAIL_FROM", "A <a@example.org>")
    monkeypatch.setattr(settings, "EMAIL_PROVIDER", provider)
    monkeypatch.setattr(sender, "_client",
                        lambda: httpx.Client(transport=httpx.MockTransport(handler)))
    sender.send("t@example.com", "s", "<p>h</p>", "t", [("r.pdf", b"%PDF-x")])
    [att] = seen["body"][key]
    assert att["content"] and (att.get("name") or att.get("filename")) == "r.pdf"
    sender.send("t@example.com", "s", "<p>h</p>", "t")            # still fine without one
    assert key not in seen["body"]


# ── shops (map data) ─────────────────────────────────────

FAKE = [
    {"id": "node/1", "name": "Shri Ration Shop", "lat": 18.52, "lon": 73.86, "address": "MG Road",
     "phone": None, "opening_hours": None, "source": "OpenStreetMap"},
    {"id": "node/2", "name": "Fair Price Shop", "lat": 18.55, "lon": 73.90, "address": None,
     "phone": "123", "opening_hours": None, "source": "OpenStreetMap"},
    {"id": "node/3", "name": "Far Shop", "lat": 19.5, "lon": 74.5, "address": None,
     "phone": None, "opening_hours": None, "source": "OpenStreetMap"},
]


def test_shops_sorted_by_distance_and_radius_applied(anon_client, monkeypatch):
    monkeypatch.setattr(shops, "_fetch", lambda lat, lon, radius_km: list(FAKE))
    r = anon_client.get("/api/shops/nearby?lat=18.52&lon=73.86&radius_km=10").json()
    assert r["status"] == "ok" and r["message_code"] == "SHOPS_FROM_OSM"
    assert [s["name"] for s in r["shops"]] == ["Shri Ration Shop", "Fair Price Shop"]
    assert r["shops"][0]["distance_km"] == 0.0 and r["shops"][1]["distance_km"] > 0
    assert all(s["source"] == "OpenStreetMap" for s in r["shops"])


def test_shops_lookup_failure_is_reported(anon_client, monkeypatch):
    def boom(*a):
        raise httpx.ConnectError("down")

    monkeypatch.setattr(shops, "_fetch", boom)
    r = anon_client.get("/api/shops/nearby?lat=18.5&lon=73.8").json()
    assert r == {"status": "unavailable", "shops": [], "message_code": "SHOPS_LOOKUP_FAILED"}


def test_shops_query_to_overpass(monkeypatch):
    seen = {}

    def handler(request):
        seen["body"] = request.content.decode()
        return httpx.Response(200, json={"elements": [
            {"type": "node", "id": 5, "lat": 18.52, "lon": 73.86,
             "tags": {"name": "Ration Dukan", "addr:street": "MG Road", "phone": "99"}},
            {"type": "way", "id": 6, "center": {"lat": 18.53, "lon": 73.87},
             "tags": {"name": "Fair Price Shop"}},
            {"type": "node", "id": 7, "lat": 18.5, "lon": 73.8, "tags": {}},     # no name: skipped
        ]})

    monkeypatch.undo()          # drop the autouse fake _fetch so the real one runs
    monkeypatch.setattr(shops, "_client",
                        lambda: httpx.Client(transport=httpx.MockTransport(handler)))
    shops._cache.clear()
    found = shops._fetch(18.5234, 73.8567, 5)
    assert [s["name"] for s in found] == ["Ration Dukan", "Fair Price Shop"]
    assert found[0]["address"] == "MG Road" and found[1]["lat"] == 18.53
    assert "18.5234" not in seen["body"] and "73.8567" not in seen["body"]   # coords are rounded


@pytest.fixture
def anon_client():
    with TestClient(app, raise_server_exceptions=False) as c:
        yield c


def test_shops_rate_limited(anon_client):
    codes = [anon_client.get("/api/shops/nearby?lat=18.5&lon=73.8").status_code
             for _ in range(11)]
    assert codes[:10] == [200] * 10 and codes[10] == 429
