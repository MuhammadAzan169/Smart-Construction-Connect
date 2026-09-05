"""Postgres-backed key-value document store (Supabase / any Postgres).

Why this exists
───────────────
The whole application persists its state as JSON "documents" that used to live
on the local filesystem (users, companies, suppliers, messages, requests, chat
history, activity log, …). On an ephemeral host like Render's free tier, that
local disk is wiped on every deploy/restart, so the data must live somewhere
durable.

Almost every write in the codebase funnels through
``data_handler.read_json(path)`` / ``write_json(path, data)``. So instead of a
big relational rewrite, we back those two functions with ONE Postgres table:

    documents(key text primary key, data jsonb, updated_at timestamptz)

The ``key`` is the path the document used to live at (relative to the repo
root, e.g. ``Database/clients/users.json``). This gives durable storage on
Supabase with almost no changes to the rest of the code.

Activation
──────────
* If ``DATABASE_URL`` is set  → Postgres mode (durable).
* If it is empty             → this module is disabled and ``data_handler``
                               keeps reading/writing local JSON files (local dev).

The connection uses ``prepare_threshold=None`` so it is compatible with the
Supabase transaction pooler (pgBouncer), which is the recommended way to
connect from a small always-restarting web service.
"""

from __future__ import annotations

import json
import logging
import os
import threading
from typing import Any

logger = logging.getLogger(__name__)

_pool = None
_lock = threading.Lock()
_state = "uninitialized"  # "uninitialized" | "enabled" | "disabled"


def _configure(conn) -> None:
    """Per-connection setup — safe with pgBouncer transaction pooling."""
    conn.autocommit = True
    # Disable server-side prepared statements (incompatible with pooler txn mode)
    try:
        conn.prepare_threshold = None
    except Exception:  # pragma: no cover - attribute always present on psycopg3
        pass


def _init() -> None:
    """Lazily create the connection pool and ensure the schema exists."""
    global _pool, _state
    with _lock:
        if _state != "uninitialized":
            return
        from backend.config import DATABASE_URL

        if not DATABASE_URL:
            _state = "disabled"
            return

        try:
            from psycopg_pool import ConnectionPool

            _pool = ConnectionPool(
                conninfo=DATABASE_URL,
                min_size=1,
                max_size=int(os.getenv("DB_POOL_MAX", "5")),
                configure=_configure,
                kwargs={"connect_timeout": 10},
                open=True,
            )
            _pool.wait(timeout=15)
            _ensure_schema()
            _state = "enabled"
            logger.info("Database enabled — using Postgres document store")
        except Exception as exc:
            # DATABASE_URL being set means the operator expects durability.
            _state = "disabled"
            logger.error(
                "DATABASE_URL is set but the connection failed: %s.",
                exc,
            )
            _allow_ephemeral = os.getenv("ALLOW_EPHEMERAL_STORAGE", "").strip().lower() in (
                "1", "true", "yes",
            )
            if os.getenv("ENV", "development") == "production" and not _allow_ephemeral:
                # On an ephemeral host (Render, a container) falling back to local
                # JSON silently loses every write on the next restart, and nothing
                # surfaces that to users. Refuse to start instead, the same way
                # config.py refuses a default JWT secret in production.
                raise RuntimeError(
                    "DATABASE_URL is set but unreachable, and ENV=production. "
                    "Refusing to start with non-durable local-file storage - "
                    "data would be lost on every restart. Check the Supabase "
                    "project is running and the transaction-pooler URI is correct. "
                    "To run anyway on throwaway local-file storage (demos only), "
                    "set ALLOW_EPHEMERAL_STORAGE=1."
                ) from exc
            if _allow_ephemeral:
                logger.warning(
                    "ALLOW_EPHEMERAL_STORAGE is set: starting WITHOUT a database. "
                    "All data is written to local files and WILL BE LOST on the "
                    "next restart or deploy. Never use this for real data."
                )
            logger.error(
                "Falling back to local JSON files (development only - NOT durable). "
                "Fix the connection string to enable persistence."
            )


def _ensure_schema() -> None:
    with _pool.connection() as conn:
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS documents (
                key         TEXT PRIMARY KEY,
                data        JSONB NOT NULL,
                updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
            );
            """
        )


def is_enabled() -> bool:
    """True when the Postgres document store is active."""
    if _state == "uninitialized":
        _init()
    return _state == "enabled"


# ── Key/value operations ──────────────────────────────────────────────────────

def kv_get(key: str) -> Any | None:
    """Return the stored JSON document for *key*, or None if absent."""
    if not is_enabled():
        return None
    with _pool.connection() as conn:
        row = conn.execute("SELECT data FROM documents WHERE key = %s", (key,)).fetchone()
    return row[0] if row else None


def kv_set(key: str, data: Any) -> None:
    """Insert or replace the JSON document at *key*."""
    if not is_enabled():
        return
    payload = json.dumps(data, ensure_ascii=False)
    with _pool.connection() as conn:
        conn.execute(
            """
            INSERT INTO documents (key, data, updated_at)
            VALUES (%s, %s::jsonb, now())
            ON CONFLICT (key)
            DO UPDATE SET data = EXCLUDED.data, updated_at = now()
            """,
            (key, payload),
        )


def kv_exists(key: str) -> bool:
    if not is_enabled():
        return False
    with _pool.connection() as conn:
        row = conn.execute("SELECT 1 FROM documents WHERE key = %s LIMIT 1", (key,)).fetchone()
    return row is not None


def kv_delete(key: str) -> bool:
    """Delete the document at *key*. Returns True if a row was removed."""
    if not is_enabled():
        return False
    with _pool.connection() as conn:
        cur = conn.execute("DELETE FROM documents WHERE key = %s", (key,))
    return cur.rowcount > 0


def kv_list_prefix(prefix: str) -> list[str]:
    """Return all keys beginning with *prefix*."""
    if not is_enabled():
        return []
    with _pool.connection() as conn:
        rows = conn.execute(
            "SELECT key FROM documents WHERE key LIKE %s ORDER BY key",
            (prefix.replace("%", r"\%").replace("_", r"\_") + "%",),
        ).fetchall()
    return [r[0] for r in rows]
