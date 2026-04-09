"""Messaging routes — direct messages between users (client↔company, client↔supplier, company↔supplier).

Features:
- Unified message schema (sender_id, receiver_id, timestamp, status)
- Soft-delete: users only hide their own view; admin retains master log
- WebSocket real-time delivery
- Read receipts (sent → delivered → read)
- Admin endpoints: list all conversations, view any chat, AI summary
"""

from __future__ import annotations

import logging
import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, WebSocket, WebSocketDisconnect, Query
from pydantic import BaseModel

from backend.utils.auth_deps import get_current_user, require_admin
from backend.utils.data_handler import read_json, write_json, add_activity_log, DB_DIR

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/messages", tags=["messages"])

MESSAGES_DIR = DB_DIR / "messages"
MESSAGES_DIR.mkdir(parents=True, exist_ok=True)


# ═══════════════════════════════════════════════════════════════════════════════
#  WebSocket connection manager
# ═══════════════════════════════════════════════════════════════════════════════

class ConnectionManager:
    """Track active WebSocket connections, keyed by user email."""

    def __init__(self):
        self._connections: dict[str, list[WebSocket]] = {}

    async def connect(self, email: str, ws: WebSocket):
        await ws.accept()
        self._connections.setdefault(email, []).append(ws)
        logger.info("WS connected: %s (total=%d)", email, len(self._connections.get(email, [])))

    def disconnect(self, email: str, ws: WebSocket):
        conns = self._connections.get(email, [])
        if ws in conns:
            conns.remove(ws)
        if not conns:
            self._connections.pop(email, None)

    async def send_to_user(self, email: str, data: dict):
        """Send a JSON payload to all open sockets for *email*."""
        for ws in list(self._connections.get(email, [])):
            try:
                await ws.send_json(data)
            except Exception:
                self.disconnect(email, ws)


manager = ConnectionManager()


# ═══════════════════════════════════════════════════════════════════════════════
#  Helpers
# ═══════════════════════════════════════════════════════════════════════════════

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
        "deleted_by": [],  # emails who soft-deleted this conversation
    }
    convos.append(convo)
    _save_conversations(convos)
    write_json(_messages_path(convo["id"]), [])
    return convo


def _visible_messages(all_msgs: list[dict], email: str) -> list[dict]:
    """Filter out messages that have been soft-deleted by *email*."""
    return [m for m in all_msgs if email not in m.get("deleted_by", [])]


# ── Models ──

class StartConversationRequest(BaseModel):
    recipient_email: str
    recipient_name: str = ""
    message: str
    # File attachment fields (optional)
    attachment_url: str = ""
    attachment_filename: str = ""
    attachment_size: int = 0
    attachment_type: str = ""  # "image", "video", "voice", "document", "audio"
    attachment_content_type: str = ""


class SendMessageRequest(BaseModel):
    content: str
    # File attachment fields (optional)
    attachment_url: str = ""
    attachment_filename: str = ""
    attachment_size: int = 0
    attachment_type: str = ""  # "image", "video", "voice", "document", "audio"
    attachment_content_type: str = ""


# ═══════════════════════════════════════════════════════════════════════════════
#  WebSocket endpoint
# ═══════════════════════════════════════════════════════════════════════════════

@router.websocket("/ws/{email}")
async def ws_connect(ws: WebSocket, email: str):
    """
    Persistent connection for real-time updates.
    Client opens ws://.../api/messages/ws/{email}?token=JWT and listens for:
      { type: "new_message", conversation_id, message }
      { type: "messages_read", conversation_id, reader }
    """
    # Validate JWT token from query parameter
    token = ws.query_params.get("token", "")
    if token:
        try:
            from backend.utils.auth_deps import _decode_token
            payload = _decode_token(token)
            if payload.get("sub") != email:
                await ws.close(code=4003, reason="Token email mismatch")
                return
        except Exception:
            await ws.close(code=4001, reason="Invalid token")
            return
    # Allow unauthenticated WS for backward compat but log warning
    else:
        logger.warning("WS connection without token for %s — consider requiring auth", email)

    await manager.connect(email, ws)
    try:
        while True:
            # Keep-alive — client can send pings (just read & discard)
            await ws.receive_text()
    except WebSocketDisconnect:
        manager.disconnect(email, ws)


