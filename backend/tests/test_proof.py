import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.proof import verify
from app.proof.vision import Transcription, VisionUnavailable
from tests.test_household import PW, profile

JPEG = b"\xff\xd8\xff\xe0" + b"0" * 200
PNG = b"\x89PNG\r\n\x1a\n" + b"0" * 200


def card(**over):
    base = dict(is_ration_card=True, card_category_text="Priority Household",
                state="Maharashtra", head_name="Sita Devi", card_number_last4=None)
    base.update(over)
    return Transcription(**base)


def decide(t, **over):
    args = dict(head_name="Sita Devi", state="Maharashtra", card_type="PHH", last4=None)
    args.update(over)
    return verify.decide(t, **args)


# ── rules (no network, no AI) ────────────────────────────

def test_matching_card_is_verified():
    status, res = decide(card())
    assert status == "verified" and res["reason"] == "MATCHED"
    assert res["checks"]["category"] == "match"


def test_not_a_card_is_never_rejected():
    status, res = decide(card(is_ration_card=False))
    assert status == "needs_review" and res["reason"] == "NOT_A_RATION_CARD"


def test_name_mismatch_needs_review():
    status, res = decide(card(head_name="Someone Else"))
    assert status == "needs_review" and res["checks"]["name"] == "mismatch"


def test_partial_name_and_spelling_tolerated():
    assert decide(card(head_name="SITA DEVI PATIL"))[0] == "verified"
    assert decide(card(head_name="Seeta Devi"))[0] == "verified"


def test_state_mismatch_needs_review():
    assert decide(card(state="Gujarat"))[0] == "needs_review"


def test_category_contradiction_needs_review():
    status, res = decide(card(card_category_text="Antyodaya Anna Yojana"))
    assert status == "needs_review" and res["checks"]["category"] == "mismatch"


def test_unreadable_category_does_not_block():
    assert decide(card(card_category_text=None))[0] == "verified"


def test_unreadable_name_or_state_needs_review():
    assert decide(card(head_name=None))[0] == "needs_review"
    assert decide(card(state=None))[0] == "needs_review"


def test_last4_match_and_mismatch():
    assert decide(card(card_number_last4="1234"), last4="1234")[0] == "verified"
    assert decide(card(card_number_last4="9999"), last4="1234")[0] == "needs_review"


def test_result_holds_no_card_contents():
    _, res = decide(card(card_number_last4="1234"), last4="1234")
    assert "Sita" not in str(res) and "1234" not in str(res)


# ── upload route ─────────────────────────────────────────

@pytest.fixture
def user():
    with TestClient(app, raise_server_exceptions=False) as c:
        assert c.post("/api/auth/signup", json={"email": "p@example.com", "password": PW}
                      ).status_code == 201
        assert c.put("/api/household/profile", json=profile()).status_code == 200
        yield c


def upload(c, data=JPEG, name="card.jpg", ctype="image/jpeg"):
    return c.post("/api/household/proof", files={"file": (name, data, ctype)},
                  data={"document_type": "ration_card_or_eligibility_proof"})


def fake_ai(monkeypatch, result):
    def _t(image, mime):
        if isinstance(result, Exception):
            raise result
        return result
    monkeypatch.setattr("app.routers.household.transcribe", _t)


def test_upload_requires_login_and_profile():
    with TestClient(app, raise_server_exceptions=False) as c:
        assert upload(c).status_code == 401
        c.post("/api/auth/signup", json={"email": "n@example.com", "password": PW})
        assert upload(c).status_code == 404          # no profile yet


def test_verified_upload(user, monkeypatch):
    fake_ai(monkeypatch, card())
    r = upload(user)
    assert r.status_code == 200
    p = r.json()["profile"]
    assert p["proof_status"] == "verified"
    assert user.get("/api/household/profile").json()["profile"]["proof_status"] == "verified"


def test_png_accepted(user, monkeypatch):
    fake_ai(monkeypatch, card())
    assert upload(user, PNG, "c.png", "image/png").json()["profile"]["proof_status"] == "verified"


def test_not_a_card_goes_to_review(user, monkeypatch):
    fake_ai(monkeypatch, card(is_ration_card=False))
    p = upload(user).json()["profile"]
    assert p["proof_status"] == "needs_review"
    assert p["proof_result"]["reason"] == "NOT_A_RATION_CARD"


def test_ai_down_goes_to_review(user, monkeypatch):
    fake_ai(monkeypatch, VisionUnavailable("down"))
    p = upload(user).json()["profile"]
    assert p["proof_status"] == "needs_review"
    assert p["proof_result"]["reason"] == "AI_UNAVAILABLE"


