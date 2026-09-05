"""RAG recommendation engine v3 — hybrid search, anti-hallucination, context-aware.

Architecture
────────────
1. Hybrid semantic index (Sentence Transformers + FAISS + BM25) with auto-refresh.
   Falls back to BM25-only if sentence-transformers not installed.
2. Intent extraction: city, budget, plot size, material keywords, language.
3. Structural boosting: city, budget, rating, experience + semantic score → 0-100.
4. Role-specific system prompts with strict anti-hallucination guards.
5. Conversation memory: context summarization for long chats.
6. Response caching for frequent queries.
7. Graceful fallback chain: LLM → rule-based summary → "I don't know".
"""

from __future__ import annotations

import hashlib
import json
import logging
import math
import os
import re
import threading
from collections import Counter
from pathlib import Path
from typing import Any

import httpx

from backend.utils.data_handler import (
    read_json,
    companies_dataset_path,
    suppliers_dataset_path,
    get_all_users,
    get_activity_log,
)
from backend.utils.market_prices import get_market_prices_context
from backend.utils.semantic_embeddings import semantic_index
from backend.utils.conversation_memory import conversation_memory, requirement_tracker
from backend.utils.response_cache import response_cache

logger = logging.getLogger(__name__)

# ═══════════════════════════════════════════════════════════════════════════════
#  OpenRouter configuration
# ═══════════════════════════════════════════════════════════════════════════════

def _load_api_keys() -> list[str]:
    keys: list[str] = []
    i = 1
    while True:
        k = os.getenv(f"OPENROUTER_API_KEY{i}", "").strip()
        if not k:
            break
        keys.append(k)
        i += 1
    return keys


def _load_models() -> list[str]:
    models: list[str] = []
    i = 1
    while True:
        m = os.getenv(f"OPENROUTER_MODEL_{i}", "").strip()
        if not m:
            break
        models.append(m)
        i += 1
    return models or [
        "openai/gpt-oss-20b:free",
        "nvidia/nemotron-3-super-120b-a12b:free",
        "stepfun/step-3.5-flash:free",
        "minimax/minimax-m2.5:free",
    ]


_OPENROUTER_BASE = os.getenv("OPENROUTER_BASE_URL", "https://openrouter.ai/api/v1")
_API_KEYS = _load_api_keys()
_MODELS = _load_models()

_RETRYABLE_STATUSES = {429, 500, 502, 503, 504}
_BAD_KEY_STATUSES = {401, 403}


# ═══════════════════════════════════════════════════════════════════════════════
#  Anti-hallucination guard (injected into every prompt)
# ═══════════════════════════════════════════════════════════════════════════════

_ANTI_HALLUCINATION_GUARD = """
CRITICAL RULES — NEVER VIOLATE:
1. ONLY use information from the DATA sections below (RECOMMENDED MATCHES, MARKET PRICES, PLATFORM DATA).
2. NEVER invent, fabricate, or guess company names, prices, phone numbers, addresses, ratings, or any factual data.
3. If the user asks about something NOT covered by the data below, respond honestly that you don't have that information.
4. NEVER create fictional companies, suppliers, or contact details.
5. If unsure about a fact, say so honestly rather than guessing.
6. When recommending companies/suppliers, ONLY use entities listed in RECOMMENDED MATCHES — never make up alternatives.
7. For prices, ONLY cite numbers from MARKET PRICES data. If a price is not listed, say you don't have current pricing.
8. Do not extrapolate or estimate data that isn't provided.

TOPIC RESTRICTION — STRICTLY ENFORCED:
• You are ONLY allowed to discuss: construction, real estate, building materials, architecture, contractor selection, project planning, platform features, market prices in Pakistan, and topics directly related to the user's construction project.
• If the user asks anything COMPLETELY UNRELATED to construction/real estate (e.g. politics, sports, religion, entertainment, coding, general chat topics, inappropriate or offensive content), respond ONLY with a polite refusal in the SAME language the user wrote in.
  - English refusal: "I'm your Construction Assistant and can only help with building and construction-related questions. Feel free to ask me anything about finding a contractor, material prices, or planning your project!"
  - Roman Urdu refusal: "Main aap ka Construction Assistant hoon aur sirf building aur construction se related sawalon mein madad kar sakta hoon. Apne ghar ya project ke baare mein kuch bhi poochhein!"
  - Urdu refusal: "میں آپ کا تعمیراتی مددگار ہوں اور صرف تعمیر و عمارت سے متعلق سوالوں میں مدد کر سکتا ہوں۔"
• NEVER engage with or respond to offensive, inappropriate, or abusive language. Just politely redirect.
"""


# ═══════════════════════════════════════════════════════════════════════════════
#  Role-based system prompts (upgraded with anti-hallucination)
# ═══════════════════════════════════════════════════════════════════════════════