# ═══════════════════════════════════════════════════════════════════════════════
#  User endpoints
# ═══════════════════════════════════════════════════════════════════════════════

@router.get("/conversations")
def list_conversations(user: dict = Depends(get_current_user)):
    """List all conversations for the current user (excluding soft-deleted)."""
    email = user.get("email", "")
    convos = _load_conversations()
    user_convos = [
        c for c in convos
        if email in c.get("participants", [])
        and email not in c.get("deleted_by", [])
    ]
    user_convos.sort(key=lambda c: c.get("updated_at", ""), reverse=True)
    return user_convos


@router.post("/conversations")
async def start_conversation(body: StartConversationRequest, user: dict = Depends(get_current_user)):
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

    # If the sender had previously soft-deleted this convo, restore it
    convos = _load_conversations()
    for c in convos:
        if c["id"] == convo["id"]:
            deleted_by = c.get("deleted_by", [])
            if sender_email in deleted_by:
                deleted_by.remove(sender_email)
            break

    now = datetime.now(timezone.utc).isoformat()
    msg = {
        "id": str(uuid.uuid4()),
        "sender": sender_email,
        "sender_name": sender_name,
        "content": body.message,
        "timestamp": now,
        "read": False,
        "status": "sent",
        "deleted_by": [],
    }

    # Add attachment if provided
    if body.attachment_url:
        msg["attachment"] = {
            "url": body.attachment_url,
            "filename": body.attachment_filename,
            "size": body.attachment_size,
            "type": body.attachment_type,
            "content_type": body.attachment_content_type,
        }

    messages = read_json(_messages_path(convo["id"]))
    messages.append(msg)
    write_json(_messages_path(convo["id"]), messages)

    # Update conversation metadata
    preview = body.message[:100] if body.message else f"📎 {body.attachment_filename}" if body.attachment_url else ""
    for c in convos:
        if c["id"] == convo["id"]:
            c["updated_at"] = now
            c["last_message"] = {"content": preview, "sender": sender_email, "timestamp": now}
            c["unread"] = c.get("unread", {})
            c["unread"][body.recipient_email] = c["unread"].get(body.recipient_email, 0) + 1
            # Restore recipient view if they had soft-deleted
            deleted_by = c.get("deleted_by", [])
            if body.recipient_email in deleted_by:
                deleted_by.remove(body.recipient_email)
            break
    _save_conversations(convos)

    # Real-time push to recipient
    await manager.send_to_user(body.recipient_email, {
        "type": "new_message",
        "conversation_id": convo["id"],
        "message": msg,
    })

    return {"conversation_id": convo["id"], "message": msg}


@router.get("/conversations/{conversation_id}")
def get_messages(conversation_id: str, user: dict = Depends(get_current_user)):
    """Get all messages in a conversation (filtered by soft-delete for user)."""
    email = user.get("email", "")
    convos = _load_conversations()
    convo = next((c for c in convos if c["id"] == conversation_id), None)
    if not convo:
        raise HTTPException(status_code=404, detail="Conversation not found")
    if email not in convo.get("participants", []):
        raise HTTPException(status_code=403, detail="Not a participant")

    all_messages = read_json(_messages_path(conversation_id))

    # Mark messages as read + update status to "read"
    unread_changed = False
    for msg in all_messages:
        if msg.get("sender") != email and not msg.get("read"):
            msg["read"] = True
            msg["status"] = "read"
            unread_changed = True
        # Upgrade legacy messages that lack a status field
        if "status" not in msg:
            msg["status"] = "read" if msg.get("read") else "sent"
    if unread_changed:
        write_json(_messages_path(conversation_id), all_messages)
        for c in convos:
            if c["id"] == conversation_id:
                c["unread"] = c.get("unread", {})
                c["unread"][email] = 0
                _save_conversations(convos)
                break

    visible = _visible_messages(all_messages, email)
    return {"conversation": convo, "messages": visible}


