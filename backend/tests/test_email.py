import copy
import json
import re
import uuid
from datetime import timedelta
from pathlib import Path

import httpx
import pytest
from fastapi.testclient import TestClient

from app.auth.sessions import now
from app.config import settings
from app.db.models import EmailLog, User
from app.db.session import SessionLocal
from app.email import render, sender
from app.email.strings import LANGS
from app.main import app

PW = "correct-horse-battery"

# the same list the CI "neutral-language" job greps for (plan_deployment.txt section 4)
BANNED = re.compile(
    r"fraud|theft|\bsteal|\bstole|cheat|scam|corrupt|embezzl|illegal|black.?market|guilty|"
    r"धोखा|चोरी|घोटाला|घोटाळा|भ्रष्ट|गबन|ठगी|अवैध|फसवणूक|अपहार|बेकायदेशीर", re.I)


def new_user(email):
    c = TestClient(app, raise_server_exceptions=False)
    c.__enter__()
    assert c.post("/api/auth/signup", json={"email": email, "password": PW}).status_code == 201
    return c


@pytest.fixture
def alice():
    c = new_user("sunita@gmail.com")
    yield c
    c.__exit__(None, None, None)


@pytest.fixture
def bob():
    c = new_user("bob@example.com")
    yield c
    c.__exit__(None, None, None)


@pytest.fixture
def anon():
    with TestClient(app, raise_server_exceptions=False) as c:
        yield c


@pytest.fixture
def mail(monkeypatch):
    """Email is 'configured' and the provider is faked. mail.sent holds what would be sent."""
    monkeypatch.setattr(settings, "EMAIL_API_KEY", "key-123")
    monkeypatch.setattr(settings, "EMAIL_FROM", "RationSaathi <noreply@example.org>")
    box = type("Box", (), {})()
    box.sent, box.fail = [], None

    def fake_send(to, subject, html, text):
        if box.fail:
            raise sender.EmailSendError(box.fail)
        box.sent.append({"to": to, "subject": subject, "html": html, "text": text})

    monkeypatch.setattr(sender, "send", fake_send)
    return box


def make_report(client, case):
    cid = client.post("/api/cases", json=case).json()["id"]
    r = client.post(f"/api/cases/{cid}/reports")
    assert r.status_code == 201, r.text
    return cid, r.json()["report_id"]


def email(client, rid, lang="en", **extra):
    return client.post(f"/api/reports/{rid}/email", json={"lang": lang, **extra})


# ── endpoint behaviour ───────────────────────────────────

def test_sends_to_account_email_only(alice, mail, demo):
    _, rid = make_report(alice, demo)
    r = email(alice, rid)
    assert r.status_code == 202
    assert r.json() == {"status": "queued", "sent_to": "s***@gmail.com"}
    assert [m["to"] for m in mail.sent] == ["sunita@gmail.com"]


def test_request_cannot_choose_recipient_subject_or_body(alice, mail, demo):
    _, rid = make_report(alice, demo)
    for extra in ({"to": "victim@example.com"}, {"subject": "hi"}, {"body": "x"}, {"cc": "a@b.co"}):
        assert email(alice, rid, **extra).status_code == 422
    assert mail.sent == []


def test_requires_login(anon, mail):
    assert email(anon, str(uuid.uuid4())).status_code == 401


def test_other_users_report_is_404(alice, bob, mail, demo):
    _, rid = make_report(alice, demo)
    r = email(bob, rid)
    assert r.status_code == 404 and r.json() == {"error": {"code": "NOT_FOUND"}}
    assert email(bob, str(uuid.uuid4())).status_code == 404
    assert email(bob, "nope").status_code == 404
    assert mail.sent == []


def test_not_configured_is_503(alice, demo, monkeypatch):
    monkeypatch.setattr(settings, "EMAIL_API_KEY", "")
    _, rid = make_report(alice, demo)
    r = email(alice, rid)
    assert r.status_code == 503 and r.json() == {"error": {"code": "EMAIL_NOT_CONFIGURED"}}
    with SessionLocal() as db:
        assert db.query(EmailLog).count() == 0
    assert alice.get("/api/health").json()["email"] == "not_configured"


def test_health_shows_configured(alice, mail):
    assert alice.get("/api/health").json()["email"] == "configured"


def test_invalid_language_rejected(alice, mail, demo):
    _, rid = make_report(alice, demo)
    assert email(alice, rid, lang="fr").status_code == 422
    assert alice.post(f"/api/reports/{rid}/email", json={}).status_code == 422