_SYSTEM_PROMPTS: dict[str, str] = {
    "landing": (
        "You are the official AI assistant for Smart Construction Connect — "
        "Pakistan's premier platform connecting homeowners with verified "
        "construction companies and material suppliers.\n\n"
        "Your ONLY job is to:\n"
        "• Explain the platform's benefits to visitors.\n"
        "• Convince homeowners why they should use the platform to find builders.\n"
        "• Convince construction companies to register and showcase their work.\n"
        "• Convince material suppliers to list their products and gain exposure.\n"
        "• Highlight features: AI-powered matching, verified profiles, transparent "
        "pricing, real-time material prices, project tracking.\n"
        "• Answer general questions about the construction industry in Pakistan.\n\n"
        "Rules:\n"
        "• You are a MARKETING assistant. Be enthusiastic and persuasive.\n"
        "• Do NOT recommend specific companies or suppliers (the visitor is not logged in).\n"
        "• Do NOT answer unrelated topics (politics, religion, sports, entertainment, etc.).\n"
        "• If the visitor wants to find a builder or supplier, tell them to sign up.\n"
        "• LANGUAGE RULE (CRITICAL): Mirror the user's language exactly.\n"
        "  - If they write in English → reply in English.\n"
        "  - If they write in Roman Urdu (Urdu in Latin letters) → reply in Roman Urdu.\n"
        "  - If they write in Urdu script → reply in Urdu script.\n"
        "  - Match their tone: casual or formal, friendly or professional.\n"
        "• Keep answers concise (under 200 words) with bullet points and emojis.\n"
        "• If asked about topics outside construction/real estate, politely decline and redirect."
    ),

    "client": (
        "You are an expert AI Construction Consultant for homeowners on Smart Construction Connect — "
        "Pakistan's premier platform connecting homeowners with verified builders.\n\n"
        "YOUR PERSONALITY:\n"
        "• Warm, professional, and conversational — like a knowledgeable friend in the construction industry.\n"
        "• Engage naturally. Ask ONE question at a time. Don't overwhelm with bullet lists of questions.\n"
        "• Show genuine interest in the user's project. React to what they say before asking the next question.\n"
        "• Use a mix of encouragement and expertise.\n\n"
        "LANGUAGE RULE (CRITICAL — HIGHEST PRIORITY):\n"
        "• Mirror the EXACT language and script of the user's most recent message.\n"
        "• English message → Reply in English. Example: 'Hello, how are you?' → 'Hi! I'm doing great, how can I help with your construction project?'\n"
        "• Roman Urdu message → Reply in Roman Urdu. Example: 'hello kia hal hey' → 'Hi! Main theek hoon, aap sunao! Aap ka ghar ka project share karein.'\n"
        "• Urdu script message → Reply in Urdu script. Example: 'ہیلو آپ کیسے ہیں' → 'میں ٹھیک ہوں، آپ کے تعمیراتی منصوبے کے بارے میں بتائیں!'\n"
        "• NEVER mix languages without the user mixing first.\n\n"
        "CONVERSATION WORKFLOW — STRICT ORDER:\n\n"
        "PHASE 1 — UNDERSTAND (keep asking until you know enough):\n"
        "   Have a natural conversation to understand what the user wants. Ask about:\n"
        "   • City & area — Where do they want to build? (e.g. Lahore DHA, Islamabad G-13)\n"
        "   • Plot size (marla/kanal) and number of floors\n"
        "   • Budget range in PKR\n"
        "   • Construction type (grey structure / full finish / renovation)\n"
        "   • Timeline and any special features (solar, smart home, basement, pool)\n\n"
        "   IMPORTANT: Ask ONE or TWO questions per message. Build on their answers. Show you're listening.\n\n"
        "PHASE 2 — RECOMMEND (ONLY when RECOMMENDED MATCHES data exists below):\n"
        "   When you see a section titled 'RECOMMENDED MATCHES FROM DATABASE' below,\n"
        "   present the TOP 3 matches with this format:\n"
        "   **Company Name** ⭐ Rating/5\n"
        "   📍 Location | 💰 Price range | 🏗️ Specializations\n"
        "   Brief personalized explanation of why they match THIS user's needs.\n\n"
        "PHASE 3 — GUIDE:\n"
        "   After recommending, help with cost breakdowns, comparisons, and next steps.\n\n"
        "ABSOLUTE RULES:\n"
        "• If there is NO section titled 'RECOMMENDED MATCHES FROM DATABASE' below, "
        "you MUST keep gathering requirements. Do NOT recommend any company.\n"
        "• NEVER invent or guess company names, prices, phone numbers, or addresses.\n"
        "• ONLY recommend companies/suppliers listed in RECOMMENDED MATCHES — never make up alternatives.\n"
        "• If a file is uploaded (floor plan, BOQ, contract), analyze it thoroughly.\n"
        "• Remember what the user told you in previous messages — don't re-ask.\n"
        "• If the user asks something outside your data, say so honestly."
    ),

    "company": (
        "You are an AI Business Advisor for construction companies on Smart Construction Connect.\n\n"
        "Your capabilities:\n"
        "1. Recommend TOP 3 material suppliers from RECOMMENDED MATCHES below.\n"
        "2. Provide current market prices from MARKET PRICES data.\n"
        "3. Help with pricing strategy, project costing, competitive analysis.\n"
        "4. Suggest material alternatives to optimize cost.\n"
        "5. Help with project planning and timeline estimation.\n\n"
        "LANGUAGE RULE (CRITICAL): Mirror the EXACT language of the user's message — "
        "English → English, Roman Urdu → Roman Urdu, Urdu script → Urdu script.\n\n"
        "Rules:\n"
        "• When recommending suppliers, ONLY use those in RECOMMENDED MATCHES.\n"
        "• Back all price suggestions with MARKET PRICES data.\n"
        "• Keep advice data-driven and actionable.\n"
        "• If a file is uploaded, analyze it and provide insights.\n"
        "• Never invent supplier names, prices, or contact information.\n"
        "• If you don't have data for something, say so clearly."
    ),

    "supplier": (
        "You are an AI Market Analyst for material suppliers on Smart Construction Connect.\n\n"
        "Your capabilities:\n"
        "1. Provide current market prices for ALL construction materials in Pakistan.\n"
        "2. Compare the supplier's prices against market averages.\n"
        "3. Identify demand trends — which materials sell most, seasonal patterns.\n"
        "4. Suggest competitive pricing strategies.\n"
        "5. Recommend new product opportunities based on platform demand data.\n"
        "6. Analyze stock levels and suggest reorder points.\n\n"
        "LANGUAGE RULE (CRITICAL): Mirror the EXACT language of the user's message — "
        "English → English, Roman Urdu → Roman Urdu, Urdu script → Urdu script.\n\n"
        "Rules:\n"
        "• Always ground price discussions in MARKET PRICES data below.\n"
        "• Be data-driven and analytical.\n"
        "• If a file is uploaded (inventory, price sheet), analyze it.\n"
        "• Never fabricate pricing data or market statistics."
    ),

    "admin": (
        "You are an AI Analytics Assistant for administrators of Smart Construction Connect.\n\n"
        "Your capabilities:\n"
        "1. Summarize platform data: total users, companies, suppliers by city.\n"
        "2. Identify top-performing companies and suppliers by rating, projects.\n"
        "3. List pending/unapproved companies and suppliers.\n"
        "4. Show market price trends and supply-demand gaps.\n"
        "5. Provide revenue and engagement insights.\n"
        "6. Answer any analytical question about the platform data.\n\n"
        "LANGUAGE RULE (CRITICAL): Mirror the EXACT language of the admin's message — "
        "English → English, Roman Urdu → Roman Urdu, Urdu script → Urdu script.\n\n"
        "Rules:\n"
        "• Use ONLY the PLATFORM DATA section below for facts. Do not guess.\n"
        "• Be concise, use tables, bullet points, numbers.\n"
        "• If data is not available, clearly state so."
    ),
}


# ═══════════════════════════════════════════════════════════════════════════════
#  Backward-compatible index wrapper (delegates to semantic_embeddings)
# ═══════════════════════════════════════════════════════════════════════════════

_INDEX = semantic_index  # Alias for backward compatibility


def rebuild_index():
    """Force rebuild of the semantic index."""
    semantic_index.build(force=True)
    response_cache.invalidate()
    logger.info("Index rebuilt and cache cleared")


