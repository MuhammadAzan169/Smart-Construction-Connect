"""Persistent conversation memory with context window management.

Stores chat history in JSON files (Database/ai_chats/) with:
- Per-user session management
- Context summarization for long conversations
- LLM-powered requirement extraction across sessions
- Conversation context injection for LLM calls

Designed to persist across page refreshes and browser restarts.
"""

from __future__ import annotations

import json
import logging
import os
import re
import time
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

import httpx

from backend.utils.data_handler import DB_DIR, read_json, write_json

logger = logging.getLogger(__name__)

_CHATS_ROOT = DB_DIR / "ai_chats"
_CHATS_ROOT.mkdir(parents=True, exist_ok=True)
_REQUIREMENTS_DIR = _CHATS_ROOT / "requirements"
_REQUIREMENTS_DIR.mkdir(parents=True, exist_ok=True)
_SUMMARIES_DIR = _CHATS_ROOT / "summaries"
_SUMMARIES_DIR.mkdir(parents=True, exist_ok=True)

# Max messages before triggering summarization
MAX_CONTEXT_MESSAGES = 20
# Keep last N messages verbatim after summary
RECENT_MESSAGES_KEEP = 8


def _safe_email(email: str) -> str:
    return re.sub(r"[^a-z0-9]", "-", email.lower())[:80]


# ═══════════════════════════════════════════════════════════════════════════════
#  Context Window Management
# ═══════════════════════════════════════════════════════════════════════════════

class ConversationMemory:
    """Manages conversation context with automatic summarization."""

    @staticmethod
    def _summary_path(email: str, session_id: str) -> Path:
        user_dir = _SUMMARIES_DIR / _safe_email(email)
        user_dir.mkdir(parents=True, exist_ok=True)
        safe_id = re.sub(r"[^a-zA-Z0-9\-]", "", session_id)[:64]
        return user_dir / f"{safe_id}.json"

    @staticmethod
    def summarize_conversation(messages: list[dict]) -> str:
        """Create a concise summary of conversation history.

        Extracts key facts: requirements, preferences, decisions made.
        This is a rule-based summarizer (no LLM call needed).
        """
        if not messages:
            return ""

        facts: list[str] = []
        user_msgs = [m for m in messages if m.get("role") == "user"]
        asst_msgs = [m for m in messages if m.get("role") == "assistant"]

        # Extract key information from user messages
        combined_user = " ".join(m.get("content", "") for m in user_msgs).lower()

        # City mentions
        from backend.utils.rag_engine import _PAKISTAN_CITIES, _AREA_PATTERNS
        for city in _PAKISTAN_CITIES:
            if city in combined_user:
                facts.append(f"Location: {city.title()}")
                break
        for area in _AREA_PATTERNS:
            if area in combined_user:
                facts.append(f"Area: {area.title()}")
                break

        # Budget
        budget_match = re.search(
            r"(\d+(?:\.\d+)?)\s*(m|million|lakh|lac|l|crore|cr|k|thousand)",
            combined_user,
        )
        if budget_match:
            facts.append(f"Budget mentioned: {budget_match.group(0)}")

        # Plot size
        plot = re.search(r"(\d+)\s*(marla|kanal)", combined_user)
        if plot:
            facts.append(f"Plot: {plot.group(0)}")

        # Construction type
        if "grey structure" in combined_user or "grey" in combined_user:
            facts.append("Type: Grey structure")
        elif "full finish" in combined_user or "complete" in combined_user:
            facts.append("Type: Full finish")
        elif "renovation" in combined_user:
            facts.append("Type: Renovation")

        # Floors
        floor = re.search(r"(\d+)\s*(?:floor|storey|story)", combined_user)
        if floor:
            facts.append(f"Floors: {floor.group(1)}")

        # Topics discussed
        topics = set()
        topic_keywords = {
            "cement": "cement", "steel": "steel", "brick": "bricks",
            "material": "materials", "supplier": "suppliers",
            "company": "companies", "price": "pricing",
            "cost": "cost estimation", "timeline": "timeline",
            "design": "design", "contractor": "contractors",
        }
        for kw, topic in topic_keywords.items():
            if kw in combined_user:
                topics.add(topic)
        if topics:
            facts.append(f"Topics: {', '.join(sorted(topics))}")

        # Recommendations given
        for msg in asst_msgs:
            content = msg.get("content", "")
            if "recommend" in content.lower() or "match" in content.lower():
                # Extract company/supplier names mentioned
                names = re.findall(r"\*\*(.+?)\*\*", content)
                if names:
                    facts.append(f"Recommended: {', '.join(names[:5])}")
                break

        # Number of exchanges
        facts.append(f"Exchanges: {len(user_msgs)} user messages, {len(asst_msgs)} assistant responses")

        if not facts:
            return "General conversation about construction."

        return "Previous conversation summary:\n" + "\n".join(f"• {f}" for f in facts)

    @classmethod
    def get_context_messages(
        cls,
        messages: list[dict],
        email: str = "",
        session_id: str = "",
    ) -> tuple[list[dict], str]:
        """Get optimized message list for LLM context window.

        If conversation is long (>MAX_CONTEXT_MESSAGES), returns:
        - A summary of older messages
        - Recent messages verbatim

        Returns: (messages_for_llm, summary_text)
        """
        if len(messages) <= MAX_CONTEXT_MESSAGES:
            return messages, ""

        # Split: older messages to summarize, recent to keep
        older = messages[:-RECENT_MESSAGES_KEEP]
        recent = messages[-RECENT_MESSAGES_KEEP:]

        # Check if we already have a summary for this session
        summary = ""
        if email and session_id:
            summary_path = cls._summary_path(email, session_id)
            cached = read_json(summary_path)
            if isinstance(cached, dict):
                cached_count = cached.get("message_count", 0)
                if cached_count == len(older):
                    summary = cached.get("summary", "")

        # Generate new summary if needed
        if not summary:
            summary = cls.summarize_conversation(older)
            if email and session_id:
                write_json(cls._summary_path(email, session_id), {
                    "summary": summary,
                    "message_count": len(older),
                    "updated_at": datetime.now(timezone.utc).isoformat(),
                })

        return recent, summary

    @classmethod
    def build_context_injection(
        cls,
        messages: list[dict],
        email: str = "",
        session_id: str = "",
    ) -> tuple[list[dict], str]:
        """Build optimized messages + context summary for LLM.

        Returns (optimized_messages, extra_context_string).
        """
        optimized, summary = cls.get_context_messages(messages, email, session_id)

        extra = ""
        if summary:
            extra = f"\n\n--- CONVERSATION HISTORY SUMMARY ---\n{summary}\n--- END SUMMARY ---\n"

        return optimized, extra


