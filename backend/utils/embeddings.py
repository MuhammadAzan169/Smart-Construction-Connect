"""Embeddings pipeline — delegates to the unified HybridSemanticIndex.

All public functions (initialize_embeddings, update_entity_embedding,
semantic_search, get_index_stats) now forward to semantic_embeddings.py so
that CRUD operations (companies.py, suppliers.py, auth.py, events.py) and
the AI chat (rag_engine.py) always share the same up-to-date index.

The old TF-IDF implementation is retained below (but unused) for reference.
"""

from __future__ import annotations
import logging
import math
import re
from collections import Counter
from typing import Any

from backend.utils.data_handler import read_json, companies_dataset_path, suppliers_dataset_path

logger = logging.getLogger(__name__)

# ── Thin shim: keep the old variable names so nothing breaks ──
_INDEX: dict[str, dict] = {}
_IDF: dict[str, float] = {}
_VOCAB: list[str] = []
_INITIALIZED = False


# ── Text extraction helpers ──

def _company_to_text(c: dict) -> str:
    """Convert a company record to searchable text."""
    parts = [
        c.get("company_name", ""),
        c.get("description", "") or "",
        c.get("city", "") or "",
    ]
    # Services
    services = c.get("services", {})
    if isinstance(services, dict):
        for k, v in services.items():
            parts.append(k.replace("_", " "))
            if isinstance(v, list):
                parts.extend(str(i) for i in v)
            elif isinstance(v, str):
                parts.append(v)

    # Specializations
    exp = c.get("experience", {})
    if isinstance(exp, dict):
        specs = exp.get("specializations", [])
        if isinstance(specs, list):
            parts.extend(specs)

    # Operational areas
    flat = c.get("flattened_operational_areas", [])
    if isinstance(flat, list):
        for area in flat:
            if isinstance(area, dict):
                parts.append(area.get("city", ""))
                parts.append(area.get("area", ""))
                parts.append(area.get("subarea", ""))

    # Construction capability
    cap = c.get("construction_capability", {})
    if isinstance(cap, dict):
        for k, v in cap.items():
            parts.append(k.replace("_", " "))
            if isinstance(v, list):
                parts.extend(str(i) for i in v)

    # Materials
    mats = c.get("materials_used", {})
    if isinstance(mats, dict):
        for pkg, mat_dict in mats.items():
            if isinstance(mat_dict, dict):
                parts.extend(mat_dict.values())

    return " ".join(str(p) for p in parts if p).lower()


def _supplier_to_text(s: dict) -> str:
    """Convert a supplier record to searchable text."""
    parts = [
        s.get("supplier_name", ""),
        s.get("description", "") or "",
        s.get("city", "") or "",
        s.get("area", "") or "",
    ]
    for city in s.get("cities_served", []):
        parts.append(city)

    for mat in s.get("materials", []):
        if isinstance(mat, dict):
            parts.append(mat.get("name", ""))
            parts.append(mat.get("category", ""))
            parts.append(mat.get("brand", ""))
            parts.append(mat.get("description", "") or "")

    return " ".join(str(p) for p in parts if p).lower()


# ── Tokenizer ──

_STOPWORDS = frozenset([
    "the", "a", "an", "and", "or", "but", "in", "on", "at", "to", "for",
    "of", "with", "by", "is", "are", "was", "were", "be", "been", "being",
    "have", "has", "had", "do", "does", "did", "will", "would", "should",
    "can", "could", "may", "might", "must", "shall", "not", "no", "this",
    "that", "these", "those", "it", "its", "from", "as", "if", "they",
])


def _tokenize(text: str) -> list[str]:
    words = re.findall(r"[a-z0-9]+", text.lower())
    return [w for w in words if w not in _STOPWORDS and len(w) > 1]


# ── TF-IDF vectorizer ──

def _build_idf(documents: list[list[str]]) -> tuple[dict[str, float], list[str]]:
    """Build IDF values from tokenized documents."""
    n = len(documents)
    df: Counter = Counter()
    for doc in documents:
        unique = set(doc)
        for word in unique:
            df[word] += 1

    # Take top 2000 terms by document frequency
    top_terms = [w for w, _ in df.most_common(2000)]
    idf = {}
    for term in top_terms:
        idf[term] = math.log((n + 1) / (df[term] + 1)) + 1

    return idf, top_terms


def _vectorize(tokens: list[str], idf: dict[str, float], vocab: list[str]) -> list[float]:
    """Create TF-IDF vector for a document."""
    tf = Counter(tokens)
    total = len(tokens) or 1
    vec = []
    for term in vocab:
        tf_val = tf.get(term, 0) / total
        idf_val = idf.get(term, 0)
        vec.append(tf_val * idf_val)
    return vec


def _cosine_sim(a: list[float], b: list[float]) -> float:
    """Cosine similarity between two vectors."""
    dot = sum(x * y for x, y in zip(a, b))
    na = math.sqrt(sum(x * x for x in a)) or 1
    nb = math.sqrt(sum(x * x for x in b)) or 1
    return dot / (na * nb)


# ═══════════════════════════════════════════════════════════════════════════════
#  Public API — all calls forward to the unified HybridSemanticIndex so that
#  CRUD routes (companies/suppliers/auth) and the AI chat share one index.
# ═══════════════════════════════════════════════════════════════════════════════

def initialize_embeddings() -> int:
    """Build / refresh the hybrid semantic index.  Returns total entity count."""
    from backend.utils.semantic_embeddings import semantic_index
    global _INITIALIZED
    semantic_index.build(force=True)
    _INITIALIZED = True
    stats = semantic_index.get_stats()
    logger.info("Semantic index ready: %d entities, mode=%s", stats["total_entities"], stats["mode"])
    return stats["total_entities"]


def update_entity_embedding(entity_id: str, entity_type: str = "company") -> bool:
    """Incrementally rebuild the index so the new/updated entity is live immediately.

    Because HybridSemanticIndex re-reads the JSON files atomically we simply
    trigger a full rebuild (it is fast: <0.5 s for hundreds of entities).
    """
    from backend.utils.semantic_embeddings import semantic_index
    from backend.utils.response_cache import response_cache
    try:
        semantic_index.build(force=True)
        response_cache.invalidate()  # flush stale AI responses
        _INITIALIZED  # keep old global in sync
        logger.info("Index refreshed after %s update: %s", entity_type, entity_id)
        return True
    except Exception as exc:
        logger.error("Failed to refresh index for %s %s: %s", entity_type, entity_id, exc)
        return False


def semantic_search(query: str, top_k: int = 10, entity_type: str | None = None) -> list[dict]:
    """Search the hybrid index.  Delegates to HybridSemanticIndex.search()."""
    from backend.utils.semantic_embeddings import semantic_index
    results = semantic_index.search(query, top_k=top_k, entity_type=entity_type)
    return [
        {
            "id": r["data"].get("company_id") or r["data"].get("supplier_id", ""),
            "score": round(r["score"] * 100, 1),
            "type": r["type"],
            "name": r["data"].get("company_name") or r["data"].get("supplier_name", ""),
            "city": r["data"].get("city", ""),
            "rating": (r["data"].get("customer_feedback") or {}).get("average_rating", 0)
                      if r["type"] == "company" else r["data"].get("rating", 0),
            "slug": r["data"].get("slug", ""),
        }
        for r in results
    ]


def get_index_stats() -> dict:
    """Return stats about the current semantic index."""
    from backend.utils.semantic_embeddings import semantic_index
    return semantic_index.get_stats()
