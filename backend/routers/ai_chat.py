"""AI Chat route — RAG-based recommendations with file/voice upload.

Pipeline: Input Handling → Preprocessing → Context Retrieval → LLM Processing → Response Formatting → Output
"""

from __future__ import annotations

import hashlib
import json
import logging
import os
import re
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Optional

from fastapi import APIRouter, File, Form, UploadFile, Depends, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel

from backend.utils.rag_engine import (
    generate_ai_response,
    generate_ai_response_stream,
    get_recommendations,
    _extract_intent,
    _INDEX,
)
from backend.utils.data_handler import add_activity_log, DB_DIR, read_json, write_json
from backend.utils.auth_deps import get_current_user
from backend.routers.filereader import file_processor
from backend.utils.conversation_memory import requirement_tracker
from backend.utils.response_cache import response_cache
from backend.utils.semantic_embeddings import semantic_index

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/ai", tags=["ai"])

# Max file sizes
MAX_AI_FILE_SIZE = 10 * 1024 * 1024  # 10 MB for documents
MAX_VOICE_SIZE = 25 * 1024 * 1024    # 25 MB for voice

# ── Session context store (in-memory, per user email) ─────────────────────────
# Stores extracted file content so users can ask follow-up questions about files
_session_contexts: dict[str, dict] = {}  # email -> {file_id: {content, summary, keywords, filename, expires}}

AI_CHATS_DIR = DB_DIR / "ai_chats"
AI_CHATS_DIR.mkdir(parents=True, exist_ok=True)


def _get_session_context(email: str) -> str:
    """Build session context string from uploaded file extractions."""
    ctx = _session_contexts.get(email, {})
    if not ctx:
        return ""
    now = datetime.now(timezone.utc).timestamp()
    parts = ["\n\n--- SESSION FILE CONTEXT ---"]
    expired = []
    for fid, info in ctx.items():
        if info.get("expires", 0) < now:
            expired.append(fid)
            continue
        parts.append(
            f"\n📎 File: **{info['filename']}**\n"
            f"Summary: {info.get('summary', 'N/A')}\n"
            f"Keywords: {', '.join(info.get('keywords', []))}\n"
            f"Content (excerpt):\n{info.get('content', '')[:2000]}"
        )
    for fid in expired:
        ctx.pop(fid, None)
    if len(parts) == 1:
        return ""
    parts.append("--- END SESSION FILE CONTEXT ---")
    return "\n".join(parts)


def _store_file_in_session(email: str, filename: str, extraction: dict, ttl_seconds: int = 3600):
    """Store extracted file content in session for follow-up questions."""
    if email not in _session_contexts:
        _session_contexts[email] = {}
    fid = hashlib.md5(f"{filename}{datetime.now().isoformat()}".encode()).hexdigest()[:12]
    _session_contexts[email][fid] = {
        "filename": filename,
        "content": extraction.get("raw_content", "")[:5000],
        "summary": extraction.get("metadata", {}).get("summary", ""),
        "keywords": extraction.get("metadata", {}).get("keywords", []),
        "tables": extraction.get("tables", []),
        "expires": datetime.now(timezone.utc).timestamp() + ttl_seconds,
    }
    # Keep max 5 files per session
    while len(_session_contexts[email]) > 5:
        oldest = min(_session_contexts[email], key=lambda k: _session_contexts[email][k].get("expires", 0))
        _session_contexts[email].pop(oldest)
    return fid


class ChatMessage(BaseModel):
    role: str  # "user" or "assistant"
    content: str


class ChatRequest(BaseModel):
    messages: list[ChatMessage]
    user_email: str = ""
    user_role: str = "client"
    session_id: str = ""


class TranscribeRequest(BaseModel):
    """Voice transcription is handled client-side via Web Speech API.
    This endpoint receives the transcribed text for processing."""
    text: str
    language: str = "auto"  # "en", "ur", "auto"


