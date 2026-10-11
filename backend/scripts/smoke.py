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
ACCOUNT = {}   # filled by the auth check, reused by the cases check


def check(name, fn):
    try:
        fn()
        results.append((name, True, ""))
    except Exception as e:  # noqa: BLE001
        msg = f"{type(e).__name__}: {e}"
        if "signup 429" in msg:
            msg += ("\n       Signup is limited to 5/hour per IP (stored in the DB, so a restart does not reset it)."
                    "\n       Local dev: python scripts/reset_dev_limits.py   |   deployed: wait for retry_after_s.")
        results.append((name, False, msg))


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
        ACCOUNT.update(email=email, password=pw)
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


def cases_and_reports():
    """Needs the auth check to have run. Uses 1 extra signup (the 'other user')."""
    assert ACCOUNT, "auth check did not complete"
    with httpx.Client(base_url=BASE, timeout=30) as me, httpx.Client(base_url=BASE, timeout=30) as other:
        assert me.post("/api/auth/login", json=ACCOUNT).status_code == 200
        r = me.post("/api/cases", json=DEMO)
        assert r.status_code == 201, r.text
        cid = r.json()["id"]
        assert me.get(f"/api/cases/{cid}").json() == DEMO, "saved case did not round-trip"
        assert cid in [c["id"] for c in me.get("/api/cases").json()]

        r = me.post(f"/api/cases/{cid}/reports")
        assert r.status_code == 201, r.text
        rid = r.json()["report_id"]
        assert r.json()["result"]["items"][0]["difference"]["value"] == "6"

        edited = json.loads(json.dumps(DEMO)); edited["records"] = []
        assert me.put(f"/api/cases/{cid}", json=edited).status_code == 200
        pub = httpx.get(f"{BASE}/api/reports/{rid}", timeout=30)      # no cookie: public link
        assert pub.status_code == 200, pub.text
        assert pub.json()["result"]["items"][0]["received"]["value"] == "14", "report not frozen"

        email = f"smoke-{uuid.uuid4().hex[:8]}@example.com"
        r = other.post("/api/auth/signup", json={"email": email, "password": "smoke-test-password-1"})
        assert r.status_code == 201, f"signup {r.status_code} {r.text}"
        for call in (other.get, other.delete):
            assert call(f"/api/cases/{cid}").status_code == 404, "another user could reach my case"
        assert other.put(f"/api/cases/{cid}", json=DEMO).status_code == 404

        assert me.delete(f"/api/cases/{cid}").status_code == 204
        assert httpx.get(f"{BASE}/api/reports/{rid}", timeout=30).status_code == 404


def receipt_parse():
    body = {"text": "Rice 8kg recvd 03/09 Rcpt#101\nचावल ८ किलो ०५/०९",
            "period": DEMO["period"], "known_items": ["Rice", "Wheat"]}
    r = httpx.post(f"{BASE}/api/receipt/parse", json=body, timeout=30)
    assert r.status_code == 200, r.text
    out = r.json()
    assert out["method"] in ("llm", "regex"), out
    assert out["raw_text"] == body["text"], "text must be echoed verbatim"
    first, second = out["suggestions"][0], out["suggestions"][1]
    assert first["quantity"] == {"value": "8", "unit": "kg"}, first
    assert first["date"] == "2026-09-03" and first["receipt_ref"] == "101", first
    assert second["item"] == "Rice" and second["quantity"] == {"value": "8", "unit": "kg"}, second
    assert second["date"] == "2026-09-05", second
    print(f"       (receipt reader used: {out['method']})")


def shops_placeholder():
    r = httpx.get(f"{BASE}/api/shops/nearby", params={"lat": 19.07, "lon": 72.87}, timeout=30)
    assert r.status_code == 200, r.text
    assert r.json() == {"status": "planned", "shops": [], "message_code": "SHOPS_COMING_SOON"}, r.text
    assert httpx.get(f"{BASE}/api/shops/nearby", params={"lat": 99, "lon": 0}, timeout=30).status_code == 422


