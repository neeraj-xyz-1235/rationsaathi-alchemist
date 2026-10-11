"""Smoke check for a RUNNING backend.

    python scripts/smoke.py                      # http://localhost:8000
    python scripts/smoke.py https://your-api.onrender.com

Exits 0 if every check passes, 1 otherwise. New checks are added as each backend
feature is built.
"""
import json
import sys
import uuid
from pathlib import Path

import httpx

BASE = (sys.argv[1] if len(sys.argv) > 1 else "http://localhost:8000").rstrip("/")
DEMO = json.loads((Path(__file__).parent.parent / "tests/fixtures/demo_case.json").read_text("utf-8"))

results = []


def check(name, fn):
    try:
        fn()
        results.append((name, True, ""))
    except Exception as e:  # noqa: BLE001
        results.append((name, False, f"{type(e).__name__}: {e}"))


def health():
    r = httpx.get(f"{BASE}/api/health", timeout=30)
    assert r.status_code == 200, r.text
    assert r.json()["db"] == "ok", r.text


def calculate_demo():
    r = httpx.post(f"{BASE}/api/calculate", json=DEMO, timeout=30)
    assert r.status_code == 200, r.text
    rice, wheat = r.json()["items"]
    assert rice["expected"]["value"] == "20", rice
    assert rice["received"]["value"] == "14", rice
    assert rice["difference"] == {"value": "6", "direction": "below"}, rice
    assert rice["labels"][0]["code"] == "shortfall", rice
    assert wheat["expected"]["value"] == "10", wheat
    assert wheat["labels"][0]["code"] == "no_difference", wheat


def calculate_rejects_rounding():
    bad = json.loads(json.dumps(DEMO))
    bad["rules"][0]["quantity"]["value"] = "1.2345"
    r = httpx.post(f"{BASE}/api/calculate", json=bad, timeout=30)
    assert r.status_code == 422, r.text
    assert r.json()["error"]["code"] == "VALIDATION_FAILED", r.text


def auth_flow():
    """signup -> me -> logout -> me(401) -> login -> me. Note: signup is limited to 5/hour/IP."""
    email, pw = f"smoke-{uuid.uuid4().hex[:8]}@example.com", "smoke-test-password-1"
    with httpx.Client(base_url=BASE, timeout=30) as c:
        r = c.post("/api/auth/signup", json={"email": email, "password": pw})
        assert r.status_code == 201, f"signup {r.status_code} {r.text}"
        cookie = r.headers["set-cookie"].lower()
        assert "httponly" in cookie and "samesite=lax" in cookie, cookie
        assert c.get("/api/auth/me").json()["user"]["email"] == email
        assert c.post("/api/auth/logout").status_code == 204
        assert c.get("/api/auth/me").status_code == 401
        r = c.post("/api/auth/login", json={"email": email, "password": pw})
        assert r.status_code == 200, r.text
        assert c.get("/api/auth/me").status_code == 200


def auth_rejects_bad_login():
    r = httpx.post(f"{BASE}/api/auth/login", timeout=30,
                   json={"email": f"nobody-{uuid.uuid4().hex[:6]}@example.com", "password": "x" * 12})
    assert r.status_code == 401, r.text
    assert r.json() == {"error": {"code": "INVALID_CREDENTIALS"}}, r.text


def csrf_blocked():
    r = httpx.post(f"{BASE}/api/auth/login", timeout=30, headers={"Origin": "https://evil.example"},
                   json={"email": "a@example.com", "password": "x" * 12})
    assert r.status_code == 403, r.text
    assert r.json()["error"]["code"] == "BAD_ORIGIN", r.text


check("GET  /api/health", health)
check("POST /api/calculate (demo: rice 20-14=6 shortfall, wheat 10-10=0)", calculate_demo)
check("POST /api/calculate rejects 1.2345 kg (never rounds)", calculate_rejects_rounding)
check("auth: signup -> me -> logout -> 401 -> login (HttpOnly, SameSite=Lax cookie)", auth_flow)
check("auth: wrong credentials -> 401 INVALID_CREDENTIALS", auth_rejects_bad_login)
check("security: foreign Origin on POST -> 403 BAD_ORIGIN", csrf_blocked)

for name, ok, msg in results:
    print(f"[{'PASS' if ok else 'FAIL'}] {name}" + (f"\n       {msg}" if msg else ""))
failed = [r for r in results if not r[1]]
print(f"\n{len(results) - len(failed)}/{len(results)} checks passed against {BASE}")
sys.exit(1 if failed else 0)
