"""Clear the login/signup/email rate-limit counters in the LOCAL SQLite dev database.

    python scripts/reset_dev_limits.py

Refuses to run against anything but SQLite, so it can never touch a Neon/production database."""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from app.db import models as m  # noqa: E402
from app.db.session import IS_SQLITE, SessionLocal  # noqa: E402

if not IS_SQLITE:
    sys.exit("Refusing: DATABASE_URL is not SQLite. This script is for local development only.")

with SessionLocal() as db:
    a = db.query(m.AuthAttempt).delete()
    e = db.query(m.EmailLog).delete()
    db.commit()
print(f"Cleared {a} auth attempts and {e} email log rows from the local dev database.")
