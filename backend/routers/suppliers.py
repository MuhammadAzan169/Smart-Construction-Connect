"""Supplier CRUD routes — backed by Database/suppliers/catalog.json."""

from __future__ import annotations
import logging
from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from typing import Any

from backend.utils.auth_deps import get_current_user, require_role
from backend.utils.data_handler import (
    read_json,
    write_json,
    suppliers_dataset_path,
    add_activity_log,
)
from backend.utils.embeddings import update_entity_embedding

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/suppliers", tags=["suppliers"])


def _load_suppliers() -> list[dict]:
    return read_json(suppliers_dataset_path())


def _save_suppliers(suppliers: list[dict]):
    write_json(suppliers_dataset_path(), suppliers)


def _find_supplier(suppliers: list[dict], *, supplier_id: str | None = None, slug: str | None = None) -> dict | None:
    for s in suppliers:
        if supplier_id and s.get("supplier_id") == supplier_id:
            return s
        if slug and s.get("slug") == slug:
            return s
    return None


@router.get("/")
def list_suppliers(
    page: int = Query(1, ge=1, description="Page number"),
    limit: int = Query(0, ge=0, le=500, description="Items per page (0 = all)"),
    city: str = Query("", description="Filter by city"),
    verified: bool | None = Query(None, description="Filter by verified status"),
):
    """Return suppliers with optional pagination and filtering."""
    items = _load_suppliers()

    if city:
        city_lower = city.lower()
        items = [s for s in items if city_lower in (s.get("city") or "").lower()]
    if verified is not None:
        target = "verified" if verified else "pending"
        items = [s for s in items if s.get("verification_status") == target]

    total = len(items)

    if limit > 0:
        start = (page - 1) * limit
        items = items[start:start + limit]

    return {"items": items, "total": total, "page": page, "limit": limit}


@router.get("/profile/{slug}")
def get_supplier_profile(slug: str):
    """Get a supplier's profile by slug."""
    s = _find_supplier(_load_suppliers(), slug=slug)
    if not s:
        raise HTTPException(status_code=404, detail="Supplier profile not found")
    return s


class SupplierProfileUpdate(BaseModel):
    data: dict[str, Any]


_ALLOWED_PROFILE_FIELDS = {
    "supplier_name", "description", "logo_url", "dp_url",
    "city", "area", "contact", "cities_served",
    "verification_documents",
    "legal_info", "payment_terms", "delivery_info",
    "status", "material_categories", "profile_settings",
    "_editor_settings",
}

_PROTECTED_FIELDS = {
    "rating", "review_count", "reliability_score",
    "verification", "verification_status", "supplier_id", "slug",
}


@router.put("/profile/{slug}")
def update_supplier_profile(
    slug: str,
    body: SupplierProfileUpdate,
    user: dict = Depends(require_role("supplier", "admin")),
):
    """Update supplier profile."""
    suppliers = _load_suppliers()
    supplier = _find_supplier(suppliers, slug=slug)
    if not supplier:
        raise HTTPException(status_code=404, detail="Supplier profile not found")

    if user.get("role") != "admin" and user.get("supplier_slug") != slug:
        raise HTTPException(status_code=403, detail="You can only edit your own supplier profile")

    is_admin = user.get("role") == "admin"
    for key, value in body.data.items():
        if key in _PROTECTED_FIELDS and not is_admin:
            continue
        if key in _ALLOWED_PROFILE_FIELDS or is_admin:
            supplier[key] = value

    _save_suppliers(suppliers)
    add_activity_log("supplier_profile_updated", slug, f"Supplier {slug} updated their profile")
    update_entity_embedding(supplier.get("supplier_id", slug), "supplier", supplier)
    return {"status": "ok"}


class MaterialsUpdate(BaseModel):
    materials: list[dict[str, Any]]


@router.get("/{supplier_id}")
def get_supplier(supplier_id: str):
    """Get a single supplier by ID or slug."""
    suppliers = _load_suppliers()
    s = _find_supplier(suppliers, supplier_id=supplier_id) or _find_supplier(suppliers, slug=supplier_id)
    if not s:
        raise HTTPException(status_code=404, detail="Supplier not found")
    return s


@router.put("/profile/{slug}/materials")
def update_materials(
    slug: str,
    body: MaterialsUpdate,
    user: dict = Depends(require_role("supplier", "admin")),
):
    """Update supplier materials/products."""
    suppliers = _load_suppliers()
    supplier = _find_supplier(suppliers, slug=slug)
    if not supplier:
        raise HTTPException(status_code=404, detail="Supplier profile not found")

    if user.get("role") != "admin" and user.get("supplier_slug") != slug:
        raise HTTPException(status_code=403, detail="You can only edit your own supplier profile")
    supplier["materials"] = body.materials
    _save_suppliers(suppliers)
    add_activity_log("materials_updated", slug, f"Supplier {slug} updated materials")
    update_entity_embedding(supplier.get("supplier_id", slug), "supplier", supplier)
    return {"status": "ok"}
