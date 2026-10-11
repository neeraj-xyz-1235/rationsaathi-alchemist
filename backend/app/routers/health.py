from fastapi import APIRouter
from sqlalchemy import text

from app.config import settings
from app.db.session import engine

router = APIRouter(prefix="/api")


@router.get("/health")
def health():
    try:
        with engine.connect() as conn:
            conn.execute(text("SELECT 1"))
        db = "ok"
    except Exception:
        db = "error"
    return {
        "status": "ok" if db == "ok" else "degraded",
        "db": db,
        "llm": "configured" if settings.ANTHROPIC_API_KEY else "not_configured",
        "email": "configured" if settings.EMAIL_API_KEY else "not_configured",
    }
