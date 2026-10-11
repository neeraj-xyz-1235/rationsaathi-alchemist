"""current_user / optional_user dependencies (plan_backend.txt 6.2)."""
from fastapi import Cookie, Depends, HTTPException
from sqlalchemy.orm import Session

from app.db.models import User, UserSession
from app.db.session import get_db

from .sessions import COOKIE_NAME, lookup


def _resolve(db: Session, token: str | None):
    return lookup(db, token)


def optional_session(rs_session: str | None = Cookie(None, alias=COOKIE_NAME),
                     db: Session = Depends(get_db)) -> tuple[User, UserSession] | None:
    return _resolve(db, rs_session)


def current_session(found=Depends(optional_session)) -> tuple[User, UserSession]:
    if found is None:
        raise HTTPException(401, "UNAUTHENTICATED")
    return found


def current_user(found=Depends(current_session)) -> User:
    return found[0]


def optional_user(found=Depends(optional_session)) -> User | None:
    return found[0] if found else None
