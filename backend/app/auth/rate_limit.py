"""Rate limits (plan_backend.txt 6.4).
Login/signup: DB-backed (survive restarts). Everything else: in-memory sliding windows,
fine because the free Render plan runs one instance."""
import hashlib
import math
import threading
import time
from collections import deque
from datetime import datetime, timedelta

from fastapi import HTTPException, Request
from sqlalchemy.orm import Session

from app.db.models import AuthAttempt, EmailLog

from .sessions import as_utc, now

LOGIN_WINDOW = timedelta(minutes=15)
LOGIN_EMAIL_FAILS = 5
LOGIN_IP_ATTEMPTS = 20
SIGNUP_WINDOW = timedelta(hours=1)
SIGNUP_IP_ATTEMPTS = 5


def too_many(retry_after_s: int) -> HTTPException:
    retry_after_s = max(1, retry_after_s)
    return HTTPException(429, "RATE_LIMITED", headers={"Retry-After": str(retry_after_s)})


def client_ip(request: Request) -> str:
    fwd = request.headers.get("x-forwarded-for")
    if fwd:
        return fwd.split(",")[0].strip()[:64]
    return request.client.host if request.client else "unknown"


def email_hash(email: str) -> str:
    return hashlib.sha256(email.strip().lower().encode()).hexdigest()


# ── DB-backed: login / signup ────────────────────────────

def _retry_after(times: list[datetime], limit: int, window: timedelta) -> int:
    """Seconds until enough old attempts age out for one more to be allowed."""
    newest_first = sorted((as_utc(t) for t in times), reverse=True)
    blocking = newest_first[limit - 1]            # this one must leave the window
    return math.ceil((blocking + window - now()).total_seconds())


def check_login_allowed(db: Session, ehash: str, ip: str) -> None:
    since = now() - LOGIN_WINDOW
    fails = [a.created_at for a in db.query(AuthAttempt).filter(
        AuthAttempt.kind == "login", AuthAttempt.email_hash == ehash,
        AuthAttempt.success.is_(False), AuthAttempt.created_at >= since)]
    if len(fails) >= LOGIN_EMAIL_FAILS:
        raise too_many(_retry_after(fails, LOGIN_EMAIL_FAILS, LOGIN_WINDOW))
    ip_times = [a.created_at for a in db.query(AuthAttempt).filter(
        AuthAttempt.kind == "login", AuthAttempt.ip == ip, AuthAttempt.created_at >= since)]
    if len(ip_times) >= LOGIN_IP_ATTEMPTS:
        raise too_many(_retry_after(ip_times, LOGIN_IP_ATTEMPTS, LOGIN_WINDOW))


def check_signup_allowed(db: Session, ip: str) -> None:
    since = now() - SIGNUP_WINDOW
    times = [a.created_at for a in db.query(AuthAttempt).filter(
        AuthAttempt.kind == "signup", AuthAttempt.ip == ip, AuthAttempt.created_at >= since)]
    if len(times) >= SIGNUP_IP_ATTEMPTS:
        raise too_many(_retry_after(times, SIGNUP_IP_ATTEMPTS, SIGNUP_WINDOW))


def record_attempt(db: Session, kind: str, ip: str, success: bool, ehash: str | None = None):
    db.add(AuthAttempt(kind=kind, email_hash=ehash, ip=ip, success=success, created_at=now()))
    db.commit()


def clear_failures(db: Session, ehash: str) -> None:
    db.query(AuthAttempt).filter(AuthAttempt.kind == "login", AuthAttempt.email_hash == ehash,
                                 AuthAttempt.success.is_(False)).delete()
    db.commit()


def cleanup_old_attempts(db: Session) -> None:
    db.query(AuthAttempt).filter(AuthAttempt.created_at < now() - timedelta(hours=24)).delete()
    db.commit()


# ── In-memory sliding windows ────────────────────────────

class SlidingWindow:
    def __init__(self, limit: int, seconds: int):
        self.limit, self.seconds = limit, seconds
        self._hits: dict[str, deque] = {}
        self._lock = threading.Lock()

    def hit(self, key: str) -> int:
        """Records a hit. Returns 0 if allowed, else seconds to wait."""
        t = time.monotonic()
        with self._lock:
            q = self._hits.setdefault(key, deque())
            while q and q[0] <= t - self.seconds:
                q.popleft()
            if len(q) >= self.limit:
                return math.ceil(q[0] + self.seconds - t)
            q.append(t)
            if len(self._hits) > 10_000:           # keep memory bounded
                for k in [k for k, v in self._hits.items() if not v or v[-1] <= t - self.seconds]:
                    del self._hits[k]
            return 0

    def reset(self) -> None:
        with self._lock:
            self._hits.clear()


general_limiter = SlidingWindow(120, 60)     # everything else, per IP
calculate_limiter = SlidingWindow(60, 60)    # /api/calculate, per IP
parse_ip_limiter = SlidingWindow(10, 60)     # /api/receipt/parse, per IP
parse_user_limiter = SlidingWindow(30, 60)   # /api/receipt/parse, per logged-in user
proof_user_limiter = SlidingWindow(10, 3600)  # proof uploads (each one costs an AI call), per user
verify_ip_limiter = SlidingWindow(30, 60)   # receipt verification (public), per IP
ALL_LIMITERS = [verify_ip_limiter, general_limiter, calculate_limiter, parse_ip_limiter, parse_user_limiter,
                proof_user_limiter]


def reset_all() -> None:
    for l in ALL_LIMITERS:
        l.reset()


def limit_calculate(request: Request) -> None:
    wait = calculate_limiter.hit(client_ip(request))
    if wait:
        raise too_many(wait)


# ── DB-backed: emailing a report (counted from email_log; every attempt counts) ──

EMAIL_USER_HOURLY = 3
EMAIL_USER_DAILY = 10
EMAIL_APP_HOURLY = 30


def check_email_allowed(db: Session, user_id) -> None:
    t = now()

    def times(since, mine):
        q = db.query(EmailLog.created_at).filter(EmailLog.created_at >= since)
        if mine:
            q = q.filter(EmailLog.user_id == user_id)
        return [row[0] for row in q]

    hour, day = timedelta(hours=1), timedelta(days=1)
    for stamps, limit, window in (
        (times(t - hour, True), EMAIL_USER_HOURLY, hour),
        (times(t - day, True), EMAIL_USER_DAILY, day),
        (times(t - hour, False), EMAIL_APP_HOURLY, hour),
    ):
        if len(stamps) >= limit:
            raise too_many(_retry_after(stamps, limit, window))


def cleanup_old_email_log(db: Session) -> None:
    db.query(EmailLog).filter(EmailLog.created_at < now() - timedelta(days=7)).delete()
    db.commit()
