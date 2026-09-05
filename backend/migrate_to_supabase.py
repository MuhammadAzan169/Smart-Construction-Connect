"""One-time migration: local JSON files + uploads → Supabase.

Reads every JSON document under ``Database/`` into the Postgres ``documents``
table, and (if Supabase Storage is configured) uploads every binary under
``company_data/`` and ``uploads/`` to the storage bucket.

Usage (from the backend/ directory, with .env populated):

    python migrate_to_supabase.py            # migrate JSON + files
    python migrate_to_supabase.py --json-only
    python migrate_to_supabase.py --dry-run

Safe to re-run: JSON keys are upserted, files are uploaded with upsert=true.
Your local files are never modified or deleted.
"""

from __future__ import annotations

import mimetypes
import sys
from pathlib import Path

# Windows consoles default to cp1252, which can't print arrows/em-dashes below.
for _stream in (sys.stdout, sys.stderr):
    if hasattr(_stream, "reconfigure"):
        _stream.reconfigure(encoding="utf-8")

ROOT = Path(__file__).resolve().parent
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from backend.utils import db, storage
from backend.utils.data_handler import _doc_key, DB_DIR, _REPO_ROOT

DRY_RUN = "--dry-run" in sys.argv
JSON_ONLY = "--json-only" in sys.argv


def migrate_json() -> int:
    if not DB_DIR.exists():
        print(f"! No Database/ directory at {DB_DIR}")
        return 0
    count = 0
    for path in sorted(DB_DIR.rglob("*.json")):
        # Skip atomic-write temp files
        if path.name.startswith(".scc_"):
            continue
        key = _doc_key(path)
        try:
            import json
            data = json.loads(path.read_text(encoding="utf-8") or "null")
        except Exception as exc:
            print(f"! Skipped {key}: {exc}")
            continue
        if data is None:
            continue
        print(f"  {'[dry] ' if DRY_RUN else ''}documents ← {key}")
        if not DRY_RUN:
            db.kv_set(key, data)
        count += 1
    return count


def migrate_files() -> int:
    if not storage.is_remote():
        print("! Supabase Storage not configured (SUPABASE_URL / SERVICE_ROLE_KEY) "
              "— skipping binary upload.")
        return 0
    count = 0
    for root_name in ("company_data", "uploads"):
        base = _REPO_ROOT / root_name
        if not base.exists():
            continue
        for path in sorted(base.rglob("*")):
            if not path.is_file() or path.name == ".gitkeep":
                continue
            rel = path.relative_to(_REPO_ROOT).as_posix()
            ctype = mimetypes.guess_type(path.name)[0] or "application/octet-stream"
            print(f"  {'[dry] ' if DRY_RUN else ''}storage ← {rel}")
            if not DRY_RUN:
                try:
                    storage.save_bytes(rel, path.read_bytes(), ctype)
                except Exception as exc:
                    print(f"! Failed {rel}: {exc}")
                    continue
            count += 1
    return count


def main() -> None:
    if not db.is_enabled():
        print("ERROR: DATABASE_URL is not set (or the connection failed). "
              "Populate .env first — nothing to migrate into.")
        sys.exit(1)

    print("== Migrating JSON documents → Postgres ==")
    n_json = migrate_json()
    print(f"   {n_json} documents migrated.\n")

    n_files = 0
    if not JSON_ONLY:
        print("== Migrating binary files → Supabase Storage ==")
        n_files = migrate_files()
        print(f"   {n_files} files migrated.\n")

    print(f"Done.{' (dry run — nothing written)' if DRY_RUN else ''} "
          f"JSON={n_json} files={n_files}")


if __name__ == "__main__":
    main()
