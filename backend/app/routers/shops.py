"""GET /api/shops/nearby: PLACEHOLDER for a planned feature (plan_backend.txt 2.6).
Never returns invented shops. Coordinates are validated and then ignored: not stored, not logged."""
from typing import Annotated

from fastapi import APIRouter, Query

from app.schemas import ShopsResponse

router = APIRouter(prefix="/api")


@router.get("/shops/nearby", response_model=ShopsResponse)
def nearby(lat: Annotated[float, Query(ge=-90, le=90)],
           lon: Annotated[float, Query(ge=-180, le=180)],
           radius_km: Annotated[float, Query(ge=1, le=25)] = 5):
    return {"status": "planned", "shops": [], "message_code": "SHOPS_COMING_SOON"}
