from fastapi import APIRouter, Depends

from app.auth.rate_limit import limit_calculate

from app.engine.calculator import calculate
from app.schemas import CalculateResult, Case

router = APIRouter(prefix="/api")


@router.post("/calculate", response_model=CalculateResult, dependencies=[Depends(limit_calculate)])
def calculate_endpoint(case: Case):
    """Public and stateless: nothing is stored, no database needed."""
    return calculate(case)