def test_fourth_send_within_an_hour_is_429(alice, mail, demo):
    _, rid = make_report(alice, demo)
    assert [email(alice, rid).status_code for _ in range(3)] == [202, 202, 202]
    r = email(alice, rid)
    assert r.status_code == 429
    assert int(r.headers["Retry-After"]) > 0
    assert r.json()["error"]["code"] == "RATE_LIMITED" and r.json()["error"]["retry_after_s"] > 0
    assert len(mail.sent) == 3


def test_failed_attempts_count_too(alice, mail, demo):
    _, rid = make_report(alice, demo)
    mail.fail = "HTTP_500"
    for _ in range(3):
        assert email(alice, rid).status_code == 202
    assert email(alice, rid).status_code == 429


def _log_rows(db, user_id, n, age):
    for _ in range(n):
        db.add(EmailLog(user_id=user_id, kind="report", status="sent", created_at=now() - age))
    db.commit()


def test_daily_limit_of_10(alice, mail, demo):
    _, rid = make_report(alice, demo)
    with SessionLocal() as db:
        uid = db.query(User).one().id
        _log_rows(db, uid, 10, timedelta(hours=5))          # outside the hourly window
    r = email(alice, rid)
    assert r.status_code == 429 and int(r.headers["Retry-After"]) > 3600


def test_old_attempts_do_not_count(alice, mail, demo):
    _, rid = make_report(alice, demo)
    with SessionLocal() as db:
        uid = db.query(User).one().id
        _log_rows(db, uid, 5, timedelta(hours=30))
    assert email(alice, rid).status_code == 202


def test_app_wide_limit_of_30_per_hour(alice, bob, mail, demo):
    _, rid = make_report(alice, demo)
    with SessionLocal() as db:
        other = db.query(User).filter_by(email="bob@example.com").one().id
        _log_rows(db, other, 30, timedelta(minutes=10))
    assert email(alice, rid).status_code == 429


def test_one_users_limit_does_not_block_another(alice, bob, mail, demo):
    _, ra = make_report(alice, demo)
    _, rb = make_report(bob, demo)
    for _ in range(3):
        email(alice, ra)
    assert email(alice, ra).status_code == 429
    assert email(bob, rb).status_code == 202


def test_log_records_status_never_body_or_recipient(alice, mail, demo):
    _, rid = make_report(alice, demo)
    email(alice, rid)
    mail.fail = "TIMEOUT"
    email(alice, rid)
    with SessionLocal() as db:
        rows = db.query(EmailLog).order_by(EmailLog.id).all()
        assert [(r.status, r.error_code) for r in rows] == [("sent", None), ("failed", "TIMEOUT")]
        assert {c.name for c in EmailLog.__table__.columns} == {
            "id", "user_id", "report_id", "kind", "status", "error_code", "created_at"}


def test_email_is_built_from_the_frozen_snapshot(alice, mail, demo):
    cid, rid = make_report(alice, demo)
    edited = copy.deepcopy(demo)
    edited["records"] = []
    alice.put(f"/api/cases/{cid}", json=edited)
    email(alice, rid)
    assert "14 kg" in mail.sent[0]["text"]                # still the original records


def test_content_demo_report(alice, mail, demo):
    _, rid = make_report(alice, demo)
    email(alice, rid)
    m = mail.sent[0]
    assert m["subject"] == "Your RationSaathi report: 1 Sep 2026 – 30 Sep 2026"
    t = m["text"]
    assert "Expected: 20 kg" in t and "Received (confirmed): 14 kg" in t and "Remaining: 6 kg" in t
    assert ("Confirmed records for Rice total 14 kg against an expected entitlement of 20 kg "
            "for 1 Sep 2026 – 30 Sep 2026, a difference of 6 kg. "
            "The reason for this difference has not been established.") in t
    assert "matches the expected entitlement of 10 kg" in t              # wheat
    assert "6 kg of the 20 kg entitlement for Rice was not recorded as collected" in t
    assert f"http://localhost:5173/r/{rid}" in t and f"http://localhost:5173/r/{rid}" in m["html"]
    assert "Anyone with this link can view the report." in t
    assert "is not a government service" in t and "is not a government service" in m["html"]
    assert "Whether unused ration can be collected later" in t


def test_html_has_no_remote_resources_or_tracking(alice, mail, demo):
    _, rid = make_report(alice, demo)
    email(alice, rid)
    html = mail.sent[0]["html"]
    for bad in ("<img", "<script", "<iframe", "<link", "src=", "url(http", "@import"):
        assert bad not in html.lower()
    assert re.findall(r'href="([^"]+)"', html) == [f"http://localhost:5173/r/{rid}"]


