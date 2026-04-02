# Smart Construction Connect — PostgreSQL (JSONB) Schema & Architecture

## Goals (what this design optimizes for)
- **Separation of concerns**: authentication/account state is isolated from business/profile data.
- **Role separation**: client, admin, company, supplier each have their own table and JSONB payload.
- **Simple today, scalable later**: start with JSONB-first tables, add typed columns/indexes only for fields you query frequently.
- **Fast querying**: btree indexes for identity/lookups, GIN indexes for JSONB search, optional generated columns for hot paths.
- **Easy updates**: update company pricing/supplier inventory without touching auth rows.
- **AI/RAG-ready**: add chat history + content tables now; add embeddings later (optionally with `pgvector`).

This document is a **schema blueprint** (DDL-style) and a **data contract** for your backend/frontend.

---

## Current JSON sources (what we are migrating)
Your local JSON files map cleanly to these domains:
- `Dataset/Users.json` → **accounts + role association** (currently mixed together)
- `Dataset/admin.json` → **platform settings + activity log**
- `Dataset/companies/Contruction Company.json` → **company catalog + pricing + operational areas**
- `Dataset/suppliers/Material Supplier.json` → **supplier catalog + materials list**

The database design below preserves the flexibility of those JSON payloads while making them queryable.

---

## High-level modular architecture
Suggested Postgres schemas (namespaces) to keep modules clean:
- `auth` — login/authentication only
- `profiles` — role-specific data (client/company/supplier/admin)
- `admin` — platform settings + audit log
- `marketplace` — requests/quotes workflow
- `ai` — chat + RAG support (optional but planned)

You can implement this with FastAPI using a service/repository pattern:
- **Routers** (`backend/routers/*`) → **Services** (business rules) → **Repositories** (SQL) → Postgres

---

## Postgres prerequisites (recommended)
```sql
-- UUID generation used by the DDL in this document.
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Optional: case-insensitive email uniqueness.
CREATE EXTENSION IF NOT EXISTS citext;

-- Optional (later): vector search for RAG.
-- CREATE EXTENSION IF NOT EXISTS vector; -- pgvector
```

---

## Core enums (recommended)
```sql
-- Keep roles/status strict and indexable.
CREATE TYPE auth.user_role AS ENUM ('client', 'admin', 'company', 'supplier');
CREATE TYPE auth.user_status AS ENUM ('active', 'pending', 'banned');

CREATE TYPE marketplace.request_status AS ENUM ('pending', 'accepted', 'rejected', 'completed');
```

---

## 1) Authentication & account state (auth only)
### Table: `auth.users`
**Rule**: store *only* login/auth and account state here.

```sql
CREATE TABLE auth.users (
  user_id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email             text NOT NULL UNIQUE,
  password_hash     text NOT NULL,
  role              auth.user_role NOT NULL,
  status            auth.user_status NOT NULL DEFAULT 'active',

  created_at        timestamptz NOT NULL DEFAULT now(),
  last_login_at     timestamptz,

  -- optional: for migration/traceability
  legacy_user_id    text
);

-- Fast lookups
CREATE INDEX users_role_status_idx ON auth.users(role, status);
```

**Notes**
- Use **hashed passwords** (Argon2/bcrypt) instead of plaintext.
- If you want case-insensitive email uniqueness, use `citext`:
  - `CREATE EXTENSION IF NOT EXISTS citext;` and change `email` to `citext`.

**Example record**
```json
{
  "user_id": "8e2c2a36-3c62-4f76-a4f4-0b05d2c6b351",
  "email": "info@001builders.com",
  "password_hash": "$argon2id$v=19$...",
  "role": "company",
  "status": "active",
  "legacy_user_id": "U-002",
  "created_at": "2026-01-10T00:00:00Z"
}
```

---

