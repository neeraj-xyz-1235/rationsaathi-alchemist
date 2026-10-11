"""Regex fallback extractor (plan_backend.txt 4.4). Works with no AI and no network.
Returns RAW strings only; normalize.py interprets them. Patterns are simple and applied per
line (input is capped at 2,000 chars) so a crafted input cannot make them run long."""
import re
import unicodedata

from .normalize import RawEntry, ascii_digits, find_date_text, locate_item

_UNIT = (r"(?:kilograms?|kilos?|kgs?|किलोग्राम|किलो|कि\.?\s?ग्रा\.?|किग्रा|grams?|gms?|gm|ग्राम|"
         r"litres?|liters?|ltrs?|ltr|lit|लीटर|ml|मिली|pcs|pc|nos|नग|g|l)")
QTY_RE = re.compile(rf"(?<![\d.,])(\d+(?:[.,]\d+)?)\s*({_UNIT})(?![A-Za-z])", re.I)
LONE_NUMBER_RE = re.compile(r"(?<![\d.,/\-])(\d+(?:[.,]\d+)?)(?![\d/\-])")
REF_RE = re.compile(
    r"(?:(?<![a-z])(?:rcpt|receipt|bill|slip|ref|no)\b\.?|#)\s*[:#.\-]?\s*((?=[a-z0-9\-]*\d)[a-z0-9][a-z0-9\-]*)",
    re.I)

_FILLER = {"received", "recvd", "rcvd", "recd", "rec", "on", "dt", "date", "qty", "quantity",
           "of", "at", "rs", "by", "from", "issued", "collected", "got", "taken", "given",
           "the", "a", "an", "and", "is", "was"}
MAX_LINES = 100
MAX_ENTRIES = 50


def _mask(s: str, span: tuple[int, int]) -> str:
    return s[:span[0]] + " " * (span[1] - span[0]) + s[span[1]:]


def _letters_only(s: str) -> str:
    kept = "".join(c if unicodedata.category(c)[0] in "LM" else " " for c in s)
    words = [w for w in kept.split() if w.lower() not in _FILLER]
    return " ".join(words[:4])[:60]


def _item_in(segment: str, known_items: list[str]) -> tuple[str | None, bool]:
    """(item as written, recognised?). Falls back to the leftover words if nothing is known."""
    hit = locate_item(segment, known_items)
    if hit:
        return hit[0], True
    text = _letters_only(segment)
    return (text or None), False


def parse(text: str, known_items: list[str]) -> list[RawEntry]:
    entries: list[RawEntry] = []
    header_dates: list[str] = []
    header_refs: list[str] = []

    for line in text.splitlines()[:MAX_LINES]:
        line = ascii_digits(unicodedata.normalize("NFC", line)).strip()
        if not line:
            continue

        ref = None
        m = REF_RE.search(line)
        if m:
            ref = m.group(1)
            line = _mask(line, m.span())

        qtys = list(QTY_RE.finditer(line))
        work = line
        for q in qtys:
            work = _mask(work, q.span())

        date_raw = None
        found = find_date_text(work)
        if found:
            date_raw = found[0].strip()
            work = _mask(work, found[1])

        line_entries: list[RawEntry] = []
        if qtys:
            prev = 0
            for q in qtys:
                segment = work[prev:q.end()] if len(qtys) > 1 else work
                prev = q.end()
                item, known = _item_in(segment, known_items)
                line_entries.append(RawEntry(
                    item_raw=item, quantity_raw=q.group(1), unit_raw=q.group(2),
                    low_confidence=item is None))
        else:
            hit = locate_item(work, known_items)
            lone = LONE_NUMBER_RE.search(work) if hit else None
            if hit and lone:                           # "rice 8": a number but no unit
                line_entries.append(RawEntry(item_raw=hit[0], quantity_raw=lone.group(1),
                                             unit_raw=None, low_confidence=True))

        if line_entries:
            for e in line_entries:
                e.date_raw, e.receipt_ref = date_raw, ref
            entries.extend(line_entries)
        else:                                          # header line, e.g. "Date: 03/09/2026"
            if date_raw:
                header_dates.append(date_raw)
            if ref:
                header_refs.append(ref)

    # a lone date / receipt number on its own line applies to entries that have none
    one_date = set(header_dates)
    one_ref = set(header_refs)
    for e in entries:
        if e.date_raw is None and len(one_date) == 1:
            e.date_raw = header_dates[0]
        if e.receipt_ref is None and len(one_ref) == 1:
            e.receipt_ref = header_refs[0]
    return entries[:MAX_ENTRIES]