# ═══════════════════════════════════════════════════════════════════════════════
#  Intent extraction
# ═══════════════════════════════════════════════════════════════════════════════

_PAKISTAN_CITIES = [
    "karachi", "lahore", "islamabad", "rawalpindi", "faisalabad",
    "multan", "peshawar", "quetta", "hyderabad", "sialkot",
    "gujranwala", "bahawalpur", "sahiwal", "mardan", "abbottabad",
    "sukkur", "nawabshah", "dera ghazi khan", "mirpur", "muzaffarabad",
    "gujrat", "sargodha", "larkana", "sheikhupura", "jhang",
    "rahim yar khan", "okara", "swat", "kohat", "bannu",
]

_AREA_PATTERNS = [
    "dha", "bahria", "gulberg", "model town", "cantt", "wapda town",
    "lake city", "johar town", "garden town", "askari", "defence",
    "satellite town", "hayatabad", "university town", "pwd",
    "g-13", "f-10", "f-11", "i-8", "e-11", "blue area",
    "clifton", "pechs", "north nazimabad", "gulshan",
]


def _parse_budget(text: str) -> tuple[float | None, float | None]:
    """Extract budget from text.

    Only matches numbers that have an explicit monetary unit suffix (lakh, crore,
    million, k/thousand) or are large bare numbers (6+ digits = ≥100,000 PKR).
    This prevents plot sizes ("5 marla"), floors ("2 manzil"), or room counts
    from being mis-read as budget figures.
    """
    text = text.lower().replace(",", "").replace("pkr", " ").replace("rs.", " ")
    # Replace " rs " as a standalone word to avoid partial matches
    text = re.sub(r"\brs\b", " ", text).strip()
    nums: list[float] = []

    # Match numbers WITH explicit monetary unit
    for m in re.finditer(
        r"(\d+(?:\.\d+)?)\s*(million|k|thousand|lakh|lac|crore|cr)\b", text
    ):
        val = float(m.group(1))
        unit = m.group(2).strip()
        if unit == "million":
            val *= 1_000_000
        elif unit in ("k", "thousand"):
            val *= 1_000
        elif unit in ("lakh", "lac"):
            val *= 100_000
        elif unit in ("crore", "cr"):
            val *= 10_000_000
        nums.append(val)

    # Match large bare numbers (≥100,000) that are clearly monetary
    for m in re.finditer(r"\b(\d{6,})\b", text):
        bare = float(m.group(1))
        # Avoid duplicating a value already captured via a unit
        if not any(abs(bare - n) < 1 for n in nums):
            nums.append(bare)

    if len(nums) >= 2:
        return min(nums), max(nums)
    elif len(nums) == 1:
        return nums[0] * 0.7, nums[0] * 1.3
    return None, None


_ROMAN_URDU_MARKERS: frozenset[str] = frozenset([
    "main", "mein", "hum", "aap", "tum", "wo", "woh", "yeh", "ye",
    "hai", "hain", "tha", "the", "thi", "ho", "hoga", "hogi", "houn",
    "karo", "karna", "karte", "karta", "karti", "kar", "kia", "kiya",
    "dena", "dedo", "lena", "lo", "batao", "batayen", "btao", "bata",
    "chahiye", "chahie", "chahta", "chahti", "chahye",
    "kya", "kia", "kab", "kahan", "kyun", "kaisa", "kesa", "kitna",
    "kitne", "kitni", "kaun", "konsa",
    "aur", "lekin", "magar", "agar", "phir", "toh", "to", "ya",
    "ke", "ka", "ki", "ko", "se", "mein", "pe", "par", "tak",
    "nahi", "nahin", "nhi", "na", "haan", "han", "ji", "bilkul",
    "achha", "acha", "accha", "theek", "thek", "sahi",
    "bhai", "dost", "sahib",
    "shukriya", "shukria", "meherbani", "shukar", "shukran",
    "zaroorat", "zarurat", "zaroor", "madad", "madat",
    "ghar", "makan", "makaan", "gher", "banwana", "banana", "bana",
    "marla", "kanal", "manzil", "kamra", "tameer", "taameer", "nirman",
    "paise", "rupay", "lakh", "crore",
    "kam", "zyada", "bara", "chota", "chhota", "pura", "sara", "sab",
    "dono", "pehle", "baad", "jaldi", "abhi",
    # Additional markers for better detection
    "bohot", "bahut", "bohat", "kuch", "koi", "wala", "wali", "wale",
    "raha", "rahi", "rahe", "gaya", "gayi", "gaye", "laga", "lagi",
    "dekho", "dekhna", "sunao", "suno", "samajh", "samjh",
    "mushkil", "asaan", "asan", "behtareen", "behtreen",
    "kaam", "paisay", "paisa", "dimagh", "waqt", "waqat",
    "mujhe", "tumhe", "humein", "hamein", "unhein", "unhe",
    "yahan", "wahan", "idhar", "udhar", "kidhar",
    "matlab", "yani", "maslan", "warna", "kyunke", "kyunki",
    "chalo", "chalein", "aao", "jao", "ruko",
    "cement", "sement", "bajri", "reti", "sarya", "eent",
    "mistry", "mistri", "thekedar", "karigar",
])


def _detect_language(text: str) -> str:
    """Detect language from text.

    Uses only unambiguous Roman Urdu words to avoid false positives from
    common English words (e.g. 'main', 'to', 'na') that appear in the
    Roman Urdu marker set but are also everyday English.
    """
    if any(0x0600 <= ord(c) <= 0x06FF for c in text):
        return "urdu"
    # Words that look like Roman Urdu but are common English — exclude them
    _ENGLISH_OVERLAP = frozenset([
        "main", "to", "na", "ya", "ho", "lo", "a", "ka", "ko",
        "ke", "par", "se", "tak", "ki", "jo", "so",
    ])
    words = set(re.findall(r"[a-z]+", text.lower()))
    unambiguous = (words - _ENGLISH_OVERLAP) & _ROMAN_URDU_MARKERS
    roman_hits = len(unambiguous)
    # Require ≥3 unambiguous hits AND they must represent ≥15 % of unique words
    # (prevents a single stray word in an otherwise-English message triggering Urdu mode)
    if roman_hits >= 3 and (len(words) == 0 or roman_hits / len(words) >= 0.15):
        return "roman_urdu"
    return "english"