## 2) Client (separate from auth)
### Table: `profiles.clients`
```sql
CREATE TABLE profiles.clients (
  client_id     uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       uuid NOT NULL UNIQUE REFERENCES auth.users(user_id) ON DELETE CASCADE,

  display_name  text,
  phone         text,

  profile_json  jsonb NOT NULL DEFAULT '{}'::jsonb,
  preferences   jsonb NOT NULL DEFAULT '{}'::jsonb,

  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX clients_profile_gin ON profiles.clients USING gin (profile_json);
CREATE INDEX clients_prefs_gin   ON profiles.clients USING gin (preferences);
```

**What goes in JSONB**
- `profile_json`: address, demographics, saved locations, etc.
- `preferences`: preferred cities/areas, preferred vendors, budget style, notification settings

**Example `preferences` JSON**
```json
{
  "preferred_cities": ["Lahore", "Islamabad"],
  "preferred_societies": ["DHA", "Bahria Town"],
  "budget_range_pkr": {"min": 8000000, "max": 12000000},
  "preferred_package": "premium"
}
```

---

## 3) Construction Company (profile + pricing/packages)
### Table: `profiles.companies`
Stores the editable **company profile** JSON (what your dashboard edits and saves).

```sql
CREATE TABLE profiles.companies (
  company_id      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         uuid NOT NULL UNIQUE REFERENCES auth.users(user_id) ON DELETE CASCADE,

  slug            text NOT NULL UNIQUE,
  company_name    text NOT NULL,

  profile_json    jsonb NOT NULL DEFAULT '{}'::jsonb,

  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX companies_name_idx ON profiles.companies(company_name);
CREATE INDEX companies_profile_gin ON profiles.companies USING gin (profile_json);
```

### Table: `profiles.company_pricing`
Keep pricing/packages in a separate JSONB row so it can be updated frequently and independently.

```sql
CREATE TABLE profiles.company_pricing (
  company_id                    uuid PRIMARY KEY REFERENCES profiles.companies(company_id) ON DELETE CASCADE,

  operational_areas             jsonb NOT NULL DEFAULT '{}'::jsonb,
  flattened_operational_areas   jsonb NOT NULL DEFAULT '[]'::jsonb,
  package_scope                 jsonb NOT NULL DEFAULT '{}'::jsonb,
  materials_used                jsonb NOT NULL DEFAULT '{}'::jsonb,
  estimated_total_cost_range    jsonb NOT NULL DEFAULT '{}'::jsonb,

  updated_at                    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX company_pricing_flat_gin ON profiles.company_pricing USING gin (flattened_operational_areas);
CREATE INDEX company_pricing_scope_gin ON profiles.company_pricing USING gin (package_scope);
```

**JSON structure (based on your dataset/editor)**
- `profile_json` typically contains keys like:
  - `contact`, `legal_info`, `payment_terms`, `construction_capability`, `services_offered`
  - `timeline_estimates`, `materials_used`, `reliability_score`, etc.
- Pricing JSONB matches your existing `operational_areas`, `flattened_operational_areas`, `package_scope`, etc.

**Example: minimal `profile_json`**
```json
{
  "contact": {"phone": "+92-42-...", "email": "info@...", "website": "..."},
  "legal_info": {"registered": true, "secp_registered": true, "ntn": "..."},
  "services_offered": {"construction": ["grey_structure"], "design": ["architectural"]}
}
```

---

## 4) Material Supplier (profile + inventory/materials)
### Table: `profiles.suppliers`
```sql
CREATE TABLE profiles.suppliers (
  supplier_id     uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         uuid NOT NULL UNIQUE REFERENCES auth.users(user_id) ON DELETE CASCADE,

  slug            text NOT NULL UNIQUE,
  supplier_name   text NOT NULL,

  profile_json    jsonb NOT NULL DEFAULT '{}'::jsonb,

  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX suppliers_name_idx ON profiles.suppliers(supplier_name);
CREATE INDEX suppliers_profile_gin ON profiles.suppliers USING gin (profile_json);
```

