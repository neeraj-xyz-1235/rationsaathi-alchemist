"""Try the LLM, validate, else regex, then normalize (plan_backend.txt 4.1).
Never saves anything. The output is SUGGESTIONS the user must confirm."""
import logging
from datetime import date

from . import llm_parser, regex_parser
from .normalize import normalize_entry

log = logging.getLogger("rationsaathi.parser")


def parse_receipt(text: str, start: date, end: date, known_items: list[str]) -> tuple[str, list[dict]]:
    entries, method = [], "regex"
    if llm_parser.is_configured():
        try:
            entries = llm_parser.extract(text)
            method = "llm"
        except llm_parser.LlmUnavailable:
            entries = []
        if not entries:                       # failed, or the model found nothing: be safe
            method = "regex"
    if method == "regex":
        entries = regex_parser.parse(text, known_items)
    return method, [normalize_entry(e, start, end, known_items) for e in entries]