def _get_language_directive(lang: str) -> str:
    if lang == "urdu":
        return (
            "\n\n⚠️ CRITICAL LANGUAGE DIRECTIVE (MUST FOLLOW): "
            "The user is writing in Urdu script (اردو). "
            "You MUST reply ENTIRELY in Urdu script — every single sentence. "
            "Use proper Urdu grammar. Do NOT switch to English under any circumstances "
            "except for proper nouns (company names) and technical units (marla, kanal, sq ft). "
            "If you reply in English, you are violating the user's language preference."
        )
    if lang == "roman_urdu":
        return (
            "\n\n⚠️ CRITICAL LANGUAGE DIRECTIVE (MUST FOLLOW): "
            "The user is writing in Roman Urdu "
            "(Urdu words spelled in English/Latin letters). "
            "You MUST reply ONLY in Roman Urdu — write Urdu words using the Latin alphabet. "
            "Reply style example: 'Han bilkul! Aap Lahore mein ghar banana chahte hain? "
            "Budget aur plot size bata dein, main aap ke liye best companies "
            "dhundh lunga.' "
            "Do NOT reply in English. Do NOT use Urdu script (اردو). "
            "Keep it natural and conversational like a Pakistani friend talking in Roman Urdu. "
            "EVERY sentence must be in Roman Urdu."
        )
    return "\n\nLANGUAGE DIRECTIVE: The user is writing in English. Reply in clear, professional English."


def _has_enough_requirements(intent: dict, user_msg_count: int) -> bool:
    """Gate recommendations: require multiple exchanges AND sufficient detail.

    Ensures the AI gathers requirements conversationally before recommending.
    """
    if user_msg_count < 3:
        return False
    filled = sum([
        bool(intent.get("city")),
        bool(intent.get("budget_min")),
        bool(intent.get("plot_size")),
        bool(intent.get("project_type")),
    ])
    return filled >= 3


# Marla → approximate square feet conversion for budget math
_MARLA_TO_SQFT: dict[str, float] = {
    "3 marla": 270, "5 marla": 450, "7 marla": 630, "8 marla": 720,
    "10 marla": 900, "12 marla": 1080, "14 marla": 1260, "1 kanal": 4500,
    "2 kanal": 9000,
}
_DEFAULT_SQFT = 1000  # used when plot size is not specified


def _extract_plot_size(text: str) -> str | None:
    m = re.search(r"(\d+(?:\.\d+)?)\s*(marla|kanal)", text.lower())
    if m:
        return f"{m.group(1)} {m.group(2)}"
    return None


def _plot_size_to_sqft(plot_size: str | None) -> float:
    """Convert extracted plot size string to approximate square feet."""
    if not plot_size:
        return _DEFAULT_SQFT
    key = plot_size.lower().strip()
    if key in _MARLA_TO_SQFT:
        return _MARLA_TO_SQFT[key]
    m = re.match(r"(\d+(?:\.\d+)?)\s*(marla|kanal)", key)
    if m:
        val = float(m.group(1))
        return val * 90.0 if m.group(2) == "marla" else val * 4500.0
    return _DEFAULT_SQFT


def _extract_intent(messages: list[dict]) -> dict[str, Any]:
    # Use all user messages for budget/plot extraction (cumulative context)
    combined = " ".join(m.get("content", "") for m in messages if m.get("role") == "user").lower()

    intent: dict[str, Any] = {
        "project_type": None,
        "budget_min": None,
        "budget_max": None,
        "city": None,
        "area": None,
        "plot_size": None,
        "needs_company": False,
        "needs_supplier": False,
        "material_keywords": [],
        "language": _detect_language(combined),
    }

    if any(w in combined for w in ["build", "house", "construct", "home", "villa", "bungalow",
                                     "marla", "kanal", "ghar", "makaan", "banwana", "floor", "storey",
                                     "tameer", "taameer", "nirman", "manzil"]):
        intent["project_type"] = "construction"
        intent["needs_company"] = True

    # Material keywords — include Roman Urdu construction materials
    mat_kw = [
        "cement", "sement", "steel", "sarya", "brick", "eent", "paint", "tile", "wood",
        "pipe", "marble", "glass", "electrical", "plumbing", "sanitary", "door", "window",
        "waterproof", "sand", "reti", "aggregate", "crush", "bajri", "material", "supply",
        "supplier", "maal", "samaan",
    ]
    found_mats = [k for k in mat_kw if k in combined]
    if found_mats:
        intent["needs_supplier"] = True
        intent["material_keywords"] = found_mats

    if any(w in combined for w in ["both", "everything", "complete", "dono", "sab", "tamam"]):
        intent["needs_company"] = True
        intent["needs_supplier"] = True

    if not intent["needs_company"] and not intent["needs_supplier"]:
        intent["needs_company"] = True

    intent["budget_min"], intent["budget_max"] = _parse_budget(combined)
    intent["plot_size"] = _extract_plot_size(combined)

    # ── City detection: scan messages newest-first so the latest city wins ──
    user_messages = [m for m in messages if m.get("role") == "user"]
    for msg in reversed(user_messages):
        text = msg.get("content", "").lower()
        for city in _PAKISTAN_CITIES:
            if city in text:
                intent["city"] = city.title()
                break
        if intent["city"]:
            break
    # Fallback: scan combined if still not found
    if not intent["city"]:
        for city in _PAKISTAN_CITIES:
            if city in combined:
                intent["city"] = city.title()
                break

    # ── Area detection: newest-first ──
    for msg in reversed(user_messages):
        text = msg.get("content", "").lower()
        for area in _AREA_PATTERNS:
            if area in text:
                intent["area"] = area.title()
                break
        if intent["area"]:
            break

    return intent


# ═══════════════════════════════════════════════════════════════════════════════
#  Scoring / boosting (applied on top of semantic similarity)
# ═══════════════════════════════════════════════════════════════════════════════

def _freshness_boost(record: dict) -> float:
    """Give a small ranking lift to entities updated within the last 30 days.

    - Updated within 7 days  → +4 pts
    - Updated within 30 days → +2 pts
    - Older / no timestamp   → 0 pts
    """
    updated_at = record.get("updated_at") or record.get("created_at")
    if not updated_at:
        return 0.0
    try:
        from datetime import datetime, timezone
        dt = datetime.fromisoformat(updated_at.replace("Z", "+00:00"))
        age_days = (datetime.now(timezone.utc) - dt).days
        if age_days <= 7:
            return 4.0
        if age_days <= 30:
            return 2.0
    except Exception:
        pass
    return 0.0


