"""Checks a shop-receipt photo against the withdrawal the household recorded.

The model only transcribes; every comparison here is plain Python on exact integer base units.
verified    : item and quantity on the receipt match the withdrawal (and the date, if readable)
mismatch    : something readable on the receipt disagrees with the withdrawal (or it is not a receipt)
unreadable  : item or quantity could not be read, or the photo could not be checked."""
import calendar
from datetime import date

from app.engine.units import UnitError, to_base
from app.parser.normalize import RawEntry, normalize_entry
from app.proof.vision import ReceiptReading


def decide(reading: ReceiptReading, *, item: str, qty_base: int, on: date,
           reference: str | None) -> tuple[str, dict]:
    """Returns (status, result). `result` holds codes and the quantities compared, no photo data."""
    if not reading.is_receipt:
        return "mismatch", {"checked_by": "ai", "reason": "NOT_A_RECEIPT", "checks": {}}

    start, end = date(on.year, on.month, 1), date(on.year, on.month, calendar.monthrange(on.year, on.month)[1])
    entry = normalize_entry(
        RawEntry(item_raw=reading.item_text, quantity_raw=reading.quantity_text,
                 unit_raw=reading.unit_text, date_raw=reading.date_text,
                 receipt_ref=reading.receipt_ref), start, end, [item])

    checks: dict[str, str] = {}
    if entry["item"] is None:
        checks["item"] = "unreadable"
    else:
        checks["item"] = "match" if entry["item_matches_rule"] else "mismatch"

    read_qty = None
    q = entry["quantity"]
    if q is None:
        checks["quantity"] = "unreadable"
    else:
        try:
            _, read_qty = to_base(q["value"], q["unit"])
            checks["quantity"] = "match" if read_qty == qty_base else "mismatch"
        except UnitError:
            checks["quantity"] = "unreadable"

    if entry["date"] is None:
        checks["date"] = "unreadable"
    else:
        checks["date"] = "match" if (entry["date"] == on or on in entry["date_candidates"]) else "mismatch"

    if reference and entry["receipt_ref"]:
        checks["reference"] = "match" if entry["receipt_ref"].strip().lower() == reference.strip().lower() else "mismatch"

    result = {"checked_by": "ai", "checks": checks,
              "read_quantity_g": read_qty, "recorded_quantity_g": qty_base}
    if "mismatch" in checks.values():
        result["reason"] = "DETAILS_DO_NOT_MATCH"
        return "mismatch", result
    if checks["item"] == "match" and checks["quantity"] == "match":
        result["reason"] = "MATCHED"
        return "verified", result
    result["reason"] = "RECEIPT_UNREADABLE"
    return "unreadable", result
