from fastapi import APIRouter
from app.schemas import Case
from app.engine.calculator import calculate

router = APIRouter(prefix="/api")

@router.post("/calculate")
def calculate_endpoint(case: Case):
    return calculate(case)