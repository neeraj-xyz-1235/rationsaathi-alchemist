"""Pydantic models = the API contract (plan_backend.txt section 2)."""
import datetime as dt
from datetime import date
from typing import Annotated, Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator

from app.engine.units import UnitError, to_base


class Strict(BaseModel):
    model_config = ConfigDict(extra="forbid")


Unit = Literal["kg", "g", "l", "ml", "pcs"]


class Quantity(Strict):
    value: str = Field(max_length=20)
    unit: Unit

    @model_validator(mode="after")
    def _exact_and_positive(self):
        try:
            _, base = to_base(self.value, self.unit)
        except UnitError as e:
            raise ValueError(str(e))   # QUANTITY_INVALID / TOO_PRECISE (never rounded)
        if base <= 0:
            raise ValueError("QUANTITY_NOT_POSITIVE")
        return self


class Period(Strict):
    start: date
    end: date

    @model_validator(mode="after")
    def _ordered(self):
        if self.end < self.start:
            raise ValueError("PERIOD_END_BEFORE_START")
        return self


class Evidence(Strict):
    receipt_ref: str | None = Field(None, max_length=60)
    note: str | None = Field(None, max_length=500)
    no_receipt: bool = False
    receipt_text: str | None = Field(None, max_length=2000)
    proof_photo: bool = False  # a receipt photo is held by the household; the image itself is never uploaded


class Rule(Strict):
    id: str = Field(min_length=1, max_length=60)
    item: str = Field(min_length=1, max_length=60)
    basis: Literal["per_member", "per_household"]
    quantity: Quantity
    due_by: date | None = None

    @field_validator("item")
    @classmethod
    def _item_not_blank(cls, v):
        if not v.strip():
            raise ValueError("ITEM_REQUIRED")
        return v


class Record(Strict):
    id: str = Field(min_length=1, max_length=60)
    rule_id: str | None = Field(None, max_length=60)
    item: str = Field(min_length=1, max_length=60)
    quantity: Quantity | None = None      # pending records may have none
    date: dt.date | None = None
    status: Literal["confirmed", "pending"]
    entry_method: Literal["manual", "extracted_confirmed", "extracted_edited"]
    evidence: Evidence = Field(default_factory=Evidence)

    @model_validator(mode="after")
    def _confirmed_needs_quantity(self):
        if self.status == "confirmed" and self.quantity is None:
            raise ValueError("QUANTITY_REQUIRED_WHEN_CONFIRMED")
        return self


class Case(Strict):
    household_ref: str | None = Field(None, max_length=60)
    members: int = Field(gt=0, le=1000)
    period: Period
    rules: list[Rule] = Field(max_length=20)
    records: list[Record] = Field(max_length=200)

    @model_validator(mode="after")
    def _consistent(self):
        rule_ids = [r.id for r in self.rules]
        if len(set(rule_ids)) != len(rule_ids):
            raise ValueError("DUPLICATE_RULE_ID")
        rec_ids = [r.id for r in self.records]
        if len(set(rec_ids)) != len(rec_ids):
            raise ValueError("DUPLICATE_RECORD_ID")
        for rec in self.records:
            if rec.rule_id is not None and rec.rule_id not in rule_ids:
                raise ValueError("UNKNOWN_RULE_ID")
        return self


# ── Responses (2.2) ──────────────────────────────────────

class Term(BaseModel):
    record_id: str
    value: str


class Expected(BaseModel):
    value: str
    basis: Literal["per_member", "per_household"]
    members: int
    per_unit: str


class Received(BaseModel):
    value: str
    terms: list[Term]


class Difference(BaseModel):
    value: str
    direction: Literal["below", "equal", "above"]


class Balance(BaseModel):
    remaining: str
    over_by: str
    percent_used: str
    phase: Literal["ongoing", "ended"]


class Excluded(BaseModel):
    record_id: str
    reason: Literal["PENDING_NOT_CONFIRMED", "MISSING_DATE", "OUTSIDE_PERIOD", "UNIT_MISMATCH"]


class Label(BaseModel):
    code: Literal["shortfall", "no_difference", "above_expected", "unclear", "late", "unrecorded"]
    reason: str
    record_ids: list[str]


class ItemResult(BaseModel):
    rule_id: str
    item: str
    unit: Unit
    expected: Expected
    received: Received
    difference: Difference
    balance: Balance
    excluded: list[Excluded]
    labels: list[Label]


