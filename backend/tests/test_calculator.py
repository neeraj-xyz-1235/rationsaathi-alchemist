from datetime import date

import pytest
from pydantic import ValidationError

from app.engine.calculator import calculate
from app.schemas import Case
from tests.conftest import make_case, make_record, rice_rule

ENDED = date(2026, 10, 11)      # after the Sep 2026 period
RUNNING = date(2026, 9, 15)


def run(case_dict, today=ENDED):
    return calculate(Case.model_validate(case_dict), today=today)


def codes(item):
    return [(l["code"], l["reason"]) for l in item["labels"]]


def test_demo_case(demo):
    res = run(demo)
    rice, wheat = res["items"]
    assert rice["expected"] == {"value": "20", "basis": "per_member", "members": 4, "per_unit": "5"}
    assert rice["received"]["value"] == "14"
    assert rice["received"]["terms"] == [{"record_id": "d1", "value": "8"},
                                         {"record_id": "d2", "value": "6"}]
    assert rice["difference"] == {"value": "6", "direction": "below"}
    assert rice["balance"] == {"remaining": "6", "over_by": "0", "percent_used": "70.0",
                               "phase": "ended"}
    assert codes(rice) == [("shortfall", "CONFIRMED_TOTAL_BELOW_EXPECTED")]
    assert wheat["expected"]["value"] == "10"
    assert wheat["difference"] == {"value": "0", "direction": "equal"}
    assert codes(wheat) == [("no_difference", "CONFIRMED_TOTAL_EQUALS_EXPECTED")]
    assert res["period"]["status"] == "ended"
    assert res["unmatched"] == []
    assert res["evidence_summary"] == {"records": 3, "with_receipt_ref": 2,
                                       "with_receipt_text": 1, "with_proof_photo": 0,
                                       "no_receipt": 1,
                                       "no_evidence": 0}


def test_decimals_exact():
    case = make_case([rice_rule("2.5")], [make_record("a", "r", "10", "kg", "2026-09-02")])
    assert run(case)["items"][0]["expected"]["value"] == "10"


def test_float_trap_sum():
    recs = [make_record("a", "r", "0.1", "kg", "2026-09-02"),
            make_record("b", "r", "0.2", "kg", "2026-09-03")]
    res = run(make_case([rice_rule("0.075")], recs))     # 4 x 0.075 = 0.3
    item = res["items"][0]
    assert item["received"]["value"] == "0.3"
    assert item["difference"]["value"] == "0"


def test_mixed_units():
    recs = [make_record("a", "r", "500", "g", "2026-09-02"),
            make_record("b", "r", "1.5", "kg", "2026-09-03")]
    assert run(make_case([rice_rule()], recs))["items"][0]["received"]["value"] == "2"


def test_above_expected_negative_difference():
    recs = [make_record("a", "r", "22", "kg", "2026-09-02")]
    item = run(make_case([rice_rule()], recs))["items"][0]
    assert item["difference"] == {"value": "-2", "direction": "above"}
    assert item["balance"]["over_by"] == "2"
    assert item["balance"]["percent_used"] == "110.0"
    assert codes(item) == [("above_expected", "CONFIRMED_TOTAL_ABOVE_EXPECTED")]


def test_pending_not_counted_and_unrecorded():
    recs = [make_record("a", "r", "8", "kg", "2026-09-02"),
            make_record("p", "r", "5", "kg", "2026-09-03", status="pending")]
    item = run(make_case([rice_rule()], recs))["items"][0]
    assert item["received"]["value"] == "8"
    assert {"record_id": "p", "reason": "PENDING_NOT_CONFIRMED"} in item["excluded"]
    assert ("unrecorded", "PENDING_NOT_CONFIRMED") in codes(item)


def test_pending_without_quantity_is_ok():
    recs = [make_record("p", "r", None, "kg", None, status="pending")]
    item = run(make_case([rice_rule()], recs))["items"][0]
    assert item["received"]["value"] == "0"
    assert ("unrecorded", "PENDING_NOT_CONFIRMED") in codes(item)


def test_outside_period_excluded_and_unclear():
    recs = [make_record("a", "r", "8", "kg", "2026-10-02")]
    item = run(make_case([rice_rule()], recs))["items"][0]
    assert item["received"]["value"] == "0"
    assert item["excluded"] == [{"record_id": "a", "reason": "OUTSIDE_PERIOD"}]
    assert ("unclear", "RECORDS_EXCLUDED") in codes(item)


def test_period_boundaries_inclusive():
    recs = [make_record("a", "r", "1", "kg", "2026-09-01"),
            make_record("b", "r", "1", "kg", "2026-09-30")]
    assert run(make_case([rice_rule()], recs))["items"][0]["received"]["value"] == "2"