@router.post("/chat")
async def ai_chat(req: ChatRequest):
    """Process AI chat (JSON body, no file) and return response with recommendations."""
    messages = [m.model_dump() for m in req.messages]

    # Inject session file context if available
    session_ctx = _get_session_context(req.user_email)

    result = generate_ai_response(
        messages,
        user_role=req.user_role,
        extra_context=session_ctx,
        user_email=req.user_email,
        session_id=req.session_id,
    )

    # Log AI interaction
    if req.user_email:
        last_user_msg = ""
        for m in reversed(messages):
            if m.get("role") == "user":
                last_user_msg = m.get("content", "")[:100]
                break
        if last_user_msg:
            add_activity_log("ai_chat", req.user_email, f"AI chat: {last_user_msg}")

    return result


@router.post("/chat/stream")
async def ai_chat_stream(req: ChatRequest):
    """Stream AI chat response using Server-Sent Events for real-time typing."""
    messages = [m.model_dump() for m in req.messages]
    session_ctx = _get_session_context(req.user_email)

    async def event_stream():
        try:
            recs_sent = False
            async for chunk in generate_ai_response_stream(
                messages,
                user_role=req.user_role,
                extra_context=session_ctx,
                user_email=req.user_email,
                session_id=req.session_id,
            ):
                if chunk.get("type") == "recommendations" and not recs_sent:
                    yield f"data: {json.dumps(chunk)}\n\n"
                    recs_sent = True
                elif chunk.get("type") == "token":
                    yield f"data: {json.dumps(chunk)}\n\n"
                elif chunk.get("type") == "done":
                    yield f"data: {json.dumps(chunk)}\n\n"
                elif chunk.get("type") == "error":
                    yield f"data: {json.dumps(chunk)}\n\n"
            yield "data: [DONE]\n\n"
        except Exception as e:
            logger.error("Stream error: %s", e)
            yield f"data: {json.dumps({'type': 'error', 'content': 'Stream interrupted. Please try again.'})}\n\n"
            yield "data: [DONE]\n\n"

    # Log
    if req.user_email:
        last_user_msg = ""
        for m in reversed(messages):
            if m.get("role") == "user":
                last_user_msg = m.get("content", "")[:100]
                break
        if last_user_msg:
            add_activity_log("ai_chat", req.user_email, f"AI chat (stream): {last_user_msg}")

    return StreamingResponse(event_stream(), media_type="text/event-stream")


@router.post("/chat-with-file")
async def ai_chat_with_file(
    file: UploadFile = File(...),
    messages: str = Form("[]"),
    user_email: str = Form(""),
    user_role: str = Form("client"),
):
    """Process AI chat with an attached file (multipart form).

    The file is processed via the file-reader service and its extracted
    content is appended to the latest user message so the RAG engine can
    reason over it. File content is also stored in session for follow-up questions.
    """
    # Parse messages JSON from form field
    try:
        parsed_messages: list[dict] = json.loads(messages)
    except json.JSONDecodeError:
        parsed_messages = []

    # Validate file size
    file_data = await file.read()
    if len(file_data) > MAX_AI_FILE_SIZE:
        return {
            "response": "The file exceeds the 10 MB size limit. Please upload a smaller file.",
            "recommendations": [],
            "file_error": True,
        }

    # Extract content from uploaded file
    extraction = await file_processor.process_uploaded_file(file_data, file.filename or "upload")

    file_context = ""
    if extraction.get("success"):
        raw = extraction.get("raw_content", "")
        summary = extraction.get("metadata", {}).get("summary", "")
        keywords = extraction.get("metadata", {}).get("keywords", [])
        tables = extraction.get("tables", [])

        # Store in session for follow-up questions
        if user_email:
            _store_file_in_session(user_email, file.filename or "upload", extraction)

        file_context = (
            f"\n\n---\n📎 Attached file: **{file.filename}**\n"
            f"Summary: {summary}\n"
            f"Keywords: {', '.join(keywords)}\n"
        )
        if tables:
            file_context += f"Tables found: {len(tables)}\n"
            for idx, tbl in enumerate(tables[:3]):
                if isinstance(tbl, list) and tbl:
                    file_context += f"Table {idx+1}: {str(tbl[:5])}\n"
        file_context += f"Content:\n{raw[:4000]}\n---"
    else:
        file_context = (
            f"\n\n---\n📎 Attached file: **{file.filename}** "
            f"(could not extract content: {extraction.get('error', 'unknown error')})\n---"
        )

    # Append file context to last user message
    if parsed_messages:
        last = parsed_messages[-1]
        if last.get("role") == "user":
            last["content"] = last["content"] + file_context
        else:
            parsed_messages.append({"role": "user", "content": f"Please analyse this file:{file_context}"})
    else:
        parsed_messages = [{"role": "user", "content": f"Please analyse this file:{file_context}"}]

    # Inject session context for other previously uploaded files
    session_ctx = _get_session_context(user_email)
    result = generate_ai_response(
        parsed_messages,
        user_role=user_role,
        extra_context=session_ctx,
        user_email=user_email,
    )

    # Log
    if user_email:
        add_activity_log("ai_chat_file", user_email, f"AI chat with file: {file.filename}")

    return result


