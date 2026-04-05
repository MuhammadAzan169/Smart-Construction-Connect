"""Upload routes — stores images & documents in /company_data/{role}/{entity_name}/"""
from __future__ import annotations

import re
from pathlib import Path

from fastapi import APIRouter, File, Form, HTTPException, UploadFile
from fastapi.responses import JSONResponse

router = APIRouter(prefix="/api/upload", tags=["upload"])

COMPANY_DATA_ROOT = Path(__file__).resolve().parents[2] / "company_data"
ALLOWED_IMAGE_TYPES = {"image/jpeg", "image/jpg", "image/png", "image/gif", "image/webp"}
ALLOWED_DOC_TYPES = {"application/pdf", "image/jpeg", "image/jpg", "image/png", "image/webp"}
MAX_IMAGE_SIZE = 5 * 1024 * 1024   # 5 MB
MAX_DOC_SIZE = 10 * 1024 * 1024    # 10 MB

_IMG_EXT_MAP = {
    "image/jpeg": "jpg",
    "image/jpg": "jpg",
    "image/png": "png",
    "image/gif": "gif",
    "image/webp": "webp",
}

_DOC_EXT_MAP = {
    "application/pdf": "pdf",
    "image/jpeg": "jpg",
    "image/jpg": "jpg",
    "image/png": "png",
    "image/webp": "webp",
}

# Maps auth role → folder name inside company_data/
ROLE_FOLDER_MAP = {
    "company": "construction_company",
    "construction": "construction_company",
    "client": "client",
    "supplier": "material_supplier",
}


def _safe_folder_name(name: str) -> str:
    """Sanitize entity name for safe use as a folder name (no path traversal)."""
    name = name.strip().lower()
    name = re.sub(r"[^a-z0-9_-]", "-", name)
    name = re.sub(r"-+", "-", name).strip("-")
    return name[:60] or "unknown"


def _role_folder(role: str) -> str:
    """Map a role string to the correct company_data sub-folder."""
    key = role.strip().lower()
    folder = ROLE_FOLDER_MAP.get(key)
    if not folder:
        raise HTTPException(status_code=400, detail=f"Invalid role: {role}")
    return folder


@router.post("/image")
async def upload_image(
    file: UploadFile = File(...),
    entity_name: str = Form(...),
    image_type: str = Form("profile"),  # "profile" or "dp"
    role: str = Form("company"),        # "company", "client", or "supplier"
) -> JSONResponse:
    """
    Upload a profile or display-picture image.
    Stores at /company_data/{role_folder}/{entity_name}/{image_type}.{ext}.
    """
    content_type = (file.content_type or "").lower()
    if content_type not in ALLOWED_IMAGE_TYPES:
        raise HTTPException(
            status_code=400,
            detail="Only JPEG, PNG, GIF, and WebP images are allowed.",
        )

    content = await file.read()
    if len(content) > MAX_IMAGE_SIZE:
        raise HTTPException(
            status_code=400,
            detail="File size must not exceed 5 MB.",
        )

    role_dir = _role_folder(role)
    safe_name = _safe_folder_name(entity_name)
    folder = COMPANY_DATA_ROOT / role_dir / safe_name
    folder.mkdir(parents=True, exist_ok=True)

    ext = _IMG_EXT_MAP.get(content_type, "jpg")
    safe_type = "dp" if image_type.strip().lower() == "dp" else "profile"
    filename = f"{safe_type}.{ext}"

    dest = folder / filename
    dest.write_bytes(content)

    url = f"/company_data/{role_dir}/{safe_name}/{filename}"
    return JSONResponse({"url": url, "entity_name": safe_name, "image_type": safe_type})


@router.post("/document")
async def upload_document(
    file: UploadFile = File(...),
    entity_name: str = Form(...),
    doc_type: str = Form(...),          # e.g. "secp_certificate", "ntn_certificate", "registration_certificate", "cnic_front", "cnic_back", "other"
    role: str = Form("company"),
) -> JSONResponse:
    """
    Upload a verification document (PDF or image).
    Stores at /company_data/{role_folder}/{entity_name}/documents/{doc_type}.{ext}.
    """
    content_type = (file.content_type or "").lower()
    if content_type not in ALLOWED_DOC_TYPES:
        raise HTTPException(
            status_code=400,
            detail="Only PDF, JPEG, PNG, and WebP documents are allowed.",
        )

    content = await file.read()
    if len(content) > MAX_DOC_SIZE:
        raise HTTPException(
            status_code=400,
            detail="Document size must not exceed 10 MB.",
        )

    role_dir = _role_folder(role)
    safe_name = _safe_folder_name(entity_name)
    # Sanitize doc_type
    safe_doc_type = re.sub(r"[^a-z0-9_-]", "_", doc_type.strip().lower())[:40] or "document"

    folder = COMPANY_DATA_ROOT / role_dir / safe_name / "documents"
    folder.mkdir(parents=True, exist_ok=True)

    ext = _DOC_EXT_MAP.get(content_type, "pdf")
    filename = f"{safe_doc_type}.{ext}"

    dest = folder / filename
    dest.write_bytes(content)

    url = f"/company_data/{role_dir}/{safe_name}/documents/{filename}"
    return JSONResponse({"url": url, "entity_name": safe_name, "doc_type": safe_doc_type})
