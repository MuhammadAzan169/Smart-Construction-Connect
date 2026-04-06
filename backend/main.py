"""FastAPI entry point for Smart Construction Connect backend.

NOTE: The primary entry point is app.py at the repo root, which includes
all routers (including upload) and serves the built frontend.  This file
exists as a convenience for running the API standalone during development:

    uvicorn backend.main:app --reload
"""

from __future__ import annotations

import logging
import sys
from pathlib import Path

if __package__ in (None, ""):
    repo_root = Path(__file__).resolve().parents[1]
    if str(repo_root) not in sys.path:
        sys.path.insert(0, str(repo_root))

from backend.config import CORS_ORIGINS, setup_logging

setup_logging()
logger = logging.getLogger(__name__)

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from backend.routers import admin, ai_chat, auth, companies, messages, requests, suppliers, upload, events

app = FastAPI(
    title="Smart Construction Connect API",
    version="1.0.0",
    description="Backend API for the Smart Construction Connect platform",
)

# ── Global exception handler ──
@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    logger.error("Unhandled error on %s %s: %s", request.method, request.url.path, exc, exc_info=True)
    return JSONResponse(status_code=500, content={"detail": "Internal server error"})

app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=["Content-Type", "Authorization", "Accept", "X-User-Email", "X-User-Role"],
)

app.include_router(auth.router)
app.include_router(companies.router)
app.include_router(suppliers.router)
app.include_router(admin.router)
app.include_router(ai_chat.router)
app.include_router(upload.router)
app.include_router(messages.router)
app.include_router(requests.router)
app.include_router(events.router)


@app.on_event("startup")
def on_startup():
    from backend.utils.embeddings import initialize_embeddings
    from backend.utils.rag_engine import rebuild_index
    initialize_embeddings()
    rebuild_index()


@app.get("/api/health")
def health():
    return {"status": "ok", "version": "1.0.0"}


if __name__ == "__main__":
    import uvicorn

    uvicorn.run("backend.main:app", host="127.0.0.1", port=8000, reload=True)