def _boost_company(c: dict, intent: dict, embed_score: float) -> float:
    score = embed_score * 60.0

    cities: set[str] = set()
    for row in c.get("flattened_operational_areas", []):
        if row.get("city"):
            cities.add(row["city"].lower())
    for ck in (c.get("operational_areas") or {}).keys():
        cities.add(ck.lower())

    if intent["city"]:
        if intent["city"].lower() in cities:
            score += 20.0
        elif cities:
            score -= 10.0

    if intent["area"]:
        area_lower = intent["area"].lower()
        has_area = any(area_lower in (row.get("area", "") + row.get("subarea", "")).lower()
                       for row in c.get("flattened_operational_areas", []))
        if has_area:
            score += 8.0

    if intent["budget_min"] is not None:
        prices = [r.get("price_per_sqft", 0) for r in c.get("flattened_operational_areas", [])
                  if isinstance(r.get("price_per_sqft"), (int, float))]
        if prices:
            avg = sum(prices) / len(prices)
            sqft = _plot_size_to_sqft(intent.get("plot_size"))
            est_min = avg * sqft * 0.8
            est_max = avg * sqft * 1.2
            if est_min <= (intent["budget_max"] or float("inf")) and est_max >= intent["budget_min"]:
                score += 10.0
            else:
                score -= 8.0

    fb = c.get("customer_feedback") or {}
    rating = fb.get("average_rating", 0)
    reviews = fb.get("review_count", 0)
    if rating >= 4.5:
        score += 8.0
    elif rating >= 4.0:
        score += 4.0
    if reviews >= 100:
        score += 3.0

    ai = c.get("ai_scores") or {}
    for k in ["timeline_reliability", "budget_accuracy", "quality_consistency"]:
        v = ai.get(k, 0)
        if isinstance(v, (int, float)) and v > 0:
            # Normalize: scores stored 0-10 → contribute up to 2 pts each
            normalized = min(v / 10.0, 1.0) if v > 1.0 else v
            score += normalized * 2.0

    if c.get("verification_status") == "verified":
        score += 3.0

    score += _freshness_boost(c)

    return max(0.0, min(100.0, score))


def _boost_supplier(s: dict, intent: dict, embed_score: float) -> float:
    score = embed_score * 60.0

    served = [c.lower() for c in s.get("cities_served", [])]
    if intent["city"]:
        if intent["city"].lower() in served:
            score += 20.0
        elif served:
            score -= 10.0

    rating = s.get("rating", 0)
    if rating >= 4.5:
        score += 8.0
    elif rating >= 4.0:
        score += 4.0

    mat_count = len(s.get("materials", []))
    if mat_count >= 6:
        score += 4.0
    elif mat_count >= 3:
        score += 2.0

    if intent["material_keywords"]:
        mat_text = " ".join(m.get("name", "") + " " + m.get("category", "") for m in s.get("materials", [])).lower()
        hits = sum(1 for k in intent["material_keywords"] if k in mat_text)
        score += min(hits * 3.0, 12.0)

    if s.get("verification_status") == "verified":
        score += 3.0

    score += _freshness_boost(s)

    return max(0.0, min(100.0, score))


# ═══════════════════════════════════════════════════════════════════════════════
#  Recommendation pipeline
# ═══════════════════════════════════════════════════════════════════════════════

def _get_company_price_range(c: dict) -> str:
    flat = c.get("flattened_operational_areas", [])
    prices = [r["price_per_sqft"] for r in flat
              if isinstance(r.get("price_per_sqft"), (int, float)) and r["price_per_sqft"] > 0]
    if not prices:
        return "Contact for pricing"
    return f"{min(prices):,.0f} – {max(prices):,.0f} PKR/sq ft"


def get_recommendations(messages: list[dict], user_role: str = "client") -> dict:
    """Retrieve and rank recommendations using hybrid semantic search."""
    intent = _extract_intent(messages)
    query = " ".join(m.get("content", "") for m in messages if m.get("role") == "user")
    results: list[dict] = []

    search_companies = user_role in ("client",) and intent["needs_company"]
    search_suppliers = user_role in ("client", "company") and (intent["needs_supplier"] or user_role == "company")

    if search_companies:
        for c, es in semantic_index.search_companies(query, top_k=10):
            sc = _boost_company(c, intent, es)
            results.append({
                "type": "company",
                "id": c.get("slug") or c["company_id"],
                "name": c.get("company_name", "Unknown"),
                "score": round(sc),
                "location": ", ".join(list((c.get("operational_areas") or {}).keys())[:2]) or "Pakistan",
                "rating": (c.get("customer_feedback") or {}).get("average_rating", 0),
                "reviews": (c.get("customer_feedback") or {}).get("review_count", 0),
                "specializations": (c.get("experience") or {}).get("specializations", [])[:3],
                "price_range": _get_company_price_range(c),
                "completed_projects": (c.get("experience") or {}).get("houses_completed", 0),
            })

    if search_suppliers:
        for s, es in semantic_index.search_suppliers(query, top_k=10):
            sc = _boost_supplier(s, intent, es)
            cats = list(set(m.get("category", "") for m in s.get("materials", [])))
            results.append({
                "type": "supplier",
                "id": s.get("slug") or s["supplier_id"],
                "name": s.get("supplier_name", "Unknown"),
                "score": round(sc),
                "location": s.get("city") or "Pakistan",
                "rating": s.get("rating", 0),
                "reviews": s.get("review_count", 0),
                "categories": [c for c in cats if c][:5],
                "materials_count": len(s.get("materials", [])),
            })

    results.sort(key=lambda x: x["score"], reverse=True)
    return {"intent": intent, "recommendations": results[:3]}


# ═══════════════════════════════════════════════════════════════════════════════
#  RAG context builders
# ═══════════════════════════════════════════════════════════════════════════════

