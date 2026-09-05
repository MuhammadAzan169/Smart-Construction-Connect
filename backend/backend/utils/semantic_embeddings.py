"""Production-grade semantic embeddings — Hybrid SBERT + FAISS (IDMap) + BM25.

Key capabilities:
- Incremental add/update/delete (no full rebuild on CRUD operations)
- Disk persistence (FAISS + BM25 + metadata via pickle; survives restarts)
- Background debounced save (5 s idle → write to disk, non-blocking)
- Hash-based auto-refresh if JSON files are edited directly on disk
- Bulk-build path for initial load or large imports
- Query-embedding cache (5-min TTL)
- Graceful fallback: SBERT+FAISS → SBERT+numpy → BM25 only

Usage:
    from backend.utils.semantic_embeddings import semantic_index
    semantic_index.build()                          # startup (loads from disk if fresh)
    semantic_index.add_or_update_entity("abc", "company", record)
    semantic_index.remove_entity("abc")
    results = semantic_index.search("cement supplier Lahore", top_k=5)
"""

from __future__ import annotations

import hashlib
import logging
import math
import os
import pickle
import re
import threading
import time
import warnings
from collections import Counter
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

import numpy as np

os.environ.setdefault("TOKENIZERS_PARALLELISM", "false")
warnings.filterwarnings("ignore", message=".*position_ids.*UNEXPECTED.*", category=FutureWarning)
warnings.filterwarnings("ignore", message=".*position_ids.*UNEXPECTED.*")

from backend.utils.data_handler import read_json, companies_dataset_path, suppliers_dataset_path

logger = logging.getLogger(__name__)

# ── Disk persistence directory ───────────────────────────────────────────────
_INDEX_DIR = Path(__file__).resolve().parent.parent.parent / "index_data"
_FAISS_PATH = _INDEX_DIR / "faiss.index"
_META_PATH = _INDEX_DIR / "meta.pkl"  # BM25 + entities + hashes
_SAVE_DEBOUNCE_SECONDS = 5.0

# ── SBERT model ──────────────────────────────────────────────────────────────
_sbert_model = None
_sbert_lock = threading.Lock()
_FAISS_AVAILABLE = False
_SBERT_AVAILABLE = False
_MODEL_NAME = os.getenv("SBERT_MODEL", "all-MiniLM-L6-v2")
_SBERT_DIM = 384  # all-MiniLM-L6-v2 output dimension


class _ExternalEmbedder:
    """Drop-in replacement for a SentenceTransformer model that calls an
    OpenAI-compatible ``/embeddings`` endpoint instead of running PyTorch.

    Exposes the same ``.encode(texts, ...)`` signature the index already uses,
    so no call sites change. Raises on failure so callers fall back to BM25.
    """

    def __init__(self, base_url: str, api_key: str, model: str):
        self._url = base_url.rstrip("/") + "/embeddings"
        self._key = api_key
        self._model = model

    def encode(self, texts, normalize_embeddings: bool = True, show_progress_bar: bool = False,
               batch_size: int = 64, **_kwargs) -> np.ndarray:
        import httpx

        if isinstance(texts, str):
            texts = [texts]
        vectors: list[list[float]] = []
        # Chunk size 90 stays under the tightest known provider limit (Cohere's
        # OpenAI-compat endpoint caps at 96 texts/request); OpenAI allows far more.
        for start in range(0, len(texts), 90):
            chunk = [(t or " ")[:8000] for t in texts[start:start + 90]]
            resp = httpx.post(
                self._url,
                headers={"Authorization": f"Bearer {self._key}", "Content-Type": "application/json"},
                json={"model": self._model, "input": chunk},
                timeout=30.0,
            )
            resp.raise_for_status()
            for item in resp.json()["data"]:
                vectors.append(item["embedding"])

        arr = np.array(vectors, dtype=np.float32)
        if normalize_embeddings and arr.size:
            norms = np.linalg.norm(arr, axis=1, keepdims=True)
            norms[norms == 0] = 1.0
            arr = arr / norms
        return arr