class PeriodResult(BaseModel):
    start: date
    end: date
    status: Literal["ongoing", "ended"]


class Unmatched(BaseModel):
    record_id: str
    reason: Literal["NO_RULE_FOR_ITEM"]


class EvidenceSummary(BaseModel):
    records: int
    with_receipt_ref: int
    with_receipt_text: int
    with_proof_photo: int
    no_receipt: int
    no_evidence: int


class CalculateResult(BaseModel):
    generated_at: str
    period: PeriodResult
    members: int
    items: list[ItemResult]
    unmatched: list[Unmatched]
    evidence_summary: EvidenceSummary


# ── Auth (2.5) ───────────────────────────────────────────

from pydantic import SecretStr  # noqa: E402
from email_validator import EmailNotValidError, validate_email  # noqa: E402

from app.auth.passwords import is_common_password  # noqa: E402


def _clean_email(v: str) -> str:
    return v.strip().lower()


class SignupRequest(Strict):
    email: str
    password: SecretStr
    display_name: str | None = None

    @field_validator("email")
    @classmethod
    def _email(cls, v):
        v = _clean_email(v)
        if len(v) > 254:
            raise ValueError("EMAIL_INVALID")
        try:
            return validate_email(v, check_deliverability=False).normalized.lower()
        except EmailNotValidError:
            raise ValueError("EMAIL_INVALID")

    @field_validator("display_name")
    @classmethod
    def _name(cls, v):
        if v is None:
            return None
        v = v.strip()
        if len(v) > 50:
            raise ValueError("NAME_TOO_LONG")
        return v or None

    @field_validator("password")
    @classmethod
    def _password_rules(cls, v, info):
        pw = v.get_secret_value()
        if len(pw) < 10:
            raise ValueError("PASSWORD_TOO_SHORT")
        if len(pw) > 128:
            raise ValueError("PASSWORD_TOO_LONG")
        if pw.lower() == info.data.get("email") or is_common_password(pw):
            raise ValueError("PASSWORD_TOO_COMMON")
        return v


class LoginRequest(Strict):
    """No format checks here: the answer must not reveal anything about accounts."""
    email: str = Field(max_length=254)
    password: SecretStr = Field(max_length=128)

    @field_validator("email")
    @classmethod
    def _email(cls, v):
        return _clean_email(v)


class UserOut(BaseModel):
    id: str
    email: str
    display_name: str | None


class UserEnvelope(BaseModel):
    user: UserOut


# ── Saved cases + reports (2.4) ──────────────────────────

class CaseSummary(BaseModel):
    id: str
    household_ref: str | None
    period: Period
    updated_at: str


class CaseCreated(BaseModel):
    id: str


class ReportCreated(BaseModel):
    report_id: str
    case: Case
    result: CalculateResult


class ReportOut(BaseModel):
    report_id: str
    generated_at: str
    case: Case
    result: CalculateResult


# ── Receipt parsing (2.3) ────────────────────────────────

class ParseRequest(Strict):
    text: str = Field(min_length=1, max_length=2000)
    period: Period
    known_items: list[Annotated[str, Field(max_length=60)]] = Field(default_factory=list, max_length=20)

    @field_validator("text")
    @classmethod
    def _not_blank(cls, v):
        if not v.strip():
            raise ValueError("TEXT_REQUIRED")
        return v


class Suggestion(BaseModel):
    item: str | None
    item_matches_rule: bool
    quantity: Quantity | None
    date: dt.date | None
    date_raw: str | None
    date_candidates: list[dt.date]
    receipt_ref: str | None
    issues: list[str]


class ParseResponse(BaseModel):
    method: Literal["llm", "regex"]
    raw_text: str
    suggestions: list[Suggestion]


# ── Shops placeholder (2.6) and tracker (2.7) ────────────

class ShopsResponse(BaseModel):
    status: Literal["ok", "empty", "unavailable"]
    shops: list[dict]
    message_code: Literal["SHOPS_FROM_OSM", "SHOPS_NONE_MAPPED", "SHOPS_LOOKUP_FAILED"]


class TrackerItem(BaseModel):
    item: str
    unit: Unit
    expected: str
    received: str
    remaining: str
    over_by: str
    percent_used: str
    labels: list[str]