def _build_rag_context(recommendations: list[dict], user_role: str) -> str:
    lines: list[str] = []

    try:
        all_c = semantic_index.get_all_companies()
        all_s = semantic_index.get_all_suppliers()
        cities: set[str] = set()
        for c in all_c:
            for row in c.get("flattened_operational_areas", []):
                if row.get("city"):
                    cities.add(row["city"])
            for ck in (c.get("operational_areas") or {}).keys():
                cities.add(ck)
        lines.append(
            f"\n\n--- PLATFORM CATALOG ---\n"
            f"Construction companies: {len(all_c)}\n"
            f"Material suppliers: {len(all_s)}\n"
            f"Cities: {', '.join(sorted(cities)[:25])}"
        )
    except Exception:
        pass

    if recommendations:
        lines.append("\n\n--- RECOMMENDED MATCHES FROM DATABASE ---")
        lines.append("(These are REAL entities from our verified database. Use ONLY these for recommendations.)")
        for i, rec in enumerate(recommendations, 1):
            if rec["type"] == "company":
                lines.append(
                    f"{i}. {rec['name']} (Construction Company) | "
                    f"Location: {rec['location']} | Rating: {rec['rating']}/5 ({rec['reviews']} reviews) | "
                    f"Price: {rec['price_range']} | Completed: {rec['completed_projects']} projects | "
                    f"Specializations: {', '.join(rec.get('specializations', []))} | "
                    f"Match: {rec['score']}%"
                )
            else:
                lines.append(
                    f"{i}. {rec['name']} (Material Supplier) | "
                    f"Location: {rec['location']} | Rating: {rec['rating']}/5 ({rec['reviews']} reviews) | "
                    f"Categories: {', '.join(rec.get('categories', []))} | "
                    f"Materials: {rec.get('materials_count', 0)} items | "
                    f"Match: {rec['score']}%"
                )
        lines.append("--- END MATCHES ---")
    else:
        lines.append("\n\n--- NO RECOMMENDATIONS YET ---")
        lines.append("You do NOT have enough information to recommend companies/suppliers yet.")
        lines.append("Continue gathering requirements conversationally: city, budget, plot size, construction type.")
        lines.append("Do NOT mention any specific company or supplier names. Focus on understanding the user's project needs.")
        lines.append("--- END ---")

    if user_role != "landing":
        lines.append(get_market_prices_context())

    return "\n".join(lines)


def _build_admin_context() -> str:
    lines = ["\n\n--- PLATFORM DATA (LIVE) ---"]
    try:
        users = get_all_users()
        companies = semantic_index.get_all_companies()
        suppliers = semantic_index.get_all_suppliers()

        role_counts: dict[str, int] = {}
        status_counts: dict[str, int] = {}
        for u in users:
            r = u.get("role", "unknown")
            role_counts[r] = role_counts.get(r, 0) + 1
            s = u.get("status", "unknown")
            status_counts[s] = status_counts.get(s, 0) + 1
        lines.append(f"\nTotal users: {len(users)}")
        for r, cnt in sorted(role_counts.items()):
            lines.append(f"  • {r}: {cnt}")
        lines.append(f"User status: {status_counts}")

        lines.append(f"\nTotal companies: {len(companies)}")
        top_rated = sorted(companies, key=lambda c: (c.get("customer_feedback") or {}).get("average_rating", 0), reverse=True)[:5]
        if top_rated:
            lines.append("Top 5 companies by rating:")
            for c in top_rated:
                fb = c.get("customer_feedback") or {}
                lines.append(f"  • {c.get('company_name')}: {fb.get('average_rating', 0)}/5 ({fb.get('review_count', 0)} reviews)")

        pending = [c for c in companies if c.get("verification_status") != "verified"]
        lines.append(f"\nPending/unverified companies: {len(pending)}")
        for c in pending[:5]:
            lines.append(f"  • {c.get('company_name')} ({c.get('city', 'N/A')})")

        lines.append(f"\nTotal suppliers: {len(suppliers)}")
        pending_s = [s for s in suppliers if s.get("verification_status") != "verified"]
        lines.append(f"Pending/unverified suppliers: {len(pending_s)}")

        city_dist: dict[str, int] = {}
        for c in companies:
            for ck in (c.get("operational_areas") or {}).keys():
                city_dist[ck] = city_dist.get(ck, 0) + 1
        if city_dist:
            lines.append("\nCompany distribution by city:")
            for city, cnt in sorted(city_dist.items(), key=lambda x: -x[1])[:10]:
                lines.append(f"  • {city}: {cnt} companies")

        activity = get_activity_log()[:10]
        if activity:
            lines.append("\nRecent activity:")
            for a in activity[:5]:
                lines.append(f"  • [{a.get('timestamp', '')[:10]}] {a.get('action')}: {a.get('details', '')[:80]}")

    except Exception as e:
        lines.append(f"Error loading platform data: {e}")

    lines.append("\n--- END PLATFORM DATA ---")
    lines.append(get_market_prices_context())
    return "\n".join(lines)


# ═══════════════════════════════════════════════════════════════════════════════
#  OpenRouter LLM call with robust retry
# ═══════════════════════════════════════════════════════════════════════════════

def _call_openrouter(system_prompt: str, messages: list[dict]) -> str:
    """Call OpenRouter with model-first, key-exhaustion strategy."""
    if not _API_KEYS:
        raise RuntimeError("No OpenRouter API keys configured in .env")
    if not _MODELS:
        raise RuntimeError("No OpenRouter models configured in .env")

    payload_messages = [{"role": "system", "content": system_prompt}] + messages

    for model_idx, model in enumerate(_MODELS, 1):
        logger.info("LLM: trying model %d/%d — %s", model_idx, len(_MODELS), model)
        for key_idx, key in enumerate(_API_KEYS, 1):
            logger.debug("LLM: model=%s key=%d/%d", model, key_idx, len(_API_KEYS))
            try:
                with httpx.Client(timeout=60.0) as client:
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
                            "max_tokens": 1500,
                            "temperature": 0.6,  # Lower temp = more factual
                        },
                    )

                if resp.status_code == 200:
                    content = (
                        resp.json()
                        .get("choices", [{}])[0]
                        .get("message", {})
                        .get("content", "")
                        .strip()
                    )
                    if content:
                        logger.info("LLM success: model=%s key=%d/%d", model, key_idx, len(_API_KEYS))
                        return content
                    logger.warning("LLM empty response: model=%s key=%d/%d", model, key_idx, len(_API_KEYS))

                elif resp.status_code in _BAD_KEY_STATUSES:
                    logger.warning("LLM bad key (HTTP %d): model=%s key=%d — skipping", resp.status_code, model, key_idx)
                    continue

                elif resp.status_code in _RETRYABLE_STATUSES:
                    logger.warning("LLM retryable (HTTP %d): model=%s key=%d", resp.status_code, model, key_idx)
                    continue

                elif resp.status_code == 404:
                    logger.warning("LLM model not found (HTTP 404): %s — skipping model", model)
                    break

                else:
                    logger.warning("LLM unexpected HTTP %d: model=%s key=%d", resp.status_code, model, key_idx)

            except httpx.TimeoutException:
                logger.warning("LLM timeout: model=%s key=%d", model, key_idx)
            except Exception as exc:
                logger.warning("LLM exception: model=%s key=%d — %s", model, key_idx, exc)

        else:
            logger.warning("LLM: all keys exhausted for model=%s", model)
            continue

    raise RuntimeError("All OpenRouter models and keys exhausted")


