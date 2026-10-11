"""Withdrawals against the month's allocation, server-made receipts, and public receipt check.
The balance is allocation minus recorded withdrawals, in exact integer grams."""
import hashlib
import re
import secrets
import uuid
from datetime import datetime

from fastapi import APIRouter, Depends, File, HTTPException, Query, Request, Response, UploadFile
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.auth import rate_limit as rl
from app.auth.deps import current_user
from app.db import models as m
from app.auth.sessions import now
from app.db import mapping
from app.db.session import get_db
from app.documents import pdf
from app.engine.units import UnitError, from_base, to_base
from app.routers.entitlements import _IST
from app.proof import receipt_check
from app.proof.vision import VisionUnavailable, read_receipt
from app.routers.household import MAX_PROOF_BYTES, _sniff
from app.schemas import WithdrawalIn

router = APIRouter(prefix="/api")

_SAFE = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"        # no 0/O/1/I
_MONTH = re.compile(r"^\d{4}-(0[1-9]|1[0-2])$")


def _code(n: int) -> str:
    return "".join(secrets.choice(_SAFE) for _ in range(n))


def _row_out(w: m.Withdrawal, proof: m.WithdrawalProof | None = None) -> dict:
    return {"proof_status": proof.status if proof else "none", "id": str(w.id), "item": w.item, "quantity": from_base(w.qty_base, "kg"), "unit": "kg",
            "withdrawal_date": w.withdrawal_date.isoformat(), "receipt_id": w.receipt_id,
            "reference": w.reference, "status": w.status}


def _withdrawn(db: Session, user_id, period: str, item: str) -> int:
    total = db.query(func.coalesce(func.sum(m.Withdrawal.qty_base), 0)).filter(
        m.Withdrawal.user_id == user_id, m.Withdrawal.period == period,
        m.Withdrawal.item == item, m.Withdrawal.status != "cancelled").scalar()
    return int(total)


@router.get("/withdrawals")
def list_withdrawals(month: str | None = Query(None), user: m.User = Depends(current_user),
                     db: Session = Depends(get_db)):
    month = month or datetime.now(_IST).strftime("%Y-%m")
    if not _MONTH.match(month):
        raise HTTPException(422, "VALIDATION_FAILED")
    rows = db.query(m.Withdrawal).filter_by(user_id=user.id, period=month).order_by(
        m.Withdrawal.withdrawal_date, m.Withdrawal.created_at).all()
    proofs = {p.withdrawal_id: p for p in db.query(m.WithdrawalProof).filter(
        m.WithdrawalProof.withdrawal_id.in_([w.id for w in rows])).all()} if rows else {}
    return {"items": [_row_out(w, proofs.get(w.id)) for w in rows]}


@router.post("/withdrawals", status_code=201)
def create_withdrawal(body: WithdrawalIn, user: m.User = Depends(current_user),
                      db: Session = Depends(get_db)):
    if body.withdrawal_date > datetime.now(_IST).date():
        raise HTTPException(422, "DATE_IN_FUTURE")
    period = body.withdrawal_date.strftime("%Y-%m")
    alloc = db.get(m.Allocation, (user.id, period))
    if alloc is None:
        raise HTTPException(409, "NO_ALLOCATION")
    entry = next((i for i in alloc.data["items"] if i["item"].lower() == body.item.strip().lower()),
                 None)
    if entry is None:
        raise HTTPException(422, "ITEM_NOT_IN_ALLOCATION")
    try:
        _, qty = to_base(format(body.quantity, "f"), body.unit)
    except UnitError:
        raise HTTPException(422, "QUANTITY_INVALID")
    _, allowed = to_base(entry["allocated_quantity"], "kg")
    if qty > allowed - _withdrawn(db, user.id, period, entry["item"]):
        raise HTTPException(409, "EXCEEDS_BALANCE")

    w = m.Withdrawal(
        id=uuid.uuid4(), user_id=user.id, period=period, item=entry["item"], qty_base=qty,
        withdrawal_date=body.withdrawal_date, reference=body.receipt_reference,
        receipt_id=f"RS-{body.withdrawal_date:%Y%m%d}-{_code(6)}",
        verification_code=_code(10), status="recorded")
    db.add(w)
    db.commit()
    return {"receipt": {**_row_out(w), "verification_code": w.verification_code}}