def test_not_configured_goes_to_review(user):
    p = upload(user).json()["profile"]          # tests run with no vision model set
    assert p["proof_status"] == "needs_review"


def test_pdf_goes_to_review_without_ai(user, monkeypatch):
    fake_ai(monkeypatch, AssertionError("must not be called"))
    p = upload(user, b"%PDF-1.4 " + b"0" * 100, "c.pdf", "application/pdf").json()["profile"]
    assert p["proof_status"] == "needs_review" and p["proof_result"]["reason"] == "PDF_NOT_READ"


def test_wrong_file_type_rejected_by_content_not_name(user):
    r = upload(user, b"MZ\x90\x00 not an image", "card.jpg", "image/jpeg")
    assert r.status_code == 422
    assert r.json()["error"]["code"] == "VALIDATION_FAILED" or r.status_code == 422


def test_empty_file_rejected(user):
    assert upload(user, b"").status_code == 422


def test_too_big_rejected(user):
    assert upload(user, JPEG + b"0" * (8 * 1024 * 1024)).status_code == 413


def test_far_too_big_rejected_by_middleware(user):
    assert upload(user, JPEG + b"0" * (10 * 1024 * 1024)).status_code == 413


def test_multipart_not_allowed_elsewhere(user):
    r = user.post("/api/household/profile", files={"file": ("a.jpg", JPEG, "image/jpeg")})
    assert r.status_code == 415


def test_changing_card_after_verification_resets(user, monkeypatch):
    fake_ai(monkeypatch, card())
    upload(user)
    user.put("/api/household/profile", json=profile(state="Gujarat"))
    assert user.get("/api/household/profile").json()["profile"]["proof_status"] == "not_submitted"


def test_same_file_on_another_account_needs_review(user, monkeypatch):
    fake_ai(monkeypatch, card())
    assert upload(user).json()["profile"]["proof_status"] == "verified"
    with TestClient(app, raise_server_exceptions=False) as other:
        other.post("/api/auth/signup", json={"email": "q@example.com", "password": PW})
        other.put("/api/household/profile", json=profile())
        p = upload(other).json()["profile"]
    assert p["proof_status"] == "needs_review" and p["proof_result"]["reason"] == "DUPLICATE_PROOF"


def test_upload_rate_limited(user, monkeypatch):
    fake_ai(monkeypatch, card())
    codes = [upload(user, JPEG + bytes([i])).status_code for i in range(11)]
    assert codes[:10] == [200] * 10 and codes[10] == 429


# ── the vision call itself (fake provider, no network) ───

def _provider(monkeypatch, handler):
    import httpx
    from app.config import settings
    from app.proof import vision
    monkeypatch.setattr(settings, "LLM_BASE_URL", "https://llm.test/v1")
    monkeypatch.setattr(settings, "LLM_VISION_MODEL", "vision-x")
    monkeypatch.setattr(settings, "LLM_API_KEY", "secret")
    monkeypatch.setattr(vision, "_client", lambda: httpx.Client(transport=httpx.MockTransport(handler)))


def test_vision_request_and_reply(monkeypatch):
    import json
    from app.proof import vision
    seen = {}

    def handler(request):
        import httpx
        seen["url"], seen["auth"] = str(request.url), request.headers["authorization"]
        seen["body"] = json.loads(request.content)
        reply = {"is_ration_card": True, "card_category_text": "PHH", "state": "Maharashtra",
                 "head_name": "Sita Devi", "card_number_last4": "1234"}
        return httpx.Response(200, json={"choices": [{"message": {"content": json.dumps(reply)}}]})

    _provider(monkeypatch, handler)
    t = vision.transcribe(JPEG, "image/jpeg")
    assert t.head_name == "Sita Devi" and t.card_number_last4 == "1234"
    assert seen["url"] == "https://llm.test/v1/chat/completions"
    assert seen["auth"] == "Bearer secret"
    assert seen["body"]["model"] == "vision-x"
    image = seen["body"]["messages"][1]["content"][1]["image_url"]["url"]
    assert image.startswith("data:image/jpeg;base64,")


@pytest.mark.parametrize("make", [
    lambda httpx: httpx.Response(500, text="boom"),
    lambda httpx: httpx.Response(200, text="not json"),
    lambda httpx: httpx.Response(200, json={"choices": [{"message": {"content": "{}"}}]}),
])
def test_vision_failures_become_unavailable(monkeypatch, make):
    import httpx
    from app.proof import vision
    _provider(monkeypatch, lambda request: make(httpx))
    with pytest.raises(VisionUnavailable):
        vision.transcribe(JPEG, "image/jpeg")


# ── hackathon switch: accept everything ──────────────────