def _build_fallback(recommendations: list[dict], intent: dict) -> str:
    if not recommendations:
        return ("I couldn't find matches based on your criteria. "
                "Could you share more details — city, budget, plot size?")
    parts = ["Based on your requirements, here are my top recommendations:\n"]
    for i, rec in enumerate(recommendations, 1):
        if rec["type"] == "company":
            parts.append(f"**{i}. {rec['name']}** (Construction Company)")
            parts.append(f"   📍 {rec['location']} | ⭐ {rec['rating']}/5 ({rec['reviews']} reviews)")
            parts.append(f"   💰 {rec['price_range']}")
            if rec.get("specializations"):
                parts.append(f"   🔧 {', '.join(rec['specializations'])}")
            parts.append(f"   Match: {rec['score']}%\n")
        else:
            parts.append(f"**{i}. {rec['name']}** (Material Supplier)")
            parts.append(f"   📍 {rec['location']} | ⭐ {rec['rating']}/5 ({rec['reviews']} reviews)")
            if rec.get("categories"):
                parts.append(f"   📦 {', '.join(rec['categories'])}")
            parts.append(f"   Match: {rec['score']}%\n")
    parts.append("Would you like more details about any of these?")
    return "\n".join(parts)


# ═══════════════════════════════════════════════════════════════════════════════
#  Main entry point
# ═══════════════════════════════════════════════════════════════════════════════

def generate_ai_response(
    messages: list[dict],
    *,
    user_role: str = "client",
    extra_context: str = "",
    user_email: str = "",
    session_id: str = "",
) -> dict:
    """Generate a RAG-grounded LLM response with memory and caching.

    Roles: landing | client | company | supplier | admin
    """
    base_system = _SYSTEM_PROMPTS.get(user_role, _SYSTEM_PROMPTS["client"])

    if not messages:
        greetings = {
            "landing": (
                "👋 Welcome to **Smart Construction Connect**!\n\n"
                "I can tell you everything about our platform:\n"
                "• How we help homeowners find the best builders 🏠\n"
                "• Why companies should register with us 🏗️\n"
                "• Benefits for material suppliers 📦\n\n"
                "What would you like to know? (English or Urdu, both work!)"
            ),
            "client": (
                "Hello! 👋 I'm your AI Construction Consultant.\n\n"
                "Tell me about your dream house:\n"
                "• **City & area** — Where do you want to build?\n"
                "• **Plot size** — How many marla/kanal?\n"
                "• **Floors** — Single, double, triple storey?\n"
                "• **Budget** — What's your range in PKR?\n"
                "• **Type** — Grey structure or full finish?\n\n"
                "I'll find the best companies and suppliers for you! 🏠\n"
                "(آپ اردو میں بھی بات کر سکتے ہیں)"
            ),
            "company": (
                "Hello! 👋 I'm your AI Business Advisor.\n\n"
                "I can help you with:\n"
                "• Finding the best **material suppliers** for your projects\n"
                "• Current **market prices** for construction materials\n"
                "• **Pricing strategy** and project costing\n"
                "• **Competitive analysis** in your area\n\n"
                "What do you need help with today?"
            ),
            "supplier": (
                "Hello! 👋 I'm your AI Market Analyst.\n\n"
                "I can help you with:\n"
                "• Current **market prices** across Pakistan\n"
                "• **Pricing strategy** — are you competitive?\n"
                "• **Demand trends** — what are buyers looking for?\n"
                "• **Stock optimization** suggestions\n\n"
                "What would you like to know?"
            ),
            "admin": (
                "Hello Admin! 👋\n\n"
                "I have access to all platform data. Ask me:\n"
                "• **User summary** — how many users, by role, status\n"
                "• **Top companies** — best rated, most projects\n"
                "• **Pending approvals** — unapproved companies/suppliers\n"
                "• **City analytics** — coverage gaps, demand\n"
                "• **Market prices** — current material costs\n\n"
                "What would you like to know?"
            ),
        }
        return {
            "response": greetings.get(user_role, greetings["client"]),
            "recommendations": [],
        }

    # ── Check response cache ─────────────────────────────────────────────────
    cached = response_cache.get(messages, user_role, user_email)
    if cached is not None:
        logger.info("Cache hit for AI response")
        return cached

    # ── Language detection ────────────────────────────────────────────────────
    # Use the LAST user message for language detection so one Urdu word in an
    # older message doesn't flip the language for the current English reply.
    last_user_msg = next(
        (m.get("content", "") for m in reversed(messages) if m.get("role") == "user"),
        "",
    )
    lang = _detect_language(last_user_msg)
    lang_directive = _get_language_directive(lang)

    # ── Conversation memory: optimize context window ──────────────────────────
    optimized_messages, memory_context = conversation_memory.build_context_injection(
        messages, user_email, session_id,
    )

    # ── Requirement tracking (for clients) ────────────────────────────────────
    requirement_context = ""
    if user_role == "client" and user_email:
        reqs = requirement_tracker.load(user_email)
        follow_up = requirement_tracker.get_follow_up_prompt(reqs)
        if follow_up:
            requirement_context = follow_up

    # ── RAG retrieval ────────────────────────────────────────────────────────
    top_matches: list[dict] = []
    intent: dict = {}
    if user_role in ("client", "company"):
        try:
            data = get_recommendations(messages, user_role)
            top_matches = data.get("recommendations", [])
            intent = data.get("intent", {})
        except Exception as e:
            logger.warning("RAG retrieval failed: %s", e)

    # ── Decide which recommendations to surface ───────────────────────────────
    user_msg_count = sum(1 for m in messages if m.get("role") == "user")
    if user_role == "client":
        # Prefer persisted tracker (handles returning users) with inline gate as fallback
        if user_email:
            reqs = requirement_tracker.load(user_email)
            gate_passed = requirement_tracker.is_ready_for_recommendations(reqs, user_msg_count)
        else:
            gate_passed = _has_enough_requirements(intent, user_msg_count)
        recs_to_return = top_matches if gate_passed else []
    elif user_role == "company":
        recs_to_return = top_matches
    else:
        recs_to_return = []

    # ── Build system prompt with all context layers ───────────────────────────
    # CRITICAL: pass recs_to_return (not top_matches) so LLM only sees company
    # data when requirements gate is passed — prevents premature recommendations.
    if user_role == "admin":
        context = _build_admin_context()
    else:
        context = _build_rag_context(recs_to_return, user_role)

    system_prompt = (
        base_system
        + _ANTI_HALLUCINATION_GUARD
        + memory_context
        + requirement_context
        + context
        + extra_context
        + lang_directive
    )

    # ── LLM call ─────────────────────────────────────────────────────────────
    try:
        response_text = _call_openrouter(system_prompt, optimized_messages)
    except RuntimeError as e:
        logger.error("LLM failed: %s", e)
        if top_matches and recs_to_return:
            response_text = _build_fallback(top_matches, intent)
        else:
            if lang == "roman_urdu":
                response_text = (
                    "Abhi connection mein masla hai. Thodi der baad dobara try karein! "
                    "Aap ki madad karne ke liye hum yahan hain. 🙏"
                )
            elif lang == "urdu":
                response_text = "ابھی کنکشن میں مسئلہ ہے۔ تھوڑی دیر بعد دوبارہ کوشش کریں۔ 🙏"
            else:
                response_text = (
                    "I'm having trouble connecting right now. Please try again in a moment! 🙏"
                )

    result = {
        "response": response_text,
        "recommendations": recs_to_return,
    }

    # ── Cache the result, tagged with entity IDs and city so smart invalidation works ──
    _cache_tags: set[str] = set()
    for m in top_matches:
        eid = m.get("company_id") or m.get("supplier_id")
        if eid:
            _cache_tags.add(eid)
    if intent.get("city"):
        _cache_tags.add(intent["city"].lower())
    response_cache.put(messages, user_role, result, user_email, tags=_cache_tags)

    return result