@router.post("/transcribe")
async def transcribe_voice(body: TranscribeRequest):
    """Receive client-side transcribed text (from Web Speech API).
    Returns cleaned text ready for the chat pipeline.

    Voice recording and speech-to-text happens client-side using
    the browser's Web Speech API (SpeechRecognition) which supports
    both English and Urdu. This endpoint validates and cleans the text.
    """
    text = body.text.strip()
    if not text:
        raise HTTPException(status_code=400, detail="No transcribed text provided")
    if len(text) > 5000:
        text = text[:5000]

    return {
        "text": text,
        "language": body.language,
        "status": "ok",
    }


@router.delete("/session/{email}")
async def clear_session_context(email: str):
    """Clear session file context for a user."""
    _session_contexts.pop(email, None)
    return {"status": "ok"}


@router.get("/session/{email}")
async def get_session_files(email: str):
    """Get list of files in the user's session context."""
    ctx = _session_contexts.get(email, {})
    now = datetime.now(timezone.utc).timestamp()
    files = []
    for fid, info in ctx.items():
        if info.get("expires", 0) >= now:
            files.append({
                "id": fid,
                "filename": info["filename"],
                "summary": info.get("summary", ""),
                "keywords": info.get("keywords", []),
            })
    return {"files": files}


# ═══════════════════════════════════════════════════════════════════════════════
#  Client requirement tracking & persistent chat history
# ═══════════════════════════════════════════════════════════════════════════════

_CHATS_DIR = DB_DIR / "ai_chats"
_CHATS_DIR.mkdir(parents=True, exist_ok=True)

UPLOADS_ROOT = Path(__file__).resolve().parents[2] / "uploads"


class RequirementsResponse(BaseModel):
    requirements: dict
    recommendations: list[dict] = []
    is_complete: bool = False
    missing_fields: list[str] = []


@router.post("/requirements/extract")
async def extract_requirements(req: ChatRequest):
    """Extract and update client requirements from conversation messages.

    Uses the single RequirementTracker (processes only latest user message).
    Returns current requirement state + whether enough info for recommendations.
    """
    if not req.user_email:
        raise HTTPException(status_code=400, detail="user_email required")

    messages = [m.model_dump() for m in req.messages]

    # Single source of truth: RequirementTracker from conversation_memory
    current = requirement_tracker.update_from_messages(req.user_email, messages)

    missing = requirement_tracker.get_missing_fields(current)
    filled_count = len([f for f in requirement_tracker.REQUIRED_FIELDS + requirement_tracker.OPTIONAL_FIELDS if current.get(f)])
    is_complete = len(missing) == 0 and filled_count >= 5

    # Get recommendations if requirements are sufficiently complete
    recommendations = []
    user_msg_count = sum(1 for m in messages if m.get("role") == "user")
    if requirement_tracker.is_ready_for_recommendations(current, user_msg_count):
        try:
            data = get_recommendations(messages, user_role="client")
            raw_recs = data.get("recommendations", [])
            recommendations = _enrich_recommendations(raw_recs)
        except Exception as e:
            logger.warning("Recommendation enrichment failed: %s", e)

    return {
        "requirements": current,
        "recommendations": recommendations,
        "is_complete": is_complete,
        "missing_fields": missing,
    }


@router.get("/requirements/{email}")
async def get_requirements(email: str):
    """Get current requirement state for a client."""
    reqs = requirement_tracker.load(email)
    return {"requirements": reqs}


@router.delete("/requirements/{email}")
async def clear_requirements(email: str):
    """Reset client requirements for a new project."""
    requirement_tracker.clear(email)
    return {"status": "ok"}


