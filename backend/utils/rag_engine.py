"""RAG-style recommendation engine — matches clients to companies/suppliers
and uses OpenRouter LLM for natural language responses.

Retrieval uses TF-IDF cosine similarity over text documents built from the
real companies.json and catalog.json datasets, so every live company and
supplier is searchable without any external vector database.
"""

from __future__ import annotations

import logging
import math
import os
import re
import threading
from collections import Counter
from typing import Any

import httpx
from dotenv import load_dotenv

from backend.utils.data_handler import (
    read_json,
    companies_dataset_path,
    suppliers_dataset_path,
)

load_dotenv()

logger = logging.getLogger(__name__)

# ── OpenRouter configuration ──────────────────────────────────────────────────

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
    # Sensible fallback if env not yet loaded
    return models or [
        "openai/gpt-oss-20b:free",
        "nvidia/nemotron-3-super-120b-a12b:free",
        "stepfun/step-3.5-flash:free",
        "minimax/minimax-m2.5:free",
    ]

_OPENROUTER_BASE  = os.getenv("OPENROUTER_BASE_URL", "https://openrouter.ai/api/v1")
_API_KEYS         = _load_api_keys()
_MODELS           = _load_models()

# Thread-safe key rotation
_key_lock  = threading.Lock()
_key_index = 0

def _next_key() -> str | None:
    global _key_index
    if not _API_KEYS:
        return None
    with _key_lock:
        key = _API_KEYS[_key_index % len(_API_KEYS)]
        _key_index = (_key_index + 1) % len(_API_KEYS)
    return key

# ── Role-based system prompts ─────────────────────────────────────────────────

_SYSTEM_PROMPTS: dict[str, str] = {
    "client": (
        "You are an advanced AI Construction Assistant for clients on the Smart Construction Connect platform.\n"
        "Core responsibilities:\n"
        "- Extract structured construction requirements (plot size, location, floors, basement, construction type, budget, timeline, features).\n"
        "- Recommend the best construction companies and material suppliers from the database based on rating, price competitiveness, availability, and relevance.\n"
        "- Provide estimated cost breakdowns and construction workflow suggestions.\n"
        "- Educate users on construction processes and materials when asked.\n"
        "Rules:\n"
        "- Only reference companies and suppliers that appear in the RECOMMENDED MATCHES section below. Never hallucinate company or supplier details.\n"
        "- If the user has uploaded a file (floor plan, BOQ, contract, etc.), analyze its content and incorporate it into your recommendations.\n"
        "- Ask follow-up questions when data is incomplete.\n"
        "- Keep answers professional, concise, and structured with bullet points.\n"
        "- Respond in the same language the user writes in."
    ),
    "company": (
        "You are an AI assistant for construction companies on the Smart Construction Connect platform.\n"
        "Help companies:\n"
        "- Optimize pricing and project quotes.\n"
        "- Suggest material usage and alternatives.\n"
        "- Improve project planning and timelines.\n"
        "- Analyze competitors and market positioning.\n"
        "- If a file is uploaded (project plan, BOQ, schedule), analyze it and provide actionable insights.\n"
        "Keep answers data-driven and professional."
    ),
    "supplier": (
        "You are an AI assistant for material suppliers on the Smart Construction Connect platform.\n"
        "Help suppliers:\n"
        "- Recommend pricing strategies based on market data.\n"
        "- Identify demand trends and seasonal patterns.\n"
        "- Suggest stock improvements and new product opportunities.\n"
        "- If a file is uploaded (inventory list, price sheet), analyze it and provide suggestions.\n"
        "Keep answers data-driven and professional."
    ),
    "admin": (
        "You are an AI assistant for platform administrators of Smart Construction Connect.\n"
        "Help admins:\n"
        "- Monitor platform activity and user engagement.\n"
        "- Detect top-performing companies and suppliers.\n"
        "- Analyze supply-demand gaps across cities.\n"
        "- If a file is uploaded (report, export), analyze it and summarize key metrics.\n"
        "Keep answers data-driven and professional."
    ),
}

DEFAULT_SYSTEM_PROMPT = _SYSTEM_PROMPTS["client"]


# ── TF-IDF Embedding Engine ───────────────────────────────────────────────────
# Builds lightweight text documents from the real JSON datasets and retrieves
# the best matches via cosine similarity — no external vector DB required.

def _tokenize(text: str) -> list[str]:
    """Lowercase, remove punctuation, split on whitespace."""
    return re.findall(r"[a-z0-9]+", text.lower())


