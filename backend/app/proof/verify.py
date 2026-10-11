"""Deterministic decision on top of the model's transcription (the AI never decides).

verified      : it is a ration card AND the name and state match what the household entered,
                and nothing on the card contradicts the entered category / last-4.
needs_review  : unreadable, no AI available, or something does not match (a person should look).
rejected      : the image is not a ration card at all."""
import re
import unicodedata
from difflib import SequenceMatcher

from .vision import Transcription

_PHH = ("priority", "phh", "bpl", "below poverty", "priority household")
_AAY = ("antyodaya", "aay", "अंत्योदय")
_PHH_HI = ("प्राधान्य", "प्राथमिकता", "बीपीएल")


def _norm(s: str) -> str:
    s = unicodedata.normalize("NFKD", s).lower()
    s = re.sub(r"[^\w\s]", " ", s)
    return " ".join(s.split())


def names_match(a: str, b: str) -> bool:
    a, b = _norm(a), _norm(b)
    if not a or not b:
        return False
    if a == b:
        return True
    ta, tb = set(a.split()), set(b.split())
    if ta <= tb or tb <= ta:                # "Sita Devi" vs "Sita Devi Patil"
        return True
    return SequenceMatcher(None, a, b).ratio() >= 0.82


def state_matches(a: str, b: str) -> bool:
    a, b = _norm(a), _norm(b)
    return bool(a and b and (a == b or a in b or b in a))


def category_from_text(text: str | None) -> str | None:
    if not text:
        return None
    t = _norm(text)
    if any(k in t for k in _AAY) or any(k in text for k in _AAY):
        return "AAY"
    if any(k in t for k in _PHH) or any(k in text for k in _PHH_HI):
        return "PHH"
    return None


def decide(t: Transcription, *, head_name: str, state: str, card_type: str,
           last4: str | None) -> tuple[str, dict]:
    """Returns (proof_status, result). `result` holds only codes, never the card contents."""
    if not t.is_ration_card:
        return "rejected", {"checked_by": "ai", "reason": "NOT_A_RATION_CARD", "checks": {}}

    checks: dict[str, str] = {}
    checks["name"] = ("unreadable" if not t.head_name else
                      "match" if names_match(t.head_name, head_name) else "mismatch")
    checks["state"] = ("unreadable" if not t.state else
                       "match" if state_matches(t.state, state) else "mismatch")

    read_cat = category_from_text(t.card_category_text)
    if read_cat is None or card_type in ("UNKNOWN", "STATE_OTHER"):
        checks["category"] = "unreadable" if read_cat is None else "match"
    else:
        checks["category"] = "match" if read_cat == card_type else "mismatch"

    if last4 and t.card_number_last4:
        digits = re.sub(r"\D", "", t.card_number_last4)[-4:]
        checks["card_number"] = "match" if digits == last4 else "mismatch"
    else:
        checks["card_number"] = "unreadable" if last4 else "not_provided"

    result = {"checked_by": "ai", "checks": checks, "category_read": read_cat}
    if any(v == "mismatch" for v in checks.values()):
        result["reason"] = "DETAILS_DO_NOT_MATCH"
        return "needs_review", result
    if checks["name"] == "match" and checks["state"] == "match":
        result["reason"] = "MATCHED"
        return "verified", result
    result["reason"] = "CARD_UNREADABLE"
    return "needs_review", result
