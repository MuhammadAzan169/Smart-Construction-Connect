"""Messaging routes — direct messages between users (client↔company, client↔supplier, company↔supplier)."""

from __future__ import annotations

import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from backend.utils.auth_deps import get_current_user
from backend.utils.data_handler import read_json, write_json, add_activity_log, DB_DIR

router = APIRouter(prefix="/api/messages", tags=["messages"])

MESSAGES_DIR = DB_DIR / "messages"
MESSAGES_DIR.mkdir(parents=True, exist_ok=True)


def _conversations_path():
    return MESSAGES_DIR / "conversations.json"


def _messages_path(conversation_id: str):
    safe_id = conversation_id.replace("..", "").replace("/", "").replace("\\", "")
    return MESSAGES_DIR / f"{safe_id}.json"


def _load_conversations() -> list[dict]:
    return read_json(_conversations_path())


def _save_conversations(convos: list[dict]):
    write_json(_conversations_path(), convos)


def _get_or_create_conversation(participants: list[str], participant_names: list[str]) -> dict:
    """Find existing conversation between two users or create a new one."""
    convos = _load_conversations()
    sorted_p = sorted(participants)

    for c in convos:
        if sorted(c.get("participants", [])) == sorted_p:
            return c

    now = datetime.now(timezone.utc).isoformat()
    convo = {
        "id": str(uuid.uuid4()),
        "participants": sorted_p,
        "participant_names": participant_names,
        "created_at": now,
        "updated_at": now,
        "last_message": None,
        "unread": {p: 0 for p in sorted_p},
    }
    convos.append(convo)
    _save_conversations(convos)
    # Create empty messages file
    write_json(_messages_path(convo["id"]), [])
    return convo


# ── Models ──

class StartConversationRequest(BaseModel):
    recipient_email: str
    recipient_name: str = ""
    message: str


class SendMessageRequest(BaseModel):
    content: str


# ── Endpoints ──

@router.get("/conversations")
def list_conversations(user: dict = Depends(get_current_user)):
    """List all conversations for the current user."""
    email = user.get("email", "")
    convos = _load_conversations()
    user_convos = [c for c in convos if email in c.get("participants", [])]
    # Sort by most recent
    user_convos.sort(key=lambda c: c.get("updated_at", ""), reverse=True)
    return user_convos


@router.post("/conversations")
def start_conversation(body: StartConversationRequest, user: dict = Depends(get_current_user)):
    """Start or resume a conversation with another user and send the first message."""
    sender_email = user.get("email", "")
    if sender_email == body.recipient_email:
        raise HTTPException(status_code=400, detail="Cannot message yourself")

    sender_name = user.get("display_name", user.get("name", sender_email))
    recipient_name = body.recipient_name or body.recipient_email

    convo = _get_or_create_conversation(
        [sender_email, body.recipient_email],
        [sender_name, recipient_name],
    )

    # Send the initial message
    now = datetime.now(timezone.utc).isoformat()
    msg = {
        "id": str(uuid.uuid4()),
        "sender": sender_email,
        "sender_name": sender_name,
        "content": body.message,
        "timestamp": now,
        "read": False,
    }

    messages = read_json(_messages_path(convo["id"]))
    messages.append(msg)
    write_json(_messages_path(convo["id"]), messages)

    # Update conversation metadata
    convos = _load_conversations()
    for c in convos:
        if c["id"] == convo["id"]:
            c["updated_at"] = now
            c["last_message"] = {"content": body.message[:100], "sender": sender_email, "timestamp": now}
            c["unread"] = c.get("unread", {})
            c["unread"][body.recipient_email] = c["unread"].get(body.recipient_email, 0) + 1
            break
    _save_conversations(convos)

    return {"conversation_id": convo["id"], "message": msg}


@router.get("/conversations/{conversation_id}")
def get_messages(conversation_id: str, user: dict = Depends(get_current_user)):
    """Get all messages in a conversation."""
    email = user.get("email", "")
    convos = _load_conversations()
    convo = next((c for c in convos if c["id"] == conversation_id), None)
    if not convo:
        raise HTTPException(status_code=404, detail="Conversation not found")
    if email not in convo.get("participants", []):
        raise HTTPException(status_code=403, detail="Not a participant")

    messages = read_json(_messages_path(conversation_id))

    # Mark messages as read for this user
    unread_changed = False
    for msg in messages:
        if msg.get("sender") != email and not msg.get("read"):
            msg["read"] = True
            unread_changed = True
    if unread_changed:
        write_json(_messages_path(conversation_id), messages)
        # Reset unread counter
        for c in convos:
            if c["id"] == conversation_id:
                c["unread"] = c.get("unread", {})
                c["unread"][email] = 0
                _save_conversations(convos)
                break

    return {"conversation": convo, "messages": messages}


@router.post("/conversations/{conversation_id}")
def send_message(conversation_id: str, body: SendMessageRequest, user: dict = Depends(get_current_user)):
    """Send a message in an existing conversation."""
    email = user.get("email", "")
    sender_name = user.get("display_name", user.get("name", email))
    convos = _load_conversations()
    convo = next((c for c in convos if c["id"] == conversation_id), None)
    if not convo:
        raise HTTPException(status_code=404, detail="Conversation not found")
    if email not in convo.get("participants", []):
        raise HTTPException(status_code=403, detail="Not a participant")

    now = datetime.now(timezone.utc).isoformat()
    msg = {
        "id": str(uuid.uuid4()),
        "sender": email,
        "sender_name": sender_name,
        "content": body.content,
        "timestamp": now,
        "read": False,
    }

    messages = read_json(_messages_path(conversation_id))
    messages.append(msg)
    write_json(_messages_path(conversation_id), messages)

    # Update conversation
    recipient = next((p for p in convo.get("participants", []) if p != email), "")
    for c in convos:
        if c["id"] == conversation_id:
            c["updated_at"] = now
            c["last_message"] = {"content": body.content[:100], "sender": email, "timestamp": now}
            c["unread"] = c.get("unread", {})
            c["unread"][recipient] = c["unread"].get(recipient, 0) + 1
            break
    _save_conversations(convos)

    return msg


@router.get("/unread")
def get_unread_count(user: dict = Depends(get_current_user)):
    """Get total unread message count for the current user."""
    email = user.get("email", "")
    convos = _load_conversations()
    total = sum(c.get("unread", {}).get(email, 0) for c in convos if email in c.get("participants", []))
    return {"unread": total}
