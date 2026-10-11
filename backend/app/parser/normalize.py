"""Deterministic interpretation of raw receipt strings (plan_backend.txt 4.1, 4.3).
Runs on BOTH parser paths. Plain Python: the AI never touches a number we compute with.

Public entry point: normalize_entry(). Nothing here rounds a quantity or guesses a date."""
import re
import unicodedata
from dataclasses import dataclass
from datetime import date

from app.engine.units import UnitError, from_base, to_base

# ── Digits ───────────────────────────────────────────────

_DEVANAGARI_DIGITS = str.maketrans("०१२३४५६७८९", "0123456789")


def ascii_digits(s: str) -> str:
    return s.translate(_DEVANAGARI_DIGITS)


# ── Units ────────────────────────────────────────────────

UNIT_ALIASES = {
    "kg": "kg", "kgs": "kg", "kilo": "kg", "kilos": "kg", "kilogram": "kg", "kilograms": "kg",
    "किलो": "kg", "किग्रा": "kg", "किलोग्राम": "kg",
    "g": "g", "gm": "g", "gms": "g", "gram": "g", "grams": "g", "ग्राम": "g",
    "l": "l", "lt": "l", "lit": "l", "ltr": "l", "ltrs": "l", "litre": "l", "litres": "l",
    "liter": "l", "liters": "l", "लीटर": "l",
    "ml": "ml", "मिली": "ml",
    "pcs": "pcs", "pc": "pcs", "nos": "pcs", "piece": "pcs", "pieces": "pcs", "नग": "pcs",
}


def canonical_unit(raw: str | None) -> str | None:
    if not raw:
        return None
    key = re.sub(r"[.\s]", "", unicodedata.normalize("NFC", raw).lower())
    return UNIT_ALIASES.get(key)


# ── Items ────────────────────────────────────────────────
# Keep in sync with the frontend's item suggestions (plan_frontend.txt section 7).

ITEM_GROUPS = {
    "Rice": ["rice", "chawal", "chaval", "चावल", "तांदूळ", "तांदुळ"],
    "Wheat": ["wheat", "gehu", "gehun", "गेहूं", "गेहू", "गहू", "गहूँ"],
    "Sugar": ["sugar", "shakkar", "cheeni", "चीनी", "साखर"],
    "Dal": ["dal", "daal", "dhal", "दाल", "डाळ"],
    "Edible oil": ["edible oil", "oil", "tel", "तेल"],
}
WORD2CANON = {w: canon for canon, words in ITEM_GROUPS.items() for w in words}
WORD2CANON.update({canon.lower(): canon for canon in ITEM_GROUPS})
_WORDS_LONGEST_FIRST = sorted(WORD2CANON, key=len, reverse=True)


def find_span(hay_lower: str, needle: str) -> tuple[int, int] | None:
    """First whole-word occurrence. ASCII needles need word boundaries ('oil' is not in 'boiled')."""
    if not needle:
        return None
    if needle.isascii():
        m = re.search(rf"(?<![a-z0-9]){re.escape(needle)}(?![a-z0-9])", hay_lower)
        return m.span() if m else None
    i = hay_lower.find(needle)
    return (i, i + len(needle)) if i >= 0 else None


def locate_item(text: str, known_items: list[str]) -> tuple[str, tuple[int, int]] | None:
    """Earliest known item or synonym in text (longest wins a tie). Returns (as written, span)."""
    low = text.lower()
    if len(low) != len(text):
        low = text
    best = None
    for w in {k.strip().lower() for k in known_items if k.strip()} | set(WORD2CANON):
        sp = find_span(low, w)
        if sp and (best is None or sp[0] < best[0] or
                   (sp[0] == best[0] and sp[1] - sp[0] > best[1] - best[0])):
            best = sp
    return (text[best[0]:best[1]], best) if best else None


def _group_in(low: str) -> str | None:
    for w in _WORDS_LONGEST_FIRST:
        if find_span(low, w):
            return WORD2CANON[w]
    return None


