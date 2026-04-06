"""Admin routes — all endpoints require admin role."""

from __future__ import annotations
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from backend.utils.auth_deps import require_admin
from backend.utils.data_handler import (
    get_all_users,
    get_users_by_role,
    save_users_by_role,
    get_activity_log,
    read_json,
    write_json,
    companies_dataset_path,
    suppliers_dataset_path,
    add_activity_log,
)
from backend.utils.events import event_bus, Events

router = APIRouter(prefix="/api/admin", tags=["admin"], dependencies=[Depends(require_admin)])


@router.get("/users")
def list_all_users():
    """Return all registered users (passwords stripped), with fields mapped for frontend."""
    users = get_all_users()
    result = []
    for u in users:
        result.append({
            "id": u.get("user_id") or u.get("id", ""),
            "name": u.get("display_name") or u.get("name", ""),
            "email": u.get("email", ""),
            "role": u.get("role", ""),
            "status": u.get("status", "pending"),
            "joinDate": (u.get("created_at") or "")[:10],
            "phone": u.get("phone"),
            # Keep original fields so Dashboard's pendingUsers (which uses user_id/display_name) still works
            "user_id": u.get("user_id") or u.get("id", ""),
            "display_name": u.get("display_name") or u.get("name", ""),
        })
    return result


@router.get("/activity")
def get_activity():
    """Return admin activity log."""
    return get_activity_log()


class StatusUpdate(BaseModel):
    user_id: str
    status: str  # active, banned, pending


@router.put("/users/status")
def update_user_status(body: StatusUpdate):
    """Enable/disable a user account."""
    # Search all role files
    for role in ("client", "company", "supplier", "admin"):
        users = get_users_by_role(role)
        for u in users:
            uid = u.get("user_id", u.get("id", ""))
            if uid == body.user_id:
                u["status"] = body.status
                save_users_by_role(role, users)
                add_activity_log(
                    f"user_{body.status}",
                    u.get("email", ""),
                    f"Admin set {u.get('display_name', u.get('name', ''))} status to {body.status}",
                )
                event_bus.publish_sync(Events.USER_STATUS_CHANGED, {"user_id": body.user_id, "status": body.status}, actor=u.get("email", ""))
                return {"status": "ok"}

    raise HTTPException(status_code=404, detail="User not found")


@router.get("/companies")
def admin_list_companies():
    """Return all companies with their profiles for admin review."""
    return read_json(companies_dataset_path())


@router.get("/suppliers")
def admin_list_suppliers():
    """Return all suppliers for admin review."""
    return read_json(suppliers_dataset_path())


# ── Verification management ──

class VerificationUpdate(BaseModel):
    slug: str
    entity_type: str  # "company" or "supplier"
    doc_type: str     # e.g. "secp_certificate", "ntn_certificate"
    status: str       # "approved", "rejected", "pending"
    notes: str = ""


@router.put("/verification")
def update_verification_status(body: VerificationUpdate):
    """Approve or reject a verification document for a company/supplier."""
    if body.entity_type == "company":
        records = read_json(companies_dataset_path())
        key, save_path = "slug", companies_dataset_path()
    elif body.entity_type == "supplier":
        records = read_json(suppliers_dataset_path())
        key, save_path = "slug", suppliers_dataset_path()
    else:
        raise HTTPException(status_code=400, detail="entity_type must be 'company' or 'supplier'")

    entity = next((r for r in records if r.get(key) == body.slug), None)
    if not entity:
        raise HTTPException(status_code=404, detail=f"{body.entity_type} not found")

    verification = entity.setdefault("verification", {})
    verification[body.doc_type] = {
        "status": body.status,
        "notes": body.notes,
    }

    # Update overall verification status
    all_statuses = [v.get("status") for v in verification.values() if isinstance(v, dict)]
    if all_statuses and all(s == "approved" for s in all_statuses):
        entity["verification_status"] = "verified"
    elif any(s == "rejected" for s in all_statuses):
        entity["verification_status"] = "rejected"
    else:
        entity["verification_status"] = "pending"

    write_json(save_path, records)
    add_activity_log(
        "verification_updated",
        body.slug,
        f"Admin set {body.doc_type} to {body.status} for {body.entity_type} {body.slug}",
    )
    event_bus.publish_sync(Events.VERIFICATION_UPDATED, {
        "slug": body.slug, "entity_type": body.entity_type,
        "doc_type": body.doc_type, "status": body.status,
    })
    return {"status": "ok", "verification_status": entity["verification_status"]}


@router.get("/stats")
def get_stats():
    """Return platform statistics."""
    users = get_all_users()
    companies = read_json(companies_dataset_path())
    suppliers = read_json(suppliers_dataset_path())

    total_users = len(users)
    clients = sum(1 for u in users if u.get("role") == "client")
    company_count = sum(1 for u in users if u.get("role") == "company")
    supplier_count = sum(1 for u in users if u.get("role") == "supplier")
    pending = sum(1 for u in users if u.get("status") == "pending")
    banned = sum(1 for u in users if u.get("status") == "banned")

    # Count entities with at least one document uploaded but not yet fully verified
    pending_doc_verifications = sum(
        1 for c in (companies if isinstance(companies, list) else [])
        if c.get("verification_documents") and c.get("verification_status") not in ("verified",)
        and any(v for v in c.get("verification_documents", {}).values())
    ) + sum(
        1 for s in (suppliers if isinstance(suppliers, list) else [])
        if s.get("verification_documents") and s.get("verification_status") not in ("verified",)
        and any(v for v in s.get("verification_documents", {}).values())
    )

    return {
        "total_users": total_users,
        "clients": clients,
        "companies": company_count,
        "suppliers": supplier_count,
        "pending_approvals": pending,
        "pending_doc_verifications": pending_doc_verifications,
        "banned_users": banned,
        "dataset_companies": len(companies) if isinstance(companies, list) else 0,
        "dataset_suppliers": len(suppliers) if isinstance(suppliers, list) else 0,
    }