def _load_sbert():
    """Return an embedder exposing ``.encode(...)``, or None for BM25-only mode.

    Preference order:
      1. External embeddings API (low RAM — works on Render free tier).
      2. Local SBERT/PyTorch, only if ENABLE_LOCAL_SBERT=1 (needs >=2GB RAM).
      3. None → hybrid index degrades to BM25 keyword search.
    """
    global _sbert_model, _SBERT_AVAILABLE
    with _sbert_lock:
        if _sbert_model is not None:
            return _sbert_model

        from backend.config import (
            EMBEDDINGS_API_URL, EMBEDDINGS_API_KEY, EMBEDDINGS_MODEL, ENABLE_LOCAL_SBERT,
        )

        # 1. External embeddings API
        if EMBEDDINGS_API_URL and EMBEDDINGS_API_KEY:
            _sbert_model = _ExternalEmbedder(EMBEDDINGS_API_URL, EMBEDDINGS_API_KEY, EMBEDDINGS_MODEL)
            _SBERT_AVAILABLE = True
            logger.info("Using external embeddings API (%s, model=%s)", EMBEDDINGS_API_URL, EMBEDDINGS_MODEL)
            return _sbert_model

        # 2. Local SBERT (opt-in — heavy)
        if ENABLE_LOCAL_SBERT:
            try:
                from sentence_transformers import SentenceTransformer
                _sbert_model = SentenceTransformer(_MODEL_NAME)
                _SBERT_AVAILABLE = True
                logger.info("Loaded local SentenceTransformer model: %s", _MODEL_NAME)
                return _sbert_model
            except Exception as exc:
                logger.error("Failed to load local SentenceTransformer: %s", exc)

        # 3. BM25-only fallback
        logger.warning("No embeddings provider configured — semantic index in BM25-only mode")
        _SBERT_AVAILABLE = False
        return None


def _embedder_label() -> str:
    """Human-readable description of the active embedding provider (for stats)."""
    if not _SBERT_AVAILABLE:
        return "N/A (BM25 fallback)"
    if isinstance(_sbert_model, _ExternalEmbedder):
        from backend.config import EMBEDDINGS_API_URL, EMBEDDINGS_MODEL
        return f"{EMBEDDINGS_MODEL} (external API: {EMBEDDINGS_API_URL})"
    return _MODEL_NAME


def _check_faiss() -> bool:
    global _FAISS_AVAILABLE
    try:
        import faiss  # noqa: F401
        _FAISS_AVAILABLE = True
    except ImportError:
        _FAISS_AVAILABLE = False
    return _FAISS_AVAILABLE


# ═══════════════════════════════════════════════════════════════════════════════
#  BM25 — incremental-capable Okapi BM25
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


class IncrementalBM25:
    """Okapi BM25 that supports add, update, and remove of individual documents.

    Documents are keyed by an integer ID that matches the FAISS IDMap IDs.
    """

    def __init__(self, k1: float = 1.5, b: float = 0.75):
        self.k1 = k1
        self.b = b
        # id → token list
        self._docs: dict[int, list[str]] = {}
        # term → number of docs containing it
        self._df: Counter = Counter()
        self._total_len: int = 0
        self._idf: dict[str, float] = {}

    # ── mutators ─────────────────────────────────────────────────────────────

    def add_doc(self, doc_id: int, tokens: list[str]) -> None:
        """Add a new document. Caller must ensure doc_id is not already present."""
        self._docs[doc_id] = tokens
        self._total_len += len(tokens)
        for term in set(tokens):
            self._df[term] += 1
        self._recompute_idf()

    def remove_doc(self, doc_id: int) -> None:
        """Remove a document. No-op if doc_id not found."""
        tokens = self._docs.pop(doc_id, None)
        if tokens is None:
            return
        self._total_len -= len(tokens)
        for term in set(tokens):
            self._df[term] -= 1
            if self._df[term] <= 0:
                del self._df[term]
        self._recompute_idf()

    def update_doc(self, doc_id: int, tokens: list[str]) -> None:
        """Update an existing document (remove old, add new)."""
        self.remove_doc(doc_id)
        self.add_doc(doc_id, tokens)

    def fit(self, id_token_pairs: list[tuple[int, list[str]]]) -> None:
        """Batch-build from scratch (faster than repeated add_doc)."""
        self._docs = {}
        self._df = Counter()
        self._total_len = 0
        for doc_id, tokens in id_token_pairs:
            self._docs[doc_id] = tokens
            self._total_len += len(tokens)
            for term in set(tokens):
                self._df[term] += 1
        self._recompute_idf()

    # ── query ────────────────────────────────────────────────────────────────

    def score_all(self, query_tokens: list[str]) -> dict[int, float]:
        """Return BM25 score for every document that has at least one hit."""
        N = len(self._docs)
        if N == 0:
            return {}
        avgdl = self._total_len / N
        scores: dict[int, float] = {}
        for q in query_tokens:
            if q not in self._idf:
                continue
            idf_val = self._idf[q]
            for doc_id, doc_tokens in self._docs.items():
                tf = doc_tokens.count(q)
                if tf == 0:
                    continue
                dl = len(doc_tokens)
                num = tf * (self.k1 + 1)
                den = tf + self.k1 * (1 - self.b + self.b * dl / avgdl)
                scores[doc_id] = scores.get(doc_id, 0.0) + idf_val * (num / den)
        return scores

    # ── internals ────────────────────────────────────────────────────────────

    def _recompute_idf(self) -> None:
        N = len(self._docs)
        self._idf = {}
        for term, freq in self._df.items():
            self._idf[term] = math.log((N - freq + 0.5) / (freq + 0.5) + 1.0)

    @property
    def N(self) -> int:
        return len(self._docs)


