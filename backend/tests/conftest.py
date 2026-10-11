import copy
import json
import os
import tempfile
from pathlib import Path

import pytest

# Tests ALWAYS use their own throw-away SQLite file: never dev.db, never a Neon URL from .env.
# Must be set before anything imports app.db.session.
_TEST_DB = Path(tempfile.gettempdir()) / "rationsaathi_test.db"
os.environ["DATABASE_URL"] = f"sqlite:///{_TEST_DB.as_posix()}"
os.environ["COOKIE_SECURE"] = "false"
os.environ["APP_ORIGIN"] = "http://localhost:5173"
os.environ["LLM_BASE_URL"] = ""
os.environ["LLM_API_KEY"] = ""
os.environ["LLM_MODEL"] = ""
os.environ["EMAIL_API_KEY"] = ""
os.environ["PROOF_AUTO_ACCEPT"] = "false"      # tests exercise the real decision

FIXTURES = Path(__file__).parent / "fixtures"


@pytest.fixture(autouse=True)
def _clean_state():
    from app.auth.rate_limit import reset_all
    from app.db import models  # noqa: F401
    from app.db.session import Base, engine
    Base.metadata.drop_all(bind=engine)
    Base.metadata.create_all(bind=engine)
    reset_all()
    yield


@pytest.fixture(autouse=True)
def _no_real_shop_lookups(monkeypatch):
    """Tests never call the real Overpass API. Shop tests install their own fake."""
    from app.routers import shops
    shops._cache.clear()
    monkeypatch.setattr(shops, "_fetch", lambda lat, lon, radius_km: [])


@pytest.fixture
def demo():
    """Fresh dict of the demo case (plan_overview.txt section 6) on every call."""
    return copy.deepcopy(json.loads((FIXTURES / "demo_case.json").read_text("utf-8")))


def make_record(id, rule_id, value, unit, on, **kw):
    rec = {"id": id, "rule_id": rule_id, "item": kw.pop("item", "Rice"),
           "quantity": {"value": value, "unit": unit} if value is not None else None,
           "date": on, "status": "confirmed", "entry_method": "manual",
           "evidence": {"receipt_ref": "x", "note": None, "no_receipt": False,
                        "receipt_text": None, "proof_photo": False}}
    rec.update(kw)
    return rec


def make_case(rules, records, members=4, start="2026-09-01", end="2026-09-30"):
    return {"household_ref": None, "members": members,
            "period": {"start": start, "end": end}, "rules": rules, "records": records}


def rice_rule(value="5", unit="kg", basis="per_member", due_by=None):
    return {"id": "r", "item": "Rice", "basis": basis,
            "quantity": {"value": value, "unit": unit}, "due_by": due_by}
