import hashlib

import pytest
from fastapi.testclient import TestClient

from app.db.models import AuthAttempt, User, UserSession
from app.db.session import SessionLocal
from app.main import app

PW = "correct-horse-battery"


@pytest.fixture
def client():
    with TestClient(app, raise_server_exceptions=False) as c:
        yield c


def signup(client, email="a@example.com", password=PW, **extra):
    return client.post("/api/auth/signup", json={"email": email, "password": password, **extra})


def login(client, email="a@example.com", password=PW):
    return client.post("/api/auth/login", json={"email": email, "password": password})


def test_signup_me_logout_me(client):
    r = signup(client, display_name="  Asha ")
    assert r.status_code == 201
    user = r.json()["user"]
    assert user["email"] == "a@example.com" and user["display_name"] == "Asha"
    assert "password" not in r.text and "hash" not in r.text

    assert client.get("/api/auth/me").json()["user"]["id"] == user["id"]
    assert client.post("/api/auth/logout").status_code == 204
    r = client.get("/api/auth/me")
    assert r.status_code == 401
    assert r.json() == {"error": {"code": "UNAUTHENTICATED"}}


def test_email_is_trimmed_and_lowercased(client):
    assert signup(client, email="  Asha@Example.COM ").json()["user"]["email"] == "asha@example.com"
    client.post("/api/auth/logout")
    assert login(client, email="ASHA@example.com").status_code == 200


def test_login_works_after_signup(client):
    signup(client)
    client.post("/api/auth/logout")
    r = login(client)
    assert r.status_code == 200
    assert client.get("/api/auth/me").status_code == 200


def test_duplicate_email_409(client):
    signup(client)
    r = signup(client)
    assert r.status_code == 409
    assert r.json() == {"error": {"code": "EMAIL_UNAVAILABLE"}}


def test_wrong_password_and_unknown_email_identical(client):
    signup(client)
    client.post("/api/auth/logout")
    wrong = login(client, password="wrong-password-123")
    unknown = login(client, email="nobody@example.com")
    assert wrong.status_code == unknown.status_code == 401
    assert wrong.json() == unknown.json() == {"error": {"code": "INVALID_CREDENTIALS"}}
    assert wrong.headers.get("set-cookie") is None


def test_sixth_failed_login_is_rate_limited(client):
    signup(client)
    client.post("/api/auth/logout")
    for _ in range(5):
        assert login(client, password="wrong-password-123").status_code == 401
    r = login(client, password="wrong-password-123")
    assert r.status_code == 429
    assert int(r.headers["Retry-After"]) > 0
    body = r.json()["error"]
    assert body["code"] == "RATE_LIMITED" and body["retry_after_s"] > 0
    # even the right password is blocked while locked out
    assert login(client).status_code == 429


def test_successful_login_clears_failures(client):
    signup(client)
    client.post("/api/auth/logout")
    for _ in range(4):
        login(client, password="wrong-password-123")
    assert login(client).status_code == 200
    client.post("/api/auth/logout")
    for _ in range(4):
        assert login(client, password="wrong-password-123").status_code == 401


def test_signup_rate_limit_per_ip(client):
    for i in range(5):
        assert signup(client, email=f"u{i}@example.com").status_code == 201
    r = signup(client, email="u6@example.com")
    assert r.status_code == 429 and "Retry-After" in r.headers


def test_cookie_flags(client):
    cookie = signup(client).headers["set-cookie"].lower()
    assert "rs_session=" in cookie
    assert "httponly" in cookie
    assert "samesite=lax" in cookie
    assert "path=/" in cookie
    assert "max-age=604800" in cookie
    assert "secure" not in cookie          # COOKIE_SECURE=false in tests


def test_db_stores_hashes_not_secrets(client):
    r = signup(client)
    token = client.cookies.get("rs_session")
    assert token
    with SessionLocal() as db:
        user = db.query(User).one()
        assert user.password_hash.startswith("$argon2id$")
        assert PW not in user.password_hash
        sess = db.query(UserSession).one()
        assert sess.token_hash == hashlib.sha256(token.encode()).hexdigest()
        assert sess.token_hash != token
    assert r.status_code == 201


def test_logout_deletes_session_row(client):
    signup(client)
    client.post("/api/auth/logout")
    with SessionLocal() as db:
        assert db.query(UserSession).count() == 0


def test_new_session_every_login(client):
    signup(client)
    t1 = client.cookies.get("rs_session")
    client.post("/api/auth/logout")
    login(client)
    assert client.cookies.get("rs_session") != t1


def test_expired_session_rejected(client):
    from datetime import timedelta
    from app.auth.sessions import now
    signup(client)
    with SessionLocal() as db:
        s = db.query(UserSession).one()
        s.expires_at = now() - timedelta(seconds=1)
        db.commit()
    assert client.get("/api/auth/me").status_code == 401


def test_forged_cookie_rejected(client):
    client.cookies.set("rs_session", "not-a-real-token")
    assert client.get("/api/auth/me").status_code == 401


@pytest.mark.parametrize("password,code", [
    ("short", "PASSWORD_TOO_SHORT"),
    ("x" * 129, "PASSWORD_TOO_LONG"),
    ("password1234", "PASSWORD_TOO_COMMON"),
    ("PASSWORD1234", "PASSWORD_TOO_COMMON"),
])
def test_password_rules(client, password, code):
    r = signup(client, password=password)
    assert r.status_code == 422
    assert r.json()["error"] == {"code": "VALIDATION_FAILED", "fields": {"password": code}}


def test_password_equal_to_email_rejected(client):
    r = signup(client, email="someone.long@example.com", password="someone.long@example.com")
    assert r.json()["error"]["fields"]["password"] == "PASSWORD_TOO_COMMON"


def test_any_characters_allowed_in_password(client):
    assert signup(client, password="पासवर्ड ✓ with spaces!").status_code == 201


@pytest.mark.parametrize("email", ["nope", "a@", "@b.com", "a b@c.com", "x" * 250 + "@a.com"])
def test_email_invalid(client, email):
    r = signup(client, email=email)
    assert r.status_code == 422
    assert r.json()["error"]["fields"]["email"] == "EMAIL_INVALID"


def test_name_too_long(client):
    r = signup(client, display_name="n" * 51)
    assert r.json()["error"]["fields"]["display_name"] == "NAME_TOO_LONG"


def test_signup_unknown_field_rejected(client):
    r = signup(client, is_admin=True)
    assert r.status_code == 422


def test_auth_attempts_store_email_hash_not_email(client):
    signup(client)
    client.post("/api/auth/logout")
    login(client, password="wrong-password-123")
    with SessionLocal() as db:
        for a in db.query(AuthAttempt):
            assert "@" not in (a.email_hash or "")


def test_seed_style_email_can_log_in(client):
    """Login does no email-format checks (the seeded demo user uses a .test address)."""
    from app.auth.passwords import hash_password
    with SessionLocal() as db:
        db.add(User(email="demo@rationsaathi.test", password_hash=hash_password(PW)))
        db.commit()
    assert login(client, email="demo@rationsaathi.test").status_code == 200
