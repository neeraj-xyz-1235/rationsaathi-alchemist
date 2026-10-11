"""Request id, global rate limit, Origin check (CSRF), JSON-only bodies, body-size limit
(plan_backend.txt 6.3, 6.4, 6.5). Pure ASGI so request bodies are never buffered here."""
import re
import uuid

from fastapi import HTTPException
from starlette.datastructures import Headers
from starlette.types import ASGIApp, Message, Receive, Scope, Send

from app.auth.rate_limit import general_limiter
from app.config import settings
from app.errors import error_response

_LOCAL_DEV_ORIGIN = re.compile(r"^http://(localhost|127\.0\.0\.1|\[::1\])(:\d{1,5})?$")
MAX_BODY = 100 * 1024
# The one route that takes a file (ration-card proof): multipart, up to 8 MB + form overhead.
UPLOAD_PATH = "/api/household/proof"
MAX_UPLOAD_BODY = 9 * 1024 * 1024
UNSAFE = {"POST", "PUT", "PATCH", "DELETE"}


def _client_ip(scope: Scope, headers: Headers) -> str:
    fwd = headers.get("x-forwarded-for")
    if fwd:
        return fwd.split(",")[0].strip()[:64]
    return scope["client"][0] if scope.get("client") else "unknown"


def _origin_allowed(headers: Headers) -> bool:
    """Browsers always send Origin (or Referer) on cross-site POSTs. A request with neither is
    not a browser CSRF (curl, tests). Our own origin (Swagger at /docs) is also fine."""
    source = headers.get("origin")
    if source is None:
        ref = headers.get("referer")
        if ref is None:
            return True
        parts = ref.split("/", 3)
        source = "/".join(parts[:3])
    source = source.rstrip("/")
    # APP_ORIGIN may list several origins, comma separated
    allowed = {o.strip().rstrip("/") for o in settings.APP_ORIGIN.split(",") if o.strip()}
    host = headers.get("host")
    if host:
        allowed |= {f"http://{host}", f"https://{host}"}
    if source in allowed:
        return True
    # Local development only (COOKIE_SECURE=false, i.e. plain http): the dev site may be opened
    # as localhost or 127.0.0.1, on whatever port Vite picked. Production runs with
    # COOKIE_SECURE=true, where this never applies.
    return not settings.COOKIE_SECURE and bool(_LOCAL_DEV_ORIGIN.match(source))


class SecurityMiddleware:
    def __init__(self, app: ASGIApp):
        self.app = app

    async def __call__(self, scope: Scope, receive: Receive, send: Send):
        if scope["type"] != "http":
            await self.app(scope, receive, send)
            return
        headers = Headers(scope=scope)
        request_id = uuid.uuid4().hex[:12]
        method, path = scope["method"], scope["path"]
        is_upload = method == "POST" and path == UPLOAD_PATH
        max_body = MAX_UPLOAD_BODY if is_upload else MAX_BODY

        async def send_with_id(message: Message):
            if message["type"] == "http.response.start":
                message.setdefault("headers", []).append((b"x-request-id", request_id.encode()))
            await send(message)

        async def reject(response):
            await response(scope, receive, send_with_id)

        # 1. general per-IP limit (health checks exempt)
        if path != "/api/health":
            wait = general_limiter.hit(_client_ip(scope, headers))
            if wait:
                return await reject(error_response(
                    429, "RATE_LIMITED", headers={"Retry-After": str(wait)}, retry_after_s=wait))

        if method in UNSAFE:
            # 2. CSRF: Origin / Referer must be ours
            if not _origin_allowed(headers):
                return await reject(error_response(403, "BAD_ORIGIN"))
            # 3. bodies must be JSON
            length = headers.get("content-length")
            has_body = (length not in (None, "0")) or "transfer-encoding" in headers
            ctype = headers.get("content-type", "").split(";")[0].strip().lower()
            wanted = "multipart/form-data" if is_upload else "application/json"
            if has_body and ctype != wanted:
                return await reject(error_response(
                    415, "VALIDATION_FAILED", fields={"_": "CONTENT_TYPE_NOT_JSON"}))
            # 4. size limit (declared, then counted while streaming)
            if length and length.isdigit() and int(length) > max_body:
                return await reject(error_response(413, "PAYLOAD_TOO_LARGE"))

        seen = 0

        async def counted_receive() -> Message:
            nonlocal seen
            message = await receive()
            if message["type"] == "http.request":
                seen += len(message.get("body", b""))
                if seen > max_body:
                    raise HTTPException(413, "PAYLOAD_TOO_LARGE")   # handled in errors.py
            return message

        await self.app(scope, counted_receive, send_with_id)
