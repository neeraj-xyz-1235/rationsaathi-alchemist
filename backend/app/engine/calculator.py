"""expected / received / difference per rule (plan 3.1-3.3). Pure Python, no AI, no floats."""
from datetime import date, datetime, timezone

from .balance import balance
from .classifier import classify
from .units import from_base, to_base


def _evidence_summary(records) -> dict:
    s = {"records": len(records), "with_receipt_ref": 0, "with_receipt_text": 0,
         "no_receipt": 0, "no_evidence": 0}
    for r in records:
        e = r.evidence
        s["with_receipt_ref"] += bool(e.receipt_ref)
        s["with_receipt_text"] += bool(e.receipt_text)
        s["no_receipt"] += bool(e.no_receipt)
        if not (e.receipt_ref or e.receipt_text or e.note or e.no_receipt):
            s["no_evidence"] += 1
    return s


def calculate(case, today: date | None = None) -> dict:
    today = today or date.today()
    start, end = case.period.start, case.period.end
    phase = "ended" if today > end else "ongoing"
    items = []

    for rule in case.rules:
        unit = rule.quantity.unit
        dim, per_unit = to_base(rule.quantity.value, unit)
        expected = case.members * per_unit if rule.basis == "per_member" else per_unit
        terms, excluded, late_ids, pending_ids = [], [], [], []
        total = 0

        for r in case.records:
            if r.rule_id != rule.id:
                continue
            if r.status == "pending":
                excluded.append({"record_id": r.id, "reason": "PENDING_NOT_CONFIRMED"})
                pending_ids.append(r.id)
                continue
            if r.date is None or r.quantity is None:
                excluded.append({"record_id": r.id, "reason": "MISSING_DATE"})
                continue
            if not (start <= r.date <= end):
                excluded.append({"record_id": r.id, "reason": "OUTSIDE_PERIOD"})
                continue
            rdim, base = to_base(r.quantity.value, r.quantity.unit)
            if rdim != dim:
                excluded.append({"record_id": r.id, "reason": "UNIT_MISMATCH"})
                continue
            total += base
            terms.append({"record_id": r.id, "value": from_base(base, unit)})
            if rule.due_by and r.date > rule.due_by:
                late_ids.append(r.id)

        diff = expected - total
        items.append({
            "rule_id": rule.id, "item": rule.item, "unit": unit,
            "expected": {"value": from_base(expected, unit), "basis": rule.basis,
                         "members": case.members, "per_unit": rule.quantity.value},
            "received": {"value": from_base(total, unit), "terms": terms},
            "difference": {"value": from_base(diff, unit),
                           "direction": "below" if diff > 0 else "above" if diff < 0 else "equal"},
            "balance": balance(expected, total, unit, phase),
            "excluded": excluded,
            "labels": classify(expected, total, phase, excluded, late_ids, pending_ids),
        })

    return {
        "generated_at": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
        "period": {"start": start.isoformat(), "end": end.isoformat(), "status": phase},
        "members": case.members,
        "items": items,
        "unmatched": [{"record_id": r.id, "reason": "NO_RULE_FOR_ITEM"}
                      for r in case.records if r.rule_id is None],
        "evidence_summary": _evidence_summary(case.records),
    }