def _enrich_recommendations(raw_recs: list[dict]) -> list[dict]:
    """Enrich recommendation entries with full company/supplier data for rich cards."""
    enriched = []
    for rec in raw_recs[:3]:
        entry: dict[str, Any] = {**rec}
        slug = rec.get("id", "")

        if rec.get("type") == "company":
            # Find full company data
            try:
                companies = semantic_index.get_all_companies()
                company = next(
                    (c for c in companies if c.get("slug") == slug or c.get("company_id") == slug),
                    None,
                )
                if company:
                    entry["description"] = company.get("description") or ""
                    entry["logo_url"] = company.get("logo_url") or ""
                    entry["dp_url"] = company.get("dp_url") or ""
                    entry["city"] = company.get("city") or rec.get("location", "")
                    entry["contact"] = company.get("contact") or {}
                    entry["services"] = company.get("services") or {}
                    entry["construction_capability"] = company.get("construction_capability") or {}
                    entry["verification_status"] = company.get("verification_status", "")
                    entry["experience"] = company.get("experience") or {}
                    entry["year_established"] = (company.get("legal_info") or {}).get("year_established")
                    entry["ai_scores"] = company.get("ai_scores") or {}

                    # Extract key packages/pricing
                    flat_areas = company.get("flattened_operational_areas", [])
                    prices = [r["price_per_sqft"] for r in flat_areas
                              if isinstance(r.get("price_per_sqft"), (int, float)) and r["price_per_sqft"] > 0]
                    if prices:
                        entry["min_price_sqft"] = min(prices)
                        entry["max_price_sqft"] = max(prices)

                    # Gallery images
                    company_slug = company.get("slug", "")
                    gallery_path = Path(__file__).resolve().parents[2] / "company_data" / "construction_company" / company_slug / "gallery"
                    gallery_images = []
                    if gallery_path.exists():
                        for img in sorted(gallery_path.iterdir())[:4]:
                            if img.suffix.lower() in (".jpg", ".jpeg", ".png", ".webp"):
                                gallery_images.append(f"/company_data/construction_company/{company_slug}/gallery/{img.name}")
                    entry["gallery_images"] = gallery_images
            except Exception as e:
                logger.warning("Failed to enrich company %s: %s", slug, e)

        elif rec.get("type") == "supplier":
            try:
                suppliers = semantic_index.get_all_suppliers()
                supplier = next(
                    (s for s in suppliers if s.get("slug") == slug or s.get("supplier_id") == slug),
                    None,
                )
                if supplier:
                    entry["description"] = supplier.get("description") or ""
                    entry["logo_url"] = supplier.get("logo_url") or ""
                    entry["dp_url"] = supplier.get("dp_url") or ""
                    entry["city"] = supplier.get("city") or rec.get("location", "")
                    entry["contact"] = supplier.get("contact") or {}
                    entry["verification_status"] = supplier.get("verification_status", "")
                    entry["materials"] = supplier.get("materials", [])[:6]
                    entry["cities_served"] = supplier.get("cities_served", [])
            except Exception as e:
                logger.warning("Failed to enrich supplier %s: %s", slug, e)

        enriched.append(entry)
    return enriched


# ═══════════════════════════════════════════════════════════════════════════════
#  Admin: File monitoring across all uploads
# ═══════════════════════════════════════════════════════════════════════════════