# ═══════════════════════════════════════════════════════════════════════════════
#  Document text builders
# ═══════════════════════════════════════════════════════════════════════════════

def _company_to_text(c: dict) -> str:
    parts = [c.get("company_name", ""), c.get("description") or "", c.get("city", "")]
    for row in c.get("flattened_operational_areas", []):
        parts.extend([row.get("city", ""), row.get("area", ""), row.get("subarea", ""), row.get("package", "")])
    for ck in (c.get("operational_areas") or {}).keys():
        parts.append(ck)
    for sp in (c.get("experience") or {}).get("specializations", []):
        parts.append(sp)
    services = c.get("services") or {}
    for sk, sv in services.items():
        parts.append(sk.replace("_", " "))
        if isinstance(sv, list):
            parts.extend(str(v) for v in sv)
    cap = c.get("construction_capability") or {}
    for ht in cap.get("house_types", []):
        parts.append(ht)
    if cap.get("min_plot_marla"):
        parts.append(f"{cap['min_plot_marla']} to {cap.get('max_plot_marla', '')} marla")
    for pkg_mats in (c.get("materials_used") or {}).values():
        if isinstance(pkg_mats, dict):
            parts.extend(pkg_mats.values())
    legal = c.get("legal_info") or {}
    if legal.get("year_established"):
        parts.append(f"established {legal['year_established']}")
    return " ".join(str(p) for p in parts if p)


def _supplier_to_text(s: dict) -> str:
    parts = [
        s.get("supplier_name", ""), s.get("description") or "",
        s.get("city", ""), s.get("area", ""),
    ]
    parts.extend(s.get("cities_served", []))
    for mat in s.get("materials", []):
        if isinstance(mat, dict):
            parts.extend([mat.get("name", ""), mat.get("category", ""), mat.get("brand", ""), mat.get("description") or ""])
    return " ".join(str(p) for p in parts if p)


def _record_to_text(entity_type: str, record: dict) -> str:
    if entity_type == "company":
        return _company_to_text(record)
    return _supplier_to_text(record)


def _file_hash(path: Path) -> str:
    try:
        return hashlib.md5(path.read_bytes()).hexdigest()
    except Exception:
        return ""


# ═══════════════════════════════════════════════════════════════════════════════
#  Hybrid Semantic Index — production-grade
# ═══════════════════════════════════════════════════════════════════════════════

