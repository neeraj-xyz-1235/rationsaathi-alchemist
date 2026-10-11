"""Builds the email from a FROZEN report snapshot (plan_backend.txt 2.8, 6.9).
The numbers come straight from the stored /api/calculate result; nothing is recomputed here.
Jinja2 autoescape is ON, so item names and notes cannot inject markup."""
from datetime import date
from pathlib import Path

from jinja2 import Environment, FileSystemLoader

from .strings import LANGS, MONTHS, STRINGS

_TEMPLATES = Path(__file__).parent / "templates"
_html_env = Environment(loader=FileSystemLoader(_TEMPLATES), autoescape=True,
                        trim_blocks=True, lstrip_blocks=True)
# plain text is not markup, so it must not be HTML-escaped ("A & B" stays "A & B")
_text_env = Environment(loader=FileSystemLoader(_TEMPLATES), autoescape=False,
                        trim_blocks=True, lstrip_blocks=True)


def fmt_date(d: str, lang: str) -> str:
    y, m, day = (int(p) for p in d.split("-"))
    return f"{day} {MONTHS[lang][m - 1]} {y}"


def fmt_period(start: str, end: str, lang: str) -> str:
    return f"{fmt_date(start, lang)} – {fmt_date(end, lang)}"


def mask_email(email: str) -> str:
    local, _, domain = email.partition("@")
    return f"{local[:1]}***@{domain}"


def _main_sentence(item: dict, s: dict, ctx: dict) -> str:
    first = item["labels"][0] if item["labels"] else {"code": "", "reason": ""}
    if first["code"] == "shortfall":
        key = "sentence_shortfall"
    elif first["code"] == "above_expected":
        key = "sentence_above_expected"
    elif first["code"] == "no_difference":
        key = "sentence_no_difference"
    else:                                   # unclear / PERIOD_NOT_ENDED: the "so far" wording
        key = "sentence_ongoing"
    return s[key].format(**ctx)


def _balance_sentence(item: dict, s: dict, ctx: dict) -> str:
    b = item["balance"]
    if b["over_by"] != "0":
        return s["balance_over"].format(**ctx)
    if b["remaining"] != "0":
        return s["balance_ongoing" if b["phase"] == "ongoing" else "balance_ended"].format(**ctx)
    return s["balance_full"].format(**ctx)


def build(result: dict, lang: str, link: str) -> tuple[str, str, str]:
    """Returns (subject, html, text)."""
    if lang not in LANGS:
        lang = "en"
    s = STRINGS[lang]
    period = fmt_period(result["period"]["start"], result["period"]["end"], lang)
    end_txt = fmt_date(result["period"]["end"], lang)

    items = []
    for it in result["items"]:
        ctx = {"item": it["item"], "unit": it["unit"], "period": period, "end": end_txt,
               "expected": it["expected"]["value"], "received": it["received"]["value"],
               "diff": it["difference"]["value"].lstrip("-"),
               "remaining": it["balance"]["remaining"], "over_by": it["balance"]["over_by"],
               "percent": it["balance"]["percent_used"]}
        notes = []
        excluded = [e for e in it["excluded"]]
        if excluded:
            notes.append(s["note_excluded"].format(item=it["item"], n=len(excluded)))
        items.append({
            "item": it["item"], "unit": it["unit"],
            "expected": ctx["expected"], "received": ctx["received"],
            "remaining": ctx["remaining"], "over_by": ctx["over_by"],
            "difference": it["difference"]["value"],
            "sentence": _main_sentence(it, s, ctx),
            "balance": _balance_sentence(it, s, ctx),
            "notes": notes,
        })
    if result["unmatched"]:
        general_notes = [s["note_unmatched"].format(n=len(result["unmatched"]))]
    else:
        general_notes = []

    ctx = {"s": s, "lang": lang, "period": period, "items": items, "notes": general_notes,
           "link": link}
    subject = s["subject"].format(period=period)
    html = _html_env.get_template("report.html.j2").render(**ctx, subject=subject)
    text = _text_env.get_template("report.txt.j2").render(**ctx, subject=subject)
    return subject, html, text