### Table: `profiles.supplier_inventory`
```sql
CREATE TABLE profiles.supplier_inventory (
  supplier_id   uuid PRIMARY KEY REFERENCES profiles.suppliers(supplier_id) ON DELETE CASCADE,

  materials     jsonb NOT NULL DEFAULT '[]'::jsonb,
  availability  jsonb NOT NULL DEFAULT '{}'::jsonb,

  updated_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX supplier_materials_gin ON profiles.supplier_inventory USING gin (materials);
```

**Materials JSON structure** (matches `Material Supplier.json`)
```json
[
  {"name": "Bestway Cement (50kg)", "category": "Cement", "brand": "Bestway", "price": 1350, "unit": "bag", "stock": 5000}
]
```

---

## 5) Admin (separate from auth)
### Table: `profiles.admins`
```sql
CREATE TABLE profiles.admins (
  admin_id        uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         uuid NOT NULL UNIQUE REFERENCES auth.users(user_id) ON DELETE CASCADE,

  permissions     jsonb NOT NULL DEFAULT '{}'::jsonb,

  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX admin_permissions_gin ON profiles.admins USING gin (permissions);
```

### Table: `admin.platform_settings`
Single-row settings table (your current `platform_settings`).

```sql
CREATE TABLE admin.platform_settings (
  settings_id   int PRIMARY KEY DEFAULT 1,
  settings      jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_at    timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT single_row CHECK (settings_id = 1)
);
```

### Table: `admin.activity_log`
Replace the JSON array log with an append-only table.

```sql
CREATE TABLE admin.activity_log (
  activity_id   bigserial PRIMARY KEY,
  timestamp     timestamptz NOT NULL DEFAULT now(),

  action        text NOT NULL,
  target        text NOT NULL,
  details       text NOT NULL,

  actor_user_id uuid REFERENCES auth.users(user_id),
  meta          jsonb NOT NULL DEFAULT '{}'::jsonb
);

CREATE INDEX activity_ts_idx ON admin.activity_log(timestamp DESC);
CREATE INDEX activity_action_idx ON admin.activity_log(action);
CREATE INDEX activity_meta_gin ON admin.activity_log USING gin (meta);
```

---

## 6) Requests / Quotes workflow (client ↔ company)
Your UI already models requests (`pending/accepted/completed`). Make it real with a typed+JSONB hybrid.

### Table: `marketplace.quote_requests`
```sql
CREATE TABLE marketplace.quote_requests (
  request_id     uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  client_id      uuid NOT NULL REFERENCES profiles.clients(client_id) ON DELETE CASCADE,
  company_id     uuid REFERENCES profiles.companies(company_id) ON DELETE SET NULL,

  status         marketplace.request_status NOT NULL DEFAULT 'pending',

  summary        text NOT NULL,
  location_text  text,

  requirements   jsonb NOT NULL DEFAULT '{}'::jsonb,
  timeline       jsonb NOT NULL DEFAULT '{}'::jsonb,
  budget         jsonb NOT NULL DEFAULT '{}'::jsonb,

  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX quote_requests_client_idx ON marketplace.quote_requests(client_id, created_at DESC);
CREATE INDEX quote_requests_company_idx ON marketplace.quote_requests(company_id, created_at DESC);
CREATE INDEX quote_requests_req_gin ON marketplace.quote_requests USING gin (requirements);
```

**Example `requirements` JSON**
```json
{
  "plot_size": "5_marla",
  "floors": 2,
  "finish_level": "premium",
  "must_have": ["basement", "roof_insulation"],
  "notes": "Need DHA approval support"
}
```

---

