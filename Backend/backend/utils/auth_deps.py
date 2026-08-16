"""FastAPI dependencies for role-based access control (JWT-based).

Usage in routes:
    from backend.utils.auth_deps import require_role, require_admin, get_current_user

    @router.get("/admin-only")
    def admin_endpoint(user: dict = Depends(require_admin)):
        ...

    @router.put("/profile/{slug}")
    def update_profile(slug: str, user: dict = Depends(require_role("company"))):
        ...
"""

from __future__ import annotations

import logging
from datetime import datetime, timedelta, timezone

import jwt
from fastapi import HTTPException, Depends
from fastapi.security import OAuth2PasswordBearer

from backend.config import JWT_SECRET_KEY, JWT_ALGORITHM, JWT_ACCESS_TOKEN_EXPIRE_MINUTES
from backend.utils.data_handler import find_user_by_email

logger = logging.getLogger(__name__)

# OAuth2 scheme — accepts Bearer token from Authorization header
_oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/auth/login", auto_error=False)


# ── Token creation / verification ─────────────────────────────────────────────

def create_access_token(data: dict, expires_delta: timedelta | None = None) -> str:
    """Create a signed JWT access token."""
    to_encode = data.copy()
    expire = datetime.now(timezone.utc) + (expires_delta or timedelta(minutes=JWT_ACCESS_TOKEN_EXPIRE_MINUTES))
    to_encode["exp"] = expire
    return jwt.encode(to_encode, JWT_SECRET_KEY, algorithm=JWT_ALGORITHM)


def _decode_token(token: str) -> dict:
    """Decode and validate a JWT token. Raises HTTPException on failure."""
    try:
        payload = jwt.decode(token, JWT_SECRET_KEY, algorithms=[JWT_ALGORITHM])
        return payload
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token has expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token")


# ── User resolution ───────────────────────────────────────────────────────────

def get_current_user(
    token: str | None = Depends(_oauth2_scheme),
) -> dict:
    """Resolve the current user from JWT Bearer token."""
    email: str = ""
    role_claim: str = ""

    if token:
        payload = _decode_token(token)
        email = payload.get("sub", "")
        role_claim = payload.get("role", "")
    else:
        raise HTTPException(status_code=401, detail="Authentication required")

    if not email:
        raise HTTPException(status_code=401, detail="Invalid credentials")

    user = find_user_by_email(email)
    if not user:
        raise HTTPException(status_code=401, detail="User not found")

    if user.get("status") == "banned":
        raise HTTPException(status_code=403, detail="Account is banned")

    # Verify claimed role matches stored role
    stored_role = user.get("role", "")
    if role_claim and stored_role != role_claim:
        raise HTTPException(status_code=403, detail="Role mismatch")

    return user


def require_admin(user: dict = Depends(get_current_user)) -> dict:
    """Dependency that ensures the caller is an admin."""
    if user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    return user


def require_role(*allowed_roles: str):
    """Return a dependency that restricts access to specific roles.

    Example: Depends(require_role("company", "admin"))
    """
    def _check(user: dict = Depends(get_current_user)) -> dict:
        if user.get("role") not in allowed_roles:
            raise HTTPException(
                status_code=403,
                detail=f"Access restricted to: {', '.join(allowed_roles)}",
            )
        return user
    return _check
