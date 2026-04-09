"""Upload routes — stores images, documents, and message attachments."""
from __future__ import annotations

import re
import uuid
from pathlib import Path

from fastapi import APIRouter, File, Form, HTTPException, UploadFile
from fastapi.responses import JSONResponse

router = APIRouter(prefix="/api/upload", tags=["upload"])

COMPANY_DATA_ROOT = Path(__file__).resolve().parents[2] / "company_data"
UPLOADS_ROOT = Path(__file__).resolve().parents[2] / "uploads"
UPLOADS_ROOT.mkdir(parents=True, exist_ok=True)

ALLOWED_IMAGE_TYPES = {"image/jpeg", "image/jpg", "image/png", "image/gif", "image/webp"}
ALLOWED_DOC_TYPES = {"application/pdf", "image/jpeg", "image/jpg", "image/png", "image/webp"}
# Message attachments: broader set
ALLOWED_MSG_FILE_TYPES = {
    "image/jpeg", "image/jpg", "image/png", "image/gif", "image/webp",
    "application/pdf",
    "video/mp4", "video/webm", "video/quicktime",
    "audio/webm", "audio/ogg", "audio/mp4", "audio/mpeg", "audio/wav",
    "application/msword", "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "application/vnd.ms-excel", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    "text/plain", "text/csv",
}
MAX_IMAGE_SIZE = 5 * 1024 * 1024   # 5 MB
MAX_DOC_SIZE = 10 * 1024 * 1024    # 10 MB
MAX_MSG_FILE_SIZE = 25 * 1024 * 1024  # 25 MB for message attachments

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
    name = name[:60] or "unknown"
    # Guard against any path traversal that survived sanitization
    if ".." in name or "/" in name or "\\" in name:
        raise HTTPException(status_code=400, detail="Invalid entity name")
    return name


def _role_folder(role: str) -> str:
    """Map a role string to the correct company_data sub-folder."""
    key = role.strip().lower()
    folder = ROLE_FOLDER_MAP.get(key)
    if not folder:
        raise HTTPException(status_code=400, detail=f"Invalid role: {role}")
    return folder


def _ensure_within(dest: Path, root: Path) -> None:
    """Raise if resolved dest escapes the root directory (path traversal guard)."""
    if not dest.resolve().is_relative_to(root.resolve()):
        raise HTTPException(status_code=400, detail="Invalid path")


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
    _ensure_within(folder, COMPANY_DATA_ROOT)
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
    _ensure_within(folder, COMPANY_DATA_ROOT)
    folder.mkdir(parents=True, exist_ok=True)

    ext = _DOC_EXT_MAP.get(content_type, "pdf")
    filename = f"{safe_doc_type}.{ext}"

    dest = folder / filename
    dest.write_bytes(content)

    url = f"/company_data/{role_dir}/{safe_name}/documents/{filename}"
    return JSONResponse({"url": url, "entity_name": safe_name, "doc_type": safe_doc_type})


