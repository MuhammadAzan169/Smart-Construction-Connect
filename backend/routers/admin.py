"""Admin routes."""

from __future__ import annotations
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from backend.utils.data_handler import (
    get_all_users,
    get_users_by_role,
    save_users_by_role,
    get_activity_log,
    read_json,
    companies_dataset_path,
    suppliers_dataset_path,
    add_activity_log,
)

router = APIRouter(prefix="/api/admin", tags=["admin"])


@router.get("/users")
def list_all_users():
    """Return all registered users (passwords stripped)."""
    users = get_all_users()
    return [{k: v for k, v in u.items() if k not in ("password_hash", "password")} for u in users]


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

    return {
        "total_users": total_users,
        "clients": clients,
        "companies": company_count,
        "suppliers": supplier_count,
        "pending_approvals": pending,
        "banned_users": banned,
        "dataset_companies": len(companies) if isinstance(companies, list) else 0,
        "dataset_suppliers": len(suppliers) if isinstance(suppliers, list) else 0,
    }
