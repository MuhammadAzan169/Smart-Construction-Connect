# Smart Construction Connect — JSON Data Analysis & Issues Report

## Summary

Full audit of the JSON-based database before migration to PostgreSQL.
**12 issues** found across security, structure, consistency, and completeness.

---

## Issue #1 — CRITICAL: Plaintext Passwords

**Files:** `Dataset/clients/client.json`, `Dataset/admin/admin.json`
**Severity:** Critical (OWASP A02 – Cryptographic Failures)

Every user record stores passwords as plaintext:
```json
{ "password": "password123" }
```
The backend `auth.py` compares directly:
```python
if user.get("password") != req.password:   # ← no hashing
```

**Fix:** Hash all passwords with Argon2id (via `passlib`) before inserting into
`auth.users.password_hash`. Force a password-reset email to all users after migration.

---

## Issue #2 — CRITICAL: Missing `Users.json` File

**File:** `backend/utils/data_handler.py` → `users_path()` → `Dataset/Users.json`
**Severity:** Critical (causes `KeyError` / empty user list at runtime)

The function `get_all_users()` reads `Dataset/Users.json`, but that file does not exist.
The actual user list sits at `Dataset/clients/client.json`. Any call to `/api/auth/login`
or `/api/admin/users` silently returns an empty list.

**Fix:** Point `users_path()` to `Dataset/clients/client.json`, or rename the file,
before migrating to the database.

---

## Issue #3 — All User Roles Mixed in One File

**File:** `Dataset/clients/client.json`
**Severity:** High (poor separation of concerns, harder to query)

The file is named "clients" but holds rows for all four roles:
`client`, `company`, `supplier`, and `admin`.
Role-specific fields like `companyFile` / `supplierFile` are present only on some rows,
creating a sparse, error-prone structure.

**Fix:** In PostgreSQL, `auth.users` holds the account row for every role, and each role
gets its own `profiles.*` table (see `schema.sql`).

---

## Issue #4 — Admin Record Mixes Three Concerns

**File:** `Dataset/admin/admin.json`
**Severity:** High

The single JSON object combines:
1. Admin credentials (`admin_id`, `email`, `password`)
2. Platform settings (`platform_settings`)
3. Activity log (`activity_log` array)

These are three completely independent data domains.

**Fix in PostgreSQL:**
| JSON key          | → Table                       |
|-------------------|-------------------------------|
| credentials       | `auth.users` + `profiles.admins` |
| platform_settings | `admin.platform_settings`     |
| activity_log      | `admin.activity_log`          |

---

## Issue #5 — Non-UUID Legacy IDs with No Referential Integrity

**Severity:** Medium

| Record type | ID format   | Example      |
|-------------|-------------|--------------|
| User        | `U-xxx`     | `U-001`      |
| Admin       | `ADMIN-xxx` | `ADMIN-001`  |
| Company     | `CC-xxx`    | `CC-001`     |
| Supplier    | `MS-xxx`    | `MS-001`     |

There is no FK linking the company row (`CC-001`) to its auth row (`U-002`).
The link is an informal string field: `"companyFile": "karachi-builders"`.

**Fix:** Use UUIDs as primary keys with real `REFERENCES` constraints (see `schema.sql`).
Store old IDs in a `legacy_id` column for traceability.

---

## Issue #6 — Empty Placeholder Files

**Files:** `Dataset/companies/companies.json`, `Dataset/suppliers/suppliers.json`
**Severity:** Low (confusing; potential future bugs)

Both files are empty (`0 bytes`). The actual data is in
`Contruction Company.json` and `Material Supplier.json`.
Having empty files alongside real data files creates confusion about which file is canonical.

**Fix:** Delete the empty files after migration; the database is the single source of truth.

---

## Issue #7 — Typo in File and Folder Names

**Paths:** `Dataset/companies/Contruction Company.json`, `Contruction AI/`
**Severity:** Low (aesthetics / professionalism)

"Contruction" is missing the "s" in "Construction".

**Fix:** After migration these files can be archived. Rename the `Contruction AI/` folder
to `Construction AI/`.

---

## Issue #8 — Prices Stored as Strings Instead of Numbers

**File:** `Dataset/companies/Contruction Company.json`
**Severity:** Medium (breaks numeric comparisons, requires string parsing)