@router.post("/gallery")
async def upload_gallery_image(
    file: UploadFile = File(...),
    entity_name: str = Form(...),
    gallery_type: str = Form("material"),  # "material" or "project"
    item_id: str = Form("0"),             # index or ID to group images
    role: str = Form("supplier"),
) -> JSONResponse:
    """
    Upload a gallery image for a material or project.
    Stores at /company_data/{role_folder}/{entity_name}/{gallery_type}_{item_id}_{n}.{ext}.
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
    safe_gallery = re.sub(r"[^a-z0-9_-]", "_", gallery_type.strip().lower())[:20] or "gallery"
    safe_item = re.sub(r"[^a-z0-9_-]", "_", str(item_id).strip().lower())[:20] or "0"

    folder = COMPANY_DATA_ROOT / role_dir / safe_name / "gallery"
    _ensure_within(folder, COMPANY_DATA_ROOT)
    folder.mkdir(parents=True, exist_ok=True)

    ext = _IMG_EXT_MAP.get(content_type, "jpg")

    # Find next available index for this item
    prefix = f"{safe_gallery}_{safe_item}_"
    existing = list(folder.glob(f"{prefix}*"))
    idx = len(existing)
    filename = f"{prefix}{idx}.{ext}"

    dest = folder / filename
    dest.write_bytes(content)

    url = f"/company_data/{role_dir}/{safe_name}/gallery/{filename}"
    return JSONResponse({"url": url, "entity_name": safe_name, "gallery_type": safe_gallery, "item_id": safe_item})


# ═══════════════════════════════════════════════════════════════════════════════
#  Message attachments (file sharing, voice notes)
# ═══════════════════════════════════════════════════════════════════════════════

_FILE_EXT_MAP = {
    "image/jpeg": "jpg", "image/jpg": "jpg", "image/png": "png",
    "image/gif": "gif", "image/webp": "webp",
    "application/pdf": "pdf",
    "video/mp4": "mp4", "video/webm": "webm", "video/quicktime": "mov",
    "audio/webm": "webm", "audio/ogg": "ogg", "audio/mp4": "m4a",
    "audio/mpeg": "mp3", "audio/wav": "wav",
    "application/msword": "doc",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "docx",
    "application/vnd.ms-excel": "xls",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": "xlsx",
    "text/plain": "txt", "text/csv": "csv",
}


def _safe_email_folder(email: str) -> str:
    """Convert email to safe folder name."""
    safe = re.sub(r"[^a-z0-9]", "-", email.strip().lower())
    return re.sub(r"-+", "-", safe).strip("-")[:60] or "unknown"


@router.post("/message-file")
async def upload_message_file(
    file: UploadFile = File(...),
    sender_email: str = Form(...),
    conversation_id: str = Form(...),
    file_type: str = Form("file"),  # "file", "voice", "image", "video"
) -> JSONResponse:
    """Upload a file attachment for messaging (images, documents, voice notes, videos).

    Files are stored at /uploads/{sender_email_safe}/{conversation_id}/{unique_filename}.
    Returns the URL and metadata for the message.
    """
    content_type = (file.content_type or "application/octet-stream").lower()
    if content_type not in ALLOWED_MSG_FILE_TYPES:
        raise HTTPException(
            status_code=400,
            detail=f"File type not allowed: {content_type}. Supported: images, PDF, videos, audio, documents.",
        )

    content = await file.read()
    if len(content) > MAX_MSG_FILE_SIZE:
        raise HTTPException(
            status_code=400,
            detail="File size must not exceed 25 MB.",
        )

    # Build storage path: /uploads/{email_safe}/{conversation_id}/
    safe_sender = _safe_email_folder(sender_email)
    safe_convo = re.sub(r"[^a-z0-9-]", "", conversation_id.strip().lower())[:60]
    folder = UPLOADS_ROOT / safe_sender / safe_convo
    _ensure_within(folder, UPLOADS_ROOT)
    folder.mkdir(parents=True, exist_ok=True)

    # Generate unique filename
    ext = _FILE_EXT_MAP.get(content_type, "bin")
    unique_id = uuid.uuid4().hex[:8]
    original_name = (file.filename or "file").rsplit(".", 1)[0]
    safe_original = re.sub(r"[^a-z0-9_-]", "_", original_name.lower())[:30]
    filename = f"{safe_original}_{unique_id}.{ext}"

    dest = folder / filename
    dest.write_bytes(content)

    # Determine file category
    if content_type.startswith("image/"):
        category = "image"
    elif content_type.startswith("video/"):
        category = "video"
    elif content_type.startswith("audio/"):
        category = "voice" if file_type == "voice" else "audio"
    else:
        category = "document"

    url = f"/uploads/{safe_sender}/{safe_convo}/{filename}"
    return JSONResponse({
        "url": url,
        "filename": file.filename or filename,
        "size": len(content),
        "content_type": content_type,
        "category": category,
        "file_type": file_type,
    })