def tracker_and_next_month():
    """Needs the auth check to have run (reuses its account)."""
    assert ACCOUNT, "auth check did not complete"
    with httpx.Client(base_url=BASE, timeout=30) as c:
        assert c.post("/api/auth/login", json=ACCOUNT).status_code == 200
        home = json.loads(json.dumps(DEMO)); home["household_ref"] = "Smoke Home"
        cid = c.post("/api/cases", json=home).json()["id"]
        r = c.post(f"/api/cases/{cid}/next-month")
        assert r.status_code == 201, r.text
        nid = r.json()["id"]
        new = c.get(f"/api/cases/{nid}").json()
        assert new["period"] == {"start": "2026-10-01", "end": "2026-10-31"}, new["period"]
        assert new["records"] == [] and len(new["rules"]) == 2, "rules copied, records not"
        assert c.post(f"/api/cases/{cid}/next-month").status_code == 409, "duplicate month must 409"
        months = [h for h in c.get("/api/tracker").json()["households"]
                  if h["household_ref"] == "Smoke Home"][0]["months"]
        assert [m["period"]["start"] for m in months] == ["2026-10-01", "2026-09-01"], months
        rice = [m for m in months if m["period"]["start"] == "2026-09-01"][0]["items"][0]
        assert (rice["expected"], rice["received"], rice["remaining"], rice["percent_used"]) ==             ("20", "14", "6", "70.0"), rice
        for case_id in (cid, nid):
            assert c.delete(f"/api/cases/{case_id}").status_code == 204


def email_endpoint():
    """If email is configured on the server we do NOT send (it would go to a fake address)."""
    configured = httpx.get(f"{BASE}/api/health", timeout=30).json()["email"] == "configured"
    assert ACCOUNT, "auth check did not complete"
    with httpx.Client(base_url=BASE, timeout=30) as c:
        assert c.post("/api/auth/login", json=ACCOUNT).status_code == 200
        cid = c.post("/api/cases", json=DEMO).json()["id"]
        rid = c.post(f"/api/cases/{cid}/reports").json()["report_id"]
        bad = c.post(f"/api/reports/{rid}/email", json={"lang": "en", "to": "x@y.co"})
        assert bad.status_code == 422, "request must not accept a recipient"
        if configured:
            print("       (email IS configured: skipped sending to the smoke account)")
        else:
            r = c.post(f"/api/reports/{rid}/email", json={"lang": "en"})
            assert r.status_code == 503, r.text
            assert r.json() == {"error": {"code": "EMAIL_NOT_CONFIGURED"}}, r.text
        assert c.delete(f"/api/cases/{cid}").status_code == 204


def grievance_notes():
    """Needs the auth check to have run (reuses its account)."""
    assert ACCOUNT, "auth check did not complete"
    note = {"portal_key": "cpgrams", "reference_no": "ABC123", "filed_on": "2026-10-03",
            "status": "filed", "note": "Smoke test note"}
    with httpx.Client(base_url=BASE, timeout=30) as c:
        assert c.post("/api/auth/login", json=ACCOUNT).status_code == 200
        cid = c.post("/api/cases", json=DEMO).json()["id"]
        base = f"/api/cases/{cid}/grievances"
        r = c.post(base, json=note)
        assert r.status_code == 201, r.text
        gid = r.json()["id"]
        assert c.post(base, json={**note, "status": "bogus"}).status_code == 422
        assert [n["id"] for n in c.get(base).json()] == [gid]
        r = c.put(f"{base}/{gid}", json={**note, "status": "resolved"})
        assert r.status_code == 200 and r.json()["status"] == "resolved", r.text
        assert httpx.get(f"{BASE}{base}", timeout=30).status_code == 401, "must need login"
        assert c.delete(f"{base}/{gid}").status_code == 204
        assert c.get(base).json() == []
        assert c.delete(f"/api/cases/{cid}").status_code == 204


check("GET  /api/health", health)
check("POST /api/calculate (demo: rice 20-14=6 shortfall, wheat 10-10=0)", calculate_demo)
check("POST /api/calculate rejects 1.2345 kg (never rounds)", calculate_rejects_rounding)
check("auth: signup -> me -> logout -> 401 -> login (HttpOnly, SameSite=Lax cookie)", auth_flow)
check("cases: save -> load -> report -> public frozen link -> other user gets 404 -> delete", cases_and_reports)
check("POST /api/receipt/parse (English + Hindi/Devanagari digits, date resolved by period)", receipt_parse)
check("GET  /api/shops/nearby is an honest placeholder (no invented shops)", shops_placeholder)
check("tracker + next-month: rules copied, records not, 409 on repeat, numbers match", tracker_and_next_month)
check("email report: no recipient field accepted; 503 when no provider key", email_endpoint)
check("grievance notes: create -> list -> update -> delete, login required", grievance_notes)
check("auth: wrong credentials -> 401 INVALID_CREDENTIALS", auth_rejects_bad_login)
check("security: foreign Origin on POST -> 403 BAD_ORIGIN", csrf_blocked)

for name, ok, msg in results:
    print(f"[{'PASS' if ok else 'FAIL'}] {name}" + (f"\n       {msg}" if msg else ""))
failed = [r for r in results if not r[1]]
print(f"\n{len(results) - len(failed)}/{len(results)} checks passed against {BASE}")
sys.exit(1 if failed else 0)
