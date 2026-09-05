"""Lightweight event bus for real-time platform events.

Supports:
- In-process pub/sub via asyncio
- SSE (Server-Sent Events) streaming to frontend
- Structured event logging to Database/admin/event_log.json
"""

from __future__ import annotations
import asyncio
import json
import logging
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, AsyncGenerator

from backend.utils.data_handler import read_json, write_json, add_activity_log

logger = logging.getLogger(__name__)

# ── Event log file ──
_EVENT_LOG_DIR = Path(__file__).resolve().parent.parent.parent / "Database" / "admin"
_EVENT_LOG_PATH = _EVENT_LOG_DIR / "event_log.json"
_MAX_EVENT_LOG = 500  # keep last N events


class EventBus:
    """Simple async event bus with SSE fan-out."""

    def __init__(self) -> None:
        self._subscribers: list[asyncio.Queue] = []

    def subscribe(self) -> asyncio.Queue:
        q: asyncio.Queue = asyncio.Queue(maxsize=50)
        self._subscribers.append(q)
        return q

    def unsubscribe(self, q: asyncio.Queue) -> None:
        try:
            self._subscribers.remove(q)
        except ValueError:
            pass

    async def publish(self, event_type: str, data: dict[str, Any] | None = None, *, actor: str = "") -> None:
        """Publish an event to all subscribers and persist it."""
        event = {
            "type": event_type,
            "data": data or {},
            "actor": actor,
            "timestamp": datetime.now(timezone.utc).isoformat(),
        }
        # Fan-out to SSE subscribers
        dead: list[asyncio.Queue] = []
        for q in self._subscribers:
            try:
                q.put_nowait(event)
            except asyncio.QueueFull:
                dead.append(q)
        for q in dead:
            self._subscribers.remove(q)

        # Persist to event log
        _persist_event(event)

    def publish_sync(self, event_type: str, data: dict[str, Any] | None = None, *, actor: str = "") -> None:
        """Fire-and-forget publish from sync context."""
        event = {
            "type": event_type,
            "data": data or {},
            "actor": actor,
            "timestamp": datetime.now(timezone.utc).isoformat(),
        }
        _persist_event(event)
        # Try to fan-out if there's a running loop
        try:
            loop = asyncio.get_running_loop()
            for q in self._subscribers:
                try:
                    q.put_nowait(event)
                except asyncio.QueueFull:
                    pass
        except RuntimeError:
            pass


def _persist_event(event: dict) -> None:
    """Append event to the JSON log, trimming old entries."""
    try:
        _EVENT_LOG_DIR.mkdir(parents=True, exist_ok=True)
        log = read_json(_EVENT_LOG_PATH)
        if not isinstance(log, list):
            log = []
        log.append(event)
        if len(log) > _MAX_EVENT_LOG:
            log = log[-_MAX_EVENT_LOG:]
        write_json(_EVENT_LOG_PATH, log)
    except Exception as e:
        logger.error(f"Failed to persist event: {e}")


# ── Singleton ──
event_bus = EventBus()


# ── SSE generator ──
async def sse_stream(queue: asyncio.Queue) -> AsyncGenerator[str, None]:
    """Yield SSE-formatted events from a subscription queue."""
    try:
        while True:
            event = await asyncio.wait_for(queue.get(), timeout=30)
            yield f"data: {json.dumps(event)}\n\n"
    except asyncio.TimeoutError:
        yield f": keepalive\n\n"
    except asyncio.CancelledError:
        return


# ── Event type constants ──
class Events:
    COMPANY_REGISTERED = "company.registered"
    COMPANY_UPDATED = "company.updated"
    COMPANY_APPROVED = "company.approved"
    COMPANY_SUSPENDED = "company.suspended"
    SUPPLIER_REGISTERED = "supplier.registered"
    SUPPLIER_UPDATED = "supplier.updated"
    USER_SIGNUP = "user.signup"
    USER_LOGIN = "user.login"
    USER_STATUS_CHANGED = "user.status_changed"
    AI_CHAT = "ai.chat"
    AI_CHAT_FILE = "ai.chat_file"
    EMBEDDINGS_UPDATED = "embeddings.updated"
    QUOTE_REQUEST_CREATED = "quote.created"
    QUOTE_REQUEST_UPDATED = "quote.updated"
    MESSAGE_SENT = "message.sent"
    PACKAGE_UPDATED = "package.updated"
    VERIFICATION_UPDATED = "verification.updated"
    ERROR = "system.error"
