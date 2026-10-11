import httpx
import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.routers import shops
from tests.test_household import PW


def shop(**over):
    s = {"name": "Sharma Fair Price Shop", "lat": 18.52, "lon": 73.86, "address": "MG Road",
         "phone": ""}
    s.update(over)
    return s


@pytest.fixture
def user():
    with TestClient(app, raise_server_exceptions=False) as c:
        assert c.post("/api/auth/signup", json={"email": "s@example.com", "password": PW}
                      ).status_code == 201
        yield c


def test_login_required():
    with TestClient(app, raise_server_exceptions=False) as c:
        assert c.get("/api/shops/saved").status_code == 401
        assert c.post("/api/shops/saved", json=shop()).status_code == 401
        assert c.delete("/api/shops/saved/abc").status_code == 401


def test_save_list_delete(user):
    r = user.post("/api/shops/saved", json=shop(phone=" 99 "))
    assert r.status_code == 201
    saved = r.json()["shop"]
    assert saved["name"] == "Sharma Fair Price Shop" and saved["phone"] == "99"
    assert saved["source"] == "You"
    assert user.get("/api/shops/saved").json() == {"shops": [saved]}
    assert user.delete(f"/api/shops/saved/{saved['id']}").status_code == 204
    assert user.get("/api/shops/saved").json() == {"shops": []}


@pytest.mark.parametrize("bad", [{"name": "  "}, {"name": ""}, {"lat": 91}, {"lon": -181},
                                 {"surprise": 1}, {"name": "x" * 101}])
def test_invalid_shop_rejected(user, bad):
    assert user.post("/api/shops/saved", json=shop(**bad)).status_code == 422


def test_saved_shops_are_private(user):
    sid = user.post("/api/shops/saved", json=shop()).json()["shop"]["id"]
    with TestClient(app, raise_server_exceptions=False) as other:
        other.post("/api/auth/signup", json={"email": "o2@example.com", "password": PW})
        assert other.get("/api/shops/saved").json() == {"shops": []}
        assert other.delete(f"/api/shops/saved/{sid}").status_code == 404
    assert len(user.get("/api/shops/saved").json()["shops"]) == 1
    assert user.delete("/api/shops/saved/not-a-uuid").status_code == 404


def test_cap_per_user(user, monkeypatch):
    monkeypatch.setattr(shops, "MAX_SAVED", 2)
    assert user.post("/api/shops/saved", json=shop()).status_code == 201
    assert user.post("/api/shops/saved", json=shop()).status_code == 201
    r = user.post("/api/shops/saved", json=shop())
    assert r.status_code == 409 and r.json()["error"]["code"] == "TOO_MANY_SAVED_SHOPS"


# ── OSM matching must not return Corporation Bank ────────

def test_only_real_ration_names_pass(monkeypatch):
    names = ["Corporation Bank", "Administration Office", "Federation House", "Narration Studio",
             "Shri Ration Shop", "RATION DUKAN 12", "Fair Price Shop", "FPS No. 5",
             "स्वस्त धान्य दुकान", "रेशन दुकान", "Fairprice Mart"]
    elements = [{"type": "node", "id": i, "lat": 18.52, "lon": 73.86, "tags": {"name": n}}
                for i, n in enumerate(names)]
    monkeypatch.undo()
    monkeypatch.setattr(shops, "_client", lambda: httpx.Client(
        transport=httpx.MockTransport(lambda r: httpx.Response(200, json={"elements": elements}))))
    shops._cache.clear()
    kept = [s["name"] for s in shops._fetch(18.52, 73.86, 5)]
    assert kept == ["Shri Ration Shop", "RATION DUKAN 12", "Fair Price Shop", "FPS No. 5",
                    "स्वस्त धान्य दुकान", "रेशन दुकान"]