@router.get("/admin/files")
async def admin_list_all_files(
    user: dict = Depends(get_current_user),
    file_type: str = "",
    limit: int = 50,
):
    """List all uploaded files across the platform for admin monitoring.

    Supports filtering by file_type: image, video, audio, document, voice
    """
    if user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")

    files: list[dict] = []
    if not UPLOADS_ROOT.exists():
        return {"files": [], "total": 0}

    for user_dir in sorted(UPLOADS_ROOT.iterdir()):
        if not user_dir.is_dir():
            continue
        sender_email = user_dir.name.replace("-at-", "@").replace("-", ".")
        for convo_dir in sorted(user_dir.iterdir()):
            if not convo_dir.is_dir():
                continue
            for file_path in sorted(convo_dir.iterdir(), key=lambda p: p.stat().st_mtime, reverse=True):
                if not file_path.is_file():
                    continue

                ext = file_path.suffix.lower().lstrip(".")
                # Determine category
                if ext in ("jpg", "jpeg", "png", "gif", "webp"):
                    category = "image"
                elif ext in ("mp4", "mov") or (ext == "webm" and not file_path.name.startswith("voice-")):
                    category = "video"
                elif ext in ("ogg", "wav", "mp3", "m4a") or (ext == "webm" and file_path.name.startswith("voice-")):
                    category = "audio"
                elif ext in ("pdf", "doc", "docx", "xls", "xlsx", "txt", "csv"):
                    category = "document"
                else:
                    category = "other"

                if file_type and category != file_type:
                    continue

                stat = file_path.stat()
                files.append({
                    "filename": file_path.name,
                    "url": f"/uploads/{user_dir.name}/{convo_dir.name}/{file_path.name}",
                    "sender": sender_email,
                    "conversation_id": convo_dir.name,
                    "category": category,
                    "size": stat.st_size,
                    "uploaded_at": datetime.fromtimestamp(stat.st_mtime, tz=timezone.utc).isoformat(),
                })

                if len(files) >= limit:
                    break
            if len(files) >= limit:
                break
        if len(files) >= limit:
            break

    files.sort(key=lambda f: f["uploaded_at"], reverse=True)
    return {"files": files[:limit], "total": len(files)}


@router.delete("/admin/files")
async def admin_delete_file(
    url: str,
    user: dict = Depends(get_current_user),
):
    """Delete a specific uploaded file (admin only)."""
    if user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")

    if not url.startswith("/uploads/"):
        raise HTTPException(status_code=400, detail="Invalid file URL")

    # Resolve and validate path
    relative = url.lstrip("/")
    file_path = Path(__file__).resolve().parents[2] / relative
    resolved = file_path.resolve()

    # Ensure path is within uploads directory
    if not str(resolved).startswith(str(UPLOADS_ROOT.resolve())):
        raise HTTPException(status_code=400, detail="Invalid file path")

    if not resolved.exists():
        raise HTTPException(status_code=404, detail="File not found")

    resolved.unlink()
    return {"status": "ok", "deleted": url}


# ═══════════════════════════════════════════════════════════════════════════════
#  ChatGPT-style Persistent Chat History
#  Storage layout:
#    Database/ai_chats/{safe_email}/index.json   → list of session metadata
#    Database/ai_chats/{safe_email}/{session_id}.json → messages for each session
# ═══════════════════════════════════════════════════════════════════════════════

_CHATS_ROOT = DB_DIR / "ai_chats"
_CHATS_ROOT.mkdir(parents=True, exist_ok=True)


def _safe_email(email: str) -> str:
    return re.sub(r"[^a-z0-9]", "-", email.lower())[:80]


def _user_chats_dir(email: str) -> Path:
    d = _CHATS_ROOT / _safe_email(email)
    d.mkdir(parents=True, exist_ok=True)
    return d


def _index_path(email: str) -> Path:
    return _user_chats_dir(email) / "index.json"


def _session_path(email: str, session_id: str) -> Path:
    # Guard against path traversal
    safe_id = re.sub(r"[^a-zA-Z0-9\-]", "", session_id)[:64]
    return _user_chats_dir(email) / f"{safe_id}.json"


def _load_index(email: str) -> list[dict]:
    data = read_json(_index_path(email))
    return data if isinstance(data, list) else []


def _save_index(email: str, index: list[dict]) -> None:
    write_json(_index_path(email), index)


def _auto_title(messages: list[dict]) -> str:
    """Generate a short title from the first user message (max 60 chars)."""
    for m in messages:
        if m.get("role") == "user":
            text = m.get("content", "").strip()
            # Strip file context blocks
            if "---" in text:
                text = text.split("---")[0].strip()
            title = text[:60]
            if len(text) > 60:
                title += "…"
            return title or "New Chat"
    return "New Chat"


class ChatSessionCreate(BaseModel):
    title: str = ""
    messages: list[ChatMessage] = []


class ChatSessionUpdate(BaseModel):
    title: str | None = None
    messages: list[ChatMessage] | None = None


class ChatSessionMeta(BaseModel):
    session_id: str
    title: str
    created_at: str
    updated_at: str
    message_count: int


