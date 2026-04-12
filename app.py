"""
Unified launcher for Smart Construction Connect.

    python app.py          → serves backend API + built frontend on port 8000
    python app.py --dev    → starts backend (8000) + Vite dev server (5173)

Backend API lives at  /api/…
Frontend (SPA) is served from Frontend/dist/ for every other route.
"""

from __future__ import annotations

import logging
import sys, subprocess, time, uuid, threading, webbrowser
from contextlib import asynccontextmanager
from pathlib import Path

# ── Ensure repo root is on sys.path so `backend.*` imports work ──
ROOT = Path(__file__).resolve().parent
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from backend.config import CORS_ORIGINS, setup_logging

# Initialise structured logging before anything else
setup_logging()
logger = logging.getLogger(__name__)

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse, JSONResponse
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.types import ASGIApp

from backend.routers import admin, ai_chat, auth, companies, messages, requests, suppliers, upload, events

# ═══════════════════════════════════════════════════════════════════════════
# FastAPI app
# ═══════════════════════════════════════════════════════════════════════════

DIST = ROOT / "Frontend" / "dist"
INDEX_HTML = DIST / "index.html"

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
        is_static = path.startswith("/assets/") or path.startswith("/company_data/") or path.startswith("/uploads/")

        if not is_static:
            logger.info(
                "[%s] → %s %s%s  client=%s",
                req_id, request.method, path, qs, client_ip,
            )

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

        # Vite hashes asset filenames → safe to cache for 1 year
        if path.startswith("/assets/"):
            response.headers["Cache-Control"] = "public, max-age=31536000, immutable"

        # Uploaded company images — cache for 1 hour, revalidate after
        elif path.startswith("/company_data/") or path.startswith("/uploads/"):
            response.headers["Cache-Control"] = "public, max-age=3600, must-revalidate"

        # API responses must never be cached by the browser
        elif path.startswith("/api/"):
            response.headers["Cache-Control"] = "no-store"

        # index.html and SPA fallback — always revalidate
        else:
            response.headers["Cache-Control"] = "no-cache, no-store, must-revalidate"
            response.headers["Pragma"] = "no-cache"
            response.headers["Expires"] = "0"

        return response


# ── Lifespan: initialize embeddings index on startup ──
@asynccontextmanager
async def lifespan(app: FastAPI):
    from backend.utils.embeddings import initialize_embeddings
    from backend.utils.rag_engine import rebuild_index
    from backend.utils.semantic_embeddings import semantic_index

    # Legacy TF-IDF index (kept for backward compatibility)
    count = initialize_embeddings()
    rebuild_index()
    logger.info("Legacy TF-IDF: %d entities indexed", count)

    # New hybrid semantic index (SBERT + FAISS + BM25)
    semantic_index.build()
    stats = semantic_index.get_stats()
    logger.info(
        "Semantic index ready: %d entities, mode=%s",
        stats["total_entities"], stats["mode"],
    )
    yield


app = FastAPI(
    title="Smart Construction Connect",
    version="1.0.0",
    description="Unified API + frontend for the Smart Construction Connect platform",
    lifespan=lifespan,
)

# ── Global exception handler ──
@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    logger.error("Unhandled error on %s %s: %s", request.method, request.url.path, exc, exc_info=True)
    return JSONResponse(
        status_code=500,
        content={"detail": "Internal server error"},
    )

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


@app.get("/api/health")
def health():
    return {"status": "ok", "version": "1.0.0"}



@app.get("/")
async def root():
    """Serve the SPA entry point."""
    if INDEX_HTML.exists():
        return FileResponse(str(INDEX_HTML), headers={"Cache-Control": "no-cache, no-store, must-revalidate"})
    return JSONResponse({"detail": "Frontend not built. Run: cd Frontend && npm run build"}, status_code=503)


# ── Static assets ──
if DIST.is_dir():
    app.mount("/assets", StaticFiles(directory=str(DIST / "assets")), name="static-assets")

# ── Uploaded files (images + documents) ──
COMPANY_DATA_DIR = ROOT / "company_data"
COMPANY_DATA_DIR.mkdir(exist_ok=True)
for _sub in ("construction_company", "client", "material_supplier"):
    (COMPANY_DATA_DIR / _sub).mkdir(exist_ok=True)