def match_item(raw: str, known_items: list[str]) -> tuple[str, bool]:
    """Map what was written onto one of the user's own rule items when possible."""
    low = unicodedata.normalize("NFC", raw).strip().lower()
    known = [k.strip() for k in known_items if k.strip()]
    for k in known:
        if k.lower() == low:
            return k, True
    canon = WORD2CANON.get(low) or _group_in(low)
    if canon:
        for k in known:
            if (WORD2CANON.get(k.lower()) or _group_in(k.lower())) == canon:
                return k, True
    for k in known:
        if find_span(low, k.lower()):
            return k, True
    return raw.strip()[:60], False


# ── Dates (4.3) ──────────────────────────────────────────

MONTHS = {"jan": 1, "feb": 2, "mar": 3, "apr": 4, "may": 5, "jun": 6,
          "jul": 7, "aug": 8, "sep": 9, "oct": 10, "nov": 11, "dec": 12}
_YEAR = r"(\d{4}|\d{2})"
DATE_NUMERIC = re.compile(rf"(?<![\d.])(\d{{1,2}})\s*([/\-.])\s*(\d{{1,2}})(?:\s*[/\-.]\s*{_YEAR})?(?!\d)")
DATE_DAY_MONTH = re.compile(
    rf"(?<!\d)(\d{{1,2}})(?:st|nd|rd|th)?[\s\-/.]*([a-z]{{3,9}})\b\.?(?:[\s,\-/.]*{_YEAR}(?!\d))?")
DATE_MONTH_DAY = re.compile(
    rf"\b([a-z]{{3,9}})\b\.?\s*(\d{{1,2}})(?:st|nd|rd|th)?(?!\d)(?:[\s,\-/.]*{_YEAR}(?!\d))?")


def find_date_text(text: str) -> tuple[str, tuple[int, int]] | None:
    """Locate a date inside free text (regex path). A '.' separator needs a year, so a
    quantity like '8.5' is never mistaken for a date."""
    low = text.lower()
    for m in DATE_NUMERIC.finditer(low):
        if m.group(2) == "." and m.group(4) is None:
            continue
        if _numeric_ok(m):
            return text[m.start():m.end()], m.span()
    for rx in (DATE_DAY_MONTH, DATE_MONTH_DAY):
        for m in rx.finditer(low):
            word = m.group(2) if rx is DATE_DAY_MONTH else m.group(1)
            if word[:3] in MONTHS and _is_month_word(word):
                return text[m.start():m.end()], m.span()
    return None


def _numeric_ok(m) -> bool:
    return 1 <= int(m.group(1)) <= 31 and 1 <= int(m.group(3)) <= 31


def _is_month_word(word: str) -> bool:
    full = ("january", "february", "march", "april", "may", "june", "july", "august",
            "september", "october", "november", "december")
    return word == "sept" or any(f.startswith(word) for f in full) and len(word) >= 3


@dataclass
class DateResult:
    value: date | None
    candidates: list[date]
    issues: list[str]


def parse_date(date_raw: str | None, start: date, end: date) -> DateResult:
    if not date_raw or not date_raw.strip():
        return DateResult(None, [], ["DATE_NOT_FOUND"])
    s = ascii_digits(unicodedata.normalize("NFC", date_raw)).strip().lower()
    readings: list[tuple[int, int]] = []
    year_txt = None
    m = DATE_NUMERIC.search(s)
    if m and _numeric_ok(m):
        a, b = int(m.group(1)), int(m.group(3))
        readings = [(a, b)] + ([(b, a)] if a != b else [])      # (day, month); DD/MM first
        year_txt = m.group(4)
    else:
        for rx, day_i, mon_i, yr_i in ((DATE_DAY_MONTH, 1, 2, 3), (DATE_MONTH_DAY, 2, 1, 3)):
            m = rx.search(s)
            if m and m.group(mon_i)[:3] in MONTHS and _is_month_word(m.group(mon_i)):
                readings = [(int(m.group(day_i)), MONTHS[m.group(mon_i)[:3]])]
                year_txt = m.group(yr_i)
                break
    if not readings:
        return DateResult(None, [], ["DATE_NOT_FOUND"])

    issues: list[str] = []
    if year_txt:
        y = int(year_txt)
        years = [y + 2000 if len(year_txt) == 2 else y]
    else:
        years = sorted({start.year, end.year})
        issues_year = ["YEAR_INFERRED_FROM_PERIOD"]

    candidates: list[date] = []
    for day, month in readings:
        for y in years:
            try:
                d = date(y, month, day)
            except ValueError:
                continue
            if d not in candidates:
                candidates.append(d)
    if not candidates:
        return DateResult(None, [], ["DATE_NOT_FOUND"])

    chosen: date | None = None
    if len(candidates) == 1:
        chosen = candidates[0]
    else:
        inside = [c for c in candidates if start <= c <= end]
        if len(inside) == 1:
            chosen = inside[0]
            if len(readings) > 1 and len({(c.day, c.month) for c in candidates}) > 1:
                issues.append("DATE_AMBIGUOUS_RESOLVED_BY_PERIOD")
        else:
            issues.append("DATE_AMBIGUOUS")      # the user picks; we never assume DD/MM
    if not year_txt:
        issues.extend(issues_year)
    return DateResult(chosen, candidates, issues)


