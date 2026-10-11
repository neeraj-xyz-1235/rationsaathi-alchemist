from app.engine.balance import balance


def test_seven_of_ten():
    assert balance(10000, 7000, "kg", "ongoing") == {
        "remaining": "3", "over_by": "0", "percent_used": "70.0", "phase": "ongoing"}


def test_full_and_over():
    assert balance(10000, 10000, "kg", "ended")["percent_used"] == "100.0"
    b = balance(10000, 12000, "kg", "ended")
    assert (b["remaining"], b["over_by"], b["percent_used"]) == ("0", "2", "120.0")


def test_floor_not_round():
    assert balance(3000, 2999, "kg", "ended")["percent_used"] == "99.9"
    assert balance(20000, 1, "kg", "ended")["percent_used"] == "0.0"


def test_zero_received():
    b = balance(5000, 0, "kg", "ongoing")
    assert (b["remaining"], b["percent_used"]) == ("5", "0.0")
