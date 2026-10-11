import pytest
from fastapi.testclient import TestClient

from app.main import app


@pytest.fixture(scope="module")
def client():
    with TestClient(app, raise_server_exceptions=False) as c:
        yield c


def test_health(client):
    r = client.get("/api/health")
    assert r.status_code == 200
    body = r.json()
    assert body["status"] == "ok" and body["db"] == "ok"
    assert body["llm"] in ("configured", "not_configured")
    assert body["email"] in ("configured", "not_configured")


def test_calculate_demo(client, demo):
    r = client.post("/api/calculate", json=demo)
    assert r.status_code == 200
    body = r.json()
    rice = body["items"][0]
    assert rice["difference"] == {"value": "6", "direction": "below"}
    assert rice["labels"][0]["code"] == "shortfall"
    assert body["items"][1]["labels"][0]["code"] == "no_difference"
    assert body["period"]["status"] == "ended"


def test_calculate_too_precise_is_validation_error(client, demo):
    demo["rules"][0]["quantity"]["value"] = "1.2345"
    r = client.post("/api/calculate", json=demo)
    assert r.status_code == 422
    err = r.json()["error"]
    assert err["code"] == "VALIDATION_FAILED"
    assert err["fields"]["rules.0.quantity"] == "TOO_PRECISE"


def test_calculate_unknown_field(client, demo):
    demo["bogus"] = True
    r = client.post("/api/calculate", json=demo)
    assert r.status_code == 422
    assert r.json()["error"]["code"] == "VALIDATION_FAILED"


def test_calculate_limits(client, demo):
    demo["rules"] = demo["rules"] * 11            # 22 rules > 20
    assert client.post("/api/calculate", json=demo).status_code == 422


def test_unknown_route_uses_error_shape(client):
    r = client.get("/api/nope")
    assert r.status_code == 404
    assert r.json() == {"error": {"code": "NOT_FOUND"}}


def test_internal_error_hides_details(client, monkeypatch):
    import app.routers.calculate as mod

    def boom(case):
        raise RuntimeError("secret stack detail")
    monkeypatch.setattr(mod, "calculate", boom)
    r = client.post("/api/calculate", json={
        "members": 1, "period": {"start": "2026-09-01", "end": "2026-09-30"},
        "rules": [], "records": []})
    assert r.status_code == 500
    assert r.json() == {"error": {"code": "INTERNAL"}}
    assert "secret" not in r.text
