"""Production-grade semantic embeddings with Sentence Transformers + FAISS.

Hybrid search: combines dense (FAISS cosine) with sparse (BM25) retrieval.
Auto-refreshes when source JSON files change on disk.

Usage:
    from backend.utils.semantic_embeddings import semantic_index
    results = semantic_index.search("cement supplier in Lahore", top_k=5)
"""

from __future__ import annotations

import hashlib
import json
import logging
import math
import os
import re
import threading
import time
from collections import Counter
from pathlib import Path
from typing import Any

import numpy as np

from backend.utils.data_handler import read_json, companies_dataset_path, suppliers_dataset_path

logger = logging.getLogger(__name__)

# ═══════════════════════════════════════════════════════════════════════════════
#  Lazy model loading — only imports heavy libs when needed
# ═══════════════════════════════════════════════════════════════════════════════

_sbert_model = None
_sbert_lock = threading.Lock()
_FAISS_AVAILABLE = False
_SBERT_AVAILABLE = False

# Preferred model — small, fast, accurate
_MODEL_NAME = os.getenv("SBERT_MODEL", "all-MiniLM-L6-v2")


def _load_sbert():
    """Load Sentence Transformer model lazily."""
    global _sbert_model, _SBERT_AVAILABLE
    with _sbert_lock:
        if _sbert_model is not None:
            return _sbert_model
        try:
            from sentence_transformers import SentenceTransformer
            _sbert_model = SentenceTransformer(_MODEL_NAME)
            _SBERT_AVAILABLE = True
            logger.info("Loaded SentenceTransformer model: %s", _MODEL_NAME)
            return _sbert_model
        except ImportError:
            logger.warning("sentence-transformers not installed, falling back to TF-IDF")
            _SBERT_AVAILABLE = False
            return None
        except Exception as e:
            logger.error("Failed to load SentenceTransformer: %s", e)
            _SBERT_AVAILABLE = False
            return None


def _check_faiss():
    """Check if FAISS is available."""
    global _FAISS_AVAILABLE
    try:
        import faiss  # noqa: F401
        _FAISS_AVAILABLE = True
    except ImportError:
        _FAISS_AVAILABLE = False
    return _FAISS_AVAILABLE


# ═══════════════════════════════════════════════════════════════════════════════
#  BM25 Sparse Index (fallback + hybrid component)
# ═══════════════════════════════════════════════════════════════════════════════

_STOPWORDS = frozenset([
    "the", "a", "an", "and", "or", "but", "in", "on", "at", "to", "for",
    "of", "with", "by", "is", "are", "was", "were", "be", "been", "being",
    "have", "has", "had", "do", "does", "did", "will", "would", "should",
    "can", "could", "may", "might", "must", "shall", "not", "no", "this",
    "that", "these", "those", "it", "its", "from", "as", "if", "they",
    "he", "she", "we", "you", "i", "me", "my", "our", "your", "their",
])


def _tokenize(text: str) -> list[str]:
    words = re.findall(r"[a-z0-9]+", text.lower())
    return [w for w in words if w not in _STOPWORDS and len(w) > 1]


class BM25Index:
    """Okapi BM25 ranking — more accurate than plain TF-IDF."""

    def __init__(self, k1: float = 1.5, b: float = 0.75):
        self.k1 = k1
        self.b = b
        self.doc_lens: list[int] = []
        self.avgdl: float = 0.0
        self.doc_freqs: dict[str, int] = {}
        self.idf: dict[str, float] = {}
        self.doc_tokens: list[list[str]] = []
        self.N: int = 0

    def fit(self, documents: list[list[str]]):
        self.doc_tokens = documents
        self.N = len(documents)
        self.doc_lens = [len(d) for d in documents]
        self.avgdl = sum(self.doc_lens) / max(self.N, 1)

        df: Counter = Counter()
        for doc in documents:
            df.update(set(doc))
        self.doc_freqs = dict(df)

        # IDF with smoothing
        self.idf = {}
        for term, freq in df.items():
            self.idf[term] = math.log((self.N - freq + 0.5) / (freq + 0.5) + 1.0)

    def score(self, query_tokens: list[str]) -> list[float]:
        scores = [0.0] * self.N
        for q in query_tokens:
            if q not in self.idf:
                continue
            idf_val = self.idf[q]
            for i, doc in enumerate(self.doc_tokens):
                tf = doc.count(q)
                if tf == 0:
                    continue
                dl = self.doc_lens[i]
                numerator = tf * (self.k1 + 1)
                denominator = tf + self.k1 * (1 - self.b + self.b * dl / self.avgdl)
                scores[i] += idf_val * (numerator / denominator)
        return scores


