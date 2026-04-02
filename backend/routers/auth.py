"""Authentication routes — signup & login backed by per-role users.json files."""

from __future__ import annotations
import uuid
from datetime import datetime, timezone
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from backend.utils.data_handler import (
    find_user_by_email,
    add_user,
    slugify,
    read_json,
    write_json,
    companies_dataset_path,
    suppliers_dataset_path,
    add_activity_log,
)

router = APIRouter(prefix="/api/auth", tags=["auth"])


class LoginRequest(BaseModel):
    email: str
    password: str
    role: str


class SignupRequest(BaseModel):
    name: str
    email: str
    password: str
    role: str
    phone: str = ""


class UserResponse(BaseModel):
    user_id: str
    display_name: str
    email: str
    role: str
    status: str
    phone: str | None = None
    company_slug: str | None = None
    supplier_slug: str | None = None


def _user_to_response(user: dict) -> UserResponse:
    return UserResponse(
        user_id=user.get("user_id", user.get("id", "")),
        display_name=user.get("display_name", user.get("name", "")),
        email=user.get("email", ""),
        role=user.get("role", ""),
        status=user.get("status", ""),
        phone=user.get("phone"),
        company_slug=user.get("company_slug", user.get("companyFile")),
        supplier_slug=user.get("supplier_slug", user.get("supplierFile")),
    )


@router.post("/login", response_model=UserResponse)
def login(req: LoginRequest):
    user = find_user_by_email(req.email)
    if not user:
        raise HTTPException(status_code=401, detail="Invalid email or password")

    # Check password — new format uses password_hash with placeholder prefix,
    # old format uses plain password field.
    stored = user.get("password_hash", user.get("password", ""))
    if stored.startswith("__PLAINTEXT__"):
        # Extract the plain password from the placeholder wrapper
        plain = stored.replace("__PLAINTEXT__", "").replace("__HASH_BEFORE_PRODUCTION__", "")
        if plain != req.password:
            raise HTTPException(status_code=401, detail="Invalid email or password")
    else:
        # Direct comparison (old format fallback)
        if stored != req.password:
            raise HTTPException(status_code=401, detail="Invalid email or password")

    if user.get("role") != req.role:
        raise HTTPException(status_code=401, detail="Role mismatch")

    return _user_to_response(user)


@router.post("/signup", response_model=UserResponse)
def signup(req: SignupRequest):
    existing = find_user_by_email(req.email)
    if existing:
        raise HTTPException(status_code=409, detail="Email already registered")

    needs_approval = req.role in ("company", "supplier")
    user_id = str(uuid.uuid4())
    slug = slugify(req.name)
    now_iso = datetime.now(timezone.utc).isoformat()

    new_user: dict = {
        "user_id": user_id,
        "email": req.email.strip().lower(),
        "password_hash": f"__PLAINTEXT__{req.password}__HASH_BEFORE_PRODUCTION__",
        "display_name": req.name,
        "phone": req.phone or None,
        "role": req.role,
        "status": "pending" if needs_approval else "active",
        "created_at": now_iso,
        "updated_at": now_iso,
        "last_login_at": None,
        "legacy_id": None,
    }

    if req.role == "company":
        new_user["company_slug"] = slug
        # Add empty profile to companies.json
        companies = read_json(companies_dataset_path())
        companies.append({
            "company_id": user_id,
            "company_name": req.name,
            "slug": slug,
            "description": None,
            "logo_url": None,
            "rating": 0,
            "review_count": 0,
            "city": None,
            "contact": {"phone": req.phone, "email": req.email, "website": ""},
            "legal_info": {"registered": False, "secp_registered": False, "ntn": "", "year_established": None},
            "construction_capability": {},
            "services": {},
            "operational_areas": {},
            "flattened_operational_areas": [],
            "package_scope": {},
            "materials_used": {},
            "estimated_cost_range": {},
            "payment_terms": {"advance_percentage": 0, "installments": "", "price_type": "", "variation_clause": False},
            "timeline_estimates": {},
            "experience": {"total_projects": 0, "houses_completed": 0, "ongoing_projects": 0, "specializations": []},
            "customer_feedback": {"average_rating": 0, "review_count": 0, "common_praises": [], "common_complaints": []},
            "quality_control": {},
            "after_handover_support": {},
            "legal_and_contract": {},
            "ideal_customer_profile": {},
            "ai_scores": {"timeline_reliability": 0, "budget_accuracy": 0, "quality_consistency": 0},
        })
        write_json(companies_dataset_path(), companies)

    elif req.role == "supplier":
        new_user["supplier_slug"] = slug
        # Add empty profile to catalog.json
        suppliers = read_json(suppliers_dataset_path())
        suppliers.append({
            "supplier_id": user_id,
            "supplier_name": req.name,
            "slug": slug,
            "description": None,
            "logo_url": None,
            "rating": 0,
            "review_count": 0,
            "city": None,
            "area": None,
            "contact": {"phone": req.phone, "email": req.email, "website": ""},
            "cities_served": [],
            "materials": [],
            "status": "pending",
        })
        write_json(suppliers_dataset_path(), suppliers)

    add_user(new_user)
    add_activity_log("user_signup", req.email, f"New {req.role} signup: {req.name}")

    return _user_to_response(new_user)
