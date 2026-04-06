"""
Unified launcher for Smart Construction Connect.

    python app.py          → serves backend API + built frontend on port 8000
    python app.py --dev    → starts backend (8000) + Vite dev server (5173)

Backend API lives at  /api/…
Frontend (SPA) is served from Frontend/dist/ for every other route.
"""

from __future__ import annotations

import sys, subprocess, time
from pathlib import Path

# ── Ensure repo root is on sys.path so `backend.*` imports work ──
ROOT = Path(__file__).resolve().parent
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse, JSONResponse

from backend.routers import admin, ai_chat, auth, companies, messages, requests, suppliers, upload, events

# ═══════════════════════════════════════════════════════════════════════════
# FastAPI app
# ═══════════════════════════════════════════════════════════════════════════

DIST = ROOT / "Frontend" / "dist"
INDEX_HTML = DIST / "index.html"

app = FastAPI(
    title="Smart Construction Connect",
    version="1.0.0",
    description="Unified API + frontend for the Smart Construction Connect platform",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:8000",
        "http://127.0.0.1:8000",
        "http://localhost:5173",
        "http://127.0.0.1:5173",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["X-User-Email", "X-User-Role"],
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


# ── Startup: initialize embeddings index ──
@app.on_event("startup")
def on_startup():
    from backend.utils.embeddings import initialize_embeddings
    count = initialize_embeddings()
    print(f"[app] Embeddings initialized: {count} entities indexed")


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


# ── SPA catch-all: must be LAST so API routes take priority ──
@app.get("/{full_path:path}")
async def spa_fallback(full_path: str, request: Request):
    """Serve index.html for all non-API paths so React Router works."""
    # Let API 404s return JSON
    if full_path.startswith("api/"):
        return JSONResponse({"detail": "Not Found"}, status_code=404)

    # Serve existing static files from dist/ (robots.txt, favicon, etc.)
    candidate = DIST / full_path
    if candidate.is_file() and ".." not in full_path:
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


def _run_prod():
    """Serve API + built frontend together on one port."""
    _build_frontend()

    if not (DIST / "index.html").exists():
        print("[app] ERROR: Frontend build failed. Run manually:")
        print("       cd Frontend && npx vite build")
        sys.exit(1)

    import uvicorn

    print()
    print("  ╔══════════════════════════════════════════════════════╗")
    print("  ║  Smart Construction Connect                          ║")
    print("  ║  http://localhost:8000                               ║")
    print("  ║  API docs: http://localhost:8000/docs                ║")
    print("  ╚══════════════════════════════════════════════════════╝")
    print()

    uvicorn.run("app:app", host="127.0.0.1", port=8000, reload=True)

if __name__ == "__main__":
    if "--dev" in sys.argv:
        _run_dev()
    else:
        _run_prod()