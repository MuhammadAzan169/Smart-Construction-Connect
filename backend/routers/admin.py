"""Admin routes — all endpoints require admin role."""

from __future__ import annotations
import asyncio
import logging
from fastapi import APIRouter, Depends, HTTPException, Query
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

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/admin", tags=["admin"], dependencies=[Depends(require_admin)])


@router.get("/users")
def list_all_users(
    page: int = Query(1, ge=1),
    limit: int = Query(50, ge=1, le=500),
    role: str = Query("", description="Filter by role"),
    status: str = Query("", description="Filter by status"),
):
    """Return all registered users (passwords stripped), with optional pagination."""
    users = get_all_users()

    if role:
        users = [u for u in users if u.get("role") == role]
    if status:
        users = [u for u in users if u.get("status") == status]

    total = len(users)

    start = (page - 1) * limit
    users = users[start:start + limit]

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
    return {"items": result, "total": total, "page": page, "limit": limit}


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

    # ── Notify the entity owner via in-platform message ──
    _notify_owner_of_verification(body.slug, body.entity_type, body.doc_type, body.status, body.notes)

    return {"status": "ok", "verification_status": entity["verification_status"]}


def _notify_owner_of_verification(slug: str, entity_type: str, doc_type: str, status: str, notes: str) -> None:
    """Find the owner of a company/supplier and send them a verification status message."""
    try:
        from backend.routers.messages import send_system_notification

        role = "company" if entity_type == "company" else "supplier"
        slug_field = "company_slug" if entity_type == "company" else "supplier_slug"
        users = get_users_by_role(role)
        owner = next((u for u in users if u.get(slug_field) == slug), None)
        if not owner:
            logger.warning("No %s user found with %s=%s", entity_type, slug_field, slug)
            return

        owner_email = owner.get("email", "")
        owner_name = owner.get("display_name") or owner.get("name") or owner_email
        doc_label = doc_type.replace("_", " ").title()

        if status == "approved":
            content = (
                f"✅ Document Approved\n\n"
                f"Your document \"{doc_label}\" has been reviewed and approved by the platform admin. "
                f"Your profile verification status has been updated accordingly.\n\n"
                f"Thank you for submitting your documents. Your profile will now appear as verified to clients."
            )
        elif status == "rejected":
            content = (
                f"❌ Document Rejected\n\n"
                f"Your document \"{doc_label}\" could not be approved at this time."
            )
            if notes:
                content += f"\n\nAdmin notes: {notes}"
            content += (
                "\n\nPlease log in to your Settings page, review the requirements, "
                "and re-upload the corrected document. If you have questions, reply to this message."
            )
        else:
            content = f"📋 Document Update\n\nYour document \"{doc_label}\" status has been updated to: {status}."
            if notes:
                content += f"\n\n{notes}"

        asyncio.create_task(
            send_system_notification(
                recipient_email=owner_email,
                recipient_name=owner_name,
                content=content,
                extra_fields={"doc_type": doc_type, "verification_status": status},
            )
        )
    except RuntimeError:
        # No running event loop (e.g., during sync tests) — fire-and-forget via a new loop
        try:
            from backend.routers.messages import send_system_notification
            import asyncio as _aio
            _loop = _aio.new_event_loop()
            _loop.run_until_complete(
                send_system_notification(
                    recipient_email=owner_email,  # type: ignore[reportPossiblyUnbound]
                    recipient_name=owner_name,  # type: ignore[reportPossiblyUnbound]
                    content=content,  # type: ignore[reportPossiblyUnbound]
                    extra_fields={"doc_type": doc_type, "verification_status": status},
                )
            )
            _loop.close()
        except Exception as inner:
            logger.warning("Sync notification fallback failed: %s", inner)
    except Exception as e:
        logger.warning("_notify_owner_of_verification failed: %s", e)


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
