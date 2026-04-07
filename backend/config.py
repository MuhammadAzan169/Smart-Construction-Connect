"""Centralised application settings loaded from environment / .env file.

Every configurable value lives here so the rest of the code-base never
reads ``os.getenv`` directly.
"""

from __future__ import annotations

import logging
import logging.handlers
import os
import sys
from pathlib import Path

from dotenv import load_dotenv

# Load .env from the repo root (two levels up from this file)
_REPO_ROOT = Path(__file__).resolve().parent.parent
load_dotenv(_REPO_ROOT / ".env")


# ── JWT ───────────────────────────────────────────────────────────────────────

JWT_SECRET_KEY: str = os.getenv("JWT_SECRET_KEY", "scc-dev-secret-change-me-in-production")
JWT_ALGORITHM: str = os.getenv("JWT_ALGORITHM", "HS256")
JWT_ACCESS_TOKEN_EXPIRE_MINUTES: int = int(os.getenv("JWT_ACCESS_TOKEN_EXPIRE_MINUTES", "60"))

# ── CORS ──────────────────────────────────────────────────────────────────────

CORS_ORIGINS: list[str] = [
    o.strip()
    for o in os.getenv(
        "CORS_ORIGINS",
        "http://localhost:8080,http://localhost:5173,http://localhost:8000,"
        "http://127.0.0.1:8080,http://127.0.0.1:5173,http://127.0.0.1:8000",
    ).split(",")
    if o.strip()
]

# ── Data directories ─────────────────────────────────────────────────────────

DATA_DIR: Path = Path(os.getenv("DATA_DIR", str(_REPO_ROOT / "Database")))
COMPANY_DATA_DIR: Path = Path(os.getenv("COMPANY_DATA_DIR", str(_REPO_ROOT / "company_data")))

# ── File upload limits ────────────────────────────────────────────────────────

MAX_IMAGE_SIZE: int = int(os.getenv("MAX_IMAGE_SIZE", str(5 * 1024 * 1024)))
MAX_DOC_SIZE: int = int(os.getenv("MAX_DOC_SIZE", str(10 * 1024 * 1024)))

# ── Logging ───────────────────────────────────────────────────────────────────

LOG_LEVEL: str = os.getenv("LOG_LEVEL", "INFO")


LOG_FILE: str = os.getenv("LOG_FILE", str(_REPO_ROOT / "logs" / "app.log"))


def setup_logging() -> None:
    """Configure structured logging for the application."""
    log_fmt = "%(asctime)s | %(levelname)-7s | %(name)s | %(message)s"
    date_fmt = "%Y-%m-%d %H:%M:%S"

    # Ensure logs/ directory exists
    Path(LOG_FILE).parent.mkdir(parents=True, exist_ok=True)

    # Rotating file handler — 5 MB per file, keep 5 backups
    file_handler = logging.handlers.RotatingFileHandler(
        LOG_FILE, maxBytes=5 * 1024 * 1024, backupCount=5, encoding="utf-8"
    )
    file_handler.setFormatter(logging.Formatter(log_fmt, datefmt=date_fmt))

    console_handler = logging.StreamHandler(sys.stdout)
    console_handler.setFormatter(logging.Formatter(log_fmt, datefmt=date_fmt))

    logging.basicConfig(
        level=LOG_LEVEL,
        handlers=[console_handler, file_handler],
        force=True,
    )
    # Silence noisy third-party loggers
    logging.getLogger("httpx").setLevel(logging.WARNING)
    logging.getLogger("httpcore").setLevel(logging.WARNING)
    logging.getLogger("uvicorn.access").setLevel(logging.WARNING)