class TrackerMonth(BaseModel):
    case_id: str
    period: PeriodResult
    items: list[TrackerItem]


class TrackerHousehold(BaseModel):
    household_ref: str | None
    months: list[TrackerMonth]


class TrackerResponse(BaseModel):
    households: list[TrackerHousehold]


# ── Email a report (2.8) ─────────────────────────────────

class EmailRequest(Strict):
    lang: Literal["en", "hi", "mr"]


class EmailQueued(BaseModel):
    status: Literal["queued"]
    sent_to: str


# ── Grievance notes (2.9) ────────────────────────────────

class GrievanceIn(Strict):
    portal_key: str = Field(pattern=r"^[a-z0-9_-]{1,40}$")
    reference_no: str | None = Field(None, max_length=60)
    filed_on: dt.date | None = None
    status: Literal["prepared", "filed", "resolved", "closed"]
    note: str | None = Field(None, max_length=500)


class GrievanceOut(BaseModel):
    id: str
    portal_key: str
    reference_no: str | None
    filed_on: dt.date | None
    status: Literal["prepared", "filed", "resolved", "closed"]
    note: str | None
    created_at: str
    updated_at: str


# ── Household profile (frontend setup page) ──────────────

Gender = Literal["female", "male", "other", "prefer_not_to_say"]


class HouseholdMember(Strict):
    name: str = Field(min_length=1, max_length=80)
    age: int = Field(ge=0, le=120)
    gender: Gender
    relationship: str = Field("member", max_length=30)

    @field_validator("name", "relationship")
    @classmethod
    def _strip(cls, v):
        v = v.strip()
        if not v:
            raise ValueError("REQUIRED")
        return v


class HouseholdProfileIn(Strict):
    head_name: str = Field(min_length=1, max_length=80)
    head_age: int = Field(ge=0, le=120)
    head_gender: Gender
    state: str = Field(min_length=1, max_length=60)
    district: str = Field(min_length=1, max_length=60)
    locality: str | None = Field(None, max_length=80)
    card_type: Literal["AAY", "PHH", "STATE_OTHER", "UNKNOWN"]
    card_colour: Literal["yellow", "orange", "white", "green", "blue", "other"]
    card_number_last4: str | None = Field(None, max_length=4)
    household_member_count: int | None = Field(None, ge=1, le=31)
    members: list[HouseholdMember] = Field(default_factory=list, max_length=30)

    @field_validator("head_name", "state", "district")
    @classmethod
    def _required_text(cls, v):
        v = v.strip()
        if not v:
            raise ValueError("REQUIRED")
        return v

    @field_validator("locality", "card_number_last4")
    @classmethod
    def _blank_is_none(cls, v):
        v = (v or "").strip()
        return v or None

    @field_validator("card_number_last4")
    @classmethod
    def _four_digits(cls, v):
        if v is not None and not (len(v) == 4 and v.isdigit()):
            raise ValueError("CARD_LAST4_INVALID")
        return v


# ── Withdrawals (frontend withdrawal page) ───────────────

from decimal import Decimal  # noqa: E402


class WithdrawalIn(Strict):
    item: str = Field(min_length=1, max_length=60)
    quantity: Decimal = Field(gt=0, max_digits=12, decimal_places=3)
    unit: Literal["kg", "g"] = "kg"
    withdrawal_date: dt.date
    receipt_reference: str | None = Field(None, max_length=60)

    @field_validator("receipt_reference")
    @classmethod
    def _blank_is_none(cls, v):
        v = (v or "").strip()
        return v or None


class MonthlyReportEmail(Strict):
    month: str = Field(pattern=r"^\d{4}-(0[1-9]|1[0-2])$")


class SavedShopIn(Strict):
    name: str = Field(min_length=1, max_length=100)
    lat: float = Field(ge=-90, le=90)
    lon: float = Field(ge=-180, le=180)
    address: str | None = Field(None, max_length=200)
    phone: str | None = Field(None, max_length=30)

    @field_validator("name")
    @classmethod
    def _name_required(cls, v):
        v = v.strip()
        if not v:
            raise ValueError("REQUIRED")
        return v

    @field_validator("address", "phone")
    @classmethod
    def _blank_is_none(cls, v):
        v = (v or "").strip()
        return v or None