def test_script_in_item_name_is_escaped(alice, mail, demo):
    demo["rules"][0]["item"] = "<script>alert(1)</script> & Co"
    demo["records"][0]["item"] = "x"
    _, rid = make_report(alice, demo)
    email(alice, rid)
    html, text = mail.sent[0]["html"], mail.sent[0]["text"]
    assert "<script>" not in html
    assert "&lt;script&gt;alert(1)&lt;/script&gt; &amp; Co" in html
    assert "<script>alert(1)</script> & Co" in text        # plain text is not HTML-escaped


def test_quote_in_item_cannot_break_out_of_attributes(alice, mail, demo):
    demo["rules"][0]["item"] = '"><b onmouseover=x>'
    _, rid = make_report(alice, demo)
    email(alice, rid)
    assert "<b onmouseover" not in mail.sent[0]["html"]


@pytest.mark.parametrize("lang", LANGS)
def test_every_language_renders_and_is_neutral(alice, mail, demo, lang):
    _, rid = make_report(alice, demo)
    assert email(alice, rid, lang=lang).status_code == 202
    m = mail.sent[0]
    for part in (m["subject"], m["html"], m["text"]):
        assert not BANNED.search(part), BANNED.search(part)
    assert "{" not in m["text"] and "}" not in m["text"]            # no unfilled placeholder
    assert "20 kg" in m["text"] and "14 kg" in m["text"]
    if lang != "en":
        assert re.search(r"[ऀ-ॿ]", m["text"])
        assert "Sep" not in m["subject"]                           # month names are localised


def render_result(result, lang="en"):
    return render.build(result, lang, "http://localhost:5173/r/x")


def sample_result(**over):
    from app.engine.calculator import calculate
    from app.schemas import Case
    from tests.conftest import make_case, make_record, rice_rule
    from datetime import date
    case = make_case([rice_rule("5")], over.pop("records", []), members=over.pop("members", 4),
                     start=over.pop("start", "2026-09-01"), end=over.pop("end", "2026-09-30"))
    return calculate(Case.model_validate(case), today=over.pop("today", date(2026, 10, 11)))


@pytest.mark.parametrize("lang", LANGS)
def test_all_sentence_kinds_are_neutral(lang):
    from datetime import date
    from tests.conftest import make_record
    shortfall = sample_result(records=[make_record("a", "r", "8", "kg", "2026-09-03")])
    equal = sample_result(records=[make_record("a", "r", "20", "kg", "2026-09-03")])
    above = sample_result(records=[make_record("a", "r", "22", "kg", "2026-09-03")])
    ongoing = sample_result(records=[make_record("a", "r", "7", "kg", "2026-09-04")],
                            members=2, today=date(2026, 9, 15))
    mixed = sample_result(records=[make_record("a", "r", "8", "kg", "2026-10-03"),
                                   make_record("u", None, "1", "kg", "2026-09-03", item="Sugar")])
    for res in (shortfall, equal, above, ongoing, mixed):
        subject, html, text = render_result(res, lang)
        for part in (subject, html, text):
            assert not BANNED.search(part)
            assert "{" not in part


def test_ongoing_uses_the_so_far_wording_and_balance():
    from datetime import date
    from tests.conftest import make_record
    res = sample_result(records=[make_record("a", "r", "7", "kg", "2026-09-04")],
                        members=2, today=date(2026, 9, 15))
    _, _, text = render_result(res)
    assert "So far, confirmed records for Rice total 7 kg of an expected 10 kg." in text
    assert "3 kg of your 10 kg for Rice is still to be collected this period (70.0% recorded so far)." in text
    assert "shortfall" not in text.lower()


def test_above_expected_and_full_balance_wording():
    from tests.conftest import make_record
    above = sample_result(records=[make_record("a", "r", "22", "kg", "2026-09-03")])
    _, _, text = render_result(above)
    assert "which is 2 kg more than the expected entitlement of 20 kg" in text
    assert "2 kg more than the entitlement has been recorded for Rice." in text
    equal = sample_result(records=[make_record("a", "r", "20", "kg", "2026-09-03")])
    assert "The full 20 kg for Rice has been recorded." in render_result(equal)[2]


def test_excluded_and_unmatched_records_are_mentioned():
    from tests.conftest import make_record
    res = sample_result(records=[make_record("a", "r", "8", "kg", "2026-10-03"),
                                 make_record("u", None, "1", "kg", "2026-09-03", item="Sugar")])
    text = render_result(res)[2]
    assert "1 record(s) for Rice were not included in the total." in text
    assert "1 record(s) had no entitlement rule entered" in text


