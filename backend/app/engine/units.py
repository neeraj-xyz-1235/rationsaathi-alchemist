from decimal import Decimal, InvalidOperation

UNITS = {"kg": ("mass", 1000), "g": ("mass", 1),
         "l": ("volume", 1000), "ml": ("volume", 1),
         "pcs": ("count", 1)}

class UnitError(ValueError):
    pass

def to_base(value: str, unit: str) -> tuple[str, int]:
    if unit not in UNITS:
        raise UnitError("UNIT_UNKNOWN")
    try:
        d = Decimal(value)
    except InvalidOperation:
        raise UnitError("QUANTITY_INVALID")
    if not d.is_finite() or d < 0:
        raise UnitError("QUANTITY_INVALID")
    dim, factor = UNITS[unit]
    base = d * factor
    if base != base.to_integral_value():
        raise UnitError("TOO_PRECISE")        # never round
    return dim, int(base)

def from_base(base: int, unit: str) -> str:
    s = format(Decimal(base) / UNITS[unit][1], "f")
    return s.rstrip("0").rstrip(".") if "." in s else s