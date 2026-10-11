from datetime import date
from .units import to_base, from_base
from .balance import balance

def calculate(case, today: date | None = None) -> dict:
    today = today or date.today()
    start, end = case.period.start, case.period.end
    phase = "ended" if today > end else "ongoing"
    items, matched_ids = [], set()

    for rule in case.rules:
        dim, per_unit = to_base(rule.quantity.value, rule.quantity.unit)
        expected = case.members * per_unit if rule.basis == "per_member" else per_unit
        terms, excluded, late_ids, pending_ids = [], [], [], []
        total = 0

        for r in case.records:
            if r.rule_id != rule.id:
                continue
            matched_ids.add(r.id)
            if r.status == "pending":
                excluded.append({"record_id": r.id, "reason": "PENDING_NOT_CONFIRMED"})
                pending_ids.append(r.id); continue
            if r.date is None or r.quantity is None:
                excluded.append({"record_id": r.id, "reason": "MISSING_DATE"}); continue
            if not (start <= r.date <= end):
                excluded.append({"record_id": r.id, "reason": "OUTSIDE_PERIOD"}); continue
            rdim, base = to_base(r.quantity.value, r.quantity.unit)
            if rdim != dim:
                excluded.append({"record_id": r.id, "reason": "UNIT_MISMATCH"}); continue
            total += base
            terms.append({"record_id": r.id, "value": from_base(base, rule.quantity.unit)})
            if rule.due_by and r.date > rule.due_by:
                late_ids.append(r.id)

        diff = expected - total
        labels = classify(expected, total, phase, excluded, late_ids, pending_ids)
        items.append({
            "rule_id": rule.id, "item": rule.item, "unit": rule.quantity.unit,
            "expected": {"value": from_base(expected, rule.quantity.unit),
                         "basis": rule.basis, "members": case.members,
                         "per_unit": rule.quantity.value},
            "received": {"value": from_base(total, rule.quantity.unit), "terms": terms},
            "difference": {"value": from_base(diff, rule.quantity.unit),
                           "direction": "below" if diff > 0 else "above" if diff < 0 else "equal"},
            "balance": balance(expected, total, rule.quantity.unit, phase),
            "excluded": excluded, "labels": labels,
        })

    unmatched = [{"record_id": r.id, "reason": "NO_RULE_FOR_ITEM"}
                 for r in case.records if r.rule_id is None]
    # also add evidence_summary, generated_at, period, members (see plan 2.2)
    return {"items": items, "unmatched": unmatched, ...}