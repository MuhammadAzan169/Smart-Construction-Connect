"""FastAPI entry point for Smart Construction Connect backend."""

from __future__ import annotations

# If this file is executed directly (e.g. `python backend/main.py`), Python sets
# sys.path[0] to the `backend/` folder. That breaks absolute imports like
# `from backend.routers import ...`. We fix that by adding the repo root.
import sys
from pathlib import Path

if __package__ in (None, ""):
    repo_root = Path(__file__).resolve().parents[1]
    if str(repo_root) not in sys.path:
        sys.path.insert(0, str(repo_root))

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from backend.routers import admin, ai_chat, auth, companies, suppliers

app = FastAPI(
    title="Smart Construction Connect API",
    version="1.0.0",
    description="Backend API for the Smart Construction Connect platform",
)

# CORS — allow the Vite dev server
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:8080", "http://localhost:5173", "http://127.0.0.1:8080", "http://127.0.0.1:5173"],
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=["Content-Type", "Authorization", "Accept"],
)

app.include_router(auth.router)
app.include_router(companies.router)
app.include_router(suppliers.router)
app.include_router(admin.router)
app.include_router(ai_chat.router)


@app.get("/api/health")
def health():
    return {"status": "ok", "version": "1.0.0"}


if __name__ == "__main__":
    import uvicorn

    uvicorn.run("backend.main:app", host="127.0.0.1", port=8000, reload=True)
