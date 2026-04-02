"""
Unified launcher for Smart Construction Connect.

    python app.py          → serves backend API + built frontend on port 8000
    python app.py --dev    → starts backend (8000) + Vite dev server (5173)

Backend API lives at  /api/…
Frontend (SPA) is served from Frontend/dist/ for every other route.
"""

from __future__ import annotations

import sys, subprocess, os, signal, time
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


# ── Serve built frontend (SPA) ──
DIST = ROOT / "Frontend" / "dist"
print(f"[app] DIST={DIST}  exists={DIST.is_dir()}")

if DIST.is_dir():
    # Serve /assets, favicon, robots.txt etc.
    app.mount("/assets", StaticFiles(directory=str(DIST / "assets")), name="frontend-assets")

    @app.get("/favicon.ico", include_in_schema=False)
    def favicon():
        path = DIST / "favicon.ico"
        if path.exists():
            return FileResponse(str(path))
        return FileResponse(str(DIST / "index.html"))

    @app.get("/robots.txt", include_in_schema=False)
    def robots():
        return FileResponse(str(DIST / "robots.txt"))

    # SPA catch-all — must be registered LAST
    @app.get("/", include_in_schema=False)
    def spa_root():
        return FileResponse(str(DIST / "index.html"))

    @app.get("/{full_path:path}", include_in_schema=False)
    def spa_fallback(full_path: str):
        """Serve index.html for any non-API, non-static route (SPA routing)."""
        # If a real file exists under dist/, serve it
        requested = DIST / full_path
        if requested.is_file() and ".." not in full_path:
            return FileResponse(str(requested))
        return FileResponse(str(DIST / "index.html"))


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