def _build_tfidf(docs: list[list[str]]) -> tuple[dict[str, float], list[dict[str, float]]]:
    """
    Compute IDF weights and per-doc TF vectors.
    Returns (idf_dict, tf_vecs) where tf_vecs[i] is a {term: tf_weight} dict.
    """
    N = len(docs)
    df: Counter = Counter()
    for tokens in docs:
        df.update(set(tokens))

    idf: dict[str, float] = {
        term: math.log((N + 1) / (count + 1)) + 1.0
        for term, count in df.items()
    }

    tf_vecs: list[dict[str, float]] = []
    for tokens in docs:
        if not tokens:
            tf_vecs.append({})
            continue
        freq = Counter(tokens)
        max_freq = max(freq.values())
        tf_vecs.append({
            term: (count / max_freq) * idf.get(term, 1.0)
            for term, count in freq.items()
        })
    return idf, tf_vecs


def _cosine(vec_a: dict[str, float], vec_b: dict[str, float]) -> float:
    """Cosine similarity between two TF-IDF sparse vectors."""
    if not vec_a or not vec_b:
        return 0.0
    dot = sum(vec_a.get(t, 0.0) * v for t, v in vec_b.items())
    norm_a = math.sqrt(sum(v * v for v in vec_a.values()))
    norm_b = math.sqrt(sum(v * v for v in vec_b.values()))
    if norm_a == 0 or norm_b == 0:
        return 0.0
    return dot / (norm_a * norm_b)


# ── In-memory embedding index (built once at startup, refreshed on change) ───

class _EmbeddingIndex:
    """Thread-safe in-memory TF-IDF index for companies and suppliers."""

    def __init__(self):
        self._lock = threading.Lock()
        self._companies: list[dict] = []
        self._suppliers: list[dict] = []
        self._company_vecs: list[dict[str, float]] = []
        self._supplier_vecs: list[dict[str, float]] = []
        self._idf: dict[str, float] = {}
        self._built = False

    def _company_document(self, c: dict) -> str:
        """Build a rich text document for one company."""
        parts: list[str] = []
        parts.append(c.get("company_name", ""))
        parts.append(c.get("description") or "")
        parts.append(c.get("city", ""))

        # Operational areas
        for row in c.get("flattened_operational_areas", []):
            parts.extend([
                row.get("city", ""),
                row.get("area", ""),
                row.get("subarea", ""),
                row.get("package", ""),
            ])
        for city_key in (c.get("operational_areas") or {}).keys():
            parts.append(city_key)

        # Specializations
        for sp in (c.get("experience") or {}).get("specializations", []):
            parts.append(sp)

        # Services
        for svc_key in (c.get("services") or {}).keys():
            parts.append(svc_key)

        # Materials used
        for pkg_mats in (c.get("materials_used") or {}).values():
            if isinstance(pkg_mats, dict):
                parts.extend(pkg_mats.values())

        # Legal / registration info
        legal = c.get("legal_info") or {}
        if legal.get("year_established"):
            parts.append(str(legal["year_established"]))

        return " ".join(str(p) for p in parts if p)

    def _supplier_document(self, s: dict) -> str:
        """Build a rich text document for one supplier."""
        parts: list[str] = []
        parts.append(s.get("supplier_name", ""))
        parts.append(s.get("description") or "")
        parts.append(s.get("city", ""))
        parts.append(s.get("area", ""))
        parts.extend(s.get("cities_served", []))
        for mat in s.get("materials", []):
            parts.extend([
                mat.get("name", ""),
                mat.get("category", ""),
                mat.get("brand", ""),
                mat.get("description", ""),
            ])
        return " ".join(str(p) for p in parts if p)

    def build(self):
        """(Re)build the TF-IDF index from the JSON datasets."""
        companies = read_json(companies_dataset_path())
        suppliers = read_json(suppliers_dataset_path())

        if not isinstance(companies, list):
            companies = []
        if not isinstance(suppliers, list):
            suppliers = []

        companies = [c for c in companies if isinstance(c, dict) and c.get("company_id")]
        suppliers = [s for s in suppliers if isinstance(s, dict) and s.get("supplier_id")]

        company_docs = [_tokenize(self._company_document(c)) for c in companies]
        supplier_docs = [_tokenize(self._supplier_document(s)) for s in suppliers]

        all_docs = company_docs + supplier_docs
        idf, all_vecs = _build_tfidf(all_docs)

        with self._lock:
            self._companies = companies
            self._suppliers = suppliers
            self._idf = idf
            self._company_vecs = all_vecs[: len(company_docs)]
            self._supplier_vecs = all_vecs[len(company_docs) :]
            self._built = True

        logger.info(
            "Embedding index built: %d companies, %d suppliers, %d unique terms",
            len(companies), len(suppliers), len(idf),
        )

    def _query_vec(self, query_tokens: list[str]) -> dict[str, float]:
        """Build a TF-IDF vector for a query using the corpus IDF weights."""
        if not query_tokens:
            return {}
        freq = Counter(query_tokens)
        max_freq = max(freq.values())
        return {
            term: (count / max_freq) * self._idf.get(term, 1.0)
            for term, count in freq.items()
        }

    def search_companies(self, query: str, top_k: int = 5) -> list[tuple[dict, float]]:
        if not self._built:
            self.build()
        qvec = self._query_vec(_tokenize(query))
        with self._lock:
            scored = [
                (c, _cosine(qvec, vec))
                for c, vec in zip(self._companies, self._company_vecs)
            ]
        scored.sort(key=lambda x: x[1], reverse=True)
        return scored[:top_k]

    def search_suppliers(self, query: str, top_k: int = 5) -> list[tuple[dict, float]]:
        if not self._built:
            self.build()
        qvec = self._query_vec(_tokenize(query))
        with self._lock:
            scored = [
                (s, _cosine(qvec, vec))
                for s, vec in zip(self._suppliers, self._supplier_vecs)
            ]
        scored.sort(key=lambda x: x[1], reverse=True)
        return scored[:top_k]

    def get_all_companies(self) -> list[dict]:
        if not self._built:
            self.build()
        with self._lock:
            return list(self._companies)

    def get_all_suppliers(self) -> list[dict]:
        if not self._built:
            self.build()
        with self._lock:
            return list(self._suppliers)


