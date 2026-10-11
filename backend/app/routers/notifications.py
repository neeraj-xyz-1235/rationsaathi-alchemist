"""Live notifications, worked out from the account's real data on every request (nothing stored).
Each one is a stable id plus a code and parameters; the frontend writes the sentence in the
user's language. Read/unread is remembered by the browser."""
import calendar
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.auth.deps import current_user
from app.db import models as m
from app.db.session import get_db
from app.engine.units import from_base, to_base
from app.routers.entitlements import _IST, current_period

router = APIRouter(prefix="/api")

LOW_PERCENT = 20          # "running low" at or below this share of the allocation
ENDING_DAYS = 5           # "month ending" in the last N days
RECENT_HOURS = 48


def build(db: Session, user: m.User) -> list[dict]:
    out: list[dict] = []
    h = db.get(m.Household, user.id)
    if h is None:
        return [{"id": "profile-missing", "code": "PROFILE_MISSING", "level": "action", "params": {}}]
    if h.proof_status == "not_submitted":
        out.append({"id": "proof-missing", "code": "PROOF_MISSING", "level": "action", "params": {}})

    period = current_period()
    alloc = db.get(m.Allocation, (user.id, period))
    if alloc is None:
        out.append({"id": f"alloc-missing:{period}", "code": "ALLOCATION_MISSING", "level": "action",
                    "params": {}})
        return out

    rows = db.query(m.Withdrawal).filter_by(user_id=user.id, period=period).filter(
        m.Withdrawal.status != "cancelled").all()
    today = datetime.now(_IST).date()
    days_left = calendar.monthrange(today.year, today.month)[1] - today.day
    total_remaining = 0
    for entry in alloc.data["items"]:
        _, allocated = to_base(entry["allocated_quantity"], "kg")
        taken = sum(w.qty_base for w in rows if w.item == entry["item"])
        remaining = allocated - taken
        total_remaining += max(0, remaining)
        item = entry["item"]
        if remaining <= 0 and taken > 0:
            out.append({"id": f"used:{item}:{period}", "code": "ITEM_FULLY_COLLECTED", "level": "info",
                        "params": {"item": item}})
        elif remaining > 0 and allocated and remaining * 100 <= allocated * LOW_PERCENT:
            out.append({"id": f"low:{item}:{period}", "code": "BALANCE_LOW", "level": "warning",
                        "params": {"item": item, "remaining": from_base(remaining, "kg")}})
    if not rows:
        out.append({"id": f"nothing-yet:{period}", "code": "NO_WITHDRAWALS_YET", "level": "info",
                    "params": {}})
    if days_left <= ENDING_DAYS and total_remaining > 0:
        out.append({"id": f"ending:{period}", "code": "MONTH_ENDING", "level": "warning",
                    "params": {"days": days_left, "remaining": from_base(total_remaining, "kg")}})

    since = datetime.now(timezone.utc) - timedelta(hours=RECENT_HOURS)
    recent = db.query(m.Withdrawal).filter(
        m.Withdrawal.user_id == user.id, m.Withdrawal.created_at >= since).order_by(
        m.Withdrawal.created_at.desc()).limit(3).all()
    for w in recent:
        out.append({"id": f"receipt:{w.receipt_id}", "code": "RECEIPT_RECORDED", "level": "info",
                    "params": {"item": w.item, "quantity": from_base(w.qty_base, "kg"),
                               "receipt_id": w.receipt_id}})
    return out


@router.get("/notifications")
def notifications(user: m.User = Depends(current_user), db: Session = Depends(get_db)):
    return {"notifications": build(db, user)}
