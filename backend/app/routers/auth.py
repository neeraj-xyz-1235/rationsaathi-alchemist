"""Signup / login / logout / me (plan_backend.txt 2.5, 6.1, 6.2, 6.6)."""
import logging

from fastapi import APIRouter, Depends, Request, Response
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.auth import rate_limit as rl
from app.auth.deps import current_session, current_user
from app.auth.passwords import hash_password, needs_rehash, verify_password
from app.auth.sessions import COOKIE_NAME, SESSION_TTL, create_session, now, revoke
from app.config import settings
from app.db.models import User
from app.db.session import get_db
from app.errors import error_response
from app.schemas import LoginRequest, SignupRequest, UserEnvelope

router = APIRouter(prefix="/api/auth")
log = logging.getLogger("rationsaathi.auth")


def _user_out(u: User) -> dict:
    return {"user": {"id": str(u.id), "email": u.email, "display_name": u.display_name}}


def _set_cookie(response: Response, token: str) -> None:
    response.set_cookie(COOKIE_NAME, token, max_age=int(SESSION_TTL.total_seconds()),
                        httponly=True, secure=settings.COOKIE_SECURE, samesite="lax", path="/")


@router.post("/signup", status_code=201, response_model=UserEnvelope)
def signup(body: SignupRequest, request: Request, response: Response,
           db: Session = Depends(get_db)):
    ip = rl.client_ip(request)
    rl.check_signup_allowed(db, ip)
    rl.record_attempt(db, "signup", ip, success=False)   # every attempt counts

    if db.query(User).filter_by(email=body.email).first():
        log.info("signup rejected: email exists ip=%s ehash=%s", ip, rl.email_hash(body.email)[:12])
        return error_response(409, "EMAIL_UNAVAILABLE")
    user = User(email=body.email, password_hash=hash_password(body.password.get_secret_value()),
                display_name=body.display_name, last_login_at=now())
    db.add(user)
    try:
        db.commit()
    except IntegrityError:           # two signups raced for the same address
        db.rollback()
        return error_response(409, "EMAIL_UNAVAILABLE")
    token = create_session(db, user, request.headers.get("user-agent"))
    _set_cookie(response, token)
    log.info("signup ok user=%s ip=%s", user.id, ip)
    return _user_out(user)


@router.post("/login", response_model=UserEnvelope)
def login(body: LoginRequest, request: Request, response: Response,
          db: Session = Depends(get_db)):
    ip = rl.client_ip(request)
    ehash = rl.email_hash(body.email)
    try:
        rl.check_login_allowed(db, ehash, ip)
    except Exception:
        log.warning("login blocked (rate limit) ip=%s ehash=%s", ip, ehash[:12])
        raise
    rl.cleanup_old_attempts(db)

    user = db.query(User).filter_by(email=body.email).first()
    password = body.password.get_secret_value()
    ok = verify_password(user.password_hash if user else None, password)   # always one verify
    if not ok or user is None:
        rl.record_attempt(db, "login", ip, success=False, ehash=ehash)
        log.warning("login failed ip=%s ehash=%s", ip, ehash[:12])
        return error_response(401, "INVALID_CREDENTIALS")

    if needs_rehash(user.password_hash):
        user.password_hash = hash_password(password)
    user.last_login_at = now()
    db.commit()
    rl.clear_failures(db, ehash)
    rl.record_attempt(db, "login", ip, success=True, ehash=ehash)
    token = create_session(db, user, request.headers.get("user-agent"))
    _set_cookie(response, token)
    log.info("login ok user=%s ip=%s", user.id, ip)
    return _user_out(user)


@router.post("/logout", status_code=204)
def logout(found=Depends(current_session), db: Session = Depends(get_db)):
    user, sess = found
    revoke(db, sess)
    log.info("logout user=%s", user.id)
    response = Response(status_code=204)
    response.delete_cookie(COOKIE_NAME, path="/")
    return response


@router.get("/me", response_model=UserEnvelope)
def me(user: User = Depends(current_user)):
    return _user_out(user)