@router.post("/conversations/{conversation_id}")
async def send_message(conversation_id: str, body: SendMessageRequest, user: dict = Depends(get_current_user)):
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
        "status": "sent",
        "deleted_by": [],
    }

    # Add attachment if provided
    if body.attachment_url:
        msg["attachment"] = {
            "url": body.attachment_url,
            "filename": body.attachment_filename,
            "size": body.attachment_size,
            "type": body.attachment_type,
            "content_type": body.attachment_content_type,
        }

    # Save to DB first (ensures no data loss before UI update)
    messages = read_json(_messages_path(conversation_id))
    messages.append(msg)
    write_json(_messages_path(conversation_id), messages)

    # Update conversation metadata
    preview = body.content[:100] if body.content else f"📎 {body.attachment_filename}" if body.attachment_url else ""
    recipient = next((p for p in convo.get("participants", []) if p != email), "")
    for c in convos:
        if c["id"] == conversation_id:
            c["updated_at"] = now
            c["last_message"] = {"content": preview, "sender": email, "timestamp": now}
            c["unread"] = c.get("unread", {})
            c["unread"][recipient] = c["unread"].get(recipient, 0) + 1
            # Restore recipient's view if they had soft-deleted
            deleted_by = c.get("deleted_by", [])
            if recipient in deleted_by:
                deleted_by.remove(recipient)
            break
    _save_conversations(convos)

    # Check if recipient is connected → mark as "delivered"
    if recipient in manager._connections and manager._connections[recipient]:
        msg["status"] = "delivered"
        # Re-save with updated status
        for m in messages:
            if m["id"] == msg["id"]:
                m["status"] = "delivered"
        write_json(_messages_path(conversation_id), messages)

    # Real-time push to recipient
    await manager.send_to_user(recipient, {
        "type": "new_message",
        "conversation_id": conversation_id,
        "message": msg,
    })

    return msg


@router.get("/unread")
def get_unread_count(user: dict = Depends(get_current_user)):
    """Get total unread message count for the current user."""
    email = user.get("email", "")
    convos = _load_conversations()
    total = sum(
        c.get("unread", {}).get(email, 0)
        for c in convos
        if email in c.get("participants", []) and email not in c.get("deleted_by", [])
    )
    return {"unread": total}


# ═══════════════════════════════════════════════════════════════════════════════
#  Soft-delete endpoints
# ═══════════════════════════════════════════════════════════════════════════════

@router.delete("/conversations/{conversation_id}")
def delete_conversation(conversation_id: str, user: dict = Depends(get_current_user)):
    """Soft-delete: hides the conversation from the user's view.
    Admin still has full access via /admin/ endpoints.
    """
    email = user.get("email", "")
    convos = _load_conversations()
    convo = next((c for c in convos if c["id"] == conversation_id), None)
    if not convo:
        raise HTTPException(status_code=404, detail="Conversation not found")
    if email not in convo.get("participants", []):
        raise HTTPException(status_code=403, detail="Not a participant")

    deleted_by = convo.setdefault("deleted_by", [])
    if email not in deleted_by:
        deleted_by.append(email)
    convo["unread"] = convo.get("unread", {})
    convo["unread"][email] = 0
    _save_conversations(convos)

    # Also soft-delete individual messages for this user
    messages = read_json(_messages_path(conversation_id))
    for m in messages:
        d = m.setdefault("deleted_by", [])
        if email not in d:
            d.append(email)
    write_json(_messages_path(conversation_id), messages)

    add_activity_log("chat_deleted", email, f"{email} soft-deleted conversation {conversation_id}")
    return {"status": "ok"}


@router.delete("/conversations/{conversation_id}/messages/{message_id}")
def delete_single_message(conversation_id: str, message_id: str, user: dict = Depends(get_current_user)):
    """Soft-delete a single message from the user's view only."""
    email = user.get("email", "")
    convos = _load_conversations()
    convo = next((c for c in convos if c["id"] == conversation_id), None)
    if not convo:
        raise HTTPException(status_code=404, detail="Conversation not found")
    if email not in convo.get("participants", []):
        raise HTTPException(status_code=403, detail="Not a participant")

    messages = read_json(_messages_path(conversation_id))
    msg = next((m for m in messages if m["id"] == message_id), None)
    if not msg:
        raise HTTPException(status_code=404, detail="Message not found")

    d = msg.setdefault("deleted_by", [])
    if email not in d:
        d.append(email)
    write_json(_messages_path(conversation_id), messages)
    return {"status": "ok"}


