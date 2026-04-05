"""One-time database migration script.

Run: python migrate_db.py

Actions:
1. Hash all plaintext passwords with bcrypt
2. Add verification_status + verification fields to companies
3. Add verification_status + verification fields to suppliers
4. Add missing timestamps to user records
5. Ensure consistent schema across all entities
"""

import json
import uuid
from datetime import datetime, timezone
from pathlib import Path

import bcrypt

DB = Path("Database")

def read_json(p: Path):
    if not p.exists():
        return []
    with open(p, "r", encoding="utf-8") as f:
        txt = f.read().strip()
        return json.loads(txt) if txt else []

def write_json(p: Path, data):
    p.parent.mkdir(parents=True, exist_ok=True)
    with open(p, "w", encoding="utf-8") as f:
        json.dump(data, f, indent=2, ensure_ascii=False)

def hash_pw(plain: str) -> str:
    return bcrypt.hashpw(plain.encode(), bcrypt.gensalt()).decode()

NOW = datetime.now(timezone.utc).isoformat()

# ── 1. Hash passwords in all user files ──
user_files = [
    DB / "admin" / "users.json",
    DB / "clients" / "users.json",
    DB / "construction" / "users.json",
    DB / "suppliers" / "users.json",
]

hashed_count = 0
for path in user_files:
    users = read_json(path)
    changed = False
    for u in users:
        pw = u.get("password_hash", "")
        if pw.startswith("__PLAINTEXT__"):
            plain = pw.replace("__PLAINTEXT__", "").replace("__HASH_BEFORE_PRODUCTION__", "")
            u["password_hash"] = hash_pw(plain)
            hashed_count += 1
            changed = True
        # Ensure user_id exists
        if not u.get("user_id"):
            u["user_id"] = str(uuid.uuid4())
            changed = True
        # Ensure timestamps
        if not u.get("created_at"):
            u["created_at"] = NOW
            changed = True
        if not u.get("updated_at"):
            u["updated_at"] = NOW
            changed = True
    if changed:
        write_json(path, users)
print(f"  Hashed {hashed_count} plaintext passwords")

# ── 2. Enhance companies.json ──
companies_path = DB / "construction" / "companies.json"
companies = read_json(companies_path)
for c in companies:
    # Add verification_status if missing
    if "verification_status" not in c:
        is_registered = c.get("legal_info", {}).get("registered", False)
        is_secp = c.get("legal_info", {}).get("secp_registered", False)
        if is_registered and is_secp:
            c["verification_status"] = "verified"
        elif is_registered or is_secp:
            c["verification_status"] = "pending"
        else:
            c["verification_status"] = "not_submitted"
    # Add verification documents dict if missing
    if "verification" not in c:
        c["verification"] = {}
    # Ensure slug exists
    if not c.get("slug"):
        name = c.get("company_name", "unknown")
        import re
        slug = re.sub(r"[^a-z0-9\s-]", "", name.lower().strip())
        slug = re.sub(r"[\s]+", "-", slug)
        c["slug"] = slug
    # Ensure status field
    if "status" not in c:
        c["status"] = "active"

write_json(companies_path, companies)
print(f"  Enhanced {len(companies)} companies with verification fields")

# ── 3. Enhance catalog.json ──
suppliers_path = DB / "suppliers" / "catalog.json"
suppliers = read_json(suppliers_path)
for s in suppliers:
    if "verification_status" not in s:
        s["verification_status"] = "not_submitted"
    if "verification" not in s:
        s["verification"] = {}
    if not s.get("slug"):
        name = s.get("supplier_name", "unknown")
        import re
        slug = re.sub(r"[^a-z0-9\s-]", "", name.lower().strip())
        slug = re.sub(r"[\s]+", "-", slug)
        s["slug"] = slug
    if "status" not in s:
        s["status"] = "active"

write_json(suppliers_path, suppliers)
print(f"  Enhanced {len(suppliers)} suppliers with verification fields")

# ── 4. Create requests collection if missing ──
requests_path = DB / "requests"
requests_path.mkdir(exist_ok=True)
requests_file = requests_path / "requests.json"
if not requests_file.exists():
    write_json(requests_file, [])
    print("  Created Database/requests/requests.json")

print("\nMigration complete!")
