"""User-friendly view of the same difference (plan 3.5). Display only; never changes labels."""
from .units import from_base


def balance(expected: int, received: int, unit: str, phase: str) -> dict:
    # integer maths only; floored so 2.999 of 3 kg shows "99.9", never "100.0"
    tenths = received * 1000 // expected if expected > 0 else 0
    return {
        "remaining": from_base(max(expected - received, 0), unit),
        "over_by": from_base(max(received - expected, 0), unit),
        "percent_used": f"{tenths // 10}.{tenths % 10}",
        "phase": phase,
    }
