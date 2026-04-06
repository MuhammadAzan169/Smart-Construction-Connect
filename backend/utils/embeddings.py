"""Lightweight embeddings pipeline for semantic search.

Uses TF-IDF vectors stored in-memory for fast similarity search.
No external ML dependencies required — works with pure Python + stdlib.

When a company/supplier is created or updated, call `update_entity_embedding()`
to refresh the search index.
"""

from __future__ import annotations
import json
import logging
import math
import re
from collections import Counter
from pathlib import Path
from typing import Any

from backend.utils.data_handler import read_json, companies_dataset_path, suppliers_dataset_path

logger = logging.getLogger(__name__)

# ── In-memory index ──
_INDEX: dict[str, dict] = {}  # entity_id -> {text, vector, meta}
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


# ── Public API ──

def initialize_embeddings() -> int:
    """Build the full search index from all companies and suppliers."""
    global _INDEX, _IDF, _VOCAB, _INITIALIZED

    companies = read_json(companies_dataset_path())
    suppliers = read_json(suppliers_dataset_path())

    documents: list[tuple[str, str, list[str], dict]] = []  # (id, type, tokens, meta)

    if isinstance(companies, list):
        for c in companies:
            if not isinstance(c, dict) or not c.get("company_id"):
                continue
            text = _company_to_text(c)
            tokens = _tokenize(text)
            meta = {
                "type": "company",
                "name": c.get("company_name", ""),
                "city": c.get("city", ""),
                "rating": c.get("rating", 0),
                "slug": c.get("slug", ""),
            }
            documents.append((c["company_id"], "company", tokens, meta))

    if isinstance(suppliers, list):
        for s in suppliers:
            if not isinstance(s, dict) or not s.get("supplier_id"):
                continue
            text = _supplier_to_text(s)
            tokens = _tokenize(text)
            meta = {
                "type": "supplier",
                "name": s.get("supplier_name", ""),
                "city": s.get("city", ""),
                "rating": s.get("rating", 0),
                "slug": s.get("slug", ""),
            }
            documents.append((s["supplier_id"], "supplier", tokens, meta))

    if not documents:
        _INITIALIZED = True
        return 0

    # Build IDF
    all_tokens = [d[2] for d in documents]
    _IDF, _VOCAB = _build_idf(all_tokens)

    # Vectorize all documents
    _INDEX = {}
    for eid, etype, tokens, meta in documents:
        vec = _vectorize(tokens, _IDF, _VOCAB)
        _INDEX[eid] = {"vector": vec, "tokens": tokens, "meta": meta}

    _INITIALIZED = True
    logger.info(f"Embeddings initialized: {len(_INDEX)} entities, {len(_VOCAB)} terms")
    return len(_INDEX)


def update_entity_embedding(entity_id: str, entity_type: str = "company") -> bool:
    """Update or add a single entity's embedding in the index."""
    global _INITIALIZED
    if not _INITIALIZED:
        initialize_embeddings()
        return True

    if entity_type == "company":
        companies = read_json(companies_dataset_path())
        entity = None
        if isinstance(companies, list):
            for c in companies:
                if c.get("company_id") == entity_id or c.get("slug") == entity_id:
                    entity = c
                    break
        if not entity:
            return False
        text = _company_to_text(entity)
        meta = {
            "type": "company",
            "name": entity.get("company_name", ""),
            "city": entity.get("city", ""),
            "rating": entity.get("rating", 0),
            "slug": entity.get("slug", ""),
        }
    else:
        suppliers = read_json(suppliers_dataset_path())
        entity = None
        if isinstance(suppliers, list):
            for s in suppliers:
                if s.get("supplier_id") == entity_id or s.get("slug") == entity_id:
                    entity = s
                    break
        if not entity:
            return False
        text = _supplier_to_text(entity)
        meta = {
            "type": "supplier",
            "name": entity.get("supplier_name", ""),
            "city": entity.get("city", ""),
            "rating": entity.get("rating", 0),
            "slug": entity.get("slug", ""),
        }

    tokens = _tokenize(text)
    vec = _vectorize(tokens, _IDF, _VOCAB)
    _INDEX[entity_id] = {"vector": vec, "tokens": tokens, "meta": meta}
    return True


def semantic_search(query: str, top_k: int = 10, entity_type: str | None = None) -> list[dict]:
    """Search the index for entities matching the query."""
    if not _INITIALIZED:
        initialize_embeddings()

    tokens = _tokenize(query.lower())
    if not tokens:
        return []

    query_vec = _vectorize(tokens, _IDF, _VOCAB)

    results = []
    for eid, data in _INDEX.items():
        if entity_type and data["meta"].get("type") != entity_type:
            continue
        sim = _cosine_sim(query_vec, data["vector"])
        if sim > 0.01:
            results.append({
                "id": eid,
                "score": round(sim * 100, 1),
                **data["meta"],
            })

    results.sort(key=lambda x: x["score"], reverse=True)
    return results[:top_k]


def get_index_stats() -> dict:
    """Return stats about the current embeddings index."""
    return {
        "initialized": _INITIALIZED,
        "total_entities": len(_INDEX),
        "vocab_size": len(_VOCAB),
        "companies": sum(1 for v in _INDEX.values() if v["meta"].get("type") == "company"),
        "suppliers": sum(1 for v in _INDEX.values() if v["meta"].get("type") == "supplier"),
    }