def test_mask_email():
    assert render.mask_email("sunita@gmail.com") == "s***@gmail.com"
    assert render.mask_email("a@b.co") == "a***@b.co"


# ── provider payloads (fake HTTP server) ─────────────────

@pytest.fixture
def provider(monkeypatch):
    monkeypatch.setattr(settings, "EMAIL_API_KEY", "key-123")
    monkeypatch.setattr(settings, "EMAIL_FROM", "RationSaathi <noreply@example.org>")
    state = {"seen": [], "status": 201}

    def handler(request):
        state["seen"].append(request)
        if state["status"] == "timeout":
            raise httpx.ReadTimeout("slow")
        return httpx.Response(state["status"], json={"message": "SECRET PROVIDER MESSAGE"})

    monkeypatch.setattr(sender, "_client",
                        lambda: httpx.Client(transport=httpx.MockTransport(handler)))
    return state


def test_brevo_request_shape(provider, monkeypatch):
    monkeypatch.setattr(settings, "EMAIL_PROVIDER", "brevo")
    sender.send("a@b.co", "Subj", "<p>h</p>", "t")
    req = provider["seen"][0]
    assert str(req.url) == "https://api.brevo.com/v3/smtp/email"
    assert req.headers["api-key"] == "key-123"
    body = json.loads(req.content)
    assert body == {"sender": {"name": "RationSaathi", "email": "noreply@example.org"},
                    "to": [{"email": "a@b.co"}], "subject": "Subj",
                    "htmlContent": "<p>h</p>", "textContent": "t"}


def test_resend_request_shape(provider, monkeypatch):
    monkeypatch.setattr(settings, "EMAIL_PROVIDER", "resend")
    sender.send("a@b.co", "Subj", "<p>h</p>", "t")
    req = provider["seen"][0]
    assert str(req.url) == "https://api.resend.com/emails"
    assert req.headers["authorization"] == "Bearer key-123"
    body = json.loads(req.content)
    assert body["from"] == "RationSaathi <noreply@example.org>" and body["to"] == ["a@b.co"]


def test_plain_from_address_works(provider, monkeypatch):
    monkeypatch.setattr(settings, "EMAIL_FROM", "noreply@example.org")
    sender.send("a@b.co", "s", "h", "t")
    assert json.loads(provider["seen"][0].content)["sender"]["email"] == "noreply@example.org"


def test_provider_errors_become_short_codes_without_leaking(provider):
    provider["status"] = 401
    with pytest.raises(sender.EmailSendError) as e:
        sender.send("a@b.co", "s", "h", "t")
    assert e.value.code == "HTTP_401" and "SECRET" not in str(e.value)
    provider["status"] = "timeout"
    with pytest.raises(sender.EmailSendError) as e:
        sender.send("a@b.co", "s", "h", "t")
    assert e.value.code == "TIMEOUT"


def test_timeout_is_10_seconds():
    assert sender.TIMEOUT_S == 10.0


def test_endpoint_end_to_end_with_failing_provider(alice, provider, demo):
    provider["status"] = 500
    _, rid = make_report(alice, demo)
    assert email(alice, rid).status_code == 202            # request returns at once
    with SessionLocal() as db:
        row = db.query(EmailLog).one()
        assert (row.status, row.error_code) == ("failed", "HTTP_500")


def test_endpoint_end_to_end_with_working_provider(alice, provider, demo):
    _, rid = make_report(alice, demo)
    assert email(alice, rid, lang="mr").status_code == 202
    body = json.loads(provider["seen"][0].content)
    assert body["to"] == [{"email": "sunita@gmail.com"}]
    assert "RationSaathi" in body["subject"] and "सप्टेंबर" in body["subject"]
    with SessionLocal() as db:
        assert db.query(EmailLog).one().status == "sent"


# ── neutral-language check over the whole backend (mirrors CI) ──

def test_backend_source_has_no_banned_words():
    root = Path(__file__).resolve().parent.parent / "app"
    hits = []
    for f in root.rglob("*"):
        if f.suffix in {".py", ".j2", ".txt"} and f.name != "common_passwords.txt":
            for n, line in enumerate(f.read_text("utf-8").splitlines(), 1):
                if BANNED.search(line):
                    hits.append(f"{f.relative_to(root)}:{n}: {line.strip()[:80]}")
    assert hits == []