# ── Quantities ───────────────────────────────────────────

_VALUE = re.compile(r"^\d+(?:[.,]\d+)?$")
_VALUE_WITH_UNIT = re.compile(r"^(\d+(?:[.,]\d+)?)\s*(\D.*)$")


def _clean_value(v: str) -> tuple[str, bool]:
    """'1,5' -> '1.5'. '1,500' (exactly 3 digits after the comma) is read as a thousands
    separator and flagged, because it could also mean 1.500."""
    if "," in v:
        head, _, tail = v.partition(",")
        if len(tail) == 3 and tail.isdigit() and "." not in v:
            return head + tail, True
        return head + "." + tail, False
    return v, False


# ── One entry ────────────────────────────────────────────

@dataclass
class RawEntry:
    """Raw strings exactly as read from the receipt (by the LLM or the regex reader)."""
    item_raw: str | None = None
    quantity_raw: str | None = None
    unit_raw: str | None = None
    date_raw: str | None = None
    receipt_ref: str | None = None
    low_confidence: bool = False       # set by the regex reader when a field was only partly found


def normalize_entry(e: RawEntry, start: date, end: date, known_items: list[str]) -> dict:
    issues: list[str] = []

    # item
    if e.item_raw and e.item_raw.strip():
        item, matches = match_item(e.item_raw, known_items)
        if not matches:
            issues.append("ITEM_NOT_IN_RULES")
    else:
        item, matches = None, False
        issues.append("ITEM_NOT_FOUND")

    # quantity + unit
    qty_txt = ascii_digits(e.quantity_raw or "").strip()
    unit_raw = e.unit_raw
    if qty_txt and not _VALUE.match(qty_txt):
        m = _VALUE_WITH_UNIT.match(qty_txt)           # e.g. the reader returned "8kg" in one field
        if m and not unit_raw:
            qty_txt, unit_raw = m.group(1), m.group(2)
        else:
            qty_txt = ""
    unit = canonical_unit(unit_raw)
    quantity = None
    if not qty_txt:
        issues.append("QUANTITY_NOT_FOUND")
    elif unit is None:
        issues.append("UNIT_NOT_FOUND")
    else:
        value, comma_flag = _clean_value(qty_txt)
        try:
            _, base = to_base(value, unit)
            if base <= 0:
                raise UnitError("QUANTITY_INVALID")
            quantity = {"value": from_base(base, unit), "unit": unit}
            if comma_flag:
                issues.append("LOW_CONFIDENCE")
        except UnitError as err:
            issues.append("QUANTITY_TOO_PRECISE" if str(err) == "TOO_PRECISE"
                          else "QUANTITY_NOT_FOUND")

    # date
    d = parse_date(e.date_raw, start, end)
    issues.extend(d.issues)

    if e.low_confidence and "LOW_CONFIDENCE" not in issues:
        issues.append("LOW_CONFIDENCE")

    ref = (e.receipt_ref or "").strip()[:60] or None
    return {
        "item": item,
        "item_matches_rule": matches,
        "quantity": quantity,
        "date": d.value,
        "date_raw": e.date_raw.strip()[:40] if e.date_raw and e.date_raw.strip() else None,
        "date_candidates": d.candidates,
        "receipt_ref": ref,
        "issues": issues,
    }
