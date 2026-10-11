"""Month list per household + next-month date shifting (plan_backend.txt 2.7).
Plain calendar arithmetic, no extra dependency. No carry-over is ever applied."""
import calendar
from datetime import date


def shift_month(d: date, months: int = 1) -> date:
    """Same day number one month later, clamped to the month's length (31 Jan -> 28 Feb)."""
    idx = d.year * 12 + (d.month - 1) + months
    year, month = divmod(idx, 12)
    month += 1
    return date(year, month, min(d.day, calendar.monthrange(year, month)[1]))


def is_whole_month(start: date, end: date) -> bool:
    return (start.day == 1 and end.year == start.year and end.month == start.month
            and end.day == calendar.monthrange(end.year, end.month)[1])


def next_period(start: date, end: date) -> tuple[date, date]:
    """1-30 Sep -> 1-31 Oct. 1-31 Jan -> 1-28 Feb. 15 Sep-14 Oct -> 15 Oct-14 Nov."""
    if is_whole_month(start, end):
        s = shift_month(start)
        return s, date(s.year, s.month, calendar.monthrange(s.year, s.month)[1])
    return shift_month(start), shift_month(end)


def household_key(ref: str | None) -> str | None:
    """None and '' are the same household."""
    ref = (ref or "").strip()
    return ref or None
