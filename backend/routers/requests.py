"""Quote-request routes — clients can request quotes, companies can respond.

Includes AI-assisted request suggestions (cost estimates, materials).
"""

from __future__ import annotations
import uuid
import logging
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from typing import Optional

from backend.utils.auth_deps import get_current_user, require_role
from backend.utils.data_handler import read_json, write_json, add_activity_log, DB_DIR

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/requests", tags=["requests"])

REQUESTS_PATH = DB_DIR / "requests" / "requests.json"


def _load() -> list[dict]:
    REQUESTS_PATH.parent.mkdir(parents=True, exist_ok=True)
    return read_json(REQUESTS_PATH)


def _save(data: list[dict]):
    write_json(REQUESTS_PATH, data)


# ── Models ──

class CreateRequest(BaseModel):
    company_slug: str
    project_title: str
    description: str = ""
    location: str = ""
    budget: str = ""
    plot_size: str = ""


class UpdateRequestStatus(BaseModel):
    status: str  # accepted, rejected, completed


class RequestResponse(BaseModel):
    notes: str = ""


# ── Client endpoints ──

@router.post("/")
def create_request(body: CreateRequest, user: dict = Depends(require_role("client"))):
    """Client submits a quote request to a company."""
    requests = _load()
    req_id = f"R-{str(uuid.uuid4())[:8].upper()}"
    now = datetime.now(timezone.utc).isoformat()

    new_req = {
        "id": req_id,
        "client_email": user.get("email", ""),
        "client_name": user.get("display_name", ""),
        "client_id": user.get("user_id", ""),
        "company_slug": body.company_slug,
        "project_title": body.project_title,
        "description": body.description,
        "location": body.location,
        "budget": body.budget,
        "plot_size": body.plot_size,
        "status": "pending",
        "created_at": now,
        "updated_at": now,
        "company_notes": "",
    }
    requests.insert(0, new_req)
    _save(requests)
    add_activity_log("request_created", req_id, f"New quote request from {user.get('display_name', '')} for {body.company_slug}")
    return new_req


@router.get("/")
def list_requests(user: dict = Depends(get_current_user)):
    """
    List requests visible to current user:
    - client: their own requests
    - company: requests sent to their company
    - admin: all requests
    """
    requests = _load()
    role = user.get("role")
    email = user.get("email", "")

    if role == "admin":
        return requests
    elif role == "client":
        return [r for r in requests if r.get("client_email") == email]
    elif role == "company":
        slug = user.get("company_slug", "")
        return [r for r in requests if r.get("company_slug") == slug]
    else:
        return []


@router.get("/{request_id}")
def get_request(request_id: str, user: dict = Depends(get_current_user)):
    """Get a single request by ID (with access control)."""
    requests = _load()
    req = next((r for r in requests if r.get("id") == request_id), None)
    if not req:
        raise HTTPException(status_code=404, detail="Request not found")

    role = user.get("role")
    email = user.get("email", "")
    slug = user.get("company_slug", "")

    if role == "admin":
        return req
    if role == "client" and req.get("client_email") == email:
        return req
    if role == "company" and req.get("company_slug") == slug:
        return req

    raise HTTPException(status_code=403, detail="Access denied")


@router.put("/{request_id}/status")
def update_request_status(
    request_id: str,
    body: UpdateRequestStatus,
    user: dict = Depends(require_role("company", "admin")),
):
    """Company accepts/rejects a request, or admin can update any status."""
    if body.status not in ("accepted", "rejected", "completed", "pending"):
        raise HTTPException(status_code=400, detail="Invalid status")

    requests = _load()
    req = next((r for r in requests if r.get("id") == request_id), None)
    if not req:
        raise HTTPException(status_code=404, detail="Request not found")

    # Company can only update their own requests
    if user.get("role") == "company" and req.get("company_slug") != user.get("company_slug"):
        raise HTTPException(status_code=403, detail="Not your request")

    req["status"] = body.status
    req["updated_at"] = datetime.now(timezone.utc).isoformat()
    _save(requests)

    add_activity_log(
        f"request_{body.status}",
        request_id,
        f"Request {request_id} set to {body.status} by {user.get('display_name', '')}",
    )
    return {"status": "ok", "request": req}


