import json

import pytest
from fastapi.testclient import TestClient

from app.main import app


@pytest.fixture
def client():
    with TestClient(app, raise_server_exceptions=False) as c:
        yield c


EVIL = {"Origin": "https://evil.example"}
GOOD = {"Origin": "http://localhost:5173"}
LOGIN = {"email": "a@example.com", "password": "whatever-password"}


def test_bad_origin_blocked(client):
    r = client.post("/api/auth/login", json=LOGIN, headers=EVIL)
    assert r.status_code == 403
    assert r.json() == {"error": {"code": "BAD_ORIGIN"}}


def test_bad_origin_via_referer_blocked(client):
    r = client.post("/api/auth/login", json=LOGIN, headers={"Referer": "https://evil.example/x"})
    assert r.status_code == 403


def test_good_origin_allowed(client):
    assert client.post("/api/auth/login", json=LOGIN, headers=GOOD).status_code == 401
    ref = {"Referer": "http://localhost:5173/login"}
    assert client.post("/api/auth/login", json=LOGIN, headers=ref).status_code == 401


def test_own_origin_allowed_so_swagger_works(client):
    h = {"Origin": "http://testserver"}
    assert client.post("/api/auth/login", json=LOGIN, headers=h).status_code == 401


def test_get_ignores_origin(client):
    assert client.get("/api/health", headers=EVIL).status_code == 200


def test_form_post_rejected(client):
    r = client.post("/api/auth/login", data={"email": "a", "password": "b"})
    assert r.status_code == 415
    assert r.json()["error"]["fields"] == {"_": "CONTENT_TYPE_NOT_JSON"}


def test_text_plain_rejected(client):
    r = client.post("/api/auth/login", content=json.dumps(LOGIN),
                    headers={"Content-Type": "text/plain"})
    assert r.status_code == 415


def test_big_body_413(client, demo):
    demo["rules"][0]["item"] = "x" * 150_000
    r = client.post("/api/calculate", json=demo)
    assert r.status_code == 413
    assert r.json() == {"error": {"code": "PAYLOAD_TOO_LARGE"}}


def test_big_body_without_content_length_413(client):
    def chunks():
        for _ in range(200):
            yield b" " * 1024
    r = client.post("/api/calculate", content=chunks(),
                    headers={"Content-Type": "application/json"})
    assert r.status_code == 413


def test_unknown_field_422(client, demo):
    demo["extra"] = 1
    assert client.post("/api/calculate", json=demo).status_code == 422


def test_request_id_header(client):
    r = client.get("/api/health")
    assert len(r.headers["x-request-id"]) == 12


def test_calculate_rate_limit_60_per_minute(client, demo):
    codes = [client.post("/api/calculate", json=demo).status_code for _ in range(61)]
    assert codes[:60] == [200] * 60
    assert codes[60] == 429


def test_rate_limit_error_shape(client, demo):
    for _ in range(60):
        client.post("/api/calculate", json=demo)
    r = client.post("/api/calculate", json=demo)
    assert r.status_code == 429
    assert r.json()["error"]["code"] == "RATE_LIMITED"
    assert r.json()["error"]["retry_after_s"] == int(r.headers["Retry-After"])


def test_general_limit_120_per_minute(client):
    codes = [client.get("/api/nope").status_code for _ in range(121)]
    assert codes[119] == 404 and codes[120] == 429


def test_health_not_rate_limited(client):
    assert all(client.get("/api/health").status_code == 200 for _ in range(130))


def test_forwarded_for_is_the_client_key(client, demo):
    for _ in range(60):
        client.post("/api/calculate", json=demo, headers={"X-Forwarded-For": "1.1.1.1"})
    blocked = client.post("/api/calculate", json=demo, headers={"X-Forwarded-For": "1.1.1.1"})
    other = client.post("/api/calculate", json=demo, headers={"X-Forwarded-For": "2.2.2.2"})
    assert blocked.status_code == 429 and other.status_code == 200


def test_no_stack_trace_on_500(client, monkeypatch):
    import app.routers.auth as mod
    monkeypatch.setattr(mod, "hash_password", lambda p: 1 / 0)
    r = client.post("/api/auth/signup", json={"email": "z@example.com", "password": "a-fine-password"})
    assert r.status_code == 500
    assert r.json() == {"error": {"code": "INTERNAL"}}
    assert "division" not in r.text and "Traceback" not in r.text
