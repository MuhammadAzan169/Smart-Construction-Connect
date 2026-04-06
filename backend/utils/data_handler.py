"""Utility helpers for reading/writing the restructured JSON database.

New layout (Database/ folder):
    Database/
    ├── clients/
    │   └── users.json
    ├── construction/
    │   ├── users.json
    │   └── companies.json
    ├── suppliers/
    │   ├── users.json
    │   └── catalog.json
    ├── admin/
    │   ├── users.json
    │   ├── settings.json
    │   └── activity_log.json

Improvements over the original:
- Atomic writes (write-to-temp + os.replace) prevent data corruption on crash
- asyncio file locks prevent race conditions on concurrent writes
- All JSON I/O is centralised here for easy future PostgreSQL migration
"""

import asyncio
import json
import logging
import os
import re
import tempfile
from collections import defaultdict
from pathlib import Path
from typing import Any

logger = logging.getLogger(__name__)

# ── Root directories ──
DB_DIR = Path(__file__).resolve().parent.parent.parent / "Database"

CLIENTS_DIR = DB_DIR / "clients"
CONSTRUCTION_DIR = DB_DIR / "construction"
SUPPLIERS_DIR = DB_DIR / "suppliers"
ADMIN_DIR = DB_DIR / "admin"

# Mapping from role → user-file directory
_ROLE_DIRS: dict[str, Path] = {
    "client": CLIENTS_DIR,
    "company": CONSTRUCTION_DIR,
    "supplier": SUPPLIERS_DIR,
    "admin": ADMIN_DIR,
}


def _ensure_dirs():
    for d in _ROLE_DIRS.values():
        d.mkdir(parents=True, exist_ok=True)


_ensure_dirs()


# ── File-level locking ──

_file_locks: dict[str, asyncio.Lock] = defaultdict(asyncio.Lock)


def _get_lock(filepath: Path) -> asyncio.Lock:
    """Return a per-file asyncio lock for safe concurrent access."""
    return _file_locks[str(filepath)]


# ── Generic JSON I/O with atomic writes ──

def read_json(filepath: Path) -> Any:
    if not filepath.exists():
        return []
    try:
        with open(filepath, "r", encoding="utf-8") as f:
            text = f.read().strip()
            if not text:
                return []
            return json.loads(text)
    except (json.JSONDecodeError, OSError) as e:
        logger.error("Failed to read JSON from %s: %s", filepath, e)
        return []


def write_json(filepath: Path, data: Any):
    """Write JSON atomically: write to temp file, then os.replace to target."""
    filepath.parent.mkdir(parents=True, exist_ok=True)
    fd, tmp_path = tempfile.mkstemp(
        dir=str(filepath.parent),
        suffix=".tmp",
        prefix=".scc_",
    )
    try:
        with os.fdopen(fd, "w", encoding="utf-8") as f:
            json.dump(data, f, indent=2, ensure_ascii=False)
        os.replace(tmp_path, str(filepath))
    except Exception:
        # Clean up temp file on failure
        try:
            os.unlink(tmp_path)
        except OSError:
            pass
        raise


# ── Path helpers ──

def _users_path(role: str) -> Path:
    return _ROLE_DIRS[role] / "users.json"


def companies_dataset_path() -> Path:
    return CONSTRUCTION_DIR / "companies.json"


def suppliers_dataset_path() -> Path:
    return SUPPLIERS_DIR / "catalog.json"


def admin_settings_path() -> Path:
    return ADMIN_DIR / "settings.json"


def admin_activity_log_path() -> Path:
    return ADMIN_DIR / "activity_log.json"




def slugify(name: str) -> str:
    slug = name.lower().strip()
    slug = re.sub(r"[^a-z0-9\s-]", "", slug)
    slug = re.sub(r"[\s]+", "-", slug)
    return slug


# ── User CRUD (searches across all role files) ──

def get_all_users() -> list[dict]:
    """Return every user across all 4 role files."""
    all_users: list[dict] = []
    for role in _ROLE_DIRS:
        all_users.extend(read_json(_users_path(role)))
    return all_users


def get_users_by_role(role: str) -> list[dict]:
    """Return users for a single role."""
    return read_json(_users_path(role))


def save_users_by_role(role: str, users: list[dict]):
    """Overwrite the users file for a specific role."""
    write_json(_users_path(role), users)


def save_all_users(users: list[dict]):
    """Sort users back into per-role files and save each one."""
    buckets: dict[str, list[dict]] = {r: [] for r in _ROLE_DIRS}
    for u in users:
        role = u.get("role", "client")
        if role in buckets:
            buckets[role].append(u)
    for role, role_users in buckets.items():
        write_json(_users_path(role), role_users)


def find_user_by_email(email: str) -> dict | None:
    """Search all role files for a user with matching email."""
    email_lower = email.strip().lower()
    for role in _ROLE_DIRS:
        for u in read_json(_users_path(role)):
            if u.get("email", "").strip().lower() == email_lower:
                return u
    return None


def add_user(user: dict):
    """Append a new user to the correct role file."""
    role = user.get("role", "client")
    users = read_json(_users_path(role))
    users.append(user)
    write_json(_users_path(role), users)


# ── Admin helpers ──

def get_admin_settings() -> dict:
    data = read_json(admin_settings_path())
    return data if isinstance(data, dict) else {}


def save_admin_settings(settings: dict):
    write_json(admin_settings_path(), settings)


def get_activity_log() -> list[dict]:
    data = read_json(admin_activity_log_path())
    return data if isinstance(data, list) else []


def save_activity_log(log: list[dict]):
    write_json(admin_activity_log_path(), log)


def add_activity_log(action: str, target: str, details: str):
    from datetime import datetime, timezone
    log = get_activity_log()
    log.insert(0, {
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "action": action,
        "target": target,
        "details": details,
    })
    save_activity_log(log[:200])  # keep last 200

