"""FastAPI dependencies for role-based access control.

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

from fastapi import Header, HTTPException, Depends

from backend.utils.data_handler import find_user_by_email


def get_current_user(
    x_user_email: str = Header(default=""),
    x_user_role: str = Header(default=""),
) -> dict:
    """Resolve the current user from request headers.

    The frontend sends X-User-Email and X-User-Role with every
    authenticated request.  We verify the email actually exists and
    the claimed role matches the stored role.
    """
    if not x_user_email:
        raise HTTPException(status_code=401, detail="Missing X-User-Email header")

    user = find_user_by_email(x_user_email)
    if not user:
        raise HTTPException(status_code=401, detail="User not found")

    if user.get("status") == "banned":
        raise HTTPException(status_code=403, detail="Account is banned")

    # Verify claimed role matches stored role
    stored_role = user.get("role", "")
    if x_user_role and stored_role != x_user_role:
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
