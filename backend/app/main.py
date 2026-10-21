"""Voicewell FastAPI app. Run: uv run uvicorn app.main:app --port 8000"""
from __future__ import annotations

import logging
import time
from pathlib import Path
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse
from fastapi.staticfiles import StaticFiles

from . import db, demo
from .config import settings
from .errors import ApiError
from .routes import router
from .store import COOKIE_NAME, hash_sid

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(name)s %(message)s")
# httpx logs full request URLs at INFO (k-ID session ids are in the query); keep it quiet.
logging.getLogger("httpx").setLevel(logging.WARNING)
log = logging.getLogger("voicewell.http")

@asynccontextmanager
async def lifespan(_: FastAPI):
    db.init_db()  # creates backend/data/voicewell.db and the users table
    demo.seed()
    if not settings.jwt_secret:
        log.warning("JWT_SECRET is not set: sign in is unavailable")
    yield


app = FastAPI(title="Voicewell", docs_url=None, redoc_url=None, openapi_url=None, lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[settings.frontend_origin],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.middleware("http")
async def access_log(request: Request, call_next):
    start = time.perf_counter()
    status = 500
    try:
        response = await call_next(request)
        status = response.status_code
        return response
    finally:
        # route, status, timing and a hashed session id only
        log.info(
            "%s %s %s %.0fms sid=%s",
            request.method,
            request.url.path,
            status,
            (time.perf_counter() - start) * 1000,
            hash_sid(request.cookies.get(COOKIE_NAME)),
        )


@app.exception_handler(ApiError)
async def api_error_handler(_: Request, exc: ApiError):
    return JSONResponse({"error": exc.code, "message": exc.message}, status_code=exc.status)


@app.exception_handler(RequestValidationError)
async def validation_handler(_: Request, __: RequestValidationError):
    return JSONResponse({"error": "bad_request", "message": "That request wasn't in the right shape."}, status_code=400)


@app.exception_handler(Exception)
async def unhandled(_: Request, exc: Exception):
    log.error("unhandled %s", type(exc).__name__)
    return JSONResponse({"error": "server_error", "message": "Something went wrong on our side."}, status_code=500)


app.include_router(router)


# Production: serve the built frontend from the same origin so cookies and the voice websocket just work.
_DIST = Path(__file__).resolve().parent.parent.parent / "frontend" / "dist"
if _DIST.is_dir():
    app.mount("/assets", StaticFiles(directory=_DIST / "assets"), name="assets")

    @app.get("/{path:path}", include_in_schema=False)
    async def spa(path: str):
        if path.startswith("api/"):
            raise ApiError(404, "not_found", "That isn't here.")
        target = (_DIST / path).resolve()
        if path and target.is_file() and _DIST in target.parents:
            return FileResponse(target)
        return FileResponse(_DIST / "index.html")
