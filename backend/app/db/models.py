import uuid
from datetime import datetime, date
from sqlalchemy import (
    Uuid, JSON, Float, Date, BigInteger, Integer, Text, Boolean, DateTime,
    ForeignKey, ForeignKeyConstraint, CheckConstraint, Index, func, false,
)
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column
from .session import Base

JsonType = JSON().with_variant(JSONB, "postgresql")
TS = DateTime(timezone=True)


# ── Accounts ─────────────────────────────────────────────

class User(Base):
    __tablename__ = "users"
    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    email: Mapped[str] = mapped_column(Text, nullable=False, unique=True)  # app trims + lowercases
    password_hash: Mapped[str] = mapped_column(Text, nullable=False)
    display_name: Mapped[str | None] = mapped_column(Text)
    email_verified_at: Mapped[datetime | None] = mapped_column(TS)
    created_at: Mapped[datetime] = mapped_column(TS, server_default=func.now())
    last_login_at: Mapped[datetime | None] = mapped_column(TS)
    __table_args__ = (
        CheckConstraint("display_name IS NULL OR length(display_name) <= 50",
                        name="ck_users_display_name_len"),
    )


class UserSession(Base):  # named UserSession to avoid clashing with SQLAlchemy's Session
    __tablename__ = "sessions"
    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(
        Uuid, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    token_hash: Mapped[str] = mapped_column(Text, nullable=False, unique=True)
    created_at: Mapped[datetime] = mapped_column(TS, server_default=func.now())
    expires_at: Mapped[datetime] = mapped_column(TS, nullable=False)
    last_seen_at: Mapped[datetime] = mapped_column(TS, server_default=func.now())
    user_agent: Mapped[str | None] = mapped_column(Text)
    __table_args__ = (Index("sessions_user_id_idx", "user_id"),)


class AuthAttempt(Base):
    __tablename__ = "auth_attempts"
    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    kind: Mapped[str] = mapped_column(Text, nullable=False)
    email_hash: Mapped[str | None] = mapped_column(Text)
    ip: Mapped[str] = mapped_column(Text, nullable=False)
    success: Mapped[bool] = mapped_column(Boolean, nullable=False)
    created_at: Mapped[datetime] = mapped_column(TS, server_default=func.now())
    __table_args__ = (
        CheckConstraint("kind IN ('login','signup')", name="ck_auth_attempts_kind"),
        Index("auth_attempts_email_idx", "email_hash", "created_at"),
        Index("auth_attempts_ip_idx", "ip", "created_at"),
    )


# ── Ration data ──────────────────────────────────────────

class Case(Base):
    __tablename__ = "cases"
    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(
        Uuid, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    household_ref: Mapped[str | None] = mapped_column(Text)
    members: Mapped[int] = mapped_column(Integer, nullable=False)
    period_start: Mapped[date] = mapped_column(Date, nullable=False)
    period_end: Mapped[date] = mapped_column(Date, nullable=False)
    created_at: Mapped[datetime] = mapped_column(TS, server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        TS, server_default=func.now(), onupdate=func.now())
    __table_args__ = (
        CheckConstraint("household_ref IS NULL OR length(household_ref) <= 60",
                        name="ck_cases_household_ref_len"),
        CheckConstraint("members > 0", name="ck_cases_members_pos"),
        CheckConstraint("period_end >= period_start", name="ck_cases_period_order"),
        Index("cases_user_period_idx", "user_id", "period_start"),
    )


class EntitlementRule(Base):
    __tablename__ = "entitlement_rules"
    case_id: Mapped[uuid.UUID] = mapped_column(
        Uuid, ForeignKey("cases.id", ondelete="CASCADE"), primary_key=True)
    id: Mapped[str] = mapped_column(Text, primary_key=True)
    position: Mapped[int] = mapped_column(Integer, nullable=False)
    item: Mapped[str] = mapped_column(Text, nullable=False)
    basis: Mapped[str] = mapped_column(Text, nullable=False)
    qty_base: Mapped[int] = mapped_column(BigInteger, nullable=False)
    unit: Mapped[str] = mapped_column(Text, nullable=False)
    due_by: Mapped[date | None] = mapped_column(Date)
    __table_args__ = (
        CheckConstraint("basis IN ('per_member','per_household')", name="ck_rules_basis"),
        CheckConstraint("qty_base > 0", name="ck_rules_qty_pos"),
        CheckConstraint("unit IN ('kg','g','l','ml','pcs')", name="ck_rules_unit"),
    )


class DistributionRecord(Base):
    __tablename__ = "distribution_records"
    case_id: Mapped[uuid.UUID] = mapped_column(
        Uuid, ForeignKey("cases.id", ondelete="CASCADE"), primary_key=True)
    id: Mapped[str] = mapped_column(Text, primary_key=True)
    position: Mapped[int] = mapped_column(Integer, nullable=False)
    rule_id: Mapped[str | None] = mapped_column(Text)
    item: Mapped[str] = mapped_column(Text, nullable=False)
    qty_base: Mapped[int | None] = mapped_column(BigInteger)
    unit: Mapped[str] = mapped_column(Text, nullable=False)
    received_on: Mapped[date | None] = mapped_column(Date)
    status: Mapped[str] = mapped_column(Text, nullable=False)
    entry_method: Mapped[str] = mapped_column(Text, nullable=False)
    receipt_ref: Mapped[str | None] = mapped_column(Text)
    note: Mapped[str | None] = mapped_column(Text)
    no_receipt: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=False, server_default=false())
    receipt_text: Mapped[str | None] = mapped_column(Text)
    extraction = mapped_column(JsonType)
    __table_args__ = (
        ForeignKeyConstraint(
            ["case_id", "rule_id"],
            ["entitlement_rules.case_id", "entitlement_rules.id"]),
        CheckConstraint("qty_base IS NULL OR qty_base > 0", name="ck_rec_qty_pos"),
        CheckConstraint("unit IN ('kg','g','l','ml','pcs')", name="ck_rec_unit"),
        CheckConstraint("status IN ('confirmed','pending')", name="ck_rec_status"),
        CheckConstraint(
            "entry_method IN ('manual','extracted_confirmed','extracted_edited')",
            name="ck_rec_entry_method"),
        CheckConstraint("status = 'pending' OR qty_base IS NOT NULL",
                        name="ck_rec_pending_qty"),
    )


class Report(Base):
    __tablename__ = "reports"
    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    case_id: Mapped[uuid.UUID] = mapped_column(
        Uuid, ForeignKey("cases.id", ondelete="CASCADE"), nullable=False)
    generated_at: Mapped[datetime] = mapped_column(TS, server_default=func.now())
    case_snapshot = mapped_column(JsonType, nullable=False)
    result = mapped_column(JsonType, nullable=False)
    __table_args__ = (Index("reports_case_id_idx", "case_id"),)


# ── Phase B ──────────────────────────────────────────────

class EmailLog(Base):
    __tablename__ = "email_log"
    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    user_id: Mapped[uuid.UUID] = mapped_column(
        Uuid, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    report_id: Mapped[uuid.UUID | None] = mapped_column(
        Uuid, ForeignKey("reports.id", ondelete="SET NULL"))
    kind: Mapped[str] = mapped_column(Text, nullable=False)
    status: Mapped[str] = mapped_column(Text, nullable=False)
    error_code: Mapped[str | None] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(TS, server_default=func.now())
    __table_args__ = (
        CheckConstraint("kind IN ('report')", name="ck_email_kind"),
        CheckConstraint("status IN ('queued','sent','failed')", name="ck_email_status"),
        Index("email_log_user_idx", "user_id", "created_at"),
    )


class GrievanceNote(Base):  # optional, cut first if time is short
    __tablename__ = "grievance_notes"
    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    case_id: Mapped[uuid.UUID] = mapped_column(
        Uuid, ForeignKey("cases.id", ondelete="CASCADE"), nullable=False)
    portal_key: Mapped[str] = mapped_column(Text, nullable=False)  # validate regex in app code
    reference_no: Mapped[str | None] = mapped_column(Text)
    filed_on: Mapped[date | None] = mapped_column(Date)
    status: Mapped[str] = mapped_column(Text, nullable=False)
    note: Mapped[str | None] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(TS, server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        TS, server_default=func.now(), onupdate=func.now())
    __table_args__ = (
        CheckConstraint("reference_no IS NULL OR length(reference_no) <= 60",
                        name="ck_gn_ref_len"),
        CheckConstraint("status IN ('prepared','filed','resolved','closed')",
                        name="ck_gn_status"),
        CheckConstraint("note IS NULL OR length(note) <= 500", name="ck_gn_note_len"),
        Index("grievance_notes_case_idx", "case_id"),
    )

# ── Household workflow (profile, proof, withdrawals) ─────

class Household(Base):
    __tablename__ = "households"
    user_id: Mapped[uuid.UUID] = mapped_column(
        Uuid, ForeignKey("users.id", ondelete="CASCADE"), primary_key=True)
    head_name: Mapped[str] = mapped_column(Text, nullable=False)
    head_age: Mapped[int] = mapped_column(Integer, nullable=False)
    head_gender: Mapped[str] = mapped_column(Text, nullable=False)
    state: Mapped[str] = mapped_column(Text, nullable=False)
    district: Mapped[str] = mapped_column(Text, nullable=False)
    locality: Mapped[str | None] = mapped_column(Text)
    card_type: Mapped[str] = mapped_column(Text, nullable=False)
    card_colour: Mapped[str] = mapped_column(Text, nullable=False)
    card_number_last4: Mapped[str | None] = mapped_column(Text)
    members = mapped_column(JsonType, nullable=False)       # list of member dicts (head first)
    proof_status: Mapped[str] = mapped_column(Text, nullable=False, default="not_submitted")
    proof_result = mapped_column(JsonType)                  # what the check found; never the file
    proof_sha256: Mapped[str | None] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(TS, server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        TS, server_default=func.now(), onupdate=func.now())
    __table_args__ = (
        CheckConstraint(
            "proof_status IN ('not_submitted','verified','needs_review','rejected')",
            name="ck_household_proof_status"),
    )


class Allocation(Base):
    """One computed monthly allocation per account per month ('YYYY-MM')."""
    __tablename__ = "allocations"
    user_id: Mapped[uuid.UUID] = mapped_column(
        Uuid, ForeignKey("users.id", ondelete="CASCADE"), primary_key=True)
    period: Mapped[str] = mapped_column(Text, primary_key=True)
    data = mapped_column(JsonType, nullable=False)
    created_at: Mapped[datetime] = mapped_column(TS, server_default=func.now())


class Withdrawal(Base):
    """A collection recorded against the month's allocation, with a server-made receipt."""
    __tablename__ = "withdrawals"
    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(
        Uuid, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    period: Mapped[str] = mapped_column(Text, nullable=False)          # 'YYYY-MM' of the date
    item: Mapped[str] = mapped_column(Text, nullable=False)
    qty_base: Mapped[int] = mapped_column(BigInteger, nullable=False)  # grams
    withdrawal_date: Mapped[date] = mapped_column(Date, nullable=False)
    reference: Mapped[str | None] = mapped_column(Text)               # shop's own receipt number
    receipt_id: Mapped[str] = mapped_column(Text, nullable=False, unique=True)
    verification_code: Mapped[str] = mapped_column(Text, nullable=False, unique=True)
    status: Mapped[str] = mapped_column(Text, nullable=False, default="recorded")
    created_at: Mapped[datetime] = mapped_column(TS, server_default=func.now())
    __table_args__ = (
        CheckConstraint("qty_base > 0", name="ck_withdrawal_qty_pos"),
        CheckConstraint("status IN ('recorded','cancelled')", name="ck_withdrawal_status"),
        Index("withdrawals_user_period_idx", "user_id", "period"),
    )


class SavedShop(Base):
    """A ration shop the user pinned themselves (OpenStreetMap has very few). Private to them."""
    __tablename__ = "saved_shops"
    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(
        Uuid, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    name: Mapped[str] = mapped_column(Text, nullable=False)
    lat: Mapped[float] = mapped_column(Float, nullable=False)
    lon: Mapped[float] = mapped_column(Float, nullable=False)
    address: Mapped[str | None] = mapped_column(Text)
    phone: Mapped[str | None] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(TS, server_default=func.now())
    __table_args__ = (Index("saved_shops_user_idx", "user_id"),)


class WithdrawalProof(Base):
    """What the receipt photo showed, checked against the withdrawal. The photo itself is never kept."""
    __tablename__ = "withdrawal_proofs"
    withdrawal_id: Mapped[uuid.UUID] = mapped_column(
        Uuid, ForeignKey("withdrawals.id", ondelete="CASCADE"), primary_key=True)
    status: Mapped[str] = mapped_column(Text, nullable=False)
    result = mapped_column(JsonType)
    sha256: Mapped[str | None] = mapped_column(Text)
    updated_at: Mapped[datetime] = mapped_column(TS, server_default=func.now())
    __table_args__ = (
        CheckConstraint("status IN ('verified','mismatch','unreadable')",
                        name="ck_withdrawal_proof_status"),
    )
