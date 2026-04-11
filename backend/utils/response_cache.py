"""In-memory response cache for frequent AI queries.

Uses LRU eviction with TTL expiry. Thread-safe.
Avoids re-running the full RAG+LLM pipeline for repeated/similar questions.
"""

from __future__ import annotations

import hashlib
import logging
import threading
import time
from collections import OrderedDict
from typing import Any

logger = logging.getLogger(__name__)


class ResponseCache:
    """LRU cache with TTL for AI responses."""

    def __init__(self, max_size: int = 100, ttl_seconds: int = 600):
        self._cache: OrderedDict[str, tuple[float, Any]] = OrderedDict()
        self._lock = threading.Lock()
        self._max_size = max_size
        self._ttl = ttl_seconds
        self._hits = 0
        self._misses = 0

    def _make_key(self, messages: list[dict], role: str) -> str:
        """Create a cache key from the last 3 user messages + role."""
        user_msgs = [m.get("content", "") for m in messages if m.get("role") == "user"]
        # Use last 3 messages for key (captures recent context)
        key_parts = user_msgs[-3:] + [role]
        raw = "|".join(key_parts).lower().strip()
        return hashlib.md5(raw.encode()).hexdigest()

    def get(self, messages: list[dict], role: str) -> Any | None:
        """Try to get a cached response."""
        key = self._make_key(messages, role)
        with self._lock:
            if key in self._cache:
                ts, value = self._cache[key]
                if time.time() - ts < self._ttl:
                    self._cache.move_to_end(key)
                    self._hits += 1
                    return value
                else:
                    del self._cache[key]
            self._misses += 1
            return None

    def put(self, messages: list[dict], role: str, value: Any):
        """Cache a response."""
        key = self._make_key(messages, role)
        with self._lock:
            if key in self._cache:
                del self._cache[key]
            self._cache[key] = (time.time(), value)
            while len(self._cache) > self._max_size:
                self._cache.popitem(last=False)

    def invalidate(self):
        """Clear all cached responses."""
        with self._lock:
            self._cache.clear()

    def stats(self) -> dict:
        with self._lock:
            total = self._hits + self._misses
            return {
                "size": len(self._cache),
                "max_size": self._max_size,
                "hits": self._hits,
                "misses": self._misses,
                "hit_rate": round(self._hits / total * 100, 1) if total > 0 else 0.0,
                "ttl_seconds": self._ttl,
            }


# ── Module singleton ──
response_cache = ResponseCache(max_size=150, ttl_seconds=600)
