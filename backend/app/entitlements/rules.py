"""Monthly grain entitlement per ration-card category (a small, editable table).

HACKATHON ASSUMPTION: these are the central NFSA headline quantities (PHH 5 kg per person per
month, AAY 35 kg per household per month) with a fixed rice/wheat split. States set their own
split and sometimes add items; replace RULES (or key it by state) with verified figures before
real use. All maths is exact integer grams, never floats."""
from app.engine.units import from_base, to_base

# card_type -> (scheme name, basis, {item: kg per member / per household as exact decimal strings})
RULES = {
    "PHH": ("Priority Household (PHH)", "per_member", {"Rice": "3", "Wheat": "2"}),
    "AAY": ("Antyodaya Anna Yojana (AAY)", "per_household", {"Rice": "20", "Wheat": "15"}),
}
# "Not sure" / other state schemes use the PHH figures, and say so.
FALLBACK = "PHH"


def scheme_for(card_type: str) -> tuple[str, str, dict[str, str], bool]:
    """(scheme name, basis, per-unit kg by item, assumed?)"""
    if card_type in RULES:
        return (*RULES[card_type], False)
    name, basis, items = RULES[FALLBACK]
    return f"{name} (assumed: card category not confirmed)", basis, items, True


def compute(card_type: str, members: int) -> dict:
    name, basis, per_unit, assumed = scheme_for(card_type)
    factor = members if basis == "per_member" else 1
    items = []
    for item, kg in per_unit.items():
        _, base = to_base(kg, "kg")
        items.append({"item": item, "unit": "kg", "basis": basis, "per_unit": kg,
                      "allocated_quantity": from_base(base * factor, "kg")})
    return {"scheme_name": name, "basis": basis, "members": members, "assumed": assumed,
            "items": items}