`operational_areas` stores prices as strings:
```json
"Gulberg III": { "standard": "3551 PKR/sq ft" }
```

`flattened_operational_areas` correctly stores them as numbers:
```json
{ "price_per_sqft": 3551.0, "price_raw": "3551 PKR/sq ft" }
```

This redundancy creates a sync risk: if one is updated, the other goes stale.

**Fix (schema.sql):** In `company_pricing.operational_areas` store prices as plain numbers.
Drop `price_raw`; the unit is always `PKR/sq ft` and can be a schema-level constant.

---

## Issue #9 — Cost Ranges Stored as Human-Readable Strings

**Severity:** Medium

```json
"estimated_total_cost_range": {
    "3_marla": { "standard": "3.4M to 3.9M PKR" }
}
```

Not machine-parseable. The companion field `estimated_total_cost_numeric` provides {min, max}
as proper integers, but both fields exist in the same record — redundancy.

**Fix:** Keep only the numeric form in `company_pricing.estimated_cost_range`.
Apply rounding and display formatting in the frontend, not in the database.

---

## Issue #10 — DATA ERROR: Cost Range min > max

**File:** `Dataset/companies/Contruction Company.json` — company `CC-001`
**Severity:** High (incorrect data shown to users)

For `3_marla.premium`:
```json
"standard": "3.4M to 3.9M PKR",
"premium":  "4.8M to 4.6M PKR"   ← min (4.8M) is greater than max (4.6M)!
```

Numeric version confirms the error:
```json
"premium": { "min": 4760000, "max": 4620000 }   ← min > max
```

**Fix (migration_seed.sql):** Values swapped to `{"min": 4620000, "max": 4800000}`.
The same audit should be applied to all companies in the dataset.

---

## Issue #11 — Redundant Derived Fields in Company JSON

**Severity:** Low-Medium (storage waste + sync risk)

These fields in each company record are fully derivable from `operational_areas`:
- `flattened_operational_areas` — flat expansion of the nested tree
- `cities_served` — list of distinct cities
- `areas_served` — list of distinct areas
- `area_location_keys` — colon-joined location strings
- `package_rate_stats` — min/max/count per package
- `estimated_total_cost_numeric` — numeric version of the string cost range

If `operational_areas` is updated but the derived fields are not regenerated,
the data becomes inconsistent.

**Fix:** Store only `operational_areas` (authoritative) and `flattened_operational_areas`
(pre-computed for the AI matcher). Drop all other derived fields; compute them via SQL
or application logic on demand.

---

## Issue #12 — Activity Log References Email, Not User ID

**File:** `Dataset/admin/admin.json`
**Severity:** Medium

```json
{ "action": "user_approved", "target": "info@001builders.com" }
```

If a user changes their email, all historical log entries become incorrect.

**Fix (schema.sql):** `admin.activity_log` has:
- `actor_user_id uuid REFERENCES auth.users(user_id)` — who did the action
- `target_type text` + `target_id text` — what was acted upon (UUID or slug)
- Original email preserved in `details` text for human readability

---

## Redundancy Map (what to drop vs. keep)

| JSON field                      | Action              | Reason                             |
|---------------------------------|---------------------|------------------------------------|
| `cities_served` (on companies)  | Drop                | Derived from `operational_areas`   |
| `areas_served`                  | Drop                | Derived from `operational_areas`   |
| `area_location_keys`            | Drop                | Derived from `operational_areas`   |
| `package_rate_stats`            | Drop                | Computed on demand                 |
| `estimated_total_cost_numeric`  | Keep → rename       | Becomes `estimated_cost_range`     |
| `estimated_total_cost_range`    | Drop (string form)  | Replaced by numeric version        |
| `price_raw` in flat areas       | Drop                | Unit is constant (`PKR/sq ft`)     |
| `location` (on suppliers)       | Promote to columns  | `suppliers.city`, `suppliers.area` |

---

## Recommended Migration Order

```
1. Run schema.sql          → create all tables and indexes
2. Hash all passwords      → python scripts/hash_passwords.py
3. Run migration_seed.sql  → import users, companies, suppliers, activity log
4. Validate row counts     → compare against JSON array lengths
5. Update backend          → swap data_handler.py for DB repository layer
6. Force password resets   → email all users with reset links
7. Archive JSON files      → move Dataset/ to Dataset/_archive/
```