# ═══════════════════════════════════════════════════════════════════════════════
#  Document builders
# ═══════════════════════════════════════════════════════════════════════════════

def _company_to_text(c: dict) -> str:
    """Convert company record to rich searchable text."""
    parts = [
        c.get("company_name", ""),
        c.get("description") or "",
        c.get("city", ""),
    ]
    # Operational areas
    for row in c.get("flattened_operational_areas", []):
        parts.extend([
            row.get("city", ""), row.get("area", ""),
            row.get("subarea", ""), row.get("package", ""),
        ])
    for ck in (c.get("operational_areas") or {}).keys():
        parts.append(ck)
    # Specializations
    for sp in (c.get("experience") or {}).get("specializations", []):
        parts.append(sp)
    # Services
    services = c.get("services") or {}
    for sk, sv in services.items():
        parts.append(sk.replace("_", " "))
        if isinstance(sv, list):
            parts.extend(str(v) for v in sv)
    # Construction capability
    cap = c.get("construction_capability") or {}
    for ht in cap.get("house_types", []):
        parts.append(ht)
    if cap.get("min_plot_marla"):
        parts.append(f"{cap['min_plot_marla']} to {cap.get('max_plot_marla', '')} marla")
    # Materials
    for pkg_mats in (c.get("materials_used") or {}).values():
        if isinstance(pkg_mats, dict):
            parts.extend(pkg_mats.values())
    # Legal
    legal = c.get("legal_info") or {}
    if legal.get("year_established"):
        parts.append(f"established {legal['year_established']}")
    return " ".join(str(p) for p in parts if p)


def _supplier_to_text(s: dict) -> str:
    """Convert supplier record to rich searchable text."""
    parts = [
        s.get("supplier_name", ""),
        s.get("description") or "",
        s.get("city", ""),
        s.get("area", ""),
    ]
    parts.extend(s.get("cities_served", []))
    for mat in s.get("materials", []):
        if isinstance(mat, dict):
            parts.extend([
                mat.get("name", ""),
                mat.get("category", ""),
                mat.get("brand", ""),
                mat.get("description", "") or "",
            ])
    return " ".join(str(p) for p in parts if p)


def _file_hash(path: Path) -> str:
    try:
        return hashlib.md5(path.read_bytes()).hexdigest()
    except Exception:
        return ""


# ═══════════════════════════════════════════════════════════════════════════════
#  Hybrid Semantic Index
# ═══════════════════════════════════════════════════════════════════════════════

