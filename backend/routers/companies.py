"""Company CRUD routes — backed by Database/construction/companies.json."""

from __future__ import annotations
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from typing import Any

from backend.utils.auth_deps import get_current_user, require_role
from backend.utils.data_handler import (
    read_json,
    write_json,
    companies_dataset_path,
    add_activity_log,
)

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
def list_companies():
    """Return all companies."""
    return _load_companies()


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
    "construction_capability", "services",
    "payment_terms", "timeline_estimates",
    "experience", "quality_control",
    "after_handover_support", "legal_and_contract",
    "ideal_customer_profile",
    "verification_documents",
    "projects",
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
    return {"status": "ok"}
