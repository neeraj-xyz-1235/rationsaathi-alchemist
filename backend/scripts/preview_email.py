"""Render the demo report email to HTML + text files you can open, with NO email provider needed.

    python scripts/preview_email.py          # writes backend/email_preview/report.{en,hi,mr}.html / .txt
"""
import json
import sys
from datetime import date
from pathlib import Path

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")   # Windows consoles default to cp1252

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))

from app.email import render  # noqa: E402
from app.engine.calculator import calculate  # noqa: E402
from app.schemas import Case  # noqa: E402

case = Case.model_validate(json.loads((ROOT / "tests/fixtures/demo_case.json").read_text("utf-8")))
result = calculate(case, today=date(2026, 10, 11))
out = ROOT / "email_preview"
out.mkdir(exist_ok=True)
for lang in ("en", "hi", "mr"):
    subject, html, text = render.build(result, lang, "http://localhost:5173/r/00000000-0000-0000-0000-000000000000")
    (out / f"report.{lang}.html").write_text(html, "utf-8")
    (out / f"report.{lang}.txt").write_text(text, "utf-8")
    print(f"[{lang}] {subject}")
print(f"\nOpen {out / 'report.en.html'} in a browser.")