# ═══════════════════════════════════════════════════════════════════════════════
#  Requirement State Tracker
# ═══════════════════════════════════════════════════════════════════════════════

class RequirementTracker:
    """LLM-powered requirement tracker inspired by multi-agent planning system.

    Instead of naive regex, uses OpenRouter LLM to:
    1. Decide IF the latest message contains construction requirement info
    2. Extract structured fields with confidence scores
    3. Only persist fields above a confidence threshold
    Regex is kept ONLY as a fast fallback when LLM is unavailable.
    """

    REQUIRED_FIELDS = ["city", "budget_min", "plot_size", "project_type"]
    OPTIONAL_FIELDS = [
        "area", "budget_max", "num_floors", "num_rooms",
        "design_style", "timeline", "construction_type",
        "special_requirements",
    ]

    _EXTRACTION_PROMPT = """\
You are an expert construction project requirement analyst for Pakistan.

Analyze ONLY the LATEST USER MESSAGE below. Determine:
1. Does this message contain ANY construction project requirement info?  
2. If yes, extract ONLY the fields explicitly mentioned or clearly implied.

STRICT RULES:
- ONLY extract what the user EXPLICITLY states. Do NOT infer or guess.
- If user says "I want a house in Lahore", extract city=Lahore, project_type=house. Nothing else.
- If user asks a question like "what builders are in Lahore?" do NOT extract city as a requirement.
- Greetings, questions, small talk → should_extract = false, empty fields.
- Budget must have explicit monetary values (lakh, crore, million, PKR, or 6+ digit numbers).
- "grey" alone does NOT mean grey structure — need "grey structure" explicitly.
- "complete" alone does NOT mean full_finish — need "full finish", "complete construction", or "turnkey".
- For each extracted field, provide a confidence score (0.0-1.0). Only fields >= 0.7 are accepted.

Respond with ONLY valid JSON, no markdown, no explanation:
{
  "should_extract": true/false,
  "fields": {
    "city": {"value": "Lahore", "confidence": 0.95},
    "area": {"value": "DHA Phase 5", "confidence": 0.9},
    "plot_size": {"value": "10 marla", "confidence": 0.95},
    "project_type": {"value": "house", "confidence": 0.9},
    "budget_min": {"value": 5000000, "confidence": 0.8},
    "budget_max": {"value": 8000000, "confidence": 0.8},
    "num_floors": {"value": 2, "confidence": 0.85},
    "num_rooms": {"value": 4, "confidence": 0.8},
    "design_style": {"value": "modern", "confidence": 0.75},
    "timeline": {"value": "12 months", "confidence": 0.8},
    "construction_type": {"value": "grey_structure", "confidence": 0.9},
    "special_requirements": {"value": ["basement", "parking"], "confidence": 0.85}
  }
}

Only include fields that are explicitly mentioned. Omit fields not present in the message.\
"""

    _CONFIDENCE_THRESHOLD = 0.7

    @staticmethod
    def _path(email: str) -> Path:
        safe = _safe_email(email)
        return _REQUIREMENTS_DIR / f"{safe}.json"

    @classmethod
    def load(cls, email: str) -> dict:
        data = read_json(cls._path(email))
        if not isinstance(data, dict) or not data:
            return {
                "email": email,
                "status": "gathering",
                "city": None, "area": None, "plot_size": None,
                "project_type": None, "budget_min": None, "budget_max": None,
                "num_floors": None, "num_rooms": None, "design_style": None,
                "timeline": None, "special_requirements": [],
                "construction_type": None, "collected_fields": [],
                "updated_at": datetime.now(timezone.utc).isoformat(),
            }
        return data

    @classmethod
    def save(cls, email: str, reqs: dict):
        reqs["updated_at"] = datetime.now(timezone.utc).isoformat()
        write_json(cls._path(email), reqs)

    @classmethod
    def clear(cls, email: str):
        path = cls._path(email)
        if path.exists():
            path.unlink()

    @classmethod
    def update_from_messages(cls, email: str, messages: list[dict]) -> dict:
        """Extract requirements from the latest message via LLM and merge."""
        current = cls.load(email)
        extracted = cls._extract_with_llm(messages)
        collected = set(current.get("collected_fields", []))

        for key, val in extracted.items():
            if val is not None and val != [] and val != "":
                current[key] = val
                collected.add(key)

        current["collected_fields"] = sorted(collected)

        # Compute status
        missing = [f for f in cls.REQUIRED_FIELDS if not current.get(f)]
        filled = len([f for f in cls.REQUIRED_FIELDS + cls.OPTIONAL_FIELDS if current.get(f)])

        if not missing and filled >= 5:
            current["status"] = "complete"
        elif len(missing) <= 2:
            current["status"] = "nearly_complete"
        else:
            current["status"] = "gathering"

        cls.save(email, current)
        return current

    @classmethod
    def get_missing_fields(cls, reqs: dict) -> list[str]:
        return [f for f in cls.REQUIRED_FIELDS if not reqs.get(f)]

    @classmethod
    def is_ready_for_recommendations(cls, reqs: dict, user_msg_count: int) -> bool:
        """Check if we have enough info to generate recommendations."""
        if user_msg_count < 3:
            return False
        missing = cls.get_missing_fields(reqs)
        filled = len([f for f in cls.REQUIRED_FIELDS + cls.OPTIONAL_FIELDS if reqs.get(f)])
        return len(missing) == 0 or (len(missing) == 1 and filled >= 4)

    @classmethod
    def get_follow_up_prompt(cls, reqs: dict) -> str:
        """Generate a follow-up question prompt based on missing requirements."""
        missing = cls.get_missing_fields(reqs)
        if not missing:
            return ""

        prompts = {
            "city": "Which city do you want to build in?",
            "budget_min": "What is your approximate budget range in PKR?",
            "plot_size": "What is your plot size (in marla or kanal)?",
            "project_type": "What type of project is this? (house, villa, commercial, renovation)",
        }

        questions = [prompts.get(f, f"What is your {f.replace('_', ' ')}?") for f in missing[:2]]
        return "\n\nIMPORTANT — Ask the user these questions naturally:\n" + "\n".join(f"• {q}" for q in questions)

    # ── LLM-powered extraction ───────────────────────────────────────────────

    @classmethod
    def _extract_with_llm(cls, messages: list[dict]) -> dict[str, Any]:
        """Use OpenRouter LLM to intelligently extract requirements.

        Falls back to regex if LLM is unavailable.
        """
        latest_user_msg = next(
            (m.get("content", "") for m in reversed(messages) if m.get("role") == "user"),
            "",
        )
        if not latest_user_msg.strip():
            return {}

        # Build context: last 3 user+assistant exchanges for context awareness
        recent = messages[-6:] if len(messages) > 6 else messages

        try:
            result = cls._call_extraction_llm(latest_user_msg, recent)
            if result is not None:
                return result
        except Exception as exc:
            logger.warning("LLM requirement extraction failed: %s — falling back to regex", exc)

        # Fallback to regex
        return cls._extract_regex(latest_user_msg)

    @classmethod
    def _call_extraction_llm(cls, latest_msg: str, recent_messages: list[dict]) -> dict[str, Any] | None:
        """Call OpenRouter for structured requirement extraction."""
        from backend.utils.rag_engine import _API_KEYS, _MODELS, _OPENROUTER_BASE

        if not _API_KEYS or not _MODELS:
            return None

        # Build the user message with context
        context_lines = []
        for m in recent_messages[:-1]:  # exclude the latest (we send it separately)
            role = m.get("role", "user")
            content = (m.get("content", "") or "")[:200]
            if content:
                context_lines.append(f"{role}: {content}")

        user_content = (
            f"Recent conversation context:\n"
            + "\n".join(context_lines[-4:])
            + f"\n\nLATEST USER MESSAGE (extract from this ONLY):\n{latest_msg}"
        )

        payload_messages = [
            {"role": "system", "content": cls._EXTRACTION_PROMPT},
            {"role": "user", "content": user_content},
        ]

        # Try first available model+key (lightweight call, single attempt)
        for model in _MODELS[:2]:
            for key in _API_KEYS[:2]:
                try:
                    with httpx.Client(timeout=15.0) as client:
                        resp = client.post(
                            f"{_OPENROUTER_BASE}/chat/completions",
                            headers={
                                "Authorization": f"Bearer {key}",
                                "Content-Type": "application/json",
                                "HTTP-Referer": "https://smartconstructionconnect.com",
                                "X-Title": "Smart Construction Connect",
                            },
                            json={
                                "model": model,
                                "messages": payload_messages,
                                "max_tokens": 500,
                                "temperature": 0.1,  # Near-deterministic for extraction
                            },
                        )

                    if resp.status_code != 200:
                        continue

                    raw = (
                        resp.json()
                        .get("choices", [{}])[0]
                        .get("message", {})
                        .get("content", "")
                        .strip()
                    )
                    if not raw:
                        continue

                    return cls._parse_llm_response(raw)

                except (httpx.TimeoutException, Exception) as exc:
                    logger.debug("LLM extraction attempt failed: %s", exc)
                    continue

        return None  # All attempts failed → caller falls back to regex

    @classmethod
    def _parse_llm_response(cls, raw: str) -> dict[str, Any]:
        """Parse the LLM JSON response and apply confidence gating."""
        # Strip markdown fences if present
        cleaned = raw.strip()
        if cleaned.startswith("```"):
            cleaned = re.sub(r"^```(?:json)?\s*", "", cleaned)
            cleaned = re.sub(r"\s*```$", "", cleaned)

        data = json.loads(cleaned)

        if not data.get("should_extract", False):
            return {}

        fields = data.get("fields", {})
        result: dict[str, Any] = {}

        for key, spec in fields.items():
            if not isinstance(spec, dict):
                continue
            confidence = spec.get("confidence", 0)
            value = spec.get("value")

            if confidence < cls._CONFIDENCE_THRESHOLD:
                logger.debug("Skipping field %s: confidence %.2f < %.2f", key, confidence, cls._CONFIDENCE_THRESHOLD)
                continue

            if value is None or value == "" or value == []:
                continue

            # Validate known field names
            if key in cls.REQUIRED_FIELDS or key in cls.OPTIONAL_FIELDS:
                result[key] = value

        return result

    # ── Regex fallback (fast, no LLM needed) ─────────────────────────────────

    @staticmethod
    def _extract_regex(text: str) -> dict[str, Any]:
        """Fast regex fallback — only used when LLM is unavailable."""
        combined = text.lower()
        reqs: dict[str, Any] = {}

        from backend.utils.rag_engine import _PAKISTAN_CITIES, _AREA_PATTERNS, _parse_budget

        for city in _PAKISTAN_CITIES:
            if city in combined:
                reqs["city"] = city.title()
                break

        for area in _AREA_PATTERNS:
            if area in combined:
                reqs["area"] = area.title()
                break

        m = re.search(r"(\d+)\s*(marla|kanal)", combined)
        if m:
            reqs["plot_size"] = f"{m.group(1)} {m.group(2)}"

        bmin, bmax = _parse_budget(combined)
        if bmin is not None:
            reqs["budget_min"] = bmin
            reqs["budget_max"] = bmax

        floor_patterns = [
            (r"(\d+)\s*(?:floor|storey|manzil)", None),
            (r"single\s*(?:storey|floor)", "1"),
            (r"double\s*(?:storey|floor)", "2"),
            (r"triple\s*(?:storey|floor)", "3"),
        ]
        for pattern, fixed in floor_patterns:
            fm = re.search(pattern, combined)
            if fm:
                reqs["num_floors"] = int(fixed) if fixed else int(fm.group(1))
                break

        rm = re.search(r"(\d+)\s*(?:room|bedroom|kamr[ae])", combined)
        if rm:
            reqs["num_rooms"] = int(rm.group(1))

        styles = {
            "modern": "modern", "contemporary": "modern",
            "traditional": "traditional", "classic": "traditional",
            "minimalist": "minimalist", "colonial": "colonial",
            "spanish": "spanish", "mediterranean": "mediterranean",
        }
        for kw, style in styles.items():
            if kw in combined:
                reqs["design_style"] = style
                break

        tm = re.search(r"(\d+)\s*(month|year|mahine|saal)", combined)
        if tm:
            val = int(tm.group(1))
            unit = tm.group(2)
            if unit in ("year", "saal"):
                reqs["timeline"] = f"{val} year{'s' if val > 1 else ''}"
            else:
                reqs["timeline"] = f"{val} month{'s' if val > 1 else ''}"

        if any(w in combined for w in ["grey structure", "gray structure"]):
            reqs["construction_type"] = "grey_structure"
        elif any(w in combined for w in ["full finish", "complete construction", "turnkey"]):
            reqs["construction_type"] = "full_finish"
        elif any(w in combined for w in ["renovation", "remodel", "repair"]):
            reqs["construction_type"] = "renovation"

        project_types = {
            "house": "house", "ghar": "house", "makaan": "house",
            "plaza": "plaza", "commercial": "commercial",
            "villa": "villa", "bungalow": "bungalow",
            "apartment": "apartment", "flat": "apartment",
            "farmhouse": "farmhouse",
        }
        for kw, ptype in project_types.items():
            if kw in combined:
                reqs["project_type"] = ptype
                break

        specials = []
        special_map = {
            "basement": "basement", "solar": "solar panels",
            "smart home": "smart home", "pool": "swimming pool",
            "swimming": "swimming pool", "lift": "elevator/lift",
            "elevator": "elevator/lift", "garden": "garden/landscaping",
            "rooftop": "rooftop", "parking": "parking",
            "boundary wall": "boundary wall",
        }
        for kw, label in special_map.items():
            if kw in combined and label not in specials:
                specials.append(label)
        if specials:
            reqs["special_requirements"] = specials

        return reqs


# ── Module singletons ──
conversation_memory = ConversationMemory()
requirement_tracker = RequirementTracker()
