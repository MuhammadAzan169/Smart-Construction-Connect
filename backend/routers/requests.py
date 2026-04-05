"""Quote-request routes — clients can request quotes, companies can respond."""

from __future__ import annotations
import uuid
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from typing import Optional

from backend.utils.auth_deps import get_current_user, require_role
from backend.utils.data_handler import read_json, write_json, add_activity_log, DB_DIR

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
