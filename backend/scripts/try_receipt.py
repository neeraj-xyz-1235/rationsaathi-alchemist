"""Try the receipt reader on a photo from your own computer and see every step.

    cd backend
    python scripts/try_receipt.py path\\to\\receipt.jpg

Reads LLM_BASE_URL / LLM_API_KEY / LLM_VISION_MODEL from backend/.env (or the environment).
Prints the model's raw reply, what the app makes of it, and the form fields it would fill in.
The photo goes only to your own AI provider; nothing is saved."""
import base64
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

import httpx  # noqa: E402

from app.config import settings  # noqa: E402
from app.parser.normalize import RawEntry, normalize_entry  # noqa: E402
from app.proof import vision  # noqa: E402


def main() -> int:
    if len(sys.argv) != 2:
        print(__doc__)
        return 2
    path = Path(sys.argv[1])
    data = path.read_bytes()
    mime = "image/png" if data[:4] == b"\x89PNG" else "image/webp" if data[8:12] == b"WEBP" else "image/jpeg"
    print(f"file: {path.name}  {len(data) / 1024:.0f} KB  {mime}")
    print(f"model: {settings.LLM_VISION_MODEL or '(LLM_VISION_MODEL is empty)'}  url: {settings.LLM_BASE_URL or '(empty)'}")
    if not vision.is_configured():
        print("-> vision is not configured: set LLM_BASE_URL and LLM_VISION_MODEL in backend/.env")
        return 1

    body = {
        "model": settings.LLM_VISION_MODEL, "temperature": 0, "max_tokens": 300,
        "messages": [
            {"role": "system", "content": vision.RECEIPT_PROMPT},
            {"role": "user", "content": [
                {"type": "text", "text": "Transcribe this receipt."},
                {"type": "image_url", "image_url": {"url": f"data:{mime};base64,{base64.b64encode(data).decode()}"}},
            ]},
        ],
    }
    headers = {"Authorization": f"Bearer {settings.LLM_API_KEY}"} if settings.LLM_API_KEY else {}
    resp = httpx.post(settings.LLM_BASE_URL.rstrip("/") + "/chat/completions", headers=headers, json=body, timeout=60)
    print(f"\n1) provider answered HTTP {resp.status_code}")
    if resp.status_code != 200:
        print("   ", resp.text[:400])
        return 1
    choice = resp.json()["choices"][0]
    print(f"   finish_reason: {choice.get('finish_reason')}")
    print("\n2) the model's raw reply:")
    print(choice["message"]["content"])

    print("\n3) what the app makes of it:")
    try:
        reading = vision.read_receipt(data, mime)
    except vision.VisionUnavailable as e:
        print("   FAILED:", e, "(see the log line above for the reason)")
        return 1
    print("   ", reading.model_dump())

    from datetime import date
    today = date.today()
    entry = normalize_entry(
        RawEntry(item_raw=reading.item_text, quantity_raw=reading.quantity_text, unit_raw=reading.unit_text,
                 date_raw=reading.date_text, receipt_ref=reading.receipt_ref),
        today.replace(day=1), today, ["Rice", "Wheat"])
    print("\n4) the form would be filled with:")
    print("    item:", entry["item"] if entry["item_matches_rule"] else None)
    print("    quantity:", entry["quantity"])
    print("    date:", entry["date"], " reference:", entry["receipt_ref"])
    print("    issues:", entry["issues"])
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
