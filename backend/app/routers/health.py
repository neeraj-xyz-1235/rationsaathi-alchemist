from fastapi import APIRouter
from sqlalchemy import text

from app.config import settings
from app.db.session import engine
from app.email import sender as email_sender

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
        "llm": "configured" if settings.LLM_BASE_URL and settings.LLM_MODEL else "not_configured",
        "vision": "configured" if settings.LLM_BASE_URL and settings.LLM_VISION_MODEL else "not_configured",
        "email": "configured" if email_sender.is_configured() else "not_configured",
    }
