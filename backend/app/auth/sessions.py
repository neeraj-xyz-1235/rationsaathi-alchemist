"""Server-side sessions (plan_backend.txt 6.2). Only sha256(token) is stored; the raw token
lives in the browser's HttpOnly cookie."""
import hashlib
import secrets
from datetime import datetime, timedelta, timezone

from sqlalchemy.orm import Session

from app.db.models import User, UserSession

COOKIE_NAME = "rs_session"
SESSION_TTL = timedelta(days=7)
TOUCH_EVERY = timedelta(minutes=5)


def now() -> datetime:
    return datetime.now(timezone.utc)


def as_utc(dt: datetime) -> datetime:
    """SQLite returns naive datetimes; everything we store is UTC."""
    return dt if dt.tzinfo else dt.replace(tzinfo=timezone.utc)


def hash_token(token: str) -> str:
    return hashlib.sha256(token.encode()).hexdigest()


def create_session(db: Session, user: User, user_agent: str | None) -> str:
    token = secrets.token_urlsafe(32)
    t = now()
    db.add(UserSession(user_id=user.id, token_hash=hash_token(token), created_at=t,
                       expires_at=t + SESSION_TTL, last_seen_at=t,
                       user_agent=(user_agent or "")[:200] or None))
    db.query(UserSession).filter(UserSession.expires_at < t).delete()   # cleanup
    db.commit()
    return token


def lookup(db: Session, token: str | None) -> tuple[User, UserSession] | None:
    if not token:
        return None
    sess = db.query(UserSession).filter_by(token_hash=hash_token(token)).first()
    if sess is None or as_utc(sess.expires_at) <= now():
        return None
    user = db.get(User, sess.user_id)
    if user is None:
        return None
    if now() - as_utc(sess.last_seen_at) > TOUCH_EVERY:
        sess.last_seen_at = now()
        db.commit()
    return user, sess


def revoke(db: Session, sess: UserSession) -> None:
    db.delete(sess)
    db.commit()
