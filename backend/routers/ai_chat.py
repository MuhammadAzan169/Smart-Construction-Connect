"""AI Chat route — RAG-based recommendations."""

from __future__ import annotations
from fastapi import APIRouter
from pydantic import BaseModel

from backend.utils.rag_engine import generate_ai_response
from backend.utils.data_handler import add_activity_log

router = APIRouter(prefix="/api/ai", tags=["ai"])


class ChatMessage(BaseModel):
    role: str  # "user" or "assistant"
    content: str


class ChatRequest(BaseModel):
    messages: list[ChatMessage]
    user_email: str = ""


@router.post("/chat")
def ai_chat(req: ChatRequest):
    """Process AI chat and return response with recommendations."""
    messages = [m.model_dump() for m in req.messages]
    result = generate_ai_response(messages)

    # Log AI interaction
    if req.user_email and result.get("recommendations"):
        last_user_msg = ""
        for m in reversed(messages):
            if m.get("role") == "user":
                last_user_msg = m.get("content", "")[:100]
                break
        add_activity_log("ai_chat", req.user_email, f"AI chat: {last_user_msg}")

    return result
