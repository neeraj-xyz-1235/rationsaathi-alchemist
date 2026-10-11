import os
import sys
from datetime import date
from argon2 import PasswordHasher
from app.db.session import SessionLocal, engine, Base
from app.db import models as m

EMAIL = "demo@rationsaathi.test"


def add_case(db, user, ref, members, start, end, rules, records):
    case = m.Case(user_id=user.id, household_ref=ref, members=members,
                  period_start=start, period_end=end)
    db.add(case)
    db.flush()
    # rules first, then records (foreign key order)
    for i, (rid, item, qty) in enumerate(rules):
        db.add(m.EntitlementRule(case_id=case.id, id=rid, position=i, item=item,
                                 basis="per_member", qty_base=qty, unit="kg"))
    db.flush()
    for i, (did, rid, item, qty, on, ref_no, note) in enumerate(records):
        db.add(m.DistributionRecord(
            case_id=case.id, id=did, position=i, rule_id=rid, item=item,
            qty_base=qty, unit="kg", received_on=on, status="confirmed",
            entry_method="manual", receipt_ref=ref_no, note=note))
    db.flush()
    return case


def main():
    password = os.getenv("SEED_PASSWORD")
    if not password:
        sys.exit("Set SEED_PASSWORD first (env var or backend/.env).")

    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    try:
        # Re-running is safe: remove the old demo user (cascades to all their data)
        old = db.query(m.User).filter_by(email=EMAIL).first()
        if old:
            db.delete(old)
            db.flush()

        user = m.User(email=EMAIL, password_hash=PasswordHasher().hash(password),
                      display_name="Demo User")
        db.add(user)
        db.flush()

        rice_wheat = [("r-rice", "Rice", 5000), ("r-wheat", "Wheat", 2500)]

        # Household "Home": 4 members
        add_case(db, user, "Home", 4, date(2026, 9, 1), date(2026, 9, 30), rice_wheat, [
            ("d1", "r-rice", "Rice", 8000, date(2026, 9, 3), "101", None),
            ("d2", "r-rice", "Rice", 6000, date(2026, 9, 20), "145", None),
        ])  # rice 14 of 20 kg
        add_case(db, user, "Home", 4, date(2026, 8, 1), date(2026, 8, 31), rice_wheat, [
            ("d1", "r-rice", "Rice", 10000, date(2026, 8, 4), "A-201", None),
            ("d2", "r-rice", "Rice", 10000, date(2026, 8, 19), "A-244", None),
            ("d3", "r-wheat", "Wheat", 10000, date(2026, 8, 4), "A-201", None),
        ])  # rice 20 of 20, wheat 10 of 10
        add_case(db, user, "Home", 4, date(2026, 7, 1), date(2026, 7, 31), rice_wheat, [
            ("d1", "r-rice", "Rice", 12000, date(2026, 7, 6), "J-310", None),
            ("d2", "r-wheat", "Wheat", 10000, date(2026, 7, 6), "J-310", None),
        ])  # rice 12 of 20 (balance 8 kg), wheat 10 of 10

        # Household "Grandparents": 2 members, ongoing month
        add_case(db, user, "Grandparents", 2, date(2026, 10, 1), date(2026, 10, 31),
                 [("r-rice", "Rice", 5000)], [
            ("d1", "r-rice", "Rice", 7000, date(2026, 10, 4), None,
             "Collected at the shop, noted in diary"),
        ])  # rice 7 of 10 kg, remaining 3 kg, 70.0%

        db.commit()
        print(f"Seeded {EMAIL} with 4 demo cases.")
    finally:
        db.close()


if __name__ == "__main__":
    main()