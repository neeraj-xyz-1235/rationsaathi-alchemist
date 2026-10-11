"""API Case <-> database rows (plan_db_schema.txt section 3).
Quantities go through engine/units.py in both directions; there is no second converter."""
import uuid

from sqlalchemy.orm import Session

from app.auth.sessions import now

from app.engine.units import from_base, to_base
from app.schemas import Case, Evidence, Quantity, Record, Rule, Period

from . import models as m

# distribution_records.unit is NOT NULL, but a pending record may have no quantity yet.
# The placeholder is never read back (qty_base is NULL, so quantity comes out as None).
_PLACEHOLDER_UNIT = "kg"


def parse_id(raw: str) -> uuid.UUID | None:
    try:
        return uuid.UUID(raw)
    except (ValueError, AttributeError, TypeError):
        return None


def insert_rules_and_records(db: Session, case_id: uuid.UUID, case: Case) -> None:
    """Rules first, then records (the composite foreign key needs that order)."""
    units = {r.id: r.quantity.unit for r in case.rules}
    for i, r in enumerate(case.rules):
        _, base = to_base(r.quantity.value, r.quantity.unit)
        db.add(m.EntitlementRule(case_id=case_id, id=r.id, position=i, item=r.item,
                                 basis=r.basis, qty_base=base, unit=r.quantity.unit,
                                 due_by=r.due_by))
    db.flush()
    for i, rec in enumerate(case.records):
        if rec.quantity is not None:
            base, unit = to_base(rec.quantity.value, rec.quantity.unit)[1], rec.quantity.unit
        else:
            base, unit = None, units.get(rec.rule_id, _PLACEHOLDER_UNIT)
        e = rec.evidence
        db.add(m.DistributionRecord(
            case_id=case_id, id=rec.id, position=i, rule_id=rec.rule_id, item=rec.item,
            qty_base=base, unit=unit, received_on=rec.date, status=rec.status,
            entry_method=rec.entry_method, receipt_ref=e.receipt_ref, note=e.note,
            no_receipt=e.no_receipt, receipt_text=e.receipt_text,
            extraction={"proof_photo": True} if e.proof_photo else None))
    db.flush()


def create_case(db: Session, user_id: uuid.UUID, case: Case) -> m.Case:
    """Insert a case + its rules + records. The owner always comes from the session."""
    row = m.Case(user_id=user_id, household_ref=case.household_ref, members=case.members,
                 period_start=case.period.start, period_end=case.period.end,
                 created_at=now(), updated_at=now())
    db.add(row)
    db.flush()
    insert_rules_and_records(db, row.id, case)
    return row


def to_schema(db: Session, row: m.Case) -> Case:
    rules = db.query(m.EntitlementRule).filter_by(case_id=row.id).order_by(
        m.EntitlementRule.position).all()
    records = db.query(m.DistributionRecord).filter_by(case_id=row.id).order_by(
        m.DistributionRecord.position).all()
    return Case(
        household_ref=row.household_ref,
        members=row.members,
        period=Period(start=row.period_start, end=row.period_end),
        rules=[Rule(id=r.id, item=r.item, basis=r.basis,
                    quantity=Quantity(value=from_base(r.qty_base, r.unit), unit=r.unit),
                    due_by=r.due_by) for r in rules],
        records=[Record(
            id=r.id, rule_id=r.rule_id, item=r.item,
            quantity=(Quantity(value=from_base(r.qty_base, r.unit), unit=r.unit)
                      if r.qty_base is not None else None),
            date=r.received_on, status=r.status, entry_method=r.entry_method,
            evidence=Evidence(receipt_ref=r.receipt_ref, note=r.note,
                              no_receipt=r.no_receipt, receipt_text=r.receipt_text,
                              proof_photo=bool((r.extraction or {}).get("proof_photo"))),
        ) for r in records],
    )
