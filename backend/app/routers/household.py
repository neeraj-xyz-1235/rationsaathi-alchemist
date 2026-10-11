"""Household profile (one per account). The setup page saves it; proof upload and entitlements
build on it. Saving changed card details clears any earlier proof result, because that result
described the old details."""
import hashlib

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from sqlalchemy.orm import Session

from app.auth import rate_limit as rl
from app.auth.deps import current_user
from app.auth.sessions import as_utc, now
from app.config import settings
from app.db import models as m
from app.db.session import get_db
from app.proof import verify
from app.proof.vision import VisionUnavailable, transcribe
from app.schemas import HouseholdProfileIn

router = APIRouter(prefix="/api/household")

# changing any of these invalidates a previous proof check
_PROOF_FIELDS = ("head_name", "state", "card_type", "card_colour", "card_number_last4")


def household_size(h: m.Household) -> int:
    return max(1, len(h.members or []))


def profile_out(h: m.Household) -> dict:
    return {"profile": {
        "head_name": h.head_name, "head_age": h.head_age, "head_gender": h.head_gender,
        "state": h.state, "district": h.district, "locality": h.locality,
        "card_type": h.card_type, "card_colour": h.card_colour,
        "card_number_last4": h.card_number_last4,
        "members": h.members, "household_member_count": household_size(h),
        "is_complete": True,
        "proof_status": h.proof_status, "proof_result": h.proof_result,
        "updated_at": as_utc(h.updated_at).strftime("%Y-%m-%dT%H:%M:%SZ") if h.updated_at else None,
    }}


def get_household(db: Session, user: m.User) -> m.Household:
    h = db.get(m.Household, user.id)
    if h is None:
        raise HTTPException(404, "NOT_FOUND")
    return h


def _members(body: HouseholdProfileIn) -> list[dict]:
    members = [x.model_dump() for x in body.members]
    if not members:     # the head alone is a household of one
        members = [{"name": body.head_name, "age": body.head_age,
                    "gender": body.head_gender, "relationship": "head"}]
    return members


def _save(body: HouseholdProfileIn, user: m.User, db: Session) -> dict:
    data = body.model_dump(exclude={"members", "household_member_count"})
    data["members"] = _members(body)
    h = db.get(m.Household, user.id)
    if h is None:
        h = m.Household(user_id=user.id, proof_status="not_submitted",
                        created_at=now(), updated_at=now(), **data)
        db.add(h)
    else:
        changed = any(getattr(h, f) != data[f] for f in _PROOF_FIELDS)
        for field, value in data.items():
            setattr(h, field, value)
        if changed:
            h.proof_status, h.proof_result, h.proof_sha256 = "not_submitted", None, None
        h.updated_at = now()
    db.commit()
    db.refresh(h)
    return profile_out(h)


@router.get("/profile")
def read_profile(user: m.User = Depends(current_user), db: Session = Depends(get_db)):
    return profile_out(get_household(db, user))


@router.put("/profile")
def put_profile(body: HouseholdProfileIn, user: m.User = Depends(current_user),
                db: Session = Depends(get_db)):
    return _save(body, user, db)


@router.post("/profile")
def post_profile(body: HouseholdProfileIn, user: m.User = Depends(current_user),
                 db: Session = Depends(get_db)):
    return _save(body, user, db)


# ── Proof upload ─────────────────────────────────────────

MAX_PROOF_BYTES = 8 * 1024 * 1024


def _sniff(data: bytes) -> str | None:
    """Trust the file's own bytes, not the name or the declared type."""
    if data.startswith(b"\xff\xd8\xff"):
        return "image/jpeg"
    if data.startswith(b"\x89PNG\r\n\x1a\n"):
        return "image/png"
    if data[:4] == b"RIFF" and data[8:12] == b"WEBP":
        return "image/webp"
    if data.startswith(b"%PDF-"):
        return "application/pdf"
    return None


@router.post("/proof")
async def upload_proof(file: UploadFile = File(...), document_type: str = Form(""),
                       user: m.User = Depends(current_user), db: Session = Depends(get_db)):
    h = get_household(db, user)               # profile first: 404 -> the page sends them to step 1
    wait = rl.proof_user_limiter.hit(str(user.id))
    if wait:
        raise rl.too_many(wait)
    data = await file.read(MAX_PROOF_BYTES + 1)
    if not data:
        raise HTTPException(422, "FILE_EMPTY")
    if len(data) > MAX_PROOF_BYTES:
        raise HTTPException(413, "PAYLOAD_TOO_LARGE")
    mime = _sniff(data)
    if mime is None:
        raise HTTPException(422, "FILE_TYPE_NOT_ALLOWED")

    digest = hashlib.sha256(data).hexdigest()
    duplicate = db.query(m.Household).filter(
        m.Household.proof_sha256 == digest, m.Household.user_id != user.id).first() is not None

    if mime == "application/pdf":
        status, result = "needs_review", {"checked_by": "none", "reason": "PDF_NOT_READ", "checks": {}}
    else:
        try:
            status, result = verify.decide(
                transcribe(data, mime), head_name=h.head_name, state=h.state,
                card_type=h.card_type, last4=h.card_number_last4)
        except VisionUnavailable:
            status, result = "needs_review", {"checked_by": "none", "reason": "AI_UNAVAILABLE",
                                              "checks": {}}
    if duplicate and status == "verified":    # the same file on another account is not proof
        status = "needs_review"
        result = {**result, "reason": "DUPLICATE_PROOF"}

    if settings.PROOF_AUTO_ACCEPT and status != "verified":
        result = {**result, "ai_status": status, "auto_accepted": True}
        status = "verified"
    h.proof_status, h.proof_result, h.proof_sha256 = status, result, digest
    h.updated_at = now()
    db.commit()                                # only the result and a hash are kept, never the file
    db.refresh(h)
    return profile_out(h)
