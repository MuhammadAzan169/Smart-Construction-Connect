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
        self._cache: OrderedDict[str, tuple[float, Any, frozenset]] = OrderedDict()
        self._lock = threading.Lock()
        self._max_size = max_size
        self._ttl = ttl_seconds
        self._hits = 0
        self._misses = 0

    def _make_key(self, messages: list[dict], role: str, user_email: str = "") -> str:
        """Create a cache key from the last 3 user messages + role + user identity."""
        user_msgs = [m.get("content", "") for m in messages if m.get("role") == "user"]
        # Include user_email so different users never share cached responses
        key_parts = user_msgs[-3:] + [role, user_email.lower()]
        raw = "|".join(key_parts).lower().strip()
        return hashlib.md5(raw.encode()).hexdigest()

    def get(self, messages: list[dict], role: str, user_email: str = "") -> Any | None:
        """Try to get a cached response."""
        key = self._make_key(messages, role, user_email)
        with self._lock:
            if key in self._cache:
                ts, value, _tags = self._cache[key]
                if time.time() - ts < self._ttl:
                    self._cache.move_to_end(key)
                    self._hits += 1
                    return value
                else:
                    del self._cache[key]
            self._misses += 1
            return None

    def put(
        self,
        messages: list[dict],
        role: str,
        value: Any,
        user_email: str = "",
        tags: set[str] | None = None,
    ) -> None:
        """Cache a response, optionally tagging it with entity IDs or city names.

        Tags are used by ``invalidate_by_tag`` for smart partial invalidation.
        """
        key = self._make_key(messages, role, user_email)
        tag_frozenset: frozenset[str] = frozenset(tags) if tags else frozenset()
        with self._lock:
            if key in self._cache:
                del self._cache[key]
            self._cache[key] = (time.time(), value, tag_frozenset)
            while len(self._cache) > self._max_size:
                self._cache.popitem(last=False)

    def invalidate(self) -> None:
        """Clear ALL cached responses."""
        with self._lock:
            self._cache.clear()

    def invalidate_by_tag(self, tag: str) -> int:
        """Remove only cache entries that were tagged with ``tag``.

        Use entity IDs (company_id / supplier_id) or city names as tags.
        Returns the number of entries removed.
        """
        removed = 0
        with self._lock:
            keys_to_delete = [
                k for k, (_, _, tags) in self._cache.items() if tag in tags
            ]
            for k in keys_to_delete:
                del self._cache[k]
                removed += 1
        if removed:
            logger.debug("Cache: removed %d entries tagged '%s'", removed, tag)
        return removed

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
