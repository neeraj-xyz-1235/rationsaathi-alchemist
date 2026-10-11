from contextlib import asynccontextmanager
from fastapi import FastAPI
from app.db.session import engine, Base
from app.db import models  # noqa: F401  (registers the tables)


@asynccontextmanager
async def lifespan(app: FastAPI):
    Base.metadata.create_all(bind=engine)
    yield


app = FastAPI(lifespan=lifespan)


@app.get("/health")
def health():
    return {"ok": True}