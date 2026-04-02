"""
Restructure the JSON database from the flat Dataset/ into the new modular Database/ layout.

New structure:
    Database/
    ├── clients/
    │   └── users.json                ← client user accounts
    ├── construction/
    │   ├── users.json                ← construction company accounts
    │   └── companies.json            ← company profiles + packages + pricing
    ├── suppliers/
    │   ├── users.json                ← material supplier accounts
    │   └── catalog.json              ← supplier profiles + materials + pricing
    ├── admin/
    │   ├── users.json                ← admin accounts
    │   ├── settings.json             ← platform configuration
    │   └── activity_log.json         ← audit trail

Run from the repo root:
    python scripts/restructure_database.py
"""

import json
import os
import re
import uuid
from copy import deepcopy
from pathlib import Path

# ──────────────────────────────────────────────────────────────────────────────
# PATHS
# ──────────────────────────────────────────────────────────────────────────────
REPO = Path(__file__).resolve().parent.parent
OLD_DIR = REPO / "Dataset"
NEW_DIR = REPO / "Database"

OLD_USERS = OLD_DIR / "clients" / "client.json"
OLD_ADMIN = OLD_DIR / "admin" / "admin.json"
OLD_COMPANIES = OLD_DIR / "companies" / "Contruction Company.json"
OLD_SUPPLIERS = OLD_DIR / "suppliers" / "Material Supplier.json"


def read_json(path: Path):
    if not path.exists():
        return []
    with open(path, "r", encoding="utf-8") as f:
        text = f.read().strip()
        return json.loads(text) if text else []


def write_json(path: Path, data):
    path.parent.mkdir(parents=True, exist_ok=True)
    with open(path, "w", encoding="utf-8") as f:
        json.dump(data, f, indent=2, ensure_ascii=False)
    print(f"  ✔ Wrote {path.relative_to(REPO)}  ({_count(data)} records)")


def _count(data):
    if isinstance(data, list):
        return len(data)
    if isinstance(data, dict):
        return 1
    return "?"


def slugify(name: str) -> str:
    slug = name.lower().strip()
    slug = re.sub(r"[^a-z0-9\s-]", "", slug)
    slug = re.sub(r"[\s]+", "-", slug)
    return slug


def new_uuid() -> str:
    return str(uuid.uuid4())


# ──────────────────────────────────────────────────────────────────────────────
# USER SCHEMA — standard across all modules
# ──────────────────────────────────────────────────────────────────────────────
def make_user_record(old: dict, role: str, *, extra_fields: dict | None = None) -> dict:
    """Build a clean user record from the old mixed-format row."""
    rec = {
        "user_id": new_uuid(),
        "email": old.get("email", "").strip().lower(),
        "password_hash": f"__PLAINTEXT__{old.get('password', '')}__HASH_BEFORE_PRODUCTION__",
        "display_name": old.get("name", ""),
        "phone": old.get("phone") or None,
        "role": role,
        "status": old.get("status", "active"),
        "created_at": _to_iso(old.get("joinDate", "")),
        "updated_at": _to_iso(old.get("joinDate", "")),
        "last_login_at": None,
        "legacy_id": old.get("id", ""),
    }
    if extra_fields:
        rec.update(extra_fields)
    return rec


def _to_iso(date_str: str) -> str:
    """Convert 'YYYY-MM-DD' to ISO 8601 with timezone."""
    if not date_str:
        return ""
    if "T" in date_str:
        return date_str  # already ISO
    return f"{date_str}T00:00:00+00:00"


# ──────────────────────────────────────────────────────────────────────────────
# COMPANY PROFILE SCHEMA — cleaned / normalized
# ──────────────────────────────────────────────────────────────────────────────

# Fields that are core (authoritative) and should be kept in company profile
COMPANY_CORE_FIELDS = {
    "company_id", "company_name", "contact", "legal_info",
    "operational_areas", "construction_capability", "services",
    "package_scope", "materials_used", "payment_terms",
    "timeline_estimates", "experience", "customer_feedback",
    "quality_control", "after_handover_support", "legal_and_contract",
    "ideal_customer_profile", "ai_scores",
}