def test_missing_date_excluded_and_unclear():
    recs = [make_record("a", "r", "8", "kg", None)]
    item = run(make_case([rice_rule()], recs))["items"][0]
    assert item["excluded"] == [{"record_id": "a", "reason": "MISSING_DATE"}]
    assert ("unclear", "RECORDS_EXCLUDED") in codes(item)


def test_record_without_rule_is_unmatched():
    recs = [make_record("s", None, "1", "kg", "2026-09-12", item="Sugar")]
    res = run(make_case([rice_rule()], recs))
    assert res["unmatched"] == [{"record_id": "s", "reason": "NO_RULE_FOR_ITEM"}]
    assert res["items"][0]["received"]["value"] == "0"


def test_unit_mismatch_excluded():
    recs = [make_record("a", "r", "2", "l", "2026-09-02")]
    item = run(make_case([rice_rule()], recs))["items"][0]
    assert item["excluded"] == [{"record_id": "a", "reason": "UNIT_MISMATCH"}]
    assert ("unclear", "RECORDS_EXCLUDED") in codes(item)


def test_per_household_ignores_members():
    case = make_case([rice_rule("5", basis="per_household")], [], members=9)
    item = run(case)["items"][0]
    assert item["expected"]["value"] == "5"
    assert item["expected"]["basis"] == "per_household"


def test_running_period_below_is_unclear_not_shortfall():
    recs = [make_record("a", "r", "7", "kg", "2026-09-04")]
    item = run(make_case([rice_rule("5")], recs, members=2), today=RUNNING)["items"][0]
    assert codes(item) == [("unclear", "PERIOD_NOT_ENDED")]
    assert item["balance"] == {"remaining": "3", "over_by": "0", "percent_used": "70.0",
                               "phase": "ongoing"}


def test_last_day_of_period_is_still_ongoing():
    res = run(make_case([rice_rule()], []), today=date(2026, 9, 30))
    assert res["period"]["status"] == "ongoing"


def test_late_only_with_due_by():
    recs = [make_record("a", "r", "20", "kg", "2026-09-20")]
    late = run(make_case([rice_rule(due_by="2026-09-10")], recs))["items"][0]
    assert ("late", "RECORDED_AFTER_DUE_BY") in codes(late)
    assert [l for l in late["labels"] if l["code"] == "late"][0]["record_ids"] == ["a"]
    none = run(make_case([rice_rule()], recs))["items"][0]
    assert "late" not in [c for c, _ in codes(none)]
    on_time = run(make_case([rice_rule(due_by="2026-09-20")], recs))["items"][0]
    assert "late" not in [c for c, _ in codes(on_time)]


def test_no_evidence_counted():
    rec = make_record("a", "r", "1", "kg", "2026-09-02",
                      evidence={"receipt_ref": None, "note": None, "no_receipt": False,
                                "receipt_text": None})
    assert run(make_case([rice_rule()], [rec]))["evidence_summary"]["no_evidence"] == 1


def test_proof_photo_counts_as_evidence():
    rec = make_record("a", "r", "1", "kg", "2026-09-02",
                      evidence={"receipt_ref": None, "note": None, "no_receipt": False,
                                "receipt_text": None, "proof_photo": True})
    summary = run(make_case([rice_rule()], [rec]))["evidence_summary"]
    assert summary["with_proof_photo"] == 1
    assert summary["no_evidence"] == 0


# ── validation (never rounded, never guessed) ────────────

def test_too_precise_quantity_rejected():
    case = make_case([rice_rule("1.2345")], [])
    with pytest.raises(ValidationError, match="TOO_PRECISE"):
        Case.model_validate(case)


def test_zero_quantity_rejected():
    with pytest.raises(ValidationError, match="QUANTITY_NOT_POSITIVE"):
        Case.model_validate(make_case([rice_rule("0")], []))


def test_unknown_rule_id_rejected():
    recs = [make_record("a", "nope", "1", "kg", "2026-09-02")]
    with pytest.raises(ValidationError, match="UNKNOWN_RULE_ID"):
        Case.model_validate(make_case([rice_rule()], recs))


def test_confirmed_record_needs_quantity():
    recs = [make_record("a", "r", None, "kg", "2026-09-02")]
    with pytest.raises(ValidationError, match="QUANTITY_REQUIRED_WHEN_CONFIRMED"):
        Case.model_validate(make_case([rice_rule()], recs))


def test_period_order_rejected():
    with pytest.raises(ValidationError, match="PERIOD_END_BEFORE_START"):
        Case.model_validate(make_case([], [], start="2026-09-30", end="2026-09-01"))


def test_unknown_field_rejected(demo):
    demo["surprise"] = 1
    with pytest.raises(ValidationError):
        Case.model_validate(demo)


def test_no_floats_in_engine():
    import pathlib
    for f in pathlib.Path("app/engine").glob("*.py"):
        assert "float(" not in f.read_text("utf-8"), f

