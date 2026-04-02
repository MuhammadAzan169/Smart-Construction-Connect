"""Supplier CRUD routes — backed by Database/suppliers/catalog.json."""

from __future__ import annotations
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Any

from backend.utils.data_handler import (
    read_json,
    write_json,
    suppliers_dataset_path,
    add_activity_log,
)

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
def list_suppliers():
    """Return all suppliers."""
    return _load_suppliers()


@router.get("/{supplier_id}")
def get_supplier(supplier_id: str):
    """Get a single supplier by ID."""
    s = _find_supplier(_load_suppliers(), supplier_id=supplier_id)
    if not s:
        raise HTTPException(status_code=404, detail="Supplier not found")
    return s


@router.get("/profile/{slug}")
def get_supplier_profile(slug: str):
    """Get a supplier's profile by slug."""
    s = _find_supplier(_load_suppliers(), slug=slug)
    if not s:
        raise HTTPException(status_code=404, detail="Supplier profile not found")
    return s


class SupplierProfileUpdate(BaseModel):
    data: dict[str, Any]


@router.put("/profile/{slug}")
def update_supplier_profile(slug: str, body: SupplierProfileUpdate):
    """Update supplier profile."""
    suppliers = _load_suppliers()
    supplier = _find_supplier(suppliers, slug=slug)
    if not supplier:
        raise HTTPException(status_code=404, detail="Supplier profile not found")
    supplier.update(body.data)
    _save_suppliers(suppliers)
    add_activity_log("supplier_profile_updated", slug, f"Supplier {slug} updated their profile")
    return {"status": "ok"}


class MaterialsUpdate(BaseModel):
    materials: list[dict[str, Any]]


@router.put("/profile/{slug}/materials")
def update_materials(slug: str, body: MaterialsUpdate):
    """Update supplier materials/products."""
    suppliers = _load_suppliers()
    supplier = _find_supplier(suppliers, slug=slug)
    if not supplier:
        raise HTTPException(status_code=404, detail="Supplier profile not found")
    supplier["materials"] = body.materials
    _save_suppliers(suppliers)
    add_activity_log("materials_updated", slug, f"Supplier {slug} updated materials")
    return {"status": "ok"}