@router.put("/{request_id}/respond")
def respond_to_request(
    request_id: str,
    body: RequestResponse,
    user: dict = Depends(require_role("company", "admin")),
):
    """Company adds response notes to a request."""
    requests = _load()
    req = next((r for r in requests if r.get("id") == request_id), None)
    if not req:
        raise HTTPException(status_code=404, detail="Request not found")

    if user.get("role") == "company" and req.get("company_slug") != user.get("company_slug"):
        raise HTTPException(status_code=403, detail="Not your request")

    req["company_notes"] = body.notes
    req["updated_at"] = datetime.now(timezone.utc).isoformat()
    _save(requests)
    return {"status": "ok"}


@router.get("/stats/summary")
def get_request_stats(user: dict = Depends(get_current_user)):
    """Return request statistics for the current user."""
    all_req = _load()
    role = user.get("role")
    email = user.get("email", "")
    slug = user.get("company_slug", "")

    if role == "admin":
        filtered = all_req
    elif role == "client":
        filtered = [r for r in all_req if r.get("client_email") == email]
    elif role == "company":
        filtered = [r for r in all_req if r.get("company_slug") == slug]
    else:
        filtered = []

    return {
        "total": len(filtered),
        "pending": sum(1 for r in filtered if r.get("status") == "pending"),
        "accepted": sum(1 for r in filtered if r.get("status") == "accepted"),
        "rejected": sum(1 for r in filtered if r.get("status") == "rejected"),
        "completed": sum(1 for r in filtered if r.get("status") == "completed"),
    }


# ── AI-assisted request suggestions ──

class AISuggestRequest(BaseModel):
    location: str = ""
    plot_size: str = ""
    construction_type: str = ""  # grey structure, full finish, renovation
    budget: str = ""
    description: str = ""


@router.post("/ai-suggest")
def ai_suggest_request(body: AISuggestRequest, user: dict = Depends(get_current_user)):
    """Get AI-powered suggestions for a quote request: estimated cost, materials, timeline."""
    from backend.utils.rag_engine import _call_openrouter
    from backend.utils.market_prices import get_market_prices_context

    prompt = (
        "You are a construction cost estimator for Pakistan. Based on the following project details, "
        "provide a structured suggestion including:\n"
        "1. **Estimated Cost Range** in PKR\n"
        "2. **Key Materials Needed** with approximate quantities\n"
        "3. **Estimated Timeline** (months)\n"
        "4. **Tips** for the client\n"
        "5. **Suggested Budget Breakdown** (foundation, structure, finishing, etc.)\n\n"
        f"Project Details:\n"
        f"- Location: {body.location or 'Not specified'}\n"
        f"- Plot Size: {body.plot_size or 'Not specified'}\n"
        f"- Type: {body.construction_type or 'Not specified'}\n"
        f"- Budget: {body.budget or 'Not specified'}\n"
        f"- Description: {body.description or 'Not specified'}\n\n"
        f"{get_market_prices_context()}\n\n"
        "Provide a concise, practical response using bullet points and tables."
    )

    try:
        suggestion = _call_openrouter(prompt, [{"role": "user", "content": "Please provide construction cost suggestions."}])
        return {"suggestion": suggestion, "status": "ok"}
    except Exception as e:
        logger.warning("AI suggestion failed: %s", e)
        # Fallback: basic estimation
        fallback = (
            "**Estimated Cost Guidance:**\n\n"
            "| Construction Type | Cost per sq ft (PKR) |\n"
            "|---|---|\n"
            "| Grey Structure | 2,500 - 4,000 |\n"
            "| Semi-Furnished | 4,000 - 6,500 |\n"
            "| Fully Furnished | 6,500 - 12,000+ |\n\n"
            "**Key Materials:** Cement, Steel, Bricks, Sand, Aggregate, "
            "Plumbing, Electrical, Paint, Tiles\n\n"
            "**Timeline:** 6-12 months for grey structure, 12-18 months for full finish\n\n"
            "*For a detailed estimate, please specify your location, plot size, and budget.*"
        )
        return {"suggestion": fallback, "status": "fallback"}