# Module-level singleton — built once when the server starts
_INDEX = _EmbeddingIndex()


def rebuild_index():
    """Call this if the JSON datasets change at runtime."""
    _INDEX.build()


# ── Intent extraction (used as a query boost signal) ─────────────────────────

def _parse_budget(text: str) -> tuple[float | None, float | None]:
    """Extract numeric budget range from text like '8M-12M' or '8000000'."""
    text = text.lower().replace(",", "").replace("pkr", "").strip()
    nums: list[float] = []
    for match in re.finditer(r"(\d+(?:\.\d+)?)\s*(m|million|k|thousand|lakh|lac|l|crore|cr)?", text):
        val = float(match.group(1))
        unit = (match.group(2) or "").strip()
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


def _extract_intent(messages: list[dict]) -> dict:
    """Extract structured intent from conversation messages."""
    combined = " ".join(m.get("content", "") for m in messages if m.get("role") == "user").lower()

    intent: dict[str, Any] = {
        "project_type": None,
        "budget_min": None,
        "budget_max": None,
        "city": None,
        "area": None,
        "needs_company": False,
        "needs_supplier": False,
        "material_keywords": [],
        "keywords": [],
    }

    # Project type
    if any(w in combined for w in ["build", "house", "construct", "home", "villa", "bungalow", "marla", "kanal"]):
        intent["project_type"] = "construction"
        intent["needs_company"] = True
    if any(w in combined for w in ["material", "supply", "cement", "steel", "brick", "paint", "tile", "wood", "pipe", "marble"]):
        intent["needs_supplier"] = True
        mat_keywords = ["cement", "steel", "brick", "paint", "tile", "wood", "pipe", "marble",
                        "glass", "electrical", "plumbing", "sanitary", "door", "window", "waterproof"]
        intent["material_keywords"] = [k for k in mat_keywords if k in combined]
    if any(w in combined for w in ["both", "everything", "complete"]):
        intent["needs_company"] = True
        intent["needs_supplier"] = True

    if not intent["needs_company"] and not intent["needs_supplier"]:
        intent["needs_company"] = True  # default

    # Budget
    budget_min, budget_max = _parse_budget(combined)
    intent["budget_min"] = budget_min
    intent["budget_max"] = budget_max

    # City
    pakistan_cities = [
        "karachi", "lahore", "islamabad", "rawalpindi", "faisalabad",
        "multan", "peshawar", "quetta", "hyderabad", "sialkot",
        "gujranwala", "bahawalpur", "sahiwal", "mardan", "abbottabad",
        "sukkur", "nawabshah",
    ]
    for city in pakistan_cities:
        if city in combined:
            intent["city"] = city.title()
            break

    # Area/society
    area_patterns = [
        "dha", "bahria", "gulberg", "model town", "cantt", "wapda town",
        "lake city", "johar town", "garden town", "askari", "defence",
        "satellite town", "hayatabad", "university town",
    ]
    for area in area_patterns:
        if area in combined:
            intent["area"] = area.title()
            break

    return intent


def _boost_company(company: dict, intent: dict, embed_score: float) -> float:
    """
    Combine TF-IDF cosine score with structural signals (city match, budget,
    rating, experience) to produce a final 0-100 relevance score.
    """
    # Base from TF-IDF (0-1 → 0-60 points)
    score = embed_score * 60.0

    # Exact city match boost
    company_cities: set[str] = set()
    for row in company.get("flattened_operational_areas", []):
        if row.get("city"):
            company_cities.add(row["city"].lower())
    for c_key in (company.get("operational_areas") or {}).keys():
        company_cities.add(c_key.lower())

    if intent["city"] and intent["city"].lower() in company_cities:
        score += 20.0
    elif intent["city"] and not company_cities:
        pass  # no location data, don't penalise
    elif intent["city"]:
        score -= 10.0

    # Budget compatibility (rough: avg_price/sqft × 1000–2000 sqft)
    if intent["budget_min"] is not None:
        prices = [
            r.get("price_per_sqft", 0)
            for r in company.get("flattened_operational_areas", [])
            if isinstance(r.get("price_per_sqft"), (int, float))
        ]
        if prices:
            avg_price = sum(prices) / len(prices)
            est_min = avg_price * 1000
            est_max = avg_price * 2000
            if est_min <= (intent["budget_max"] or float("inf")) and est_max >= intent["budget_min"]:
                score += 10.0
            else:
                score -= 8.0

    # Rating
    rating = (company.get("customer_feedback") or {}).get("average_rating", 0)
    if rating >= 4.5:
        score += 8.0
    elif rating >= 4.0:
        score += 4.0

    # AI reliability scores
    ai = company.get("ai_scores") or {}
    for key in ["timeline_reliability", "budget_accuracy", "quality_consistency"]:
        val = ai.get(key, 0)
        if isinstance(val, (int, float)):
            score += val * 2.0  # 0-1 → 0-2 each

    return max(0.0, min(100.0, score))


def _boost_supplier(supplier: dict, intent: dict, embed_score: float) -> float:
    """
    Combine TF-IDF cosine score with city match and rating signals.
    """
    score = embed_score * 60.0

    cities_served = [c.lower() for c in supplier.get("cities_served", [])]
    if intent["city"] and intent["city"].lower() in cities_served:
        score += 20.0
    elif intent["city"] and cities_served:
        score -= 10.0

    rating = supplier.get("rating", 0)
    if rating >= 4.5:
        score += 8.0
    elif rating >= 4.0:
        score += 4.0

    # More material variety = more useful
    mat_count = len(supplier.get("materials", []))
    if mat_count >= 6:
        score += 4.0
    elif mat_count >= 3:
        score += 2.0

    return max(0.0, min(100.0, score))



def get_recommendations(messages: list[dict]) -> dict:
    """
    Return top recommendations using TF-IDF embedding similarity +
    structural boosting signals (city, budget, rating).
    """
    intent = _extract_intent(messages)
    query = " ".join(m.get("content", "") for m in messages if m.get("role") == "user")

    results: list[dict] = []

    if intent["needs_company"]:
        candidates = _INDEX.search_companies(query, top_k=10)
        for c, embed_score in candidates:
            sc = _boost_company(c, intent, embed_score)
            results.append({
                "type": "company",
                "id": c["company_id"],
                "name": c.get("company_name", "Unknown"),
                "score": round(sc),
                "location": ", ".join(list((c.get("operational_areas") or {}).keys())[:2]) or "Pakistan",
                "rating": (c.get("customer_feedback") or {}).get("average_rating", 0),
                "reviews": (c.get("customer_feedback") or {}).get("review_count", 0),
                "specializations": (c.get("experience") or {}).get("specializations", [])[:3],
                "price_range": _get_company_price_range(c),
                "completed_projects": (c.get("experience") or {}).get("houses_completed", 0),
            })

    if intent["needs_supplier"]:
        candidates = _INDEX.search_suppliers(query, top_k=10)
        for s, embed_score in candidates:
            sc = _boost_supplier(s, intent, embed_score)
            categories = list(set(m.get("category", "") for m in s.get("materials", [])))
            results.append({
                "type": "supplier",
                "id": s["supplier_id"],
                "name": s.get("supplier_name", "Unknown"),
                "score": round(sc),
                "location": s.get("city") or (s.get("location") or {}).get("city", "Pakistan"),
                "rating": s.get("rating", 0),
                "reviews": s.get("review_count", 0),
                "categories": [c for c in categories if c][:5],
                "materials_count": len(s.get("materials", [])),
            })

    results.sort(key=lambda x: x["score"], reverse=True)
    top = results[:3]

    response_text = _build_response_text(top, intent)
    return {"intent": intent, "recommendations": top, "response": response_text}


def _get_company_price_range(company: dict) -> str:
    flat = company.get("flattened_operational_areas", [])
    prices = [r.get("price_per_sqft", 0) for r in flat if isinstance(r.get("price_per_sqft"), (int, float)) and r.get("price_per_sqft", 0) > 0]
    if not prices:
        return "Contact for pricing"
    mn, mx = min(prices), max(prices)
    fmt = lambda n: f"{n:,.0f}"
    return f"{fmt(mn)} - {fmt(mx)} PKR/sq ft"


def _build_response_text(recommendations: list[dict], intent: dict) -> str:
    if not recommendations:
        return "I couldn't find matches based on your criteria. Could you provide more details about your project requirements, preferred city, or budget range?"

    parts = ["Based on your requirements, here are my top recommendations:\n"]

    for i, rec in enumerate(recommendations, 1):
        if rec["type"] == "company":
            parts.append(f"**{i}. {rec['name']}** (Construction Company)")
            parts.append(f"   📍 {rec['location']} | ⭐ {rec['rating']}/5 ({rec['reviews']} reviews)")
            parts.append(f"   💰 {rec['price_range']}")
            if rec.get("specializations"):
                parts.append(f"   🔧 {', '.join(rec['specializations'])}")
            parts.append(f"   Match Score: {rec['score']}%\n")
        else:
            parts.append(f"**{i}. {rec['name']}** (Material Supplier)")
            parts.append(f"   📍 {rec['location']} | ⭐ {rec['rating']}/5 ({rec['reviews']} reviews)")
            if rec.get("categories"):
                parts.append(f"   📦 {', '.join(rec['categories'])}")
            parts.append(f"   Match Score: {rec['score']}%\n")

    parts.append("Would you like more details about any of these, or would you like to refine your search?")
    return "\n".join(parts)


# ── OpenRouter LLM call ───────────────────────────────────────────────────────

def _call_openrouter(system_prompt: str, messages: list[dict]) -> str:
    """Call OpenRouter with key + model rotation. Raises RuntimeError if all fail."""
    if not _API_KEYS:
        raise RuntimeError("No OpenRouter API keys configured in .env")

    payload_messages = [{"role": "system", "content": system_prompt}] + messages

    tried_keys: set[int] = set()
    attempts_total = len(_API_KEYS) * len(_MODELS)

    for _ in range(attempts_total):
        key = _next_key()
        if not key:
            break

        for model in _MODELS:
            payload = {
                "model": model,
                "messages": payload_messages,
                "max_tokens": 1024,
                "temperature": 0.7,
            }
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
                        json=payload,
                    )

                if resp.status_code == 200:
                    data = resp.json()
                    content = (
                        data.get("choices", [{}])[0]
                        .get("message", {})
                        .get("content", "")
                        .strip()
                    )
                    if content:
                        logger.info("OpenRouter success with model=%s", model)
                        return content

                elif resp.status_code in (401, 403):
                    # Bad key — skip to next key, don't retry this model
                    logger.warning("OpenRouter auth error (key rotated): %s", resp.status_code)
                    break

                elif resp.status_code == 429:
                    # Rate limited on this key — skip to next key
                    logger.warning("OpenRouter rate limited (key rotated): %s", model)
                    break

                else:
                    logger.warning("OpenRouter error %s for model=%s", resp.status_code, model)

            except httpx.TimeoutException:
                logger.warning("OpenRouter timeout for model=%s", model)
            except Exception as e:
                logger.warning("OpenRouter request failed for model=%s: %s", model, e)

    raise RuntimeError("All OpenRouter API keys and models exhausted without a successful response.")