app.mount("/company_data", StaticFiles(directory=str(COMPANY_DATA_DIR)), name="static-company-data")

# ── Message attachments (file sharing, voice notes) ──
UPLOADS_DIR = ROOT / "uploads"
UPLOADS_DIR.mkdir(exist_ok=True)
app.mount("/uploads", StaticFiles(directory=str(UPLOADS_DIR)), name="static-uploads")


# ── SPA catch-all: must be LAST so API routes take priority ──
@app.get("/{full_path:path}")
async def spa_fallback(full_path: str, request: Request):
    """Serve index.html for all non-API paths so React Router works."""
    # Let API 404s return JSON
    if full_path.startswith("api/"):
        return JSONResponse({"detail": "Not Found"}, status_code=404)

    # Serve existing static files from dist/ (robots.txt, favicon, etc.)
    candidate = (DIST / full_path).resolve()
    if candidate.is_file() and candidate.is_relative_to(DIST.resolve()):
        return FileResponse(str(candidate))

    # SPA fallback — let React Router handle the path client-side
    if INDEX_HTML.exists():
        return FileResponse(str(INDEX_HTML), headers={"Cache-Control": "no-cache, no-store, must-revalidate"})

    return JSONResponse({"detail": "Frontend not built"}, status_code=503)


# ═══════════════════════════════════════════════════════════════════════════
# CLI
# ═══════════════════════════════════════════════════════════════════════════

def _build_frontend():
    """Build the Vite frontend if dist/ is missing or stale."""
    pkg_json = ROOT / "Frontend" / "package.json"
    if not pkg_json.exists():
        print("[app] Frontend/package.json not found — skipping build.")
        return

    dist_index = DIST / "index.html"
    if dist_index.exists():
        print(f"[app] Frontend already built ({dist_index})")
        return

    print("[app] Building frontend…")
    subprocess.run(
        ["npx", "vite", "build"],
        cwd=str(ROOT / "Frontend"),
        shell=True,
        check=True,
    )
    print("[app] Frontend build complete.")


def _run_dev():
    """Start backend + Vite dev server together for development."""
    vite = None
    try:
        print("[app] Starting Vite dev server on http://localhost:5173 …")
        vite = subprocess.Popen(
            ["npx", "vite", "--host"],
            cwd=str(ROOT / "Frontend"),
            shell=True,
        )
        time.sleep(1)

        print("[app] Starting FastAPI backend on http://localhost:8000 …")
        import uvicorn
        uvicorn.run("app:app", host="127.0.0.1", port=8000, reload=True)
    except KeyboardInterrupt:
        print("\n[app] Shutting down…")
    finally:
        if vite:
            vite.terminate()
            vite.wait(timeout=5)


def _wait_and_open_browser(url: str, health_url: str, timeout: int = 30):
    """Poll the health endpoint then open the browser once the server is ready."""
    import urllib.request
    deadline = time.time() + timeout
    while time.time() < deadline:
        try:
            with urllib.request.urlopen(health_url, timeout=1):
                break
        except Exception:
            time.sleep(0.3)
    webbrowser.open(url)


def _run_prod():
    """Serve API + built frontend together on one port."""
    _build_frontend()

    if not (DIST / "index.html").exists():
        print("[app] ERROR: Frontend build failed. Run manually:")
        print("       cd Frontend && npx vite build")
        sys.exit(1)

    import uvicorn

    port = 8000
    url = f"http://localhost:{port}"

    print()
    print("  ╔══════════════════════════════════════════════════════╗")
    print("  ║  Smart Construction Connect                          ║")
    print(f"  ║  {url:<52}║")
    print(f"  ║  API docs: {url}/docs{' ' * 29}║")                  
    print("  ║  Opening browser when server is ready…               ║")
    print("  ╚══════════════════════════════════════════════════════╝")
    print()

    # Open browser automatically once server is accepting connections
    t = threading.Thread(
        target=_wait_and_open_browser,
        args=(url, f"{url}/api/health"),
        daemon=True,
    )
    t.start()

    uvicorn.run("app:app", host="127.0.0.1", port=port, reload=False)

if __name__ == "__main__":
    if "--dev" in sys.argv:
        _run_dev()
    else:
        _run_prod()