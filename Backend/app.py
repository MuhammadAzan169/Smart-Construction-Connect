"""
Smart Construction Connect — Backend API server.

This is the production entry point for the standalone backend (deployed on
Render). It serves ONLY the JSON API under /api/… plus the static uploaded
files (/company_data/… and /uploads/…). The React frontend is a separate
app deployed on Vercel.

Run locally:
    python app.py                 → serves the API on http://localhost:8000
    uvicorn app:app --reload      → same, with autoreload

On Render the start command is (see Procfile):
    uvicorn app:app --host 0.0.0.0 --port $PORT
"""

from __future__ import annotations

import logging
import os
import sys
import time
import uuid
from contextlib import asynccontextmanager
from pathlib import Path

# ── Ensure repo root is on sys.path so `backend.*` imports work ──
ROOT = Path(__file__).resolve().parent
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from backend.config import CORS_ORIGINS, PORT, setup_logging

# Initialise structured logging before anything else
setup_logging()
logger = logging.getLogger(__name__)

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import JSONResponse
from starlette.middleware.base import BaseHTTPMiddleware

from backend.routers import admin, ai_chat, auth, companies, messages, requests, suppliers, upload, events


# ── Request logging middleware ──
class RequestLoggingMiddleware(BaseHTTPMiddleware):
    """Log every request: method, path, query, client IP, status, and duration."""

    async def dispatch(self, request: Request, call_next):
        req_id = uuid.uuid4().hex[:8]
        start = time.perf_counter()

        client_ip = (
            request.headers.get("X-Forwarded-For", "").split(",")[0].strip()
            or (request.client.host if request.client else "unknown")
        )
        qs = f"?{request.url.query}" if request.url.query else ""
        path = request.url.path

        # Skip logging for static assets — too noisy
        is_static = path.startswith("/company_data/") or path.startswith("/uploads/")

        if not is_static:
            logger.info("[%s] → %s %s%s  client=%s", req_id, request.method, path, qs, client_ip)

        try:
            response = await call_next(request)
        except Exception as exc:
            duration = (time.perf_counter() - start) * 1000
            logger.error(
                "[%s] ✗ %s %s%s  client=%s  %.1fms  UNHANDLED: %s",
                req_id, request.method, path, qs, client_ip, duration, exc,
                exc_info=True,
            )
            raise

        duration = (time.perf_counter() - start) * 1000
        status = response.status_code

        if not is_static:
            if status >= 500:
                log = logger.error
            elif status >= 400:
                log = logger.warning
            else:
                log = logger.info
            log(
                "[%s] ← %s %s%s  client=%s  status=%d  %.1fms",
                req_id, request.method, path, qs, client_ip, status, duration,
            )

        return response


# ── Cache-control middleware ──
class CacheControlMiddleware(BaseHTTPMiddleware):
    """Set appropriate Cache-Control headers based on the request path."""

    async def dispatch(self, request: Request, call_next):
        response = await call_next(request)
        path = request.url.path

        # Uploaded company images — cache for 1 hour, revalidate after
        if path.startswith("/company_data/") or path.startswith("/uploads/"):
            response.headers["Cache-Control"] = "public, max-age=3600, must-revalidate"
        # API responses must never be cached by the browser
        elif path.startswith("/api/"):
            response.headers["Cache-Control"] = "no-store"

        return response


# ── Lifespan: initialize embeddings index on startup ──
@asynccontextmanager
async def lifespan(app: FastAPI):
    from backend.utils.embeddings import initialize_embeddings
    from backend.utils.semantic_embeddings import semantic_index
    from backend.utils.response_cache import response_cache
    from backend.utils.index_sync import start_background_watcher

    # Build the hybrid semantic index ONCE (external embeddings / SBERT + BM25).
    # Doing it a single time keeps cold starts cheap on Render's free tier, where
    # each build hits the embeddings API for every company/supplier.
    count = initialize_embeddings()
    response_cache.invalidate()
    stats = semantic_index.get_stats()
    logger.info(
        "Semantic index ready: %d entities, mode=%s", stats["total_entities"], stats["mode"]
    )

    # Background watcher: auto-refresh index if JSON files change on disk
    stop_watcher = start_background_watcher()
    yield
    stop_watcher()


app = FastAPI(
    title="Smart Construction Connect API",
    version="1.0.0",
    description="Backend API for the Smart Construction Connect platform",
    lifespan=lifespan,
)


# ── Global exception handler ──
@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    logger.error("Unhandled error on %s %s: %s", request.method, request.url.path, exc, exc_info=True)
    return JSONResponse(status_code=500, content={"detail": "Internal server error"})


app.add_middleware(RequestLoggingMiddleware)
app.add_middleware(CacheControlMiddleware)
app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=["Content-Type", "Authorization", "Accept"],
)

# ── API routes ──
app.include_router(auth.router)
app.include_router(companies.router)
app.include_router(suppliers.router)
app.include_router(admin.router)
app.include_router(ai_chat.router)
app.include_router(upload.router)
app.include_router(messages.router)
app.include_router(requests.router)
app.include_router(events.router)


@app.get("/")
def root():
    return {"service": "Smart Construction Connect API", "status": "ok", "docs": "/docs"}


@app.get("/api/health")
def health():
    return {"status": "ok", "version": "1.0.0"}


# ── Static: uploaded company images + documents ──
COMPANY_DATA_DIR = ROOT / "company_data"
COMPANY_DATA_DIR.mkdir(exist_ok=True)
for _sub in ("construction_company", "client", "material_supplier"):
    (COMPANY_DATA_DIR / _sub).mkdir(exist_ok=True)
app.mount("/company_data", StaticFiles(directory=str(COMPANY_DATA_DIR)), name="static-company-data")

# ── Static: message attachments (file sharing, voice notes) ──
UPLOADS_DIR = ROOT / "uploads"
UPLOADS_DIR.mkdir(exist_ok=True)
app.mount("/uploads", StaticFiles(directory=str(UPLOADS_DIR)), name="static-uploads")


if __name__ == "__main__":
    import uvicorn

    # Render provides $PORT; fall back to configured PORT (default 8000) locally.
    port = int(os.getenv("PORT", str(PORT)))
    reload = "--reload" in sys.argv or os.getenv("ENV", "development") != "production"
    uvicorn.run("app:app", host="0.0.0.0", port=port, reload=reload)
