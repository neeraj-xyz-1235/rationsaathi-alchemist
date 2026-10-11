"""Monthly allocation. Computed from the household's verified card category and size by the
fixed rules in app/entitlements/rules.py; the frontend never works out a quantity."""
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.auth.deps import current_user
from app.db import models as m
from app.db.session import get_db
from app.entitlements.rules import compute
from app.routers.household import effective_proof_status, get_household, household_size

router = APIRouter(prefix="/api/entitlements")

_IST = timezone(timedelta(hours=5, minutes=30))


def current_period() -> str:
    return datetime.now(_IST).strftime("%Y-%m")


def period_label(period: str) -> str:
    return datetime.strptime(period, "%Y-%m").strftime("%B %Y")


def _out(period: str, data: dict) -> dict:
    return {"allocation": {"period": period, "month": period, "period_label": period_label(period),
                           "status": "Allocation available", **data}}


@router.get("/current")
def current(user: m.User = Depends(current_user), db: Session = Depends(get_db)):
    row = db.get(m.Allocation, (user.id, current_period()))
    if row is None:
        raise HTTPException(404, "NOT_FOUND")
    return _out(row.period, row.data)


@router.post("/allocate")
def allocate(user: m.User = Depends(current_user), db: Session = Depends(get_db)):
    h = get_household(db, user)
    if effective_proof_status(h) != "verified":
        raise HTTPException(409, "PROOF_NOT_VERIFIED")
    period = current_period()
    data = compute(h.card_type, household_size(h))
    row = db.get(m.Allocation, (user.id, period))
    if row is None:
        db.add(m.Allocation(user_id=user.id, period=period, data=data))
    else:
        row.data = data
    db.commit()
    return _out(period, data)
