def classify(expected, received, phase, excluded, late_ids, pending_ids):
    labels = []
    if received == expected:
        labels.append({"code": "no_difference", "reason": "CONFIRMED_TOTAL_EQUALS_EXPECTED", "record_ids": []})
    elif received > expected:
        labels.append({"code": "above_expected", "reason": "CONFIRMED_TOTAL_ABOVE_EXPECTED", "record_ids": []})
    elif phase == "ended":
        labels.append({"code": "shortfall", "reason": "CONFIRMED_TOTAL_BELOW_EXPECTED", "record_ids": []})
    else:
        labels.append({"code": "unclear", "reason": "PERIOD_NOT_ENDED", "record_ids": []})
    bad = [e["record_id"] for e in excluded
           if e["reason"] in ("MISSING_DATE", "OUTSIDE_PERIOD", "UNIT_MISMATCH")]
    if bad:
        labels.append({"code": "unclear", "reason": "RECORDS_EXCLUDED", "record_ids": bad})
    if late_ids:
        labels.append({"code": "late", "reason": "RECORDED_AFTER_DUE_BY", "record_ids": late_ids})
    if pending_ids:
        labels.append({"code": "unrecorded", "reason": "PENDING_NOT_CONFIRMED", "record_ids": pending_ids})
    return labels