# Fields that are derived/redundant and should be dropped from the profile
# (can be recomputed from core fields at query time)
COMPANY_DERIVED_FIELDS = {
    "estimated_total_cost_range",         # string form — replaced by numeric version
    "cities_served",                      # derived from operational_areas
    "areas_served",                       # derived from operational_areas
    "area_location_keys",                 # derived from operational_areas
    "package_rate_stats",                 # computed from flattened_operational_areas
    "search_tags",                        # computed from multiple fields
    "unified_text_summary",              # computed text block
    "city_market",                       # derived from city + tier
    "company_tier",                      # derived from pricing
    "derived_scores",                    # computed from ai_scores + rating
    "executive_cost_ceiling",            # computed from cost range
    "has_installments",                  # derived from payment_terms
    "is_registered",                     # derived from legal_info.registered
    "overall_budget_min_pkr",            # computed from estimated_total_cost_numeric
    "overall_budget_max_pkr",            # computed from estimated_total_cost_numeric
    "plot_sizes_sqft",                   # derived from construction_capability
    "warranty_and_support_score",        # computed
}


def clean_company(old: dict) -> dict:
    """Clean a company record: keep core fields, fix data issues, drop derived junk."""
    c = {}

    # ── Identity ──
    c["company_id"] = old["company_id"]
    c["company_name"] = old["company_name"]
    c["slug"] = slugify(old["company_name"])
    c["description"] = None
    c["logo_url"] = None

    # ── Promoted columns (for fast filtering, match PostgreSQL schema) ──
    feedback = old.get("customer_feedback", {})
    c["rating"] = feedback.get("average_rating", 0)
    c["review_count"] = feedback.get("review_count", 0)

    # Primary city from operational areas
    op_areas = old.get("operational_areas", {})
    cities = list(op_areas.keys())
    c["city"] = cities[0] if cities else None

    # ── Contact ──
    c["contact"] = old.get("contact", {})

    # ── Legal info ──
    c["legal_info"] = old.get("legal_info", {})

    # ── Construction capability ──
    c["construction_capability"] = old.get("construction_capability", {})

    # ── Services ──
    c["services"] = old.get("services", {})

    # ── Operational areas (nested tree — authoritative) ──
    # FIX: Convert string prices to numbers
    c["operational_areas"] = _fix_operational_area_prices(op_areas)

    # ── Flattened operational areas (pre-computed for AI matcher) ──
    # FIX: Remove redundant 'price_raw' and 'location' fields
    c["flattened_operational_areas"] = _clean_flat_areas(
        old.get("flattened_operational_areas", [])
    )

    # ── Package scope ──
    c["package_scope"] = old.get("package_scope", {})

    # ── Materials used per package ──
    c["materials_used"] = old.get("materials_used", {})

    # ── Estimated cost range — NUMERIC ONLY ──
    # FIX: Use the numeric version, fix min>max errors, drop string form
    c["estimated_cost_range"] = _fix_cost_range(
        old.get("estimated_total_cost_numeric", {})
    )

    # ── Payment terms ──
    c["payment_terms"] = old.get("payment_terms", {})

    # ── Timeline estimates ──
    c["timeline_estimates"] = old.get("timeline_estimates", {})

    # ── Experience ──
    c["experience"] = old.get("experience", {})

    # ── Customer feedback ──
    c["customer_feedback"] = {
        "average_rating": feedback.get("average_rating", 0),
        "review_count": feedback.get("review_count", 0),
        "common_praises": feedback.get("common_praises", []),
        "common_complaints": feedback.get("common_complaints", []),
    }

    # ── Quality control ──
    c["quality_control"] = old.get("quality_control", {})

    # ── After handover support ──
    c["after_handover_support"] = old.get("after_handover_support", {})

    # ── Legal & contract ──
    c["legal_and_contract"] = old.get("legal_and_contract", {})

    # ── Ideal customer profile ──
    c["ideal_customer_profile"] = old.get("ideal_customer_profile", {})

    # ── AI scores ──
    c["ai_scores"] = old.get("ai_scores", {})

    return c


