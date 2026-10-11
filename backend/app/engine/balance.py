import pytest
from app.engine.units import to_base, from_base, UnitError

def test_to_base():
    assert to_base("2.5", "kg") == ("mass", 2500)

def test_from_base():
    assert from_base(2500, "kg") == "2.5"
    assert from_base(0, "kg") == "0"
    assert from_base(-2000, "kg") == "-2"

def test_never_rounds():
    with pytest.raises(UnitError):
        to_base("1.2345", "kg")