# ═══════════════════════════════════════════════════════════════════════════════
#  Streaming response generator
# ═══════════════════════════════════════════════════════════════════════════════

async def generate_ai_response_stream(
    messages: list[dict],
    *,
    user_role: str = "client",
    extra_context: str = "",
    user_email: str = "",
    session_id: str = "",
):
    """Async generator that yields streaming tokens for SSE.

    Yields dicts: {type: "recommendations", ...}, {type: "token", content: "..."}, {type: "done"}
    Falls back to non-streaming if streaming isn't supported.
    """
    import asyncio

    base_system = _SYSTEM_PROMPTS.get(user_role, _SYSTEM_PROMPTS["client"])

    if not messages:
        greetings = {
            "landing": "👋 Welcome to **Smart Construction Connect**!\n\nI can tell you everything about our platform.",
            "client": "Hello! 👋 I'm your AI Construction Consultant.\n\nTell me about your dream house — city, budget, plot size!",
            "company": "Hello! 👋 I'm your AI Business Advisor.\n\nI can help with suppliers, pricing, and project costing.",
            "supplier": "Hello! 👋 I'm your AI Market Analyst.\n\nI can help with market prices and demand trends.",
            "admin": "Hello Admin! 👋\n\nI have access to all platform data. What would you like to know?",
        }
        yield {"type": "token", "content": greetings.get(user_role, greetings["client"])}
        yield {"type": "recommendations", "recommendations": []}
        yield {"type": "done"}
        return

    # Language detection
    # Use the LAST user message for language detection so one Urdu word in an
    # older message doesn't flip the language for the current English reply.
    last_user_msg = next(
        (m.get("content", "") for m in reversed(messages) if m.get("role") == "user"),
        "",
    )
    lang = _detect_language(last_user_msg)
    lang_directive = _get_language_directive(lang)

    # Conversation memory
    optimized_messages, memory_context = conversation_memory.build_context_injection(
        messages, user_email, session_id,
    )

    # Requirement tracking
    requirement_context = ""
    if user_role == "client" and user_email:
        reqs = requirement_tracker.load(user_email)
        follow_up = requirement_tracker.get_follow_up_prompt(reqs)
        if follow_up:
            requirement_context = follow_up
        try:
            data = get_recommendations(messages, user_role)
            top_matches = data.get("recommendations", [])
            intent = data.get("intent", {})
        except Exception as e:
            logger.warning("RAG retrieval failed: %s", e)

    user_msg_count = sum(1 for m in messages if m.get("role") == "user")
    if user_role == "client":
        if user_email:
            reqs = requirement_tracker.load(user_email)
            gate_passed = requirement_tracker.is_ready_for_recommendations(reqs, user_msg_count)
        else:
            gate_passed = _has_enough_requirements(intent, user_msg_count)
        recs_to_return = top_matches if gate_passed else []
    elif user_role == "company":
        recs_to_return = top_matches
    else:
        recs_to_return = []

    # Send recommendations first
    yield {"type": "recommendations", "recommendations": recs_to_return}

    # Build system prompt
    # CRITICAL: pass recs_to_return (not top_matches) so LLM only sees company
    # data when requirements gate is passed — prevents premature recommendations.
    if user_role == "admin":
        context = _build_admin_context()
    else:
        context = _build_rag_context(recs_to_return, user_role)

    system_prompt = (
        base_system
        + _ANTI_HALLUCINATION_GUARD
        + memory_context
        + requirement_context
        + context
        + extra_context
        + lang_directive
    )

    # Try streaming from OpenRouter
    if not _API_KEYS or not _MODELS:
        yield {"type": "error", "content": "No API keys configured."}
        yield {"type": "done"}
        return

    payload_messages = [{"role": "system", "content": system_prompt}] + optimized_messages
    streamed = False

    for model in _MODELS:
        if streamed:
            break
        for key in _API_KEYS:
            try:
                async with httpx.AsyncClient(timeout=60.0) as client:
                    async with client.stream(
                        "POST",
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
                            "max_tokens": 1500,
                            "temperature": 0.6,
                            "stream": True,
                        },
                    ) as resp:
                        if resp.status_code != 200:
                            if resp.status_code in _BAD_KEY_STATUSES:
                                continue
                            if resp.status_code in _RETRYABLE_STATUSES:
                                continue
                            if resp.status_code == 404:
                                break
                            continue

                        async for line in resp.aiter_lines():
                            if not line.startswith("data: "):
                                continue
                            data_str = line[6:].strip()
                            if data_str == "[DONE]":
                                break
                            try:
                                data = json.loads(data_str)
                                delta = data.get("choices", [{}])[0].get("delta", {})
                                content = delta.get("content", "")
                                if content:
                                    yield {"type": "token", "content": content}
                                    streamed = True
                            except json.JSONDecodeError:
                                continue

                        if streamed:
                            break
            except httpx.TimeoutException:
                logger.warning("Stream timeout: model=%s", model)
            except Exception as exc:
                logger.warning("Stream error: model=%s — %s", model, exc)

    if not streamed:
        try:
            import asyncio
            loop = asyncio.get_event_loop()
            response_text = await loop.run_in_executor(
                None, _call_openrouter, system_prompt, optimized_messages
            )
            yield {"type": "token", "content": response_text}
        except RuntimeError:
            if top_matches and recs_to_return:
                yield {"type": "token", "content": _build_fallback(top_matches, intent)}
            else:
                yield {"type": "error", "content": "I'm having trouble connecting right now. Please try again! 🙏"}

    yield {"type": "done"}