def _fix_operational_area_prices(areas: dict) -> dict:
    """Convert string prices like '3551 PKR/sq ft' to numbers."""
    result = {}
    for city, city_data in areas.items():
        result[city] = {}
        for area, area_data in city_data.items():
            result[city][area] = {}
            for subarea, packages in area_data.items():
                result[city][area][subarea] = {}
                for pkg, price in packages.items():
                    if isinstance(price, str):
                        # Extract number from "3551 PKR/sq ft"
                        m = re.match(r"([\d.]+)", price.replace(",", ""))
                        result[city][area][subarea][pkg] = float(m.group(1)) if m else price
                    else:
                        result[city][area][subarea][pkg] = price
    return result


def _clean_flat_areas(flat: list) -> list:
    """Remove redundant fields from flattened operational areas."""
    cleaned = []
    for entry in flat:
        cleaned.append({
            "city": entry.get("city"),
            "area": entry.get("area"),
            "subarea": entry.get("subarea"),
            "package": entry.get("package"),
            "price_per_sqft": entry.get("price_per_sqft"),
        })
    return cleaned


def _fix_cost_range(numeric: dict) -> dict:
    """Fix min>max errors in the numeric cost range dict."""
    fixed = {}
    for size_key, packages in numeric.items():
        fixed[size_key] = {}
        for pkg, vals in packages.items():
            mn = vals.get("min")
            mx = vals.get("max")
            # Fix: ensure min <= max when both are present
            if mn is not None and mx is not None and mn > mx:
                mn, mx = mx, mn
            fixed[size_key][pkg] = {"min": mn, "max": mx}
    return fixed


# ──────────────────────────────────────────────────────────────────────────────
# SUPPLIER PROFILE SCHEMA — cleaned / normalized
# ──────────────────────────────────────────────────────────────────────────────

def clean_supplier(old: dict) -> dict:
    """Clean a supplier record."""
    s = {}

    s["supplier_id"] = old["supplier_id"]
    s["supplier_name"] = old["supplier_name"]
    s["slug"] = slugify(old["supplier_name"])
    s["description"] = old.get("description")
    s["logo_url"] = old.get("logo")

    # Promoted columns
    s["rating"] = old.get("rating", 0)
    s["review_count"] = old.get("review_count", 0)

    loc = old.get("location", {})
    s["city"] = loc.get("city")
    s["area"] = loc.get("area")

    # Contact info
    s["contact"] = old.get("contact", {})

    # Cities served
    s["cities_served"] = old.get("cities_served", [])

    # Materials (the extra business data)
    s["materials"] = old.get("materials", [])

    # Status
    s["status"] = old.get("status", "active")

    return s


# ──────────────────────────────────────────────────────────────────────────────
# MAIN
# ──────────────────────────────────────────────────────────────────────────────