def test_auto_accept_verifies_anything_valid(user, monkeypatch):
    from app.config import settings
    monkeypatch.setattr(settings, "PROOF_AUTO_ACCEPT", True)
    fake_ai(monkeypatch, card(is_ration_card=False))
    p = upload(user).json()["profile"]
    assert p["proof_status"] == "verified"
    assert p["proof_result"]["auto_accepted"] is True
    assert p["proof_result"]["ai_status"] == "needs_review"      # the real outcome is kept
    assert p["proof_result"]["reason"] == "NOT_A_RATION_CARD"


def test_auto_accept_covers_ai_down_and_pdf(user, monkeypatch):
    from app.config import settings
    monkeypatch.setattr(settings, "PROOF_AUTO_ACCEPT", True)
    assert upload(user).json()["profile"]["proof_status"] == "verified"      # no AI configured
    pdf = upload(user, b"%PDF-1.4 " + b"0" * 100, "c.pdf", "application/pdf")
    assert pdf.json()["profile"]["proof_status"] == "verified"


def test_auto_accept_still_refuses_bad_files(user, monkeypatch):
    from app.config import settings
    monkeypatch.setattr(settings, "PROOF_AUTO_ACCEPT", True)
    assert upload(user, b"MZ\x90\x00 not an image", "card.jpg", "image/jpeg").status_code == 422
    assert upload(user, b"").status_code == 422


def test_auto_accept_unsticks_older_review_rows(user, monkeypatch):
    from app.config import settings
    from app.db import models as m
    from app.db.session import SessionLocal
    with SessionLocal() as db:
        h = db.query(m.Household).one()
        h.proof_status = "needs_review"
        db.commit()
    assert user.get("/api/household/profile").json()["profile"]["proof_status"] == "needs_review"
    monkeypatch.setattr(settings, "PROOF_AUTO_ACCEPT", True)
    assert user.get("/api/household/profile").json()["profile"]["proof_status"] == "verified"


# ── tolerant reading of model replies ────────────────────

def _reply(monkeypatch, content, statuses=None, seen=None):
    import json as _json
    import httpx
    calls = iter(statuses or [200])

    def handler(request):
        if seen is not None:
            seen.append(_json.loads(request.content))
        code = next(calls, 200)
        if code != 200:
            return httpx.Response(code, json={"error": {"message": "model does not support image input"}})
        return httpx.Response(200, json={"choices": [{"message": {"content": content}}]})

    _provider(monkeypatch, handler)


def test_think_blocks_and_code_fences_are_stripped(monkeypatch):
    from app.proof import vision
    _reply(monkeypatch, '<think>hmm, let me look...</think>\n```json\n'
                        '{"is_receipt": true, "item_text": "Wheat", "quantity_text": "2"}\n```')
    r = vision.read_receipt(JPEG, "image/jpeg")
    assert r.item_text == "Wheat" and r.quantity_text == "2"


def test_alternative_key_names_are_accepted(monkeypatch):
    from app.proof import vision
    _reply(monkeypatch, '{"item": "Wheat", "issued_qty": 2, "unit": "kg", "issue_date": "11 Oct 2026", '
                        '"receipt_no": "RS-1"}')
    r = vision.read_receipt(JPEG, "image/jpeg")
    assert (r.item_text, r.quantity_text, r.unit_text, r.date_text, r.receipt_ref) == \
        ("Wheat", "2", "kg", "11 Oct 2026", "RS-1")
    assert r.is_receipt is True


def test_json_mode_rejected_retries_without_it(monkeypatch):
    from app.proof import vision
    seen = []
    _reply(monkeypatch, '{"is_receipt": true, "item_text": "Rice"}', statuses=[400, 200], seen=seen)
    assert vision.read_receipt(JPEG, "image/jpeg").item_text == "Rice"
    assert "response_format" in seen[0] and "response_format" not in seen[1]


def test_provider_error_is_logged_without_user_data(monkeypatch, caplog):
    from app.proof import vision
    _reply(monkeypatch, "{}", statuses=[404])
    with caplog.at_level("WARNING"), pytest.raises(VisionUnavailable):
        vision.read_receipt(JPEG, "image/jpeg")
    assert "HTTP 404" in caplog.text and "does not support image input" in caplog.text
    assert "secret" not in caplog.text                      # the API key never appears


def test_health_reports_vision_setting(monkeypatch):
    from app.config import settings
    with TestClient(app) as c:
        assert c.get("/api/health").json()["vision"] == "not_configured"
        monkeypatch.setattr(settings, "LLM_BASE_URL", "https://x/v1")
        monkeypatch.setattr(settings, "LLM_VISION_MODEL", "m")
        assert c.get("/api/health").json()["vision"] == "configured"
