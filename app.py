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

from backend.routers import admin, ai_chat, auth, companies, suppliers

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
)

# ── API routes ──
app.include_router(auth.router)
app.include_router(companies.router)
app.include_router(suppliers.router)
app.include_router(admin.router)
app.include_router(ai_chat.router)


@app.get("/api/health")
def health():
    return {"status": "ok", "version": "1.0.0"}


# ── SPA fallback: catch any non-API 404 and serve index.html ──
if DIST.is_dir():
    # Serve /assets/* (CSS, JS bundles)
    app.mount("/assets", StaticFiles(directory=str(DIST / "assets")), name="static-assets")

    @app.exception_handler(404)
    async def spa_fallback(request: Request, exc):
        """For non-API paths, serve index.html so SPA client-side routing works."""
        path = request.url.path

        # API routes should return proper JSON 404
        if path.startswith("/api/"):
            return JSONResponse({"detail": "Not Found"}, status_code=404)

        # Try to serve existing static file from dist/
        requested = DIST / path.lstrip("/")
        if requested.is_file() and ".." not in path:
            return FileResponse(str(requested))

        # Fallback to index.html for client-side routing
        if INDEX_HTML.exists():
            return FileResponse(str(INDEX_HTML))

        return JSONResponse({"detail": "Not Found"}, status_code=404)


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
    print("  ║  Smart Construction Connect                         ║")
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
