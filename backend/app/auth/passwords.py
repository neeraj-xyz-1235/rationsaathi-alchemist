"""argon2id hash/verify (plan_backend.txt 6.1). Plain passwords are never stored or logged."""
from functools import lru_cache
from pathlib import Path

from argon2 import PasswordHasher
from argon2.exceptions import InvalidHashError, VerificationError

_hasher = PasswordHasher()   # argon2id with the library's default parameters
_DUMMY_HASH = _hasher.hash("rationsaathi-dummy-password")


def hash_password(password: str) -> str:
    return _hasher.hash(password)


def verify_password(stored_hash: str | None, password: str) -> bool:
    """Always does one verify, even for an unknown account, so timing doesn't reveal it."""
    try:
        _hasher.verify(stored_hash or _DUMMY_HASH, password)
        return stored_hash is not None
    except (VerificationError, InvalidHashError):
        return False


def needs_rehash(stored_hash: str) -> bool:
    return _hasher.check_needs_rehash(stored_hash)


@lru_cache(maxsize=1)
def _common() -> frozenset[str]:
    path = Path(__file__).with_name("common_passwords.txt")
    return frozenset(l.strip().lower() for l in path.read_text("utf-8").splitlines() if l.strip())


def is_common_password(password: str) -> bool:
    return password.lower() in _common()