@router.get("/withdrawals/{withdrawal_id}/receipt.pdf")
def receipt_pdf(withdrawal_id: str, user: m.User = Depends(current_user),
                db: Session = Depends(get_db)):
    wid = mapping.parse_id(withdrawal_id)
    w = db.get(m.Withdrawal, wid) if wid else None
    if w is None or w.user_id != user.id:
        raise HTTPException(404, "NOT_FOUND")
    h = db.get(m.Household, user.id)
    proof = db.get(m.WithdrawalProof, w.id)
    data = pdf.receipt_pdf({**_row_out(w, proof), "verification_code": w.verification_code},
                           {"head_name": h.head_name if h else "-",
                            "state": h.state if h else "-", "district": h.district if h else "-"})
    return Response(data, media_type="application/pdf", headers={
        "Content-Disposition": f'attachment; filename="receipt-{w.receipt_id}.pdf"',
        "Cache-Control": "no-store"})


@router.post("/withdrawals/{withdrawal_id}/proof")
async def upload_receipt_proof(withdrawal_id: str, file: UploadFile = File(...),
                               user: m.User = Depends(current_user), db: Session = Depends(get_db)):
    """A photo of the shop receipt, checked against what was recorded. The photo is not kept."""
    wid = mapping.parse_id(withdrawal_id)
    w = db.get(m.Withdrawal, wid) if wid else None
    if w is None or w.user_id != user.id:
        raise HTTPException(404, "NOT_FOUND")
    wait = rl.receipt_proof_limiter.hit(str(user.id))
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
    reused = db.query(m.WithdrawalProof).filter(
        m.WithdrawalProof.sha256 == digest, m.WithdrawalProof.withdrawal_id != w.id).first() is not None

    if mime == "application/pdf":
        status, result = "unreadable", {"checked_by": "none", "reason": "PDF_NOT_READ", "checks": {}}
    else:
        try:
            status, result = receipt_check.decide(
                read_receipt(data, mime), item=w.item, qty_base=w.qty_base, on=w.withdrawal_date,
                reference=w.reference)
        except VisionUnavailable:
            status, result = "unreadable", {"checked_by": "none", "reason": "AI_UNAVAILABLE", "checks": {}}
    if reused and status == "verified":       # the same photo cannot prove two different withdrawals
        status, result = "unreadable", {**result, "reason": "PHOTO_ALREADY_USED"}

    proof = db.get(m.WithdrawalProof, w.id)
    if proof is None:
        proof = m.WithdrawalProof(withdrawal_id=w.id, status=status, result=result, sha256=digest,
                                  updated_at=now())
        db.add(proof)
    else:
        proof.status, proof.result, proof.sha256, proof.updated_at = status, result, digest, now()
    db.commit()
    return {"proof": {"status": status, "reason": result.get("reason"), "checks": result.get("checks", {})},
            "withdrawal": _row_out(w, proof)}


def _limit_verify(request: Request) -> None:
    wait = rl.verify_ip_limiter.hit(rl.client_ip(request))
    if wait:
        raise rl.too_many(wait)


@router.get("/receipts/verify/{code}", dependencies=[Depends(_limit_verify)])
def verify_receipt(code: str, db: Session = Depends(get_db)):
    """Public: confirms a receipt exists. Shows no account details."""
    code = code.strip().upper()[:40]
    w = db.query(m.Withdrawal).filter((m.Withdrawal.receipt_id == code) |
                                      (m.Withdrawal.verification_code == code)).first()
    if w is None:
        return {"valid": False, "message": "No receipt was issued with this reference or code."}
    proof = db.get(m.WithdrawalProof, w.id)
    return {"valid": True, "status": w.status, "proof_status": proof.status if proof else "none", "item": w.item,
            "quantity": from_base(w.qty_base, "kg"), "unit": "kg",
            "withdrawal_date": w.withdrawal_date.isoformat(), "receipt_id": w.receipt_id,
            "message": f"Receipt {w.receipt_id} is valid: {w.item} "
                       f"{from_base(w.qty_base, 'kg')} kg on {w.withdrawal_date.isoformat()}."}