## 7) AI / RAG integration (scaffold now, scale later)
### Chat history (works without embeddings)
```sql
CREATE TABLE ai.chat_sessions (
  session_id   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      uuid REFERENCES auth.users(user_id) ON DELETE SET NULL,
  created_at   timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE ai.chat_messages (
  message_id   bigserial PRIMARY KEY,
  session_id   uuid NOT NULL REFERENCES ai.chat_sessions(session_id) ON DELETE CASCADE,
  role         text NOT NULL CHECK (role IN ('user','assistant','system')),
  content      text NOT NULL,
  meta         jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX chat_messages_session_idx ON ai.chat_messages(session_id, created_at);
```

### RAG content (optional, add when ready)
- Store documents and chunks in JSONB; add embeddings later.

```sql
CREATE TABLE ai.rag_documents (
  document_id  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source       text NOT NULL,
  title        text,
  doc_json     jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at   timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE ai.rag_chunks (
  chunk_id     uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id  uuid NOT NULL REFERENCES ai.rag_documents(document_id) ON DELETE CASCADE,
  chunk_index  int NOT NULL,
  content      text NOT NULL,
  meta         jsonb NOT NULL DEFAULT '{}'::jsonb
);

CREATE INDEX rag_chunks_doc_idx ON ai.rag_chunks(document_id, chunk_index);
```

**Embeddings note**
- If you want real vector search later, add `pgvector` and an embeddings table. Keep it optional for now.

---

## Relationship summary
- `auth.users (1)` → `(0..1) profiles.clients / profiles.companies / profiles.suppliers / profiles.admins`
- `profiles.companies (1)` → `(1) profiles.company_pricing`
- `profiles.suppliers (1)` → `(1) profiles.supplier_inventory`
- `profiles.clients (1)` → `(N) marketplace.quote_requests`
- `profiles.companies (1)` → `(N) marketplace.quote_requests` (optional assignment)
- `auth.users (0..1)` → `(N) admin.activity_log` as `actor_user_id`

---

## API mapping (your current routes → new tables)
This keeps your backend modular: routers call services; services call repositories targeting these tables.

- `/api/auth/login`, `/api/auth/signup` → `auth.users` (+ insert into one role table)
- `/api/companies/*` → `profiles.companies`, `profiles.company_pricing`
- `/api/suppliers/*` → `profiles.suppliers`, `profiles.supplier_inventory`
- `/api/admin/users`, `/api/admin/users/status` → `auth.users` (+ `admin.activity_log`)
- `/api/admin/activity` → `admin.activity_log`
- `/api/admin/stats` → aggregated counts from `auth.users` (+ optional joins)
- `/api/ai/chat` → `ai.chat_sessions`, `ai.chat_messages` (and optionally store recommendations metadata)

When you implement the migration, you can initially keep the JSON response shapes the same as today and simply swap out the storage layer.

## Query & indexing guidance (practical)
### Fast lookups (btree)
- `auth.users.email` (unique)
- `(role, status)` for admin dashboards
- FK indexes on `user_id`, `client_id`, `company_id`, `supplier_id`

### JSONB search (GIN)
Use GIN indexes on JSONB that you filter by:
- `profiles.company_pricing.flattened_operational_areas`
- `profiles.supplier_inventory.materials`
- `marketplace.quote_requests.requirements`

### When JSONB becomes too slow
Promote “hot” JSON fields into typed columns or generated columns. Example:
```sql
ALTER TABLE profiles.companies
  ADD COLUMN primary_city text
  GENERATED ALWAYS AS ((profile_json #>> '{contact,city}')) STORED;

CREATE INDEX companies_primary_city_idx ON profiles.companies(primary_city);
```

---

## Migration approach (recommended)
1. Create tables above (empty)
2. Import `Users.json` → `auth.users` + role tables
3. Import company/supplier datasets → `profiles.companies/suppliers` (as catalog rows)
4. Import per-profile JSON files into `profile_json` / pricing/inventory tables
5. Switch backend repositories from filesystem to SQL

---

## Deliverables in this repo
- Diagram: `docs/database/architecture.mmd`
- This schema doc: `docs/database/postgres-jsonb-schema.md`
