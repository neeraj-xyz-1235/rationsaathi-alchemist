"""Exact unit handling. Quantities are integers in base units (g, ml, pcs); never floats."""
import re

# unit -> (dimension, base units per 1 of this unit)
UNITS = {"kg": ("mass", 1000), "g": ("mass", 1),
         "l": ("volume", 1000), "ml": ("volume", 1),
         "pcs": ("count", 1)}

_NUMBER = re.compile(r"^\d{1,12}(\.\d{1,12})?$")


class UnitError(ValueError):
    pass


def to_base(value: str, unit: str) -> tuple[str, int]:
    """'2.5','kg' -> ('mass', 2500). Raises UnitError instead of ever rounding."""
    if unit not in UNITS:
        raise UnitError("UNIT_UNKNOWN")
    if not isinstance(value, str) or not _NUMBER.match(value.strip()):
        raise UnitError("QUANTITY_INVALID")
    whole, _, frac = value.strip().partition(".")
    dim, factor = UNITS[unit]
    digits = len(str(factor)) - 1            # kg/l -> 3 decimals, g/ml/pcs -> 0
    if len(frac) > digits and frac[digits:].strip("0"):
        raise UnitError("TOO_PRECISE")       # never round
    frac = frac[:digits].ljust(digits, "0")
    return dim, int(whole) * factor + (int(frac) if frac else 0)


def from_base(base: int, unit: str) -> str:
    """2500,'kg' -> '2.5'. Exact, trailing zeros stripped."""
    factor = UNITS[unit][1]
    digits = len(str(factor)) - 1
    sign = "-" if base < 0 else ""
    whole, rem = divmod(abs(base), factor)
    if digits and rem:
        return f"{sign}{whole}.{str(rem).rjust(digits, '0').rstrip('0')}"
    return f"{sign}{whole}"
