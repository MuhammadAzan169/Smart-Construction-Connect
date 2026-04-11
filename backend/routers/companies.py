"""Company CRUD routes — backed by Database/construction/companies.json."""

from __future__ import annotations
import logging
from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from typing import Any

from backend.utils.auth_deps import get_current_user, require_role
from backend.utils.data_handler import (
    read_json,
    write_json,
    companies_dataset_path,
    add_activity_log,
)
from backend.utils.events import event_bus, Events
from backend.utils.embeddings import update_entity_embedding

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/companies", tags=["companies"])


def _load_companies() -> list[dict]:
    return read_json(companies_dataset_path())


def _save_companies(companies: list[dict]):
    write_json(companies_dataset_path(), companies)


def _find_company(companies: list[dict], *, company_id: str | None = None, slug: str | None = None) -> dict | None:
    for c in companies:
        if company_id and c.get("company_id") == company_id:
            return c
        if slug and c.get("slug") == slug:
            return c
    return None


@router.get("/")
def list_companies(
    page: int = Query(1, ge=1, description="Page number"),
    limit: int = Query(0, ge=0, le=500, description="Items per page (0 = all)"),
    city: str = Query("", description="Filter by city"),
    verified: bool | None = Query(None, description="Filter by verified status"),
):
    """Return companies with optional pagination and filtering."""
    items = _load_companies()

    # Filtering
    if city:
        city_lower = city.lower()
        items = [c for c in items if city_lower in (c.get("city") or "").lower()]
    if verified is not None:
        target = "verified" if verified else "pending"
        items = [c for c in items if c.get("verification_status") == target]

    total = len(items)

    # Pagination (limit=0 means return all for backward compat)
    if limit > 0:
        start = (page - 1) * limit
        items = items[start:start + limit]

    return {"items": items, "total": total, "page": page, "limit": limit}


@router.get("/{company_id}")
def get_company(company_id: str):
    """Get a single company by ID."""
    c = _find_company(_load_companies(), company_id=company_id)
    if not c:
        raise HTTPException(status_code=404, detail="Company not found")
    return c


@router.get("/profile/{slug}")
def get_company_profile(slug: str):
    """Get a company's profile by slug (for dashboard editing)."""
    c = _find_company(_load_companies(), slug=slug)
    if not c:
        raise HTTPException(status_code=404, detail="Company profile not found")
    return c


class CompanyProfileUpdate(BaseModel):
    data: dict[str, Any]


# Fields that users are allowed to set via profile update.
# Anything not in this set is silently dropped.
_ALLOWED_PROFILE_FIELDS = {
    "company_name", "description", "logo_url", "dp_url", "city",
    "contact", "legal_info",
    "construction_capability", "services", "services_offered",
    "payment_terms", "timeline_estimates", "timeline_notes",
    "experience", "experience_track", "quality_control",
    "after_handover_support", "legal_and_contract", "legal_contract",
    "ideal_customer_profile",
    "verification_documents",
    "projects",
    "materials_used", "profile_settings", "_editor_settings",
}

# Fields that only admins can modify — never writable by regular users.
_PROTECTED_FIELDS = {
    "rating", "review_count", "ai_scores", "reliability_score",
    "verification", "verification_status", "company_id", "slug",
}


@router.put("/profile/{slug}")
def update_company_profile(
    slug: str,
    body: CompanyProfileUpdate,
    user: dict = Depends(require_role("company", "admin")),
):
    """Update a company's profile data."""
    companies = _load_companies()
    company = _find_company(companies, slug=slug)
    if not company:
        raise HTTPException(status_code=404, detail="Company profile not found")

    # Non-admin users can only edit their own company
    if user.get("role") != "admin" and user.get("company_slug") != slug:
        raise HTTPException(status_code=403, detail="You can only edit your own company profile")

    # Filter to allowed fields only
    is_admin = user.get("role") == "admin"
    for key, value in body.data.items():
        if key in _PROTECTED_FIELDS and not is_admin:
            continue
        if key in _ALLOWED_PROFILE_FIELDS or is_admin:
            company[key] = value

    _save_companies(companies)
    add_activity_log("company_profile_updated", slug, f"Company {slug} updated their profile")
    # Update embeddings + emit event
    update_entity_embedding(company.get("company_id", slug), "company")
    event_bus.publish_sync(Events.COMPANY_UPDATED, {"slug": slug, "fields": list(body.data.keys())}, actor=user.get("email", ""))
    return {"status": "ok"}


class PackageUpdate(BaseModel):
    operational_areas: dict[str, Any]
    flattened_operational_areas: list[dict[str, Any]]
    package_scope: dict[str, Any] = {}
    materials_used: dict[str, Any] = {}
    estimated_cost_range: dict[str, Any] = {}


@router.put("/profile/{slug}/packages")
def update_packages(
    slug: str,
    body: PackageUpdate,
    user: dict = Depends(require_role("company", "admin")),
):
    """Update company packages & pricing."""
    companies = _load_companies()
    company = _find_company(companies, slug=slug)
    if not company:
        raise HTTPException(status_code=404, detail="Company profile not found")

    if user.get("role") != "admin" and user.get("company_slug") != slug:
        raise HTTPException(status_code=403, detail="You can only edit your own company profile")

    company["operational_areas"] = body.operational_areas
    company["flattened_operational_areas"] = body.flattened_operational_areas
    company["package_scope"] = body.package_scope
    company["materials_used"] = body.materials_used
    company["estimated_cost_range"] = body.estimated_cost_range
    _save_companies(companies)
    add_activity_log("packages_updated", slug, f"Company {slug} updated packages & pricing")
    update_entity_embedding(company.get("company_id", slug), "company")
    event_bus.publish_sync(Events.PACKAGE_UPDATED, {"slug": slug}, actor=user.get("email", ""))
    return {"status": "ok"}


class ProjectsUpdate(BaseModel):
    projects: list[dict[str, Any]]


@router.put("/profile/{slug}/projects")
def update_projects(
    slug: str,
    body: ProjectsUpdate,
    user: dict = Depends(require_role("company", "admin")),
):
    """Update company projects / portfolio."""
    companies = _load_companies()
    company = _find_company(companies, slug=slug)
    if not company:
        raise HTTPException(status_code=404, detail="Company profile not found")

    if user.get("role") != "admin" and user.get("company_slug") != slug:
        raise HTTPException(status_code=403, detail="You can only edit your own company profile")

    company["projects"] = body.projects
    _save_companies(companies)
    add_activity_log("projects_updated", slug, f"Company {slug} updated projects")
    update_entity_embedding(company.get("company_id", slug), "company")
    event_bus.publish_sync(Events.COMPANY_UPDATED, {"slug": slug, "action": "projects_updated"}, actor=user.get("email", ""))
    return {"status": "ok"}