# ═══════════════════════════════════════════════════════════════════════════════
#  Admin endpoints (master log — ignores soft-deletes)
# ═══════════════════════════════════════════════════════════════════════════════

@router.get("/admin/conversations")
def admin_list_conversations(
    user_email: str = Query("", description="Filter by participant email"),
    admin: dict = Depends(require_admin),
):
    """Admin: list ALL conversations (ignoring soft-deletes), optionally filtered by user."""
    convos = _load_conversations()
    if user_email:
        convos = [c for c in convos if user_email in c.get("participants", [])]
    convos.sort(key=lambda c: c.get("updated_at", ""), reverse=True)
    # Enrich with message count
    for c in convos:
        msgs = read_json(_messages_path(c["id"]))
        c["message_count"] = len(msgs)
    return convos


@router.get("/admin/conversations/{conversation_id}")
def admin_get_messages(conversation_id: str, admin: dict = Depends(require_admin)):
    """Admin: get full unfiltered chat history (master log)."""
    convos = _load_conversations()
    convo = next((c for c in convos if c["id"] == conversation_id), None)
    if not convo:
        raise HTTPException(status_code=404, detail="Conversation not found")
    messages = read_json(_messages_path(conversation_id))
    return {"conversation": convo, "messages": messages}


@router.get("/admin/summary/{conversation_id}")
def admin_summarize_chat(conversation_id: str, admin: dict = Depends(require_admin)):
    """Admin: get an AI-generated summary of a conversation.
    Uses context windowing — sends last 100 messages max for efficiency.
    """
    convos = _load_conversations()
    convo = next((c for c in convos if c["id"] == conversation_id), None)
    if not convo:
        raise HTTPException(status_code=404, detail="Conversation not found")

    all_messages = read_json(_messages_path(conversation_id))
    if not all_messages:
        return {"summary": "This conversation has no messages yet."}

    # Context windowing: only send the last 100 messages
    window = all_messages[-100:]

    # Build a transcript for the LLM
    transcript_lines = []
    for m in window:
        ts = m.get("timestamp", "")[:16].replace("T", " ")
        sender = m.get("sender_name", m.get("sender", "Unknown"))
        content = m.get("content", "")
        transcript_lines.append(f"[{ts}] {sender}: {content}")

    transcript = "\n".join(transcript_lines)
    participants = ", ".join(convo.get("participant_names", convo.get("participants", [])))

    from backend.utils.rag_engine import _call_openrouter

    summary_prompt = (
        "You are an administrative AI analyst for Smart Construction Connect, a multi-tenant "
        "construction platform in Pakistan. Summarise the following chat transcript between platform users.\n\n"
        "Provide a concise sit-rep covering:\n"
        "1. **Purpose** — What is the conversation about?\n"
        "2. **Key Points** — Important decisions, agreements, or requests made.\n"
        "3. **Action Items** — Any pending tasks or follow-ups.\n"
        "4. **Tone & Sentiment** — Professional, heated, friendly, etc.\n"
        "5. **Flags** — Any potential issues (disputes, ToS violations, suspicious activity).\n\n"
        f"Participants: {participants}\n"
        f"Messages in window: {len(window)} of {len(all_messages)} total\n\n"
        f"--- TRANSCRIPT ---\n{transcript}\n--- END TRANSCRIPT ---"
    )

    try:
        summary = _call_openrouter(summary_prompt, [{"role": "user", "content": "Please summarise this conversation."}])
    except Exception as e:
        logger.error("AI summary failed: %s", e)
        # Fallback: basic stats summary
        senders = {}
        for m in all_messages:
            s = m.get("sender_name", m.get("sender", "Unknown"))
            senders[s] = senders.get(s, 0) + 1
        parts = [f"**Conversation Summary** (auto-generated fallback)\n"]
        parts.append(f"- **Participants:** {participants}")
        parts.append(f"- **Total messages:** {len(all_messages)}")
        parts.append(f"- **Date range:** {all_messages[0].get('timestamp', '')[:10]} → {all_messages[-1].get('timestamp', '')[:10]}")
        parts.append(f"- **Messages per sender:**")
        for name, count in senders.items():
            parts.append(f"  - {name}: {count} messages")
        summary = "\n".join(parts)

    return {"summary": summary, "message_count": len(all_messages), "window_size": len(window)}
