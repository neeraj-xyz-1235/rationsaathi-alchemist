from app.engine.classifier import classify


def codes(labels):
    return [l["code"] for l in labels]


def test_equal():
    assert codes(classify(100, 100, "ended", [], [], [])) == ["no_difference"]


def test_above():
    assert codes(classify(100, 120, "ongoing", [], [], [])) == ["above_expected"]


def test_below_ended_is_shortfall():
    assert codes(classify(100, 50, "ended", [], [], [])) == ["shortfall"]


def test_below_ongoing_is_unclear():
    labels = classify(100, 50, "ongoing", [], [], [])
    assert labels == [{"code": "unclear", "reason": "PERIOD_NOT_ENDED", "record_ids": []}]


def test_pending_exclusion_alone_is_not_unclear():
    excluded = [{"record_id": "p", "reason": "PENDING_NOT_CONFIRMED"}]
    assert codes(classify(100, 100, "ended", excluded, [], ["p"])) == ["no_difference", "unrecorded"]


def test_multiple_labels_carry_record_ids():
    excluded = [{"record_id": "a", "reason": "OUTSIDE_PERIOD"},
                {"record_id": "b", "reason": "MISSING_DATE"}]
    labels = classify(100, 50, "ended", excluded, ["c"], [])
    assert codes(labels) == ["shortfall", "unclear", "late"]
    assert labels[1]["record_ids"] == ["a", "b"]
    assert labels[2]["record_ids"] == ["c"]
