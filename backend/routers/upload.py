"""Image upload routes — stores images in /images/{entity_name}/"""
from __future__ import annotations

import re
from pathlib import Path

from fastapi import APIRouter, File, Form, HTTPException, UploadFile
from fastapi.responses import JSONResponse

router = APIRouter(prefix="/api/upload", tags=["upload"])

IMAGES_ROOT = Path(__file__).resolve().parents[2] / "images"
ALLOWED_CONTENT_TYPES = {"image/jpeg", "image/jpg", "image/png", "image/gif", "image/webp"}
MAX_FILE_SIZE = 5 * 1024 * 1024  # 5 MB

_EXT_MAP = {
    "image/jpeg": "jpg",
    "image/jpg": "jpg",
    "image/png": "png",
    "image/gif": "gif",
    "image/webp": "webp",
}


def _safe_folder_name(name: str) -> str:
    """Sanitize entity name for safe use as a folder name (no path traversal)."""
    name = name.strip().lower()
    name = re.sub(r"[^a-z0-9_-]", "-", name)
    name = re.sub(r"-+", "-", name).strip("-")
    return name[:60] or "unknown"


@router.post("/image")
async def upload_image(
    file: UploadFile = File(...),
    entity_name: str = Form(...),
    image_type: str = Form("profile"),  # "profile" or "dp"
) -> JSONResponse:
    """
    Upload a profile or display-picture image for a company or supplier.
    Stores the file at /images/{entity_name}/{image_type}.{ext} and returns
    the URL path.
    """
    content_type = (file.content_type or "").lower()
    if content_type not in ALLOWED_CONTENT_TYPES:
        raise HTTPException(
            status_code=400,
            detail="Only JPEG, PNG, GIF, and WebP images are allowed.",
        )

    content = await file.read()
    if len(content) > MAX_FILE_SIZE:
        raise HTTPException(
            status_code=400,
            detail="File size must not exceed 5 MB.",
        )

    safe_name = _safe_folder_name(entity_name)
    folder = IMAGES_ROOT / safe_name
    folder.mkdir(parents=True, exist_ok=True)

    ext = _EXT_MAP.get(content_type, "jpg")
    safe_type = "dp" if image_type.strip().lower() == "dp" else "profile"
    filename = f"{safe_type}.{ext}"

    dest = folder / filename
    dest.write_bytes(content)

    url = f"/images/{safe_name}/{filename}"
    return JSONResponse({"url": url, "entity_name": safe_name, "image_type": safe_type})
