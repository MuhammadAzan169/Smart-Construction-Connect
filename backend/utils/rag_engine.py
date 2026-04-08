"""RAG recommendation engine v2 — role-aware, bilingual, auto-refreshing.

Architecture
────────────
1. TF-IDF in-memory index built from Database/construction/companies.json
   and Database/suppliers/catalog.json.  Refreshes automatically when file
   hashes change (covers edits from the frontend).
2. Intent extraction pulls city, budget, plot size, material keywords, and
   language preference from the full conversation.
3. Structural boosting (city, budget, rating, experience) combines with
   TF-IDF cosine score → 0-100 relevance.
4. Role-specific system prompts (landing, client, company, supplier, admin)
   get RAG context + market prices injected before the OpenRouter LLM call.
5. Graceful fallback: if LLM fails, a rule-based summary is returned.
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
from dotenv import load_dotenv

from backend.utils.data_handler import (
    read_json,
    companies_dataset_path,
    suppliers_dataset_path,
    get_all_users,
    get_activity_log,
)
from backend.utils.market_prices import get_market_prices_context

load_dotenv()
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

# Retryable HTTP status codes — move to the next key on these
_RETRYABLE_STATUSES = {429, 500, 502, 503, 504}
# Fatal key-level errors — key is bad, skip it entirely
_BAD_KEY_STATUSES = {401, 403}


# ═══════════════════════════════════════════════════════════════════════════════
#  Role-based system prompts
# ═══════════════════════════════════════════════════════════════════════════════

_SYSTEM_PROMPTS: dict[str, str] = {
    # ── Landing page (marketing bot) ──────────────────────────────────────────
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
        "• Do NOT answer unrelated topics (politics, religion, etc.).\n"
        "• If the visitor wants to find a builder or supplier, tell them to sign up.\n"
        "• Respond in the SAME language the user writes in. If they write Urdu/Roman Urdu, reply in Urdu. "
        "If English, reply in English. You can mix if they mix.\n"
        "• Keep answers concise (under 200 words) with bullet points and emojis."
    ),

    # ── Client (homeowner) ────────────────────────────────────────────────────
    "client": (
        "You are an expert AI Construction Consultant for homeowners on Smart Construction Connect.\n\n"
        "WORKFLOW — follow this strictly:\n"
        "STEP 1 — GATHER requirements first (do NOT recommend yet):\n"
        "   Ask conversationally, one or two questions at a time:\n"
        "   - City & area/society (e.g. Lahore DHA, Islamabad G-13)\n"
        "   - Plot size (marla/kanal)\n"
        "   - Construction type (grey structure / full finish / renovation)\n"
        "   - Budget range in PKR\n"
        "   - Number of floors\n"
        "   - Timeline and any special features (solar, smart home, pool)\n"
        "STEP 2 — ONLY after you have AT LEAST city + budget (minimum 2 key facts), "
        "present the TOP 3 matches from RECOMMENDED MATCHES below.\n"
        "STEP 3 — Provide cost breakdown using MARKET PRICES data.\n\n"
        "CRITICAL RULES:\n"
        "• NEVER recommend companies or suppliers before gathering minimum requirements.\n"
        "• NEVER invent or hallucinate company names, prices, or contact details.\n"
        "• ONLY recommend entries that appear in RECOMMENDED MATCHES.\n"
        "• If user only needs materials, recommend suppliers only.\n"
        "• Use markdown: bold headings (**text**), bullet lists, cost tables with | pipes |.\n"
        "• Respond in the SAME language the user is writing in (see LANGUAGE DIRECTIVE below).\n"
        "• If a file is uploaded (floor plan, BOQ, contract), analyze it thoroughly."
    ),

    # ── Construction company ──────────────────────────────────────────────────
    "company": (
        "You are an AI Business Advisor for construction companies on Smart Construction Connect.\n\n"
        "Your capabilities:\n"
        "1. Recommend the TOP 3 best material suppliers matching what the company needs.\n"
        "2. Provide current market prices for construction materials in Pakistan.\n"
        "3. Help with pricing strategy, project costing, and competitive analysis.\n"
        "4. Suggest material alternatives to optimize cost.\n"
        "5. Help with project planning and timeline estimation.\n\n"
        "Rules:\n"
        "• When recommending suppliers, ONLY use those in RECOMMENDED MATCHES below.\n"
        "• Back all price suggestions with MARKET PRICES data.\n"
        "• Keep advice data-driven and actionable.\n"
        "• Respond in the SAME language the user writes in.\n"
        "• If a file is uploaded, analyze it and provide insights."
    ),

    # ── Material supplier ─────────────────────────────────────────────────────
    "supplier": (
        "You are an AI Market Analyst for material suppliers on Smart Construction Connect.\n\n"
        "Your capabilities:\n"
        "1. Provide current market prices for ALL construction materials in Pakistan.\n"
        "2. Compare the supplier's prices against market averages.\n"
        "3. Identify demand trends — which materials sell most, seasonal patterns.\n"
        "4. Suggest competitive pricing strategies.\n"
        "5. Recommend new product opportunities based on platform demand data.\n"
        "6. Analyze stock levels and suggest reorder points.\n\n"
        "Rules:\n"
        "• Always ground price discussions in the MARKET PRICES data below.\n"
        "• Be data-driven and analytical.\n"
        "• Respond in the SAME language the user writes in.\n"
        "• If a file is uploaded (inventory, price sheet), analyze it."
    ),

    # ── Admin ─────────────────────────────────────────────────────────────────
    "admin": (
        "You are an AI Analytics Assistant for administrators of Smart Construction Connect.\n\n"
        "Your capabilities:\n"
        "1. Summarize platform data: total users, companies, suppliers by city.\n"
        "2. Identify top-performing companies and suppliers by rating, projects.\n"
        "3. List pending/unapproved companies and suppliers.\n"
        "4. Show market price trends and supply-demand gaps.\n"
        "5. Provide revenue and engagement insights.\n"
        "6. Answer any analytical question about the platform data.\n\n"
        "Rules:\n"
        "• Use ONLY the PLATFORM DATA section below for facts. Do not guess.\n"
        "• Be concise and use tables, bullet points, numbers.\n"
        "• Respond in the SAME language the admin writes in."
    ),
}


# ═══════════════════════════════════════════════════════════════════════════════
#  TF-IDF Embedding Index (auto-refreshing)
# ═══════════════════════════════════════════════════════════════════════════════

def _tokenize(text: str) -> list[str]:
    return re.findall(r"[a-z0-9]+", text.lower())


def _build_tfidf(docs: list[list[str]]) -> tuple[dict[str, float], list[dict[str, float]]]:
    N = len(docs)
    if N == 0:
        return {}, []
    df: Counter = Counter()
    for tokens in docs:
        df.update(set(tokens))
    idf = {term: math.log((N + 1) / (count + 1)) + 1.0 for term, count in df.items()}
    tf_vecs: list[dict[str, float]] = []
    for tokens in docs:
        if not tokens:
            tf_vecs.append({})
            continue
        freq = Counter(tokens)
        max_freq = max(freq.values())
        tf_vecs.append({t: (c / max_freq) * idf.get(t, 1.0) for t, c in freq.items()})
    return idf, tf_vecs


def _cosine(a: dict[str, float], b: dict[str, float]) -> float:
    if not a or not b:
        return 0.0
    dot = sum(a.get(t, 0.0) * v for t, v in b.items())
    na = math.sqrt(sum(v * v for v in a.values()))
    nb = math.sqrt(sum(v * v for v in b.values()))
    return dot / (na * nb) if na and nb else 0.0


def _file_hash(path: Path) -> str:
    """Quick hash of a file to detect changes."""
    try:
        return hashlib.md5(path.read_bytes()).hexdigest()
    except Exception:
        return ""


class _EmbeddingIndex:
    """Thread-safe TF-IDF index that auto-refreshes when JSON files change."""

    def __init__(self):
        self._lock = threading.Lock()
        self._companies: list[dict] = []
        self._suppliers: list[dict] = []
        self._company_vecs: list[dict[str, float]] = []
        self._supplier_vecs: list[dict[str, float]] = []
        self._idf: dict[str, float] = {}
        self._built = False
        self._company_hash = ""
        self._supplier_hash = ""

    # ── Document builders ─────────────────────────────────────────────────────

    @staticmethod
    def _company_doc(c: dict) -> str:
        parts = [
            c.get("company_name", ""),
            c.get("description") or "",
            c.get("city", ""),
        ]
        for row in c.get("flattened_operational_areas", []):
            parts.extend([row.get("city", ""), row.get("area", ""), row.get("subarea", ""), row.get("package", "")])
        for ck in (c.get("operational_areas") or {}).keys():
            parts.append(ck)
        for sp in (c.get("experience") or {}).get("specializations", []):
            parts.append(sp)
        for sk in (c.get("services") or {}).keys():
            parts.append(sk)
        for pkg_mats in (c.get("materials_used") or {}).values():
            if isinstance(pkg_mats, dict):
                parts.extend(pkg_mats.values())
        cap = c.get("construction_capability") or {}
        for ht in cap.get("house_types", []):
            parts.append(ht)
        legal = c.get("legal_info") or {}
        if legal.get("year_established"):
            parts.append(str(legal["year_established"]))
        return " ".join(str(p) for p in parts if p)

    @staticmethod
    def _supplier_doc(s: dict) -> str:
        parts = [
            s.get("supplier_name", ""),
            s.get("description") or "",
            s.get("city", ""),
            s.get("area", ""),
        ]
        parts.extend(s.get("cities_served", []))
        for mat in s.get("materials", []):
            parts.extend([mat.get("name", ""), mat.get("category", ""), mat.get("brand", ""), mat.get("description", "") or ""])
        return " ".join(str(p) for p in parts if p)

    # ── Build / refresh ───────────────────────────────────────────────────────

    def _needs_refresh(self) -> bool:
        ch = _file_hash(companies_dataset_path())
        sh = _file_hash(suppliers_dataset_path())
        return ch != self._company_hash or sh != self._supplier_hash

    def build(self, force: bool = False):
        if self._built and not force and not self._needs_refresh():
            return

        comp_path = companies_dataset_path()
        supp_path = suppliers_dataset_path()

        companies = read_json(comp_path)
        suppliers = read_json(supp_path)
        if not isinstance(companies, list):
            companies = []
        if not isinstance(suppliers, list):
            suppliers = []
        companies = [c for c in companies if isinstance(c, dict) and c.get("company_id")]
        suppliers = [s for s in suppliers if isinstance(s, dict) and s.get("supplier_id")]

        cdocs = [_tokenize(self._company_doc(c)) for c in companies]
        sdocs = [_tokenize(self._supplier_doc(s)) for s in suppliers]
        idf, vecs = _build_tfidf(cdocs + sdocs)

        with self._lock:
            self._companies = companies
            self._suppliers = suppliers
            self._idf = idf
            self._company_vecs = vecs[:len(cdocs)]
            self._supplier_vecs = vecs[len(cdocs):]
            self._company_hash = _file_hash(comp_path)
            self._supplier_hash = _file_hash(supp_path)
            self._built = True

        logger.info("Index built: %d companies, %d suppliers, %d terms", len(companies), len(suppliers), len(idf))

    def _ensure(self):
        if not self._built or self._needs_refresh():
            self.build()

    def _qvec(self, query: str) -> dict[str, float]:
        tokens = _tokenize(query)
        if not tokens:
            return {}
        freq = Counter(tokens)
        mx = max(freq.values())
        return {t: (c / mx) * self._idf.get(t, 1.0) for t, c in freq.items()}

    def search_companies(self, query: str, top_k: int = 10) -> list[tuple[dict, float]]:
        self._ensure()
        qv = self._qvec(query)
        with self._lock:
            scored = [(c, _cosine(qv, v)) for c, v in zip(self._companies, self._company_vecs)]
        scored.sort(key=lambda x: x[1], reverse=True)
        return scored[:top_k]

    def search_suppliers(self, query: str, top_k: int = 10) -> list[tuple[dict, float]]:
        self._ensure()
        qv = self._qvec(query)
        with self._lock:
            scored = [(s, _cosine(qv, v)) for s, v in zip(self._suppliers, self._supplier_vecs)]
        scored.sort(key=lambda x: x[1], reverse=True)
        return scored[:top_k]

    def get_all_companies(self) -> list[dict]:
        self._ensure()
        with self._lock:
            return list(self._companies)

    def get_all_suppliers(self) -> list[dict]:
        self._ensure()
        with self._lock:
            return list(self._suppliers)


_INDEX = _EmbeddingIndex()


def rebuild_index():
    _INDEX.build(force=True)


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
    text = text.lower().replace(",", "").replace("pkr", "").replace("rs", "").strip()
    nums: list[float] = []
    for m in re.finditer(r"(\d+(?:\.\d+)?)\s*(m|million|k|thousand|lakh|lac|l|crore|cr)?", text):
        val = float(m.group(1))
        unit = (m.group(2) or "").strip()
        if unit in ("m", "million"):
            val *= 1_000_000
        elif unit in ("k", "thousand"):
            val *= 1_000
        elif unit in ("lakh", "lac", "l"):
            val *= 100_000
        elif unit in ("crore", "cr"):
            val *= 10_000_000
        nums.append(val)
    if len(nums) >= 2:
        return min(nums), max(nums)
    elif len(nums) == 1:
        return nums[0] * 0.7, nums[0] * 1.3
    return None, None


# Comprehensive Roman Urdu word set — Urdu written in Latin script
_ROMAN_URDU_MARKERS: frozenset[str] = frozenset([
    # Pronouns & basic
    "main", "mein", "hum", "aap", "tum", "wo", "woh", "yeh", "ye",
    # Verbs / conjugations
    "hai", "hain", "tha", "the", "thi", "ho", "hoga", "hogi", "houn",
    "karo", "karna", "karte", "karta", "karti", "kar", "kia", "kiya",
    "dena", "dedo", "lena", "lo", "batao", "batayen", "btao", "bata",
    "chahiye", "chahie", "chahta", "chahti", "chahye",
    # Question words
    "kya", "kia", "kab", "kahan", "kyun", "kaisa", "kesa", "kitna",
    "kitne", "kitni", "kaun", "konsa",
    # Common connectors
    "aur", "lekin", "magar", "agar", "phir", "toh", "to", "ya",
    "ke", "ka", "ki", "ko", "se", "mein", "pe", "par", "tak",
    # Responses
    "nahi", "nahin", "nhi", "na", "haan", "han", "ji", "bilkul",
    "achha", "acha", "accha", "theek", "thek", "sahi",
    # Greetings / politeness
    "bhai", "dost", "sahib",
    "shukriya", "shukria", "meherbani", "shukar", "shukran",
    "zaroorat", "zarurat", "zaroor", "madad", "madat",
    # Construction / house
    "ghar", "makan", "makaan", "gher", "banwana", "banana", "bana",
    "marla", "kanal", "manzil", "kamra", "tameer", "taameer", "nirman",
    # Numbers / money
    "paise", "rupay", "lakh", "crore",
    # Degree words
    "kam", "zyada", "bara", "chota", "chhota", "pura", "sara", "sab",
    "dono", "pehle", "baad", "jaldi", "abhi",
])


def _detect_language(text: str) -> str:
    """Detect language: 'urdu' (script), 'roman_urdu', or 'english'."""
    # Urdu / Arabic script characters
    if any(0x0600 <= ord(c) <= 0x06FF for c in text):
        return "urdu"
    # Roman Urdu — Urdu words written in Latin letters
    words = set(re.findall(r"[a-z]+", text.lower()))
    roman_hits = len(words & _ROMAN_URDU_MARKERS)
    if roman_hits >= 2:
        return "roman_urdu"
    return "english"


def _get_language_directive(lang: str) -> str:
    """Return a system-prompt injection enforcing correct reply language."""
    if lang == "urdu":
        return (
            "\n\nLANGUAGE DIRECTIVE: The user is writing in Urdu script (اردو). "
            "You MUST reply entirely in Urdu script. "
            "Use proper Urdu grammar. Avoid switching to English except for "
            "technical terms (company names, prices, materials)."
        )
    if lang == "roman_urdu":
        return (
            "\n\nLANGUAGE DIRECTIVE: The user is writing in Roman Urdu "
            "(Urdu words spelled in English letters). "
            "You MUST reply in Roman Urdu — write Urdu words using the Latin alphabet. "
            "Reply style example: 'Han bilkul! Aap Lahore mein ghar banana chahte hain? "
            "Budget aur plot size bata dein, main aap ke liye best companies "
            "dhundh lunga.' "
            "Do NOT reply in English. Do NOT use Urdu script. "
            "Keep it natural and conversational like a friend talking in Roman Urdu."
        )
    return (
        "\n\nLANGUAGE DIRECTIVE: The user is writing in English. Reply in English."
    )


def _has_enough_requirements(intent: dict, user_msg_count: int) -> bool:
    """True when we have enough info to surface company/supplier recommendations."""
    if user_msg_count < 2:
        return False  # Always ask at least once before recommending
    filled = sum([
        bool(intent.get("city")),
        bool(intent.get("budget_min")),
        bool(intent.get("plot_size")),
        bool(intent.get("project_type")),
    ])
    return filled >= 2


def _extract_plot_size(text: str) -> str | None:
    m = re.search(r"(\d+)\s*(marla|kanal)", text.lower())
    if m:
        return f"{m.group(1)} {m.group(2)}"
    return None


def _extract_intent(messages: list[dict]) -> dict[str, Any]:
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

    # Project type
    if any(w in combined for w in ["build", "house", "construct", "home", "villa", "bungalow",
                                     "marla", "kanal", "ghar", "makaan", "banwana", "floor", "storey"]):
        intent["project_type"] = "construction"
        intent["needs_company"] = True

    # Material / supplier needs
    mat_kw = ["cement", "steel", "brick", "paint", "tile", "wood", "pipe", "marble",
              "glass", "electrical", "plumbing", "sanitary", "door", "window", "waterproof",
              "sand", "aggregate", "crush", "material", "supply", "supplier"]
    found_mats = [k for k in mat_kw if k in combined]
    if found_mats:
        intent["needs_supplier"] = True
        intent["material_keywords"] = found_mats

    if any(w in combined for w in ["both", "everything", "complete", "dono", "sab"]):
        intent["needs_company"] = True
        intent["needs_supplier"] = True

    if not intent["needs_company"] and not intent["needs_supplier"]:
        intent["needs_company"] = True

    intent["budget_min"], intent["budget_max"] = _parse_budget(combined)
    intent["plot_size"] = _extract_plot_size(combined)

    for city in _PAKISTAN_CITIES:
        if city in combined:
            intent["city"] = city.title()
            break

    for area in _AREA_PATTERNS:
        if area in combined:
            intent["area"] = area.title()
            break

    return intent


# ═══════════════════════════════════════════════════════════════════════════════
#  Scoring / boosting
# ═══════════════════════════════════════════════════════════════════════════════

def _boost_company(c: dict, intent: dict, embed_score: float) -> float:
    score = embed_score * 60.0

    # City match
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

    # Area match
    if intent["area"]:
        area_lower = intent["area"].lower()
        has_area = any(area_lower in (row.get("area", "") + row.get("subarea", "")).lower()
                       for row in c.get("flattened_operational_areas", []))
        if has_area:
            score += 8.0

    # Budget compatibility
    if intent["budget_min"] is not None:
        prices = [r.get("price_per_sqft", 0) for r in c.get("flattened_operational_areas", [])
                  if isinstance(r.get("price_per_sqft"), (int, float))]
        if prices:
            avg = sum(prices) / len(prices)
            est_min = avg * 1000
            est_max = avg * 2000
            if est_min <= (intent["budget_max"] or float("inf")) and est_max >= intent["budget_min"]:
                score += 10.0
            else:
                score -= 8.0

    # Rating & reviews
    fb = c.get("customer_feedback") or {}
    rating = fb.get("average_rating", 0)
    reviews = fb.get("review_count", 0)
    if rating >= 4.5:
        score += 8.0
    elif rating >= 4.0:
        score += 4.0
    if reviews >= 100:
        score += 3.0

    # AI reliability scores
    ai = c.get("ai_scores") or {}
    for k in ["timeline_reliability", "budget_accuracy", "quality_consistency"]:
        v = ai.get(k, 0)
        if isinstance(v, (int, float)):
            score += v * 2.0

    # Verified status
    if c.get("verification_status") == "verified":
        score += 3.0

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

    # Material keyword match
    if intent["material_keywords"]:
        mat_text = " ".join(m.get("name", "") + " " + m.get("category", "") for m in s.get("materials", [])).lower()
        hits = sum(1 for k in intent["material_keywords"] if k in mat_text)
        score += min(hits * 3.0, 12.0)

    if s.get("verification_status") == "verified":
        score += 3.0

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
    intent = _extract_intent(messages)
    query = " ".join(m.get("content", "") for m in messages if m.get("role") == "user")
    results: list[dict] = []

    # Client: both companies and suppliers (user can narrow)
    # Company: only suppliers
    # Supplier/admin: no RAG recommendations (they get market data instead)
    search_companies = user_role in ("client",) and intent["needs_company"]
    search_suppliers = user_role in ("client", "company") and (intent["needs_supplier"] or user_role == "company")

    if search_companies:
        for c, es in _INDEX.search_companies(query, top_k=10):
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
        for s, es in _INDEX.search_suppliers(query, top_k=10):
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

    # Catalog overview
    try:
        all_c = _INDEX.get_all_companies()
        all_s = _INDEX.get_all_suppliers()
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

    # Recommendations
    if recommendations:
        lines.append("\n\n--- RECOMMENDED MATCHES FROM DATABASE ---")
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
        lines.append("\n\nNo specific matches found yet — ask the user for more details.")

    # Market prices (for all roles except landing)
    if user_role != "landing":
        lines.append(get_market_prices_context())

    return "\n".join(lines)


def _build_admin_context() -> str:
    """Build platform analytics context for admin chatbot."""
    lines = ["\n\n--- PLATFORM DATA (LIVE) ---"]
    try:
        users = get_all_users()
        companies = _INDEX.get_all_companies()
        suppliers = _INDEX.get_all_suppliers()

        # User stats
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

        # Company stats
        lines.append(f"\nTotal companies: {len(companies)}")
        top_rated = sorted(companies, key=lambda c: (c.get("customer_feedback") or {}).get("average_rating", 0), reverse=True)[:5]
        if top_rated:
            lines.append("Top 5 companies by rating:")
            for c in top_rated:
                fb = c.get("customer_feedback") or {}
                lines.append(f"  • {c.get('company_name')}: {fb.get('average_rating', 0)}/5 ({fb.get('review_count', 0)} reviews)")

        # Pending approvals
        pending = [c for c in companies if c.get("verification_status") != "verified"]
        lines.append(f"\nPending/unverified companies: {len(pending)}")
        for c in pending[:5]:
            lines.append(f"  • {c.get('company_name')} ({c.get('city', 'N/A')})")

        # Supplier stats
        lines.append(f"\nTotal suppliers: {len(suppliers)}")
        pending_s = [s for s in suppliers if s.get("verification_status") != "verified"]
        lines.append(f"Pending/unverified suppliers: {len(pending_s)}")

        # City distribution
        city_dist: dict[str, int] = {}
        for c in companies:
            for ck in (c.get("operational_areas") or {}).keys():
                city_dist[ck] = city_dist.get(ck, 0) + 1
        if city_dist:
            lines.append("\nCompany distribution by city:")
            for city, cnt in sorted(city_dist.items(), key=lambda x: -x[1])[:10]:
                lines.append(f"  • {city}: {cnt} companies")

        # Recent activity
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
#  OpenRouter LLM call
# ═══════════════════════════════════════════════════════════════════════════════

def _call_openrouter(system_prompt: str, messages: list[dict]) -> str:
    """Call OpenRouter with model-first, key-exhaustion strategy.

    For every model in order:
        Try every API key in order.
        On success → return immediately.
        On retryable error (429, 5xx, timeout) → next key.
        On bad-key error (401, 403) → skip that key for this model, try next key.
    If all keys fail for the current model → move to the next model.
    If all models exhausted → raise RuntimeError.
    """
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
                            "temperature": 0.7,
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
                        logger.info(
                            "LLM success: model=%s key=%d/%d",
                            model, key_idx, len(_API_KEYS),
                        )
                        return content
                    # Empty response — treat as soft failure, try next key
                    logger.warning(
                        "LLM empty response: model=%s key=%d/%d",
                        model, key_idx, len(_API_KEYS),
                    )

                elif resp.status_code in _BAD_KEY_STATUSES:
                    logger.warning(
                        "LLM bad key (HTTP %d): model=%s key=%d/%d — skipping key",
                        resp.status_code, model, key_idx, len(_API_KEYS),
                    )
                    # Key is invalid; no point retrying it on the same model
                    continue

                elif resp.status_code in _RETRYABLE_STATUSES:
                    logger.warning(
                        "LLM retryable error (HTTP %d): model=%s key=%d/%d — next key",
                        resp.status_code, model, key_idx, len(_API_KEYS),
                    )
                    continue

                elif resp.status_code == 404:
                    # Model not found on this endpoint — no point trying other keys
                    logger.warning(
                        "LLM model not found (HTTP 404): model=%s — skipping model",
                        model,
                    )
                    break  # Break inner (key) loop → try next model

                else:
                    logger.warning(
                        "LLM unexpected HTTP %d: model=%s key=%d/%d — next key",
                        resp.status_code, model, key_idx, len(_API_KEYS),
                    )

            except httpx.TimeoutException:
                logger.warning(
                    "LLM timeout: model=%s key=%d/%d — next key",
                    model, key_idx, len(_API_KEYS),
                )
            except Exception as exc:
                logger.warning(
                    "LLM exception: model=%s key=%d/%d — %s",
                    model, key_idx, len(_API_KEYS), exc,
                )

        else:
            # All keys exhausted for this model
            logger.warning("LLM: all keys exhausted for model=%s — trying next model", model)
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

def generate_ai_response(messages: list[dict], *, user_role: str = "client", extra_context: str = "") -> dict:
    """Generate a RAG-grounded LLM response.

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

    # ── Language detection ────────────────────────────────────────────────────
    combined_user = " ".join(m.get("content", "") for m in messages if m.get("role") == "user")
    lang = _detect_language(combined_user)
    lang_directive = _get_language_directive(lang)

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
        # Only show recs after enough requirements gathered
        recs_to_return = top_matches if _has_enough_requirements(intent, user_msg_count) else []
    elif user_role == "company":
        recs_to_return = top_matches  # company users get supplier recs immediately
    else:
        recs_to_return = []

    # ── Build system prompt with context ─────────────────────────────────────
    if user_role == "admin":
        context = _build_admin_context()
    else:
        context = _build_rag_context(top_matches, user_role)

    system_prompt = base_system + lang_directive + context + extra_context

    # ── LLM call ─────────────────────────────────────────────────────────────
    try:
        response_text = _call_openrouter(system_prompt, messages)
    except RuntimeError as e:
        logger.error("LLM failed: %s", e)
        if top_matches and recs_to_return:
            response_text = _build_fallback(top_matches, intent)
        else:
            # Fallback in all three languages
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

    return {
        "response": response_text,
        "recommendations": recs_to_return,
    }


