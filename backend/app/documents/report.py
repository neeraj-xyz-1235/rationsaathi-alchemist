"""Monthly household report: the month's allocation against recorded withdrawals, in exact grams."""
import re
from datetime import datetime

from fastapi import HTTPException
from sqlalchemy.orm import Session

from app.db import models as m
from app.engine.units import from_base, to_base
from app.routers.household import get_household

MONTH = re.compile(r"^\d{4}-(0[1-9]|1[0-2])$")


def label(period: str) -> str:
    return datetime.strptime(period, "%Y-%m").strftime("%B %Y")


def build(db: Session, user: m.User, period: str) -> dict:
    if not MONTH.match(period or ""):
        raise HTTPException(422, "VALIDATION_FAILED")
    h = get_household(db, user)
    alloc = db.get(m.Allocation, (user.id, period))
    if alloc is None:
        raise HTTPException(404, "NOT_FOUND")
    rows = db.query(m.Withdrawal).filter_by(user_id=user.id, period=period).order_by(
        m.Withdrawal.withdrawal_date, m.Withdrawal.created_at).all()
    items = []
    for entry in alloc.data["items"]:
        _, allocated = to_base(entry["allocated_quantity"], "kg")
        taken = sum(w.qty_base for w in rows if w.item == entry["item"] and w.status != "cancelled")
        items.append({"item": entry["item"], "unit": "kg",
                      "allocated": from_base(allocated, "kg"), "withdrawn": from_base(taken, "kg"),
                      "remaining": from_base(max(0, allocated - taken), "kg"),
                      "over_by": from_base(max(0, taken - allocated), "kg")})
    return {
        "period": period, "period_label": label(period),
        "household": {"head_name": h.head_name, "state": h.state, "district": h.district,
                      "members": len(h.members or []) or 1},
        "scheme_name": alloc.data["scheme_name"], "scheme_assumed": alloc.data.get("assumed", False),
        "items": items,
        "withdrawals": [{"date": w.withdrawal_date.isoformat(), "item": w.item,
                         "quantity": from_base(w.qty_base, "kg"), "unit": "kg",
                         "receipt_id": w.receipt_id, "reference": w.reference} for w in rows],
    }