class HybridSemanticIndex:
    """Thread-safe hybrid search index with FAISS (dense) + BM25 (sparse).

    Falls back gracefully:
    - If sentence-transformers unavailable → BM25 only
    - If FAISS unavailable → brute-force numpy cosine
    """

    def __init__(self):
        self._lock = threading.Lock()
        self._companies: list[dict] = []
        self._suppliers: list[dict] = []
        self._company_texts: list[str] = []
        self._supplier_texts: list[str] = []
        self._all_texts: list[str] = []
        self._all_entities: list[dict] = []  # {type, data, text}

        # Dense index
        self._dense_embeddings: np.ndarray | None = None
        self._faiss_index = None

        # Sparse index
        self._bm25 = BM25Index()
        self._doc_tokens: list[list[str]] = []

        # State
        self._built = False
        self._company_hash = ""
        self._supplier_hash = ""

        # Cache for query embeddings
        self._query_cache: dict[str, tuple[float, np.ndarray]] = {}
        self._cache_ttl = 300  # 5 minutes
        self._max_cache = 200

    def _needs_refresh(self) -> bool:
        ch = _file_hash(companies_dataset_path())
        sh = _file_hash(suppliers_dataset_path())
        with self._lock:
            return ch != self._company_hash or sh != self._supplier_hash

    def build(self, force: bool = False):
        """Build or rebuild the full index from JSON data."""
        if self._built and not force and not self._needs_refresh():
            return

        t0 = time.perf_counter()
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

        # Build text representations
        all_entities: list[dict] = []
        all_texts: list[str] = []
        all_tokens: list[list[str]] = []

        for c in companies:
            text = _company_to_text(c)
            all_entities.append({"type": "company", "data": c})
            all_texts.append(text)
            all_tokens.append(_tokenize(text))

        for s in suppliers:
            text = _supplier_to_text(s)
            all_entities.append({"type": "supplier", "data": s})
            all_texts.append(text)
            all_tokens.append(_tokenize(text))

        # Build BM25 sparse index (always available)
        bm25 = BM25Index()
        bm25.fit(all_tokens)

        # Build dense embeddings if SBERT available
        dense_embeddings = None
        faiss_index = None
        model = _load_sbert()
        if model is not None and all_texts:
            try:
                embeddings = model.encode(
                    all_texts,
                    show_progress_bar=False,
                    normalize_embeddings=True,
                    batch_size=64,
                )
                dense_embeddings = np.array(embeddings, dtype=np.float32)

                # Build FAISS index
                if _check_faiss():
                    import faiss
                    dim = dense_embeddings.shape[1]
                    faiss_index = faiss.IndexFlatIP(dim)  # Inner product = cosine for normalized vectors
                    faiss_index.add(dense_embeddings)
                    logger.info("FAISS index built: %d vectors, dim=%d", len(all_texts), dim)
                else:
                    logger.info("FAISS not available, using numpy cosine similarity")
            except Exception as e:
                logger.error("Dense embedding build failed: %s", e)
                dense_embeddings = None
                faiss_index = None

        # Atomically swap in new index
        with self._lock:
            self._companies = companies
            self._suppliers = suppliers
            self._all_entities = all_entities
            self._all_texts = all_texts
            self._doc_tokens = all_tokens
            self._bm25 = bm25
            self._dense_embeddings = dense_embeddings
            self._faiss_index = faiss_index
            self._company_hash = _file_hash(comp_path)
            self._supplier_hash = _file_hash(supp_path)
            self._built = True
            self._query_cache.clear()

        elapsed = time.perf_counter() - t0
        mode = "hybrid (SBERT+FAISS)" if dense_embeddings is not None and faiss_index is not None else \
               "hybrid (SBERT+numpy)" if dense_embeddings is not None else "BM25 only"
        logger.info(
            "Semantic index built in %.2fs: %d companies, %d suppliers, mode=%s",
            elapsed, len(companies), len(suppliers), mode,
        )

    def _ensure(self):
        if not self._built or self._needs_refresh():
            self.build()

    def _embed_query(self, query: str) -> np.ndarray | None:
        """Embed a query string, with caching."""
        now = time.time()

        # Check cache
        if query in self._query_cache:
            ts, vec = self._query_cache[query]
            if now - ts < self._cache_ttl:
                return vec

        model = _load_sbert()
        if model is None:
            return None

        try:
            vec = model.encode(
                [query],
                normalize_embeddings=True,
                show_progress_bar=False,
            )
            vec = np.array(vec, dtype=np.float32)

            # Cache management
            if len(self._query_cache) >= self._max_cache:
                # Evict oldest entries
                sorted_keys = sorted(self._query_cache, key=lambda k: self._query_cache[k][0])
                for k in sorted_keys[: self._max_cache // 2]:
                    del self._query_cache[k]
            self._query_cache[query] = (now, vec)
            return vec
        except Exception as e:
            logger.error("Query embedding failed: %s", e)
            return None

    def _dense_search(self, query_vec: np.ndarray, top_k: int) -> list[tuple[int, float]]:
        """Dense (semantic) search using FAISS or numpy."""
        with self._lock:
            if self._faiss_index is not None:
                scores, indices = self._faiss_index.search(query_vec, min(top_k * 2, len(self._all_entities)))
                return [(int(idx), float(score)) for idx, score in zip(indices[0], scores[0]) if idx >= 0]
            elif self._dense_embeddings is not None:
                # Fallback: numpy cosine similarity
                sims = np.dot(self._dense_embeddings, query_vec.T).flatten()
                top_indices = np.argsort(sims)[-top_k * 2:][::-1]
                return [(int(idx), float(sims[idx])) for idx in top_indices]
        return []

    def _sparse_search(self, query: str, top_k: int) -> list[tuple[int, float]]:
        """BM25 sparse search."""
        tokens = _tokenize(query)
        if not tokens:
            return []
        with self._lock:
            scores = self._bm25.score(tokens)
        indexed = [(i, s) for i, s in enumerate(scores) if s > 0]
        indexed.sort(key=lambda x: x[1], reverse=True)
        return indexed[:top_k * 2]

    def search(
        self,
        query: str,
        top_k: int = 10,
        entity_type: str | None = None,
        dense_weight: float = 0.7,
        sparse_weight: float = 0.3,
    ) -> list[dict]:
        """Hybrid search combining dense (semantic) and sparse (BM25) scores.

        Returns list of {type, data, score, dense_score, sparse_score}.
        """
        self._ensure()

        with self._lock:
            n_entities = len(self._all_entities)
        if n_entities == 0:
            return []

        # Dense search
        dense_results: dict[int, float] = {}
        query_vec = self._embed_query(query)
        if query_vec is not None:
            for idx, score in self._dense_search(query_vec, top_k):
                if 0 <= idx < n_entities:
                    dense_results[idx] = score
        else:
            # No SBERT → shift weight to sparse
            dense_weight = 0.0
            sparse_weight = 1.0

        # Sparse search
        sparse_results: dict[int, float] = {}
        for idx, score in self._sparse_search(query, top_k):
            if 0 <= idx < n_entities:
                sparse_results[idx] = score

        # Normalize scores to [0, 1]
        if dense_results:
            max_d = max(dense_results.values()) or 1.0
            dense_results = {k: v / max_d for k, v in dense_results.items()}
        if sparse_results:
            max_s = max(sparse_results.values()) or 1.0
            sparse_results = {k: v / max_s for k, v in sparse_results.items()}

        # Merge with Reciprocal Rank Fusion (RRF) style combining
        all_indices = set(dense_results.keys()) | set(sparse_results.keys())
        combined: list[tuple[int, float, float, float]] = []
        for idx in all_indices:
            d_score = dense_results.get(idx, 0.0)
            s_score = sparse_results.get(idx, 0.0)
            final = dense_weight * d_score + sparse_weight * s_score
            combined.append((idx, final, d_score, s_score))

        combined.sort(key=lambda x: x[1], reverse=True)

        # Filter by entity type and build results
        results: list[dict] = []
        with self._lock:
            for idx, score, d_score, s_score in combined:
                if idx >= len(self._all_entities):
                    continue
                entity = self._all_entities[idx]
                if entity_type and entity["type"] != entity_type:
                    continue
                results.append({
                    "type": entity["type"],
                    "data": entity["data"],
                    "score": round(score, 4),
                    "dense_score": round(d_score, 4),
                    "sparse_score": round(s_score, 4),
                })
                if len(results) >= top_k:
                    break

        return results

    def search_companies(self, query: str, top_k: int = 10) -> list[tuple[dict, float]]:
        """Search companies only — compatible with existing rag_engine interface."""
        results = self.search(query, top_k=top_k, entity_type="company")
        return [(r["data"], r["score"]) for r in results]

    def search_suppliers(self, query: str, top_k: int = 10) -> list[tuple[dict, float]]:
        """Search suppliers only — compatible with existing rag_engine interface."""
        results = self.search(query, top_k=top_k, entity_type="supplier")
        return [(r["data"], r["score"]) for r in results]

    def get_all_companies(self) -> list[dict]:
        self._ensure()
        with self._lock:
            return [e["data"] for e in self._all_entities if e["type"] == "company"]

    def get_all_suppliers(self) -> list[dict]:
        self._ensure()
        with self._lock:
            return [e["data"] for e in self._all_entities if e["type"] == "supplier"]

    def get_stats(self) -> dict:
        with self._lock:
            return {
                "built": self._built,
                "total_entities": len(self._all_entities),
                "companies": sum(1 for e in self._all_entities if e["type"] == "company"),
                "suppliers": sum(1 for e in self._all_entities if e["type"] == "supplier"),
                "dense_available": self._dense_embeddings is not None,
                "faiss_available": self._faiss_index is not None,
                "sbert_model": _MODEL_NAME if _SBERT_AVAILABLE else "N/A (TF-IDF fallback)",
                "mode": (
                    "hybrid (SBERT+FAISS)" if self._dense_embeddings is not None and self._faiss_index is not None
                    else "hybrid (SBERT+numpy)" if self._dense_embeddings is not None
                    else "BM25 sparse only"
                ),
                "query_cache_size": len(self._query_cache),
            }


# ── Module-level singleton ──
semantic_index = HybridSemanticIndex()
