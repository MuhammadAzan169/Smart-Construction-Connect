"""Real-time events router — SSE stream + analytics endpoints."""

from __future__ import annotations

from fastapi import APIRouter, Depends
from fastapi.responses import StreamingResponse

from backend.utils.auth_deps import require_admin, get_current_user
from backend.utils.events import event_bus, sse_stream, _EVENT_LOG_PATH
from backend.utils.analytics import get_platform_analytics, get_top_companies, get_supply_demand_gaps
from backend.utils.embeddings import get_index_stats, initialize_embeddings, semantic_search
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
    """Get current embeddings index stats."""
    return get_index_stats()


@router.post("/embeddings/rebuild")
def embeddings_rebuild(user: dict = Depends(require_admin)):
    """Force rebuild the entire embeddings index."""
    count = initialize_embeddings()
    return {"status": "ok", "entities_indexed": count}


# ── Semantic search (any authenticated user) ──

@router.get("/search")
def search_entities(
    q: str = "",
    type: str = "",
    limit: int = 10,
    user: dict = Depends(get_current_user),
):
    """Semantic search across companies and suppliers."""
    if not q.strip():
        return []
    entity_type = type if type in ("company", "supplier") else None
    return semantic_search(q, top_k=min(limit, 50), entity_type=entity_type)