class HybridSemanticIndex:
    """Thread-safe hybrid index: FAISS (IDMap) dense + BM25 sparse.

    Supports incremental add/update/remove, disk persistence, and auto-refresh.
    """

    def __init__(self):
        self._lock = threading.Lock()

        # FAISS IDMap index (int64 IDs)
        self._faiss_index = None  # faiss.IndexIDMap or None

        # Numpy fallback when FAISS not installed
        # _dense_store: dict[int, np.ndarray]  id → 384-dim vector
        self._dense_store: dict[int, np.ndarray] = {}

        # BM25
        self._bm25 = IncrementalBM25()

        # Entity metadata: int64_id → {type, data}
        self._id_to_entity: dict[int, dict] = {}

        # String entity_id → int64 FAISS/BM25 id
        self._str_to_int: dict[str, int] = {}

        # Monotonically increasing counter; deleted IDs are never reused
        self._id_counter: int = 0

        # State
        self._built: bool = False
        self._company_hash: str = ""
        self._supplier_hash: str = ""

        # Query embedding cache: query_str → (timestamp, vector)
        self._query_cache: dict[str, tuple[float, np.ndarray]] = {}
        self._cache_ttl: float = 300.0
        self._max_cache: int = 200

        # Background save debouncer
        self._save_timer: threading.Timer | None = None
        self._pending_save: bool = False

    # ─────────────────────────────────────────────────────────────────────────
    #  Persistence
    # ─────────────────────────────────────────────────────────────────────────

    def save(self, directory: str | Path | None = None) -> None:
        """Write FAISS index + BM25 + metadata to disk."""
        d = Path(directory) if directory else _INDEX_DIR
        d.mkdir(parents=True, exist_ok=True)
        try:
            with self._lock:
                # FAISS
                if self._faiss_index is not None and _check_faiss():
                    import faiss
                    faiss.write_index(self._faiss_index, str(d / "faiss.index"))

                # Everything else: BM25 state, entity map, dense fallback, hashes
                meta = {
                    "bm25": self._bm25,
                    "id_to_entity": self._id_to_entity,
                    "str_to_int": self._str_to_int,
                    "id_counter": self._id_counter,
                    "dense_store": self._dense_store,
                    "company_hash": self._company_hash,
                    "supplier_hash": self._supplier_hash,
                }
                with open(d / "meta.pkl", "wb") as f:
                    pickle.dump(meta, f, protocol=pickle.HIGHEST_PROTOCOL)

            logger.info("Index persisted to %s (%d entities)", d, len(self._id_to_entity))
        except Exception as exc:
            logger.error("Index save failed: %s", exc)

    def load(self, directory: str | Path | None = None) -> bool:
        """Load persisted index from disk. Returns True if successful."""
        d = Path(directory) if directory else _INDEX_DIR
        meta_path = d / "meta.pkl"
        faiss_path = d / "faiss.index"
        if not meta_path.exists():
            return False
        try:
            with open(meta_path, "rb") as f:
                meta = pickle.load(f)

            faiss_index = None
            if faiss_path.exists() and _check_faiss():
                import faiss
                faiss_index = faiss.read_index(str(faiss_path))

            with self._lock:
                self._bm25 = meta["bm25"]
                self._id_to_entity = meta["id_to_entity"]
                self._str_to_int = meta["str_to_int"]
                self._id_counter = meta["id_counter"]
                self._dense_store = meta.get("dense_store", {})
                self._company_hash = meta["company_hash"]
                self._supplier_hash = meta["supplier_hash"]
                self._faiss_index = faiss_index
                self._built = True
                self._query_cache.clear()

            logger.info(
                "Index loaded from disk: %d entities, FAISS=%s",
                len(self._id_to_entity), faiss_index is not None,
            )
            return True
        except Exception as exc:
            logger.warning("Index load failed (%s) — will rebuild from scratch", exc)
            return False

    def _schedule_save(self) -> None:
        """Debounced background save: writes to disk 5 s after last mutation."""
        with self._lock:
            if self._save_timer is not None:
                self._save_timer.cancel()
            timer = threading.Timer(_SAVE_DEBOUNCE_SECONDS, self._background_save)
            timer.daemon = True
            timer.start()
            self._save_timer = timer

    def _background_save(self) -> None:
        try:
            self.save()
        except Exception as exc:
            logger.error("Background index save failed: %s", exc)

    # ─────────────────────────────────────────────────────────────────────────
    #  Build (full)
    # ─────────────────────────────────────────────────────────────────────────

    def _needs_refresh(self) -> bool:
        ch = _file_hash(companies_dataset_path())
        sh = _file_hash(suppliers_dataset_path())
        with self._lock:
            return ch != self._company_hash or sh != self._supplier_hash

    def build(self, force: bool = False) -> None:
        """Full index build from JSON files.

        On first call at startup, tries to load from disk; only rebuilds if
        the JSON file hashes have changed since the last save.
        """
        # Attempt to load persisted index (skips heavy SBERT encode)
        if not force and not self._built:
            if self.load():
                if not self._needs_refresh():
                    logger.info("Index loaded from disk — no rebuild needed")
                    return
                logger.info("JSON files changed since last save — rebuilding")
            # else: no valid disk cache → fall through to full build

        if not force and self._built and not self._needs_refresh():
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

        # Assign fresh IDs
        new_id_to_entity: dict[int, dict] = {}
        new_str_to_int: dict[str, int] = {}
        texts: list[str] = []
        id_token_pairs: list[tuple[int, list[str]]] = []
        counter = 0

        for c in companies:
            eid = c["company_id"]
            text = _company_to_text(c)
            new_id_to_entity[counter] = {"type": "company", "data": c}
            new_str_to_int[eid] = counter
            texts.append(text)
            id_token_pairs.append((counter, _tokenize(text)))
            counter += 1

        for s in suppliers:
            eid = s["supplier_id"]
            text = _supplier_to_text(s)
            new_id_to_entity[counter] = {"type": "supplier", "data": s}
            new_str_to_int[eid] = counter
            texts.append(text)
            id_token_pairs.append((counter, _tokenize(text)))
            counter += 1

        # BM25
        new_bm25 = IncrementalBM25()
        new_bm25.fit(id_token_pairs)

        # Dense embeddings
        model = _load_sbert()
        new_dense_store: dict[int, np.ndarray] = {}
        new_faiss_index = None

        if model is not None and texts:
            try:
                vecs = model.encode(
                    texts,
                    show_progress_bar=False,
                    normalize_embeddings=True,
                    batch_size=64,
                )
                vecs = np.array(vecs, dtype=np.float32)

                if _check_faiss():
                    import faiss
                    base = faiss.IndexFlatIP(vecs.shape[1])
                    new_faiss_index = faiss.IndexIDMap(base)
                    ids = np.arange(counter, dtype=np.int64)
                    new_faiss_index.add_with_ids(vecs, ids)
                    logger.info("FAISS IDMap built: %d vectors, dim=%d", counter, vecs.shape[1])
                else:
                    # Numpy fallback
                    for i, vec in enumerate(vecs):
                        new_dense_store[i] = vec
                    logger.info("Numpy dense store built: %d vectors", counter)
            except Exception as exc:
                logger.error("Dense build failed: %s", exc)

        with self._lock:
            self._id_to_entity = new_id_to_entity
            self._str_to_int = new_str_to_int
            self._bm25 = new_bm25
            self._dense_store = new_dense_store
            self._faiss_index = new_faiss_index
            self._id_counter = counter
            self._company_hash = _file_hash(comp_path)
            self._supplier_hash = _file_hash(supp_path)
            self._built = True
            self._query_cache.clear()

        mode = (
            "hybrid (SBERT+FAISS)" if new_faiss_index is not None
            else "hybrid (SBERT+numpy)" if new_dense_store
            else "BM25 sparse only"
        )
        logger.info(
            "Index built in %.2fs: %d companies, %d suppliers, mode=%s",
            time.perf_counter() - t0, len(companies), len(suppliers), mode,
        )
        self._schedule_save()

    # ─────────────────────────────────────────────────────────────────────────
    #  Incremental mutations
    # ─────────────────────────────────────────────────────────────────────────

    def add_or_update_entity(
        self,
        entity_id: str,
        entity_type: str,
        record: dict,
    ) -> None:
        """Atomically add or update a single entity in the live index.

        O(1) dense update + O(|doc|) BM25 update.  No full rebuild needed.
        """
        self._ensure()
        text = _record_to_text(entity_type, record)
        tokens = _tokenize(text)

        model = _load_sbert()
        vec: np.ndarray | None = None
        if model is not None:
            try:
                vec = model.encode(
                    [text],
                    normalize_embeddings=True,
                    show_progress_bar=False,
                )
                vec = np.array(vec, dtype=np.float32)  # shape (1, dim)
            except Exception as exc:
                logger.error("Encode failed for %s %s: %s", entity_type, entity_id, exc)

        with self._lock:
            # If entity already exists, remove old entry first
            old_int_id = self._str_to_int.get(entity_id)
            if old_int_id is not None:
                self._bm25.remove_doc(old_int_id)
                if self._faiss_index is not None:
                    try:
                        import faiss
                        self._faiss_index.remove_ids(np.array([old_int_id], dtype=np.int64))
                    except Exception:
                        pass
                self._dense_store.pop(old_int_id, None)
                # Reuse same int id for update to avoid unbounded counter growth
                new_int_id = old_int_id
            else:
                new_int_id = self._id_counter
                self._id_counter += 1

            # Add to BM25
            self._bm25.add_doc(new_int_id, tokens)

            # Add to dense index
            if vec is not None:
                if self._faiss_index is not None:
                    try:
                        import faiss
                        self._faiss_index.add_with_ids(vec, np.array([new_int_id], dtype=np.int64))
                    except Exception as exc:
                        logger.error("FAISS add failed: %s", exc)
                else:
                    self._dense_store[new_int_id] = vec[0]

            # Update mappings
            self._str_to_int[entity_id] = new_int_id
            self._id_to_entity[new_int_id] = {"type": entity_type, "data": record}

            # Update file hashes so hash-based refresh doesn't overwrite our live update
            self._company_hash = _file_hash(companies_dataset_path())
            self._supplier_hash = _file_hash(suppliers_dataset_path())
            self._query_cache.clear()

        logger.info("Incremental %s: %s id=%s → int_id=%d", "update" if old_int_id is not None else "add", entity_type, entity_id, new_int_id)
        self._schedule_save()

    def remove_entity(self, entity_id: str) -> bool:
        """Remove an entity from the live index. Returns True if found."""
        self._ensure()
        with self._lock:
            int_id = self._str_to_int.pop(entity_id, None)
            if int_id is None:
                return False
            self._bm25.remove_doc(int_id)
            if self._faiss_index is not None:
                try:
                    import faiss
                    self._faiss_index.remove_ids(np.array([int_id], dtype=np.int64))
                except Exception:
                    pass
            self._dense_store.pop(int_id, None)
            self._id_to_entity.pop(int_id, None)
            self._company_hash = _file_hash(companies_dataset_path())
            self._supplier_hash = _file_hash(suppliers_dataset_path())
            self._query_cache.clear()

        logger.info("Removed entity %s from index", entity_id)
        self._schedule_save()
        return True

    def bulk_add(self, records: list[dict], entity_type: str) -> None:
        """Batch-add many entities efficiently with a single SBERT encode call."""
        if not records:
            return
        self._ensure()

        texts = [_record_to_text(entity_type, r) for r in records]
        token_lists = [_tokenize(t) for t in texts]
        id_field = "company_id" if entity_type == "company" else "supplier_id"
        entity_ids = [r.get(id_field, "") for r in records]

        model = _load_sbert()
        vecs: np.ndarray | None = None
        if model is not None and texts:
            try:
                vecs = model.encode(texts, normalize_embeddings=True, show_progress_bar=False, batch_size=64)
                vecs = np.array(vecs, dtype=np.float32)
            except Exception as exc:
                logger.error("Bulk encode failed: %s", exc)

        with self._lock:
            for i, (eid, tokens, record) in enumerate(zip(entity_ids, token_lists, records)):
                old_int_id = self._str_to_int.get(eid)
                if old_int_id is not None:
                    self._bm25.remove_doc(old_int_id)
                    if self._faiss_index is not None:
                        try:
                            import faiss
                            self._faiss_index.remove_ids(np.array([old_int_id], dtype=np.int64))
                        except Exception:
                            pass
                    self._dense_store.pop(old_int_id, None)
                    new_int_id = old_int_id
                else:
                    new_int_id = self._id_counter
                    self._id_counter += 1

                self._bm25.add_doc(new_int_id, tokens)
                if vecs is not None and self._faiss_index is not None:
                    try:
                        import faiss
                        self._faiss_index.add_with_ids(vecs[i : i + 1], np.array([new_int_id], dtype=np.int64))
                    except Exception:
                        pass
                elif vecs is not None:
                    self._dense_store[new_int_id] = vecs[i]

                self._str_to_int[eid] = new_int_id
                self._id_to_entity[new_int_id] = {"type": entity_type, "data": record}

            self._company_hash = _file_hash(companies_dataset_path())
            self._supplier_hash = _file_hash(suppliers_dataset_path())
            self._query_cache.clear()

        logger.info("Bulk-added %d %s entities", len(records), entity_type)
        self._schedule_save()

    # ─────────────────────────────────────────────────────────────────────────
    #  Search
    # ─────────────────────────────────────────────────────────────────────────

    def _ensure(self) -> None:
        if not self._built or self._needs_refresh():
            self.build()

    def _embed_query(self, query: str) -> np.ndarray | None:
        now = time.time()
        cached = self._query_cache.get(query)
        if cached:
            ts, vec = cached
            if now - ts < self._cache_ttl:
                return vec

        model = _load_sbert()
        if model is None:
            return None
        try:
            vec = model.encode([query], normalize_embeddings=True, show_progress_bar=False)
            vec = np.array(vec, dtype=np.float32)
            if len(self._query_cache) >= self._max_cache:
                oldest = sorted(self._query_cache, key=lambda k: self._query_cache[k][0])
                for k in oldest[: self._max_cache // 2]:
                    del self._query_cache[k]
            self._query_cache[query] = (now, vec)
            return vec
        except Exception as exc:
            logger.error("Query embed failed: %s", exc)
            return None

    def _dense_scores(self, query_vec: np.ndarray, top_k: int) -> dict[int, float]:
        with self._lock:
            if self._faiss_index is not None:
                n = min(top_k * 3, self._faiss_index.ntotal)
                if n == 0:
                    return {}
                scores, ids = self._faiss_index.search(query_vec, n)
                return {int(i): float(s) for i, s in zip(ids[0], scores[0]) if i >= 0}
            elif self._dense_store:
                ids = list(self._dense_store.keys())
                mat = np.stack([self._dense_store[i] for i in ids])
                sims = np.dot(mat, query_vec[0]).flatten()
                return {ids[i]: float(sims[i]) for i in range(len(ids))}
        return {}

    def search(
        self,
        query: str,
        top_k: int = 10,
        entity_type: str | None = None,
        dense_weight: float = 0.7,
        sparse_weight: float = 0.3,
    ) -> list[dict]:
        """Hybrid search. Returns [{type, data, score, dense_score, sparse_score}]."""
        self._ensure()

        with self._lock:
            n_entities = len(self._id_to_entity)
        if n_entities == 0:
            return []

        # Dense
        dense_raw: dict[int, float] = {}
        query_vec = self._embed_query(query)
        if query_vec is not None:
            dense_raw = self._dense_scores(query_vec, top_k)
        else:
            dense_weight, sparse_weight = 0.0, 1.0

        # Sparse
        sparse_raw = self._bm25.score_all(_tokenize(query))

        # Normalize
        def _normalize(d: dict[int, float]) -> dict[int, float]:
            if not d:
                return d
            mx = max(d.values()) or 1.0
            return {k: v / mx for k, v in d.items()}

        dense_norm = _normalize(dense_raw)
        sparse_norm = _normalize(sparse_raw)

        # Merge
        all_ids = set(dense_norm) | set(sparse_norm)
        combined: list[tuple[int, float, float, float]] = []
        for idx in all_ids:
            d = dense_norm.get(idx, 0.0)
            s = sparse_norm.get(idx, 0.0)
            combined.append((idx, dense_weight * d + sparse_weight * s, d, s))
        combined.sort(key=lambda x: x[1], reverse=True)

        results: list[dict] = []
        with self._lock:
            for idx, score, d_score, s_score in combined:
                entity = self._id_to_entity.get(idx)
                if entity is None:
                    continue
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
        return [(r["data"], r["score"]) for r in self.search(query, top_k=top_k, entity_type="company")]

    def search_suppliers(self, query: str, top_k: int = 10) -> list[tuple[dict, float]]:
        return [(r["data"], r["score"]) for r in self.search(query, top_k=top_k, entity_type="supplier")]

    def get_all_companies(self) -> list[dict]:
        self._ensure()
        with self._lock:
            return [e["data"] for e in self._id_to_entity.values() if e["type"] == "company"]

    def get_all_suppliers(self) -> list[dict]:
        self._ensure()
        with self._lock:
            return [e["data"] for e in self._id_to_entity.values() if e["type"] == "supplier"]

    def get_stats(self) -> dict:
        with self._lock:
            n = len(self._id_to_entity)
            return {
                "built": self._built,
                "total_entities": n,
                "companies": sum(1 for e in self._id_to_entity.values() if e["type"] == "company"),
                "suppliers": sum(1 for e in self._id_to_entity.values() if e["type"] == "supplier"),
                "dense_available": (self._faiss_index is not None) or bool(self._dense_store),
                "faiss_available": self._faiss_index is not None,
                "sbert_model": _embedder_label(),
                "mode": (
                    "hybrid (SBERT+FAISS)" if self._faiss_index is not None
                    else "hybrid (SBERT+numpy)" if self._dense_store
                    else "BM25 sparse only"
                ),
                "query_cache_size": len(self._query_cache),
                "id_counter": self._id_counter,
            }


# ── Module-level singleton ────────────────────────────────────────────────────
semantic_index = HybridSemanticIndex()
