"""AI Chat route — RAG-based recommendations with file/voice upload.

Pipeline: Input Handling → Preprocessing → Context Retrieval → LLM Processing → Response Formatting → Output
"""

from __future__ import annotations

import hashlib
import json
import logging
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import Optional

from fastapi import APIRouter, File, Form, UploadFile, Depends, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel

from backend.utils.rag_engine import generate_ai_response, generate_ai_response_stream
from backend.utils.data_handler import add_activity_log, DB_DIR
from backend.utils.auth_deps import get_current_user
from backend.routers.filereader import file_processor

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

    result = generate_ai_response(messages, user_role=req.user_role, extra_context=session_ctx)

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
            async for chunk in generate_ai_response_stream(messages, user_role=req.user_role, extra_context=session_ctx):
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
    result = generate_ai_response(parsed_messages, user_role=user_role, extra_context=session_ctx)

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