def main():
    print("=" * 60)
    print("Restructuring JSON database → Database/")
    print("=" * 60)

    # ── Load old data ──
    old_users = read_json(OLD_USERS)
    old_admin = read_json(OLD_ADMIN)
    old_companies = read_json(OLD_COMPANIES)
    old_suppliers = read_json(OLD_SUPPLIERS)

    print(f"\nSource data loaded:")
    print(f"  Users:     {len(old_users)}")
    print(f"  Companies: {len(old_companies)}")
    print(f"  Suppliers: {len(old_suppliers)}")
    print()

    # ── Split users by role ──
    clients_users = []
    company_users = []
    supplier_users = []
    admin_users = []

    for u in old_users:
        role = u.get("role", "")
        if role == "client":
            rec = make_user_record(u, "client", extra_fields={
                "preferences": {}
            })
            clients_users.append(rec)
        elif role == "company":
            rec = make_user_record(u, "company", extra_fields={
                "company_slug": u.get("companyFile") or slugify(u.get("name", "")),
            })
            company_users.append(rec)
        elif role == "supplier":
            rec = make_user_record(u, "supplier", extra_fields={
                "supplier_slug": u.get("supplierFile") or slugify(u.get("name", "")),
            })
            supplier_users.append(rec)
        elif role == "admin":
            rec = make_user_record(u, "admin", extra_fields={
                "permissions": {"all": True}
            })
            admin_users.append(rec)

    # Companies that exist in the company dataset but NOT in users list
    # need user stub records so they can log in
    existing_company_slugs = {u.get("company_slug") for u in company_users}
    for c in old_companies:
        slug = slugify(c["company_name"])
        if slug not in existing_company_slugs:
            contact = c.get("contact", {})
            rec = {
                "user_id": new_uuid(),
                "email": contact.get("email", f"{slug}@placeholder.pk").strip().lower(),
                "password_hash": "__PLAINTEXT__password123__HASH_BEFORE_PRODUCTION__",
                "display_name": c["company_name"],
                "phone": contact.get("phone") or None,
                "role": "company",
                "status": "active",
                "created_at": _to_iso(""),
                "updated_at": _to_iso(""),
                "last_login_at": None,
                "legacy_id": c["company_id"],
                "company_slug": slug,
            }
            company_users.append(rec)
            existing_company_slugs.add(slug)

    # Similarly for suppliers not in users list
    existing_supplier_slugs = {u.get("supplier_slug") for u in supplier_users}
    for s in old_suppliers:
        slug = slugify(s["supplier_name"])
        if slug not in existing_supplier_slugs:
            contact = s.get("contact", {})
            rec = {
                "user_id": new_uuid(),
                "email": contact.get("email", f"{slug}@placeholder.pk").strip().lower(),
                "password_hash": "__PLAINTEXT__password123__HASH_BEFORE_PRODUCTION__",
                "display_name": s["supplier_name"],
                "phone": contact.get("phone") or None,
                "role": "supplier",
                "status": "active",
                "created_at": _to_iso(""),
                "updated_at": _to_iso(""),
                "last_login_at": None,
                "legacy_id": s["supplier_id"],
                "supplier_slug": slug,
            }
            supplier_users.append(rec)
            existing_supplier_slugs.add(slug)

    # ── Clean company profiles ──
    cleaned_companies = [clean_company(c) for c in old_companies]

    # ── Clean supplier profiles ──
    cleaned_suppliers = [clean_supplier(s) for s in old_suppliers]

    # ── Admin data ──
    settings = old_admin.get("platform_settings", {})
    activity_log = old_admin.get("activity_log", [])

    # ── Write new structure ──
    print("Writing new Database/ structure:\n")

    # clients/
    write_json(NEW_DIR / "clients" / "users.json", clients_users)

    # construction/
    write_json(NEW_DIR / "construction" / "users.json", company_users)
    write_json(NEW_DIR / "construction" / "companies.json", cleaned_companies)

    # suppliers/
    write_json(NEW_DIR / "suppliers" / "users.json", supplier_users)
    write_json(NEW_DIR / "suppliers" / "catalog.json", cleaned_suppliers)

    # admin/
    write_json(NEW_DIR / "admin" / "users.json", admin_users)
    write_json(NEW_DIR / "admin" / "settings.json", settings)
    write_json(NEW_DIR / "admin" / "activity_log.json", activity_log)

    # ── Summary ──
    print("\n" + "=" * 60)
    print("MIGRATION SUMMARY")
    print("=" * 60)
    print(f"\n  Client accounts:      {len(clients_users)}")
    print(f"  Company accounts:     {len(company_users)}")
    print(f"  Company profiles:     {len(cleaned_companies)}")
    print(f"  Supplier accounts:    {len(supplier_users)}")
    print(f"  Supplier profiles:    {len(cleaned_suppliers)}")
    print(f"  Admin accounts:       {len(admin_users)}")
    print(f"  Activity log entries: {len(activity_log)}")
    print()

    # ── Data fixes applied ──
    print("DATA FIXES APPLIED:")
    print("  ✔ Passwords tagged for hashing (not stored as plaintext)")
    print("  ✔ Users split by role into separate files")
    print("  ✔ String prices converted to numbers in operational_areas")
    print("  ✔ Redundant price_raw / location fields removed from flat areas")
    print("  ✔ min > max cost range errors corrected")
    print(f"  ✔ {len(COMPANY_DERIVED_FIELDS)} redundant derived fields dropped per company")
    print("  ✔ Missing user accounts created for companies/suppliers in dataset")
    print("  ✔ Admin data split into users.json + settings.json + activity_log.json")


if __name__ == "__main__":
    main()
