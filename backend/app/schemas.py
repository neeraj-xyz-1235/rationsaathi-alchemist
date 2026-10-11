from datetime import date
from typing import Literal
from pydantic import BaseModel, ConfigDict, Field

class Strict(BaseModel):
    model_config = ConfigDict(extra="forbid")

Unit = Literal["kg", "g", "l", "ml", "pcs"]

class Quantity(Strict):
    value: str = Field(max_length=20)
    unit: Unit

class Period(Strict):
    start: date
    end: date

class Evidence(Strict):
    receipt_ref: str | None = Field(None, max_length=60)
    note: str | None = Field(None, max_length=500)
    no_receipt: bool = False
    receipt_text: str | None = Field(None, max_length=2000)

class Rule(Strict):
    id: str = Field(max_length=60)
    item: str = Field(max_length=60)
    basis: Literal["per_member", "per_household"]
    quantity: Quantity
    due_by: date | None = None

class Record(Strict):
    id: str = Field(max_length=60)
    rule_id: str | None = None
    item: str = Field(max_length=60)
    quantity: Quantity | None = None      # pending records may have none
    date: date | None = None
    status: Literal["confirmed", "pending"]
    entry_method: Literal["manual", "extracted_confirmed", "extracted_edited"]
    evidence: Evidence = Evidence()

class Case(Strict):
    household_ref: str | None = Field(None, max_length=60)
    members: int = Field(gt=0)
    period: Period
    rules: list[Rule] = Field(max_length=20)
    records: list[Record] = Field(max_length=200)