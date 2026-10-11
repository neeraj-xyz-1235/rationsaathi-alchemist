import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI

from app.config import settings
from app.db import models  # noqa: F401  (registers the tables)
from app.db.session import Base, engine
from app.errors import install_error_handlers
from app.routers import (auth, calculate, cases, entitlements, grievances, health, household,
                         monthly_report, receipt, reports, shops, tracker, withdrawals)
from app.security.middleware import SecurityMiddleware


@asynccontextmanager
async def lifespan(app: FastAPI):
    Base.metadata.create_all(bind=engine)
    yield


app = FastAPI(
    title="RationSaathi API",
    lifespan=lifespan,
    docs_url="/docs" if settings.ENABLE_DOCS else None,
    redoc_url=None,
    openapi_url="/openapi.json" if settings.ENABLE_DOCS else None,
)
install_error_handlers(app)


class _RedactShopCoords(logging.Filter):
    """Coordinates are never logged (plan_backend.txt 2.6): strip the query from access logs."""

    def filter(self, record):
        args = record.args
        if isinstance(args, tuple) and len(args) >= 3 and str(args[2]).startswith("/api/shops"):
            record.args = (args[0], args[1], str(args[2]).split("?")[0] + "?<redacted>") + args[3:]
        return True


logging.getLogger("uvicorn.access").addFilter(_RedactShopCoords())
app.add_middleware(SecurityMiddleware)
app.include_router(health.router)
app.include_router(auth.router)
app.include_router(calculate.router)
app.include_router(cases.router)
app.include_router(reports.router)
app.include_router(receipt.router)
app.include_router(shops.router)
app.include_router(tracker.router)
app.include_router(grievances.router)
app.include_router(household.router)
app.include_router(entitlements.router)
app.include_router(withdrawals.router)
app.include_router(monthly_report.router)
