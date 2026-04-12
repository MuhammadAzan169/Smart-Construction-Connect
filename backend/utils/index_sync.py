"""Background index synchronisation worker.

Runs a lightweight daemon thread that polls the JSON source files every 10 s.
If either file has changed on disk (e.g., via a direct edit or external import),
the thread triggers a differential rebuild: only entities whose record has
actually changed are updated in the live index, so the workload is minimal.

Usage (called automatically from app.py / main.py lifespan):

    from backend.utils.index_sync import start_background_watcher
    stop = start_background_watcher()   # call stop() on shutdown
"""

from __future__ import annotations

import hashlib
import logging
import threading
import time
from pathlib import Path
from typing import Callable

logger = logging.getLogger(__name__)

_POLL_INTERVAL = 10.0  # seconds


def _file_hash(path: Path) -> str:
    try:
        return hashlib.md5(path.read_bytes()).hexdigest()
    except Exception:
        return ""


def _record_hash(record: dict) -> str:
    """Fast hash of a single entity record to detect field-level changes."""
    import json
    try:
        return hashlib.md5(
            json.dumps(record, sort_keys=True, default=str).encode()
        ).hexdigest()
    except Exception:
        return ""


def _diff_and_update(
    old_records: dict[str, dict],
    new_records: list[dict],
    id_field: str,
    entity_type: str,
    index,
) -> tuple[int, int]:
    """Compare old vs new records, apply incremental updates for changed entities.

    Returns (added_count, updated_count).
    """
    added = updated = 0
    new_ids: set[str] = set()

    for record in new_records:
        eid = record.get(id_field)
        if not eid:
            continue
        new_ids.add(eid)
        old = old_records.get(eid)
        if old is None:
            # New entity
            index.add_or_update_entity(eid, entity_type, record)
            added += 1
        elif _record_hash(old) != _record_hash(record):
            # Changed entity
            index.add_or_update_entity(eid, entity_type, record)
            updated += 1

    # Removed entities
    removed_ids = set(old_records) - new_ids
    for eid in removed_ids:
        index.remove_entity(eid)

    return added, updated


def start_background_watcher(poll_interval: float = _POLL_INTERVAL) -> Callable[[], None]:
    """Start the background sync thread. Returns a callable that stops it."""
    from backend.utils.semantic_embeddings import semantic_index
    from backend.utils.data_handler import read_json, companies_dataset_path, suppliers_dataset_path

    comp_path = companies_dataset_path()
    supp_path = suppliers_dataset_path()

    _stop_event = threading.Event()

    # Snapshot of hashes at the time the watcher starts
    _state = {
        "comp_hash": _file_hash(comp_path),
        "supp_hash": _file_hash(supp_path),
    }

    def _watch():
        logger.info("Index background watcher started (poll every %.0fs)", poll_interval)
        while not _stop_event.wait(poll_interval):
            try:
                new_ch = _file_hash(comp_path)
                new_sh = _file_hash(supp_path)

                comp_changed = new_ch != _state["comp_hash"]
                supp_changed = new_sh != _state["supp_hash"]

                if not comp_changed and not supp_changed:
                    continue

                # Build a snapshot of what the index currently knows
                with semantic_index._lock:
                    old_companies = {
                        e["data"]["company_id"]: e["data"]
                        for e in semantic_index._id_to_entity.values()
                        if e["type"] == "company" and e["data"].get("company_id")
                    }
                    old_suppliers = {
                        e["data"]["supplier_id"]: e["data"]
                        for e in semantic_index._id_to_entity.values()
                        if e["type"] == "supplier" and e["data"].get("supplier_id")
                    }

                total_changes = 0

                if comp_changed:
                    companies = read_json(comp_path)
                    if isinstance(companies, list):
                        a, u = _diff_and_update(old_companies, companies, "company_id", "company", semantic_index)
                        total_changes += a + u
                        if a + u:
                            logger.info("Watcher: companies %d added, %d updated", a, u)
                    _state["comp_hash"] = new_ch

                if supp_changed:
                    suppliers = read_json(supp_path)
                    if isinstance(suppliers, list):
                        a, u = _diff_and_update(old_suppliers, suppliers, "supplier_id", "supplier", semantic_index)
                        total_changes += a + u
                        if a + u:
                            logger.info("Watcher: suppliers %d added, %d updated", a, u)
                    _state["supp_hash"] = new_sh

                if total_changes:
                    # Invalidate cached responses related to any city in the fresh data
                    from backend.utils.response_cache import response_cache
                    response_cache.invalidate()  # full flush after external file edit

            except Exception as exc:
                logger.error("Index watcher error: %s", exc)

        logger.info("Index background watcher stopped")

    thread = threading.Thread(target=_watch, name="IndexWatcher", daemon=True)
    thread.start()

    def stop() -> None:
        _stop_event.set()

    return stop
