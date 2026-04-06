"""AI Chat route — RAG-based recommendations with optional file upload."""

from __future__ import annotations

import json
import logging
from typing import Optional

from fastapi import APIRouter, File, Form, UploadFile
from pydantic import BaseModel

from backend.utils.rag_engine import generate_ai_response
from backend.utils.data_handler import add_activity_log
from backend.routers.filereader import file_processor

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/ai", tags=["ai"])

# Max file size for AI chat attachments (5 MB)
MAX_AI_FILE_SIZE = 5 * 1024 * 1024


class ChatMessage(BaseModel):
    role: str  # "user" or "assistant"
    content: str


class ChatRequest(BaseModel):
    messages: list[ChatMessage]
    user_email: str = ""
    user_role: str = "client"


@router.post("/chat")
async def ai_chat(req: ChatRequest):
    """Process AI chat (JSON body, no file) and return response with recommendations."""
    messages = [m.model_dump() for m in req.messages]
    result = generate_ai_response(messages, user_role=req.user_role)

    # Log AI interaction
    if req.user_email and result.get("recommendations"):
        last_user_msg = ""
        for m in reversed(messages):
            if m.get("role") == "user":
                last_user_msg = m.get("content", "")[:100]
                break
        add_activity_log("ai_chat", req.user_email, f"AI chat: {last_user_msg}")

    return result


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
    reason over it.
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
            "response": "The file exceeds the 5 MB size limit. Please upload a smaller file.",
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
        file_context = (
            f"\n\n---\n📎 Attached file: **{file.filename}**\n"
            f"Summary: {summary}\n"
            f"Keywords: {', '.join(keywords)}\n"
            f"Content:\n{raw[:3000]}\n---"
        )
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

    result = generate_ai_response(parsed_messages, user_role=user_role)

    # Log
    if user_email:
        add_activity_log("ai_chat_file", user_email, f"AI chat with file: {file.filename}")

    return result
