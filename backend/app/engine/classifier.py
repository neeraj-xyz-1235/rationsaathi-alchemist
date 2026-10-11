"""Fixed-rule labels (plan 3.3). No AI. Each label carries a reason code and record ids."""


def _label(code, reason, record_ids=None):
    return {"code": code, "reason": reason, "record_ids": record_ids or []}


def classify(expected, received, phase, excluded, late_ids, pending_ids):
    labels = []
    if received == expected:
        labels.append(_label("no_difference", "CONFIRMED_TOTAL_EQUALS_EXPECTED"))
    elif received > expected:
        labels.append(_label("above_expected", "CONFIRMED_TOTAL_ABOVE_EXPECTED"))
    elif phase == "ended":
        labels.append(_label("shortfall", "CONFIRMED_TOTAL_BELOW_EXPECTED"))
    else:
        labels.append(_label("unclear", "PERIOD_NOT_ENDED"))
    bad = [e["record_id"] for e in excluded
           if e["reason"] in ("MISSING_DATE", "OUTSIDE_PERIOD", "UNIT_MISMATCH")]
    if bad:
        labels.append(_label("unclear", "RECORDS_EXCLUDED", bad))
    if late_ids:
        labels.append(_label("late", "RECORDED_AFTER_DUE_BY", late_ids))
    if pending_ids:
        labels.append(_label("unrecorded", "PENDING_NOT_CONFIRMED", pending_ids))
    return labels
