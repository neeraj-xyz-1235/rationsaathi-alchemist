from fastapi import FastAPI

from app.config import settings
from app.routers import auth, calculate, cases, receipt, reports, shops

app = FastAPI(
    title="RationSaathi API",
    docs_url="/docs" if settings.enable_docs else None,
    redoc_url=None,
    openapi_url="/openapi.json" if settings.enable_docs else None,
)

for module in (auth, calculate, cases, receipt, reports, shops):
    app.include_router(module.router)


@app.get("/api/health")
def health():
    return {
        "status": "ok",
        "db": "ok",  # TODO (G): real DB check
        "llm": "configured" if settings.anthropic_api_key else "not_configured",
    }
