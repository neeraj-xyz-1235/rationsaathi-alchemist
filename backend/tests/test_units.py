import pytest

from app.engine.units import UnitError, from_base, to_base


def test_to_base():
    assert to_base("2.5", "kg") == ("mass", 2500)
    assert to_base("500", "g") == ("mass", 500)
    assert to_base("1.5", "l") == ("volume", 1500)
    assert to_base("3", "pcs") == ("count", 3)
    assert to_base("0.001", "kg") == ("mass", 1)


def test_from_base():
    assert from_base(2500, "kg") == "2.5"
    assert from_base(0, "kg") == "0"
    assert from_base(-2000, "kg") == "-2"
    assert from_base(-500, "kg") == "-0.5"
    assert from_base(1, "kg") == "0.001"
    assert from_base(20000, "kg") == "20"
    assert from_base(7, "pcs") == "7"


def test_never_rounds():
    with pytest.raises(UnitError, match="TOO_PRECISE"):
        to_base("1.2345", "kg")
    with pytest.raises(UnitError, match="TOO_PRECISE"):
        to_base("1.5", "g")          # g must be whole
    with pytest.raises(UnitError, match="TOO_PRECISE"):
        to_base("0.5", "pcs")


def test_trailing_zeros_are_not_rounding():
    assert to_base("1.5000", "kg") == ("mass", 1500)


@pytest.mark.parametrize("bad", ["", "abc", "-1", "1e3", "NaN", "Infinity", "1,5", " ", "1.", ".5"])
def test_invalid_quantities(bad):
    with pytest.raises(UnitError):
        to_base(bad, "kg")


def test_unknown_unit():
    with pytest.raises(UnitError, match="UNIT_UNKNOWN"):
        to_base("1", "lb")


def test_float_trap():
    a, b = to_base("0.1", "kg")[1], to_base("0.2", "kg")[1]
    assert from_base(a + b, "kg") == "0.3"
