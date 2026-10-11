from contextlib import asynccontextmanager

from fastapi import FastAPI

from app.config import settings
from app.db import models  # noqa: F401  (registers the tables)
from app.db.session import Base, engine
from app.errors import install_error_handlers
from app.routers import auth, calculate, health
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
app.add_middleware(SecurityMiddleware)
app.include_router(health.router)
app.include_router(auth.router)
app.include_router(calculate.router)