# ═══════════════════════════════════════════════════════════════════════════════
#  Streaming response generator
# ═══════════════════════════════════════════════════════════════════════════════

async def generate_ai_response_stream(messages: list[dict], *, user_role: str = "client", extra_context: str = ""):
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
    combined_user = " ".join(m.get("content", "") for m in messages if m.get("role") == "user")
    lang = _detect_language(combined_user)
    lang_directive = _get_language_directive(lang)

    # RAG retrieval
    top_matches: list[dict] = []
    intent: dict = {}
    if user_role in ("client", "company"):
        try:
            data = get_recommendations(messages, user_role)
            top_matches = data.get("recommendations", [])
            intent = data.get("intent", {})
        except Exception as e:
            logger.warning("RAG retrieval failed: %s", e)

    user_msg_count = sum(1 for m in messages if m.get("role") == "user")
    if user_role == "client":
        recs_to_return = top_matches if _has_enough_requirements(intent, user_msg_count) else []
    elif user_role == "company":
        recs_to_return = top_matches
    else:
        recs_to_return = []

    # Send recommendations first
    yield {"type": "recommendations", "recommendations": recs_to_return}

    # Build system prompt with context
    if user_role == "admin":
        context = _build_admin_context()
    else:
        context = _build_rag_context(top_matches, user_role)

    system_prompt = base_system + lang_directive + context + extra_context

    # Try streaming from OpenRouter
    if not _API_KEYS or not _MODELS:
        yield {"type": "error", "content": "No API keys configured."}
        yield {"type": "done"}
        return

    payload_messages = [{"role": "system", "content": system_prompt}] + messages
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
                            "temperature": 0.7,
                            "stream": True,
                        },
                    ) as resp:
                        if resp.status_code != 200:
                            if resp.status_code in _BAD_KEY_STATUSES:
                                continue
                            if resp.status_code in _RETRYABLE_STATUSES:
                                continue
                            if resp.status_code == 404:
                                break  # skip model
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
        # Fallback to non-streaming
        try:
            response_text = _call_openrouter(system_prompt, messages)
            yield {"type": "token", "content": response_text}
        except RuntimeError:
            if top_matches and recs_to_return:
                yield {"type": "token", "content": _build_fallback(top_matches, intent)}
            else:
                yield {"type": "error", "content": "I'm having trouble connecting right now. Please try again! 🙏"}

    yield {"type": "done"}
