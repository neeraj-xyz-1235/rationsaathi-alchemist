"""GET /api/tracker (plan_backend.txt 2.7). Computed on read through the SAME engine as
/api/calculate, so tracker numbers always equal the report's. Nothing extra is stored."""
from typing import Annotated

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.auth.deps import current_user
from app.db import mapping
from app.db import models as m
from app.db.session import get_db
from app.engine.calculator import calculate
from app.engine.tracker import household_key
from app.schemas import TrackerResponse

router = APIRouter(prefix="/api")


def _month(case_row: m.Case, db: Session) -> dict:
    result = calculate(mapping.to_schema(db, case_row))
    items = []
    for it in result["items"]:
        codes = []
        for label in it["labels"]:
            if label["code"] not in codes:
                codes.append(label["code"])
        b = it["balance"]
        items.append({"item": it["item"], "unit": it["unit"],
                      "expected": it["expected"]["value"], "received": it["received"]["value"],
                      "remaining": b["remaining"], "over_by": b["over_by"],
                      "percent_used": b["percent_used"], "labels": codes})
    return {"case_id": str(case_row.id), "period": result["period"], "items": items}


@router.get("/tracker", response_model=TrackerResponse)
def tracker(months: Annotated[int, Query(ge=1, le=24)] = 6,
            user: m.User = Depends(current_user), db: Session = Depends(get_db)):
    rows = db.query(m.Case).filter_by(user_id=user.id).order_by(
        m.Case.period_start.desc(), m.Case.created_at.desc()).all()
    groups: dict[str | None, list[m.Case]] = {}
    for r in rows:
        groups.setdefault(household_key(r.household_ref), []).append(r)
    households = [{"household_ref": ref, "months": [_month(c, db) for c in cases[:months]]}
                  for ref, cases in groups.items()]
    # household with the most recent month first; deterministic tie-break on name
    households.sort(key=lambda h: (h["months"][0]["period"]["start"], h["household_ref"] or ""),
                    reverse=True)
    return {"households": households}
