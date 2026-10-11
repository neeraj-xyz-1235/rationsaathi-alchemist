"""One error shape everywhere: {"error": {"code": ..., ...}} (plan_backend.txt section 2)."""
import logging

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from starlette.exceptions import HTTPException as StarletteHTTPException

log = logging.getLogger("rationsaathi")


def error_response(status: int, code: str, headers: dict | None = None, **extra) -> JSONResponse:
    return JSONResponse({"error": {"code": code, **extra}}, status_code=status, headers=headers)


def _field_code(err: dict) -> str:
    msg = err.get("msg", "")
    if msg.startswith("Value error, "):          # our own validators raise CODE_NAMES
        return msg[len("Value error, "):]
    return err.get("type", "invalid").upper().replace(".", "_")


def install_error_handlers(app: FastAPI) -> None:
    @app.exception_handler(RequestValidationError)
    async def _validation(request: Request, exc: RequestValidationError):
        fields = {}
        for err in exc.errors():
            loc = [str(p) for p in err["loc"] if p not in ("body", "query", "path")]
            fields[".".join(loc) or "_"] = _field_code(err)
        return error_response(422, "VALIDATION_FAILED", fields=fields)

    @app.exception_handler(StarletteHTTPException)
    async def _http(request: Request, exc: StarletteHTTPException):
        codes = {401: "UNAUTHENTICATED", 404: "NOT_FOUND", 413: "PAYLOAD_TOO_LARGE",
                 429: "RATE_LIMITED"}
        code = exc.detail if isinstance(exc.detail, str) and exc.detail.isupper() \
            else codes.get(exc.status_code, "INTERNAL")
        extra = {}
        retry = (exc.headers or {}).get("Retry-After")
        if exc.status_code == 429 and retry and retry.isdigit():
            extra["retry_after_s"] = int(retry)
        return error_response(exc.status_code, code, headers=exc.headers, **extra)

    @app.exception_handler(Exception)
    async def _unhandled(request: Request, exc: Exception):
        log.exception("unhandled error on %s %s", request.method, request.url.path)
        return error_response(500, "INTERNAL")   # never leak details
