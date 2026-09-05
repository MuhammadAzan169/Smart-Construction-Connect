"""Real-time events router — SSE stream + analytics endpoints."""

from __future__ import annotations

from fastapi import APIRouter, Depends
from fastapi.responses import StreamingResponse

from backend.utils.auth_deps import require_admin, get_current_user
from backend.utils.events import event_bus, sse_stream, _EVENT_LOG_PATH
from backend.utils.analytics import get_platform_analytics, get_top_companies, get_supply_demand_gaps
from backend.utils.embeddings import get_index_stats, initialize_embeddings, semantic_search
from backend.utils.semantic_embeddings import semantic_index
from backend.utils.response_cache import response_cache
from backend.utils.data_handler import read_json

router = APIRouter(prefix="/api", tags=["events"])


# ── SSE stream (admin only) ──

@router.get("/events/stream")
async def event_stream(user: dict = Depends(require_admin)):
    """Server-Sent Events stream for real-time platform events (admin only)."""
    queue = event_bus.subscribe()

    async def generate():
        try:
            async for chunk in sse_stream(queue):
                yield chunk
        finally:
            event_bus.unsubscribe(queue)

    return StreamingResponse(generate(), media_type="text/event-stream")


@router.get("/events/log")
def get_event_log(user: dict = Depends(require_admin)):
    """Return the persisted event log (most recent 500 events)."""
    log = read_json(_EVENT_LOG_PATH)
    if isinstance(log, list):
        return log[-100:]  # Return last 100 for performance
    return []


# ── Analytics (admin only) ──

@router.get("/analytics/overview")
def analytics_overview(user: dict = Depends(require_admin)):
    """Comprehensive platform analytics."""
    return get_platform_analytics()


@router.get("/analytics/top-companies")
def analytics_top_companies(user: dict = Depends(require_admin)):
    """Top-performing companies by composite score."""
    return get_top_companies(limit=10)


@router.get("/analytics/supply-demand")
def analytics_supply_demand(user: dict = Depends(require_admin)):
    """Supply-demand gap analysis by city."""
    return get_supply_demand_gaps()


# ── Embeddings (admin) ──

@router.get("/embeddings/stats")
def embeddings_stats(user: dict = Depends(require_admin)):
    """Get current embeddings index stats (includes semantic index info)."""
    legacy_stats = get_index_stats()
    semantic_stats = semantic_index.get_stats()
    cache_stats = response_cache.stats()
    return {
        "legacy_tfidf": legacy_stats,
        "semantic_index": semantic_stats,
        "response_cache": cache_stats,
    }


@router.post("/embeddings/rebuild")
def embeddings_rebuild(user: dict = Depends(require_admin)):
    """Force rebuild the entire embeddings index (legacy + semantic)."""
    count = initialize_embeddings()
    semantic_index.build(force=True)
    response_cache.invalidate()
    semantic_stats = semantic_index.get_stats()
    return {
        "status": "ok",
        "legacy_entities_indexed": count,
        "semantic_index": semantic_stats,
    }


# ── Semantic search (any authenticated user) ──

@router.get("/search")
def search_entities(
    q: str = "",
    type: str = "",
    limit: int = 10,
    user: dict = Depends(get_current_user),
):
    """Hybrid semantic search across companies and suppliers."""
    if not q.strip():
        return []
    entity_type = type if type in ("company", "supplier") else None

    # Try semantic index first (hybrid: SBERT + BM25)
    try:
        results = semantic_index.search(q, top_k=min(limit, 50), entity_type=entity_type)
        return [
            {
                "type": r["type"],
                "name": r["data"].get("company_name" if r["type"] == "company" else "supplier_name", "Unknown"),
                "id": r["data"].get("slug") or r["data"].get("company_id" if r["type"] == "company" else "supplier_id", ""),
                "city": r["data"].get("city", ""),
                "score": round(r["score"] * 100, 1),
                "dense_score": round(r.get("dense_score", 0) * 100, 1),
                "sparse_score": round(r.get("sparse_score", 0) * 100, 1),
            }
            for r in results
        ]
    except Exception:
        # Fallback to legacy TF-IDF search
        return semantic_search(q, top_k=min(limit, 50), entity_type=entity_type)