@router.get("/history", summary="List all chat sessions for the authenticated user")
async def list_chat_sessions(user: dict = Depends(get_current_user)):
    """Return a list of previous AI chat sessions, newest first."""
    index = _load_index(user["email"])
    index.sort(key=lambda s: s.get("updated_at", ""), reverse=True)
    return {"sessions": index}


@router.post("/history", summary="Create a new chat session")
async def create_chat_session(
    body: ChatSessionCreate,
    user: dict = Depends(get_current_user),
):
    """Create and persist a new chat session."""
    session_id = str(uuid.uuid4())
    now = datetime.now(timezone.utc).isoformat()
    messages = [m.model_dump() for m in body.messages]
    title = body.title.strip() or _auto_title(messages) or "New Chat"

    meta: dict = {
        "session_id": session_id,
        "title": title,
        "created_at": now,
        "updated_at": now,
        "message_count": len(messages),
    }

    # Write the message file
    write_json(_session_path(user["email"], session_id), messages)

    # Update index
    index = _load_index(user["email"])
    index.insert(0, meta)
    _save_index(user["email"], index)

    return {"session_id": session_id, "title": title, "created_at": now}


@router.get("/history/{session_id}", summary="Load a specific chat session")
async def get_chat_session(
    session_id: str,
    user: dict = Depends(get_current_user),
):
    """Return the full message list for a specific session."""
    path = _session_path(user["email"], session_id)
    if not path.exists():
        raise HTTPException(status_code=404, detail="Chat session not found")
    messages = read_json(path)
    if not isinstance(messages, list):
        messages = []

    # Find meta from index
    index = _load_index(user["email"])
    meta = next((s for s in index if s.get("session_id") == session_id), {})

    return {
        "session_id": session_id,
        "title": meta.get("title", "Chat"),
        "created_at": meta.get("created_at", ""),
        "updated_at": meta.get("updated_at", ""),
        "messages": messages,
    }


@router.put("/history/{session_id}", summary="Append messages / rename a session")
async def update_chat_session(
    session_id: str,
    body: ChatSessionUpdate,
    user: dict = Depends(get_current_user),
):
    """Update title and/or replace the full message list for a session."""
    path = _session_path(user["email"], session_id)
    index = _load_index(user["email"])
    meta = next((s for s in index if s.get("session_id") == session_id), None)

    if not meta:
        raise HTTPException(status_code=404, detail="Chat session not found")

    now = datetime.now(timezone.utc).isoformat()

    if body.messages is not None:
        messages = [m.model_dump() for m in body.messages]
        write_json(path, messages)
        meta["message_count"] = len(messages)
        if not body.title and meta.get("title") in ("New Chat", ""):
            meta["title"] = _auto_title(messages)

    if body.title is not None:
        meta["title"] = body.title.strip() or meta.get("title", "Chat")

    meta["updated_at"] = now
    _save_index(user["email"], index)

    return {"session_id": session_id, "title": meta["title"], "updated_at": now}


@router.delete("/history/{session_id}", summary="Delete a chat session")
async def delete_chat_session(
    session_id: str,
    user: dict = Depends(get_current_user),
):
    """Permanently delete a chat session and its messages."""
    path = _session_path(user["email"], session_id)
    index = _load_index(user["email"])

    new_index = [s for s in index if s.get("session_id") != session_id]
    if len(new_index) == len(index):
        raise HTTPException(status_code=404, detail="Chat session not found")

    if path.exists():
        path.unlink()

    _save_index(user["email"], new_index)
    return {"status": "deleted", "session_id": session_id}


@router.patch("/history/{session_id}/rename", summary="Rename a chat session")
async def rename_chat_session(
    session_id: str,
    body: dict,
    user: dict = Depends(get_current_user),
):
    """Rename a chat session title only."""
    new_title = (body.get("title") or "").strip()
    if not new_title:
        raise HTTPException(status_code=400, detail="title is required")

    index = _load_index(user["email"])
    meta = next((s for s in index if s.get("session_id") == session_id), None)
    if not meta:
        raise HTTPException(status_code=404, detail="Chat session not found")

    meta["title"] = new_title[:120]
    meta["updated_at"] = datetime.now(timezone.utc).isoformat()
    _save_index(user["email"], index)
    return {"session_id": session_id, "title": meta["title"]}