def _build_rag_context(recommendations: list[dict]) -> str:
    """
    Format top recommendations + a brief catalog overview as grounding context
    injected into the system prompt.
    """
    lines: list[str] = []

    # --- Full catalog overview so the LLM knows what exists ------------------
    try:
        all_companies = _INDEX.get_all_companies()
        all_suppliers = _INDEX.get_all_suppliers()

        if all_companies:
            cities_set: set[str] = set()
            for c in all_companies:
                for row in c.get("flattened_operational_areas", []):
                    if row.get("city"):
                        cities_set.add(row["city"])
                for ck in (c.get("operational_areas") or {}).keys():
                    cities_set.add(ck)

            lines.append(
                f"\n\n--- PLATFORM CATALOG OVERVIEW ---\n"
                f"Total construction companies available: {len(all_companies)}\n"
                f"Total material suppliers available: {len(all_suppliers)}\n"
                f"Cities covered: {', '.join(sorted(cities_set)[:20])}"
            )
    except Exception:
        pass

    # --- Top matched records -------------------------------------------------
    if not recommendations:
        lines.append("\n\nNo specific matches found for this query yet. Ask the user for more details.")
        lines.append("--- END OF DATABASE CONTEXT ---")
        lines.append("Only reference real companies and suppliers shown above. Do not invent others.")
        return "\n".join(lines)

    lines.append("\n\n--- TOP RECOMMENDED MATCHES FROM DATABASE ---")
    for i, rec in enumerate(recommendations, 1):
        if rec["type"] == "company":
            lines.append(
                f"{i}. {rec['name']} (Construction Company) | "
                f"Location: {rec['location']} | Rating: {rec['rating']}/5 ({rec['reviews']} reviews) | "
                f"Price: {rec['price_range']} | Completed: {rec['completed_projects']} projects | "
                f"Specializations: {', '.join(rec.get('specializations', []))} | "
                f"Match Score: {rec['score']}%"
            )
        else:
            lines.append(
                f"{i}. {rec['name']} (Material Supplier) | "
                f"Location: {rec['location']} | Rating: {rec['rating']}/5 ({rec['reviews']} reviews) | "
                f"Categories: {', '.join(rec.get('categories', []))} | "
                f"Materials: {rec.get('materials_count', 0)} items | "
                f"Match Score: {rec['score']}%"
            )
    lines.append("--- END OF DATABASE CONTEXT ---")
    lines.append("Use ONLY the above data when recommending companies or suppliers. Do not invent others.")
    return "\n".join(lines)


def generate_ai_response(messages: list[dict], *, user_role: str = "client") -> dict:
    """Generate an LLM-powered conversational response with RAG context injected.

    Flow:
    1. Run the scoring/retrieval pipeline to get top recommendations.
    2. Inject those matches into the system prompt as grounding context.
    3. Call OpenRouter LLM with the full conversation history.
    4. Return the LLM response text plus the structured recommendations.
    """
    base_system = _SYSTEM_PROMPTS.get(user_role, DEFAULT_SYSTEM_PROMPT)

    if not messages:
        return {
            "response": (
                "Hello! I'm your Smart Construction Connect AI assistant. "
                "I can help you find the perfect construction company or material supplier in Pakistan. "
                "You can also upload files (floor plans, BOQs, contracts) for me to analyze. "
                "Tell me about your project — what are you looking to build, your budget range, and preferred city?"
            ),
            "recommendations": [],
        }

    # --- RAG retrieval --------------------------------------------------------
    top_matches: list[dict] = []
    try:
        recs_data = get_recommendations(messages)
        top_matches = recs_data.get("recommendations", [])
    except Exception as e:
        logger.warning("RAG retrieval failed: %s", e)

    # Build grounded system prompt
    rag_context = _build_rag_context(top_matches)
    system_prompt = base_system + rag_context

    # --- LLM call -------------------------------------------------------------
    try:
        response_text = _call_openrouter(system_prompt, messages)
    except RuntimeError as e:
        logger.error("LLM call failed: %s", e)
        # Graceful degradation: return the rule-based response
        if top_matches:
            response_text = _build_response_text(top_matches, _extract_intent(messages))
        else:
            response_text = (
                "I'm having trouble connecting to the AI service right now. "
                "Please try again in a moment, or describe your project and I'll do my best to help!"
            )

    return {
        "response": response_text,
        "recommendations": top_matches,
    }

