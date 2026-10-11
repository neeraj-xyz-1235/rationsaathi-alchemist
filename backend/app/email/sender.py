"""Sends through a provider's HTTPS API with a 10 s timeout (plan_backend.txt 6.9).
Render's free tier blocks outbound SMTP, so there is no SMTP here.

Providers: "brevo" (default; free daily quota, verify one sender address, no domain needed) or
"resend" (needs a verified domain before it will send to anyone but you).

Safety: the recipient is chosen by the caller (always the account's own email), the subject and
body come from our templates, no remote images, the only attachment is a PDF we make. The body is never logged."""
import base64
import logging
import re

import httpx

from app.config import settings

log = logging.getLogger("rationsaathi.email")
TIMEOUT_S = 10.0
FROM_NAME = "RationSaathi"


class EmailSendError(Exception):
    """code is a short class name only (never a provider message or body)."""

    def __init__(self, code: str):
        super().__init__(code)
        self.code = code


def is_configured() -> bool:
    return bool(settings.EMAIL_API_KEY and settings.EMAIL_FROM)


def _sender_address() -> tuple[str, str]:
    m = re.match(r"^\s*(?:(.*?)\s*)?<([^<>]+)>\s*$", settings.EMAIL_FROM)
    return (m.group(1) or FROM_NAME, m.group(2)) if m else (FROM_NAME, settings.EMAIL_FROM.strip())


def _client() -> httpx.Client:        # a seam for tests
    return httpx.Client(timeout=httpx.Timeout(TIMEOUT_S))


def send(to: str, subject: str, html: str, text: str,
         attachments: list[tuple[str, bytes]] | None = None) -> None:
    if not is_configured():
        raise EmailSendError("NOT_CONFIGURED")
    name, address = _sender_address()
    provider = settings.EMAIL_PROVIDER.lower()
    if provider == "resend":
        url = "https://api.resend.com/emails"
        headers = {"Authorization": f"Bearer {settings.EMAIL_API_KEY}"}
        body = {"from": f"{name} <{address}>", "to": [to], "subject": subject,
                "html": html, "text": text}
        if attachments:
            body["attachments"] = [{"filename": n, "content": base64.b64encode(b).decode()}
                                   for n, b in attachments]
    else:
        url = "https://api.brevo.com/v3/smtp/email"
        headers = {"api-key": settings.EMAIL_API_KEY, "accept": "application/json"}
        body = {"sender": {"name": name, "email": address}, "to": [{"email": to}],
                "subject": subject, "htmlContent": html, "textContent": text}
        if attachments:
            body["attachment"] = [{"name": n, "content": base64.b64encode(b).decode()}
                                  for n, b in attachments]
    try:
        with _client() as client:
            resp = client.post(url, headers=headers, json=body)
        resp.raise_for_status()
    except httpx.TimeoutException:
        raise EmailSendError("TIMEOUT")
    except httpx.HTTPStatusError as e:
        raise EmailSendError(f"HTTP_{e.response.status_code}")
    except httpx.HTTPError as e:
        raise EmailSendError(type(e).__name__.upper())
