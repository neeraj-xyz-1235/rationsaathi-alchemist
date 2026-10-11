"""Saved cases (plan_backend.txt 2.4). Every route loads the case WHERE id AND user_id = me;
a missing case and someone else's case are both 404, so existence is never revealed."""
from fastapi import APIRouter, Depends, HTTPException, Response
from sqlalchemy.orm import Session

from app.auth.deps import current_user
from app.auth.sessions import as_utc, now
from app.db import mapping
from app.db import models as m
from app.db.session import get_db
from app.engine.tracker import household_key, next_period, shift_month
from app.errors import error_response
from app.schemas import Case, CaseCreated, CaseSummary, Period

router = APIRouter(prefix="/api/cases")


def _iso(dt) -> str:
    return as_utc(dt).strftime("%Y-%m-%dT%H:%M:%SZ")


def get_owned_case(db: Session, raw_id: str, user: m.User) -> m.Case:
    cid = mapping.parse_id(raw_id)
    row = db.query(m.Case).filter_by(id=cid, user_id=user.id).first() if cid else None
    if row is None:
        raise HTTPException(404, "NOT_FOUND")
    return row


@router.get("", response_model=list[CaseSummary])
def list_cases(user: m.User = Depends(current_user), db: Session = Depends(get_db)):
    rows = db.query(m.Case).filter_by(user_id=user.id).order_by(
        m.Case.updated_at.desc(), m.Case.period_start.desc()).all()
    return [{"id": str(c.id), "household_ref": c.household_ref,
             "period": {"start": c.period_start, "end": c.period_end},
             "updated_at": _iso(c.updated_at)} for c in rows]


@router.post("", status_code=201, response_model=CaseCreated)
def create_case(body: Case, user: m.User = Depends(current_user), db: Session = Depends(get_db)):
    row = mapping.create_case(db, user.id, body)    # owner = session user, never the body
    db.commit()
    return {"id": str(row.id)}


@router.get("/{case_id}", response_model=Case)
def get_case(case_id: str, user: m.User = Depends(current_user), db: Session = Depends(get_db)):
    return mapping.to_schema(db, get_owned_case(db, case_id, user))


@router.put("/{case_id}", response_model=Case)
def replace_case(case_id: str, body: Case, user: m.User = Depends(current_user),
                 db: Session = Depends(get_db)):
    row = get_owned_case(db, case_id, user)
    try:
        row.household_ref, row.members = body.household_ref, body.members
        row.period_start, row.period_end = body.period.start, body.period.end
        row.updated_at = now()
        # one transaction; records reference rules, so delete records first, insert rules first
        db.query(m.DistributionRecord).filter_by(case_id=row.id).delete()
        db.query(m.EntitlementRule).filter_by(case_id=row.id).delete()
        db.flush()
        mapping.insert_rules_and_records(db, row.id, body)
        db.commit()
    except Exception:
        db.rollback()
        raise
    return mapping.to_schema(db, row)


@router.post("/{case_id}/next-month", status_code=201, response_model=CaseCreated)
def next_month(case_id: str, user: m.User = Depends(current_user), db: Session = Depends(get_db)):
    """Copies household_ref, members and rules into a NEW case for the following month.
    Records are NOT copied and unused ration is NOT carried over (golden rule 3)."""
    row = get_owned_case(db, case_id, user)
    case = mapping.to_schema(db, row)
    try:
        start, end = next_period(case.period.start, case.period.end)
        rules = [r.model_copy(update={"due_by": shift_month(r.due_by) if r.due_by else None})
                 for r in case.rules]
    except (ValueError, OverflowError):
        return error_response(422, "VALIDATION_FAILED", fields={"period": "DATE_OUT_OF_RANGE"})
    ref = household_key(row.household_ref)
    for other in db.query(m.Case).filter_by(user_id=user.id, period_start=start):
        if household_key(other.household_ref) == ref:
            return error_response(409, "CASE_EXISTS_FOR_PERIOD")
    new = case.model_copy(update={"period": Period(start=start, end=end), "rules": rules,
                                  "records": []})
    created = mapping.create_case(db, user.id, new)
    db.commit()
    return {"id": str(created.id)}


@router.delete("/{case_id}", status_code=204)
def delete_case(case_id: str, user: m.User = Depends(current_user),
                db: Session = Depends(get_db)):
    row = get_owned_case(db, case_id, user)
    db.delete(row)           # the database cascades to rules, records and reports
    db.commit()
    return Response(status_code=204)
