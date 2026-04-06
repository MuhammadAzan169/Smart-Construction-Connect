"""Authentication routes — signup & login backed by per-role users.json files."""

from __future__ import annotations
import logging
import uuid
from datetime import datetime, timezone
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field, field_validator

try:
    import bcrypt
    _BCRYPT_AVAILABLE = True
except ImportError:  # pragma: no cover
    _BCRYPT_AVAILABLE = False

from backend.utils.auth_deps import create_access_token
from backend.utils.data_handler import (
    find_user_by_email,
    add_user,
    slugify,
    read_json,
    write_json,
    companies_dataset_path,
    suppliers_dataset_path,
    add_activity_log,
    _ROLE_DIRS,
)
from backend.utils.events import event_bus, Events
from backend.utils.embeddings import update_entity_embedding

logger = logging.getLogger(__name__)


def _hash_password(plain: str) -> str:
    """Return a bcrypt hash. Raises if bcrypt is not installed."""
    if not _BCRYPT_AVAILABLE:
        raise RuntimeError(
            "bcrypt is required for password hashing. Install it: pip install bcrypt"
        )
    return bcrypt.hashpw(plain.encode(), bcrypt.gensalt()).decode()


def _verify_password(plain: str, stored: str) -> bool:
    """Verify a password against a bcrypt hash. Rejects legacy plaintext."""
    if stored.startswith("$2b$") or stored.startswith("$2a$"):
        if not _BCRYPT_AVAILABLE:
            return False
        return bcrypt.checkpw(plain.encode(), stored.encode())
    # Reject any non-bcrypt hash — legacy plaintext passwords must be re-hashed
    logger.warning("Rejected login attempt with non-bcrypt password hash")
    return False



class LoginRequest(BaseModel):
    email: str = Field(..., min_length=3, max_length=255)
    password: str = Field(..., min_length=1)
    role: str = Field(..., pattern=r"^(client|company|supplier|admin)$")


class SignupRequest(BaseModel):
    name: str = Field(..., min_length=2, max_length=200)
    email: str = Field(..., min_length=3, max_length=255)
    password: str = Field(..., min_length=8, max_length=128)
    role: str = Field(..., pattern=r"^(client|company|supplier|admin)$")
    phone: str = ""

    @field_validator("email")
    @classmethod
    def validate_email(cls, v: str) -> str:
        v = v.strip().lower()
        if "@" not in v or "." not in v.split("@")[-1]:
            raise ValueError("Invalid email format")
        return v

    @field_validator("password")
    @classmethod
    def validate_password_strength(cls, v: str) -> str:
        if not any(c.isupper() for c in v):
            raise ValueError("Password must contain at least one uppercase letter")
        if not any(c.isdigit() for c in v):
            raise ValueError("Password must contain at least one digit")
        return v


class LoginResponse(BaseModel):
    user_id: str
    display_name: str
    email: str
    role: str
    status: str
    phone: str | None = None
    company_slug: str | None = None
    supplier_slug: str | None = None
    access_token: str
    token_type: str = "bearer"


def _user_to_login_response(user: dict, token: str) -> LoginResponse:
    return LoginResponse(
        user_id=user.get("user_id", user.get("id", "")),
        display_name=user.get("display_name", user.get("name", "")),
        email=user.get("email", ""),
        role=user.get("role", ""),
        status=user.get("status", ""),
        phone=user.get("phone"),
        company_slug=user.get("company_slug", user.get("companyFile")),
        supplier_slug=user.get("supplier_slug", user.get("supplierFile")),
        access_token=token,
    )


router = APIRouter(prefix="/api/auth", tags=["auth"])


@router.post("/login", response_model=LoginResponse)
def login(req: LoginRequest):
    user = find_user_by_email(req.email)
    if not user:
        raise HTTPException(status_code=401, detail="Invalid email or password")

    stored = user.get("password_hash", user.get("password", ""))
    if not _verify_password(req.password, stored):
        raise HTTPException(status_code=401, detail="Invalid email or password")

    if user.get("role") != req.role:
        raise HTTPException(status_code=401, detail="Role mismatch")

    token = create_access_token({"sub": user["email"], "role": user["role"]})
    logger.info("User logged in: %s (%s)", user["email"], user["role"])
    return _user_to_login_response(user, token)


@router.post("/signup", response_model=LoginResponse)
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
        "password_hash": _hash_password(req.password),
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

    # Emit events + build embeddings for new entities
    event_bus.publish_sync(Events.USER_SIGNUP, {"role": req.role, "name": req.name}, actor=req.email)
    if req.role == "company":
        update_entity_embedding(user_id, "company")
        event_bus.publish_sync(Events.COMPANY_REGISTERED, {"slug": slug, "name": req.name}, actor=req.email)
    elif req.role == "supplier":
        update_entity_embedding(user_id, "supplier")
        event_bus.publish_sync(Events.SUPPLIER_REGISTERED, {"slug": slug, "name": req.name}, actor=req.email)

    token = create_access_token({"sub": new_user["email"], "role": new_user["role"]})
    logger.info("New user signed up: %s (%s)", req.email, req.role)
    return _user_to_login_response(new_user, token)


# ── Profile management ────────────────────────────────────────────────────────

from backend.utils.auth_deps import get_current_user
from fastapi import Depends


class ProfileUpdateRequest(BaseModel):
    display_name: str | None = None
    phone: str | None = None
    preferences: dict | None = None


class ChangePasswordRequest(BaseModel):
    current_password: str
    new_password: str


@router.get("/profile")
def get_profile(user: dict = Depends(get_current_user)):
    """Return the current user's profile (all non-sensitive fields)."""
    safe = {k: v for k, v in user.items() if k != "password_hash"}
    return safe


@router.put("/profile")
def update_profile(body: ProfileUpdateRequest, user: dict = Depends(get_current_user)):
    """Update display_name, phone, and/or preferences for the current user."""
    role = user.get("role", "client")
    path = _ROLE_DIRS.get(role)
    if not path:
        raise HTTPException(status_code=400, detail="Unsupported role")

    users_file = path / "users.json"
    records = read_json(users_file)

    updated = False
    for record in records:
        if record.get("email") == user.get("email"):
            if body.display_name is not None:
                record["display_name"] = body.display_name.strip()
            if body.phone is not None:
                record["phone"] = body.phone.strip() or None
            if body.preferences is not None:
                existing = record.get("preferences") or {}
                existing.update(body.preferences)
                record["preferences"] = existing
            record["updated_at"] = datetime.now(timezone.utc).isoformat()
            updated = True
            break

    if not updated:
        raise HTTPException(status_code=404, detail="User record not found")

    write_json(users_file, records)
    return {"status": "ok"}


@router.put("/change-password")
def change_password(body: ChangePasswordRequest, user: dict = Depends(get_current_user)):
    """Change the current user's password after verifying the current one."""
    if not _verify_password(body.current_password, user.get("password_hash", "")):
        raise HTTPException(status_code=400, detail="Current password is incorrect")

    role = user.get("role", "client")
    path = _ROLE_DIRS.get(role)
    if not path:
        raise HTTPException(status_code=400, detail="Unsupported role")

    users_file = path / "users.json"
    records = read_json(users_file)

    for record in records:
        if record.get("email") == user.get("email"):
            record["password_hash"] = _hash_password(body.new_password)
            record["updated_at"] = datetime.now(timezone.utc).isoformat()
            break

    write_json(users_file, records)
    return {"status": "ok"}
