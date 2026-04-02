-- =============================================================================
-- Smart Construction Connect — PostgreSQL Schema
-- Version: 1.0.0 | Target: PostgreSQL 15+
-- Run this file once on an empty database: psql -d your_db -f schema.sql
-- =============================================================================

-- ─────────────────────────────────────────────────────────────────────────────
-- 0. EXTENSIONS
-- ─────────────────────────────────────────────────────────────────────────────
CREATE EXTENSION IF NOT EXISTS pgcrypto;   -- gen_random_uuid()
CREATE EXTENSION IF NOT EXISTS citext;     -- case-insensitive email comparisons

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. SCHEMAS (namespaces)
-- ─────────────────────────────────────────────────────────────────────────────
CREATE SCHEMA IF NOT EXISTS auth;
CREATE SCHEMA IF NOT EXISTS profiles;
CREATE SCHEMA IF NOT EXISTS admin;
CREATE SCHEMA IF NOT EXISTS marketplace;
CREATE SCHEMA IF NOT EXISTS ai;

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. ENUM TYPES
-- ─────────────────────────────────────────────────────────────────────────────
DO $$ BEGIN
    CREATE TYPE auth.user_role   AS ENUM ('client', 'admin', 'company', 'supplier');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    CREATE TYPE auth.user_status AS ENUM ('active', 'pending', 'banned');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    CREATE TYPE marketplace.request_status AS ENUM ('pending', 'accepted', 'rejected', 'completed');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. SHARED TRIGGER — auto-update "updated_at" on any table
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION shared.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$;

CREATE SCHEMA IF NOT EXISTS shared;

CREATE OR REPLACE FUNCTION shared.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$;

-- Helper macro — call once per table at the bottom of this file
-- Usage: SELECT shared.create_updated_at_trigger('<schema>.<table>');
CREATE OR REPLACE FUNCTION shared.create_updated_at_trigger(tbl regclass)
RETURNS void LANGUAGE plpgsql AS $$
BEGIN
    EXECUTE format(
        'CREATE OR REPLACE TRIGGER trg_%s_updated_at
         BEFORE UPDATE ON %s
         FOR EACH ROW EXECUTE FUNCTION shared.set_updated_at();',
        replace(tbl::text, '.', '_'), tbl
    );
END;
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 4. AUTH SCHEMA
-- ─────────────────────────────────────────────────────────────────────────────

-- 4.1  auth.users
--  • Single source of truth for login / account state.
--  • Role-specific data lives in profiles.* tables.
--  • NEVER store plaintext passwords — use Argon2id via passlib or bcrypt.
CREATE TABLE IF NOT EXISTS auth.users (
    user_id         uuid         PRIMARY KEY DEFAULT gen_random_uuid(),

    -- citext gives case-insensitive UNIQUE automatically
    email           citext       NOT NULL UNIQUE,
    password_hash   text         NOT NULL,     -- Argon2id / bcrypt hash only

    role            auth.user_role   NOT NULL,
    status          auth.user_status NOT NULL DEFAULT 'active',

    display_name    text         NOT NULL,
    phone           text,                      -- nullable; empty string → NULL

    created_at      timestamptz  NOT NULL DEFAULT now(),
    updated_at      timestamptz  NOT NULL DEFAULT now(),
    last_login_at   timestamptz,

    -- Migration traceability: stores old IDs like 'U-001', 'ADMIN-001'
    legacy_id       text         UNIQUE
);

CREATE INDEX IF NOT EXISTS users_role_status_idx ON auth.users (role, status);
CREATE INDEX IF NOT EXISTS users_created_at_idx  ON auth.users (created_at DESC);

-- ─────────────────────────────────────────────────────────────────────────────
-- 5. PROFILES SCHEMA
-- ─────────────────────────────────────────────────────────────────────────────

-- 5.1  profiles.clients
CREATE TABLE IF NOT EXISTS profiles.clients (
    client_id       uuid         PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         uuid         NOT NULL UNIQUE
                                 REFERENCES auth.users(user_id) ON DELETE CASCADE,

    -- Flexible profile data (address, demographics, saved locations)
    profile_json    jsonb        NOT NULL DEFAULT '{}'::jsonb,

    -- User-controlled preferences (preferred cities, budget style, notifications)
    preferences     jsonb        NOT NULL DEFAULT '{}'::jsonb,

    created_at      timestamptz  NOT NULL DEFAULT now(),
    updated_at      timestamptz  NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS clients_profile_gin ON profiles.clients USING gin (profile_json);
CREATE INDEX IF NOT EXISTS clients_prefs_gin   ON profiles.clients USING gin (preferences);

-- 5.2  profiles.companies
--  • Core identity / contact for a construction company.
--  • Pricing and operational data is in profiles.company_pricing (separate row).
CREATE TABLE IF NOT EXISTS profiles.companies (
    company_id      uuid         PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         uuid         NOT NULL UNIQUE
                                 REFERENCES auth.users(user_id) ON DELETE CASCADE,

    slug            text         NOT NULL UNIQUE,  -- URL-safe name, e.g. 'karachi-builders'
    company_name    text         NOT NULL,
    description     text,
    logo_url        text,

    -- Typed columns pulled out of JSON for fast filtering / sorting
    rating          numeric(3,2) CHECK (rating BETWEEN 0 AND 5),
    review_count    int          NOT NULL DEFAULT 0 CHECK (review_count >= 0),
    city            text,                          -- primary city (for geo-filter)

    -- Everything else: legal_info, contact, services, after_handover_support, etc.
    profile_json    jsonb        NOT NULL DEFAULT '{}'::jsonb,

    created_at      timestamptz  NOT NULL DEFAULT now(),
    updated_at      timestamptz  NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS companies_name_idx    ON profiles.companies (company_name);
CREATE INDEX IF NOT EXISTS companies_city_idx    ON profiles.companies (city);
CREATE INDEX IF NOT EXISTS companies_rating_idx  ON profiles.companies (rating DESC);
CREATE INDEX IF NOT EXISTS companies_profile_gin ON profiles.companies USING gin (profile_json);

-- 5.3  profiles.company_pricing
--  • Operational pricing, package scopes, material standards.
--  • Kept separate so pricing updates don't bump the company's updated_at.
CREATE TABLE IF NOT EXISTS profiles.company_pricing (
    company_id                  uuid    PRIMARY KEY
                                        REFERENCES profiles.companies(company_id) ON DELETE CASCADE,

    -- Sparse/nested area→package→price_per_sqft tree (original format)
    operational_areas           jsonb   NOT NULL DEFAULT '{}'::jsonb,

    -- Flat array — each row: {city, area, subarea, package, price_per_sqft}
    -- Used by the AI matcher and search filters
    flattened_operational_areas jsonb   NOT NULL DEFAULT '[]'::jsonb,

    -- Package feature descriptions: {standard:{fixtures,ceiling,...}, premium:..., executive:...}
    package_scope               jsonb   NOT NULL DEFAULT '{}'::jsonb,

    -- Materials per package: {standard:{cement,steel,...}, premium:..., executive:...}
    materials_used              jsonb   NOT NULL DEFAULT '{}'::jsonb,

    -- Cost ranges (numeric only, no strings): {3_marla:{standard:{min,max}, ...}, ...}
    -- FIX: store ONLY numeric min/max here; drop the string version ('3.4M to 3.9M PKR')
    estimated_cost_range        jsonb   NOT NULL DEFAULT '{}'::jsonb,

    -- Construction capability: plot sizes, max floors, basement support, house types
    construction_capability     jsonb   NOT NULL DEFAULT '{}'::jsonb,

    -- Services: {construction:[...], design:[...], approvals_support:[...], extras:[...]}
    services                    jsonb   NOT NULL DEFAULT '{}'::jsonb,

    -- Payment terms: advance %, installment type, price type, variation clause
    payment_terms               jsonb   NOT NULL DEFAULT '{}'::jsonb,

    -- Timeline estimates per size + storey + reliability
    timeline_estimates          jsonb   NOT NULL DEFAULT '{}'::jsonb,

    -- Experience summary: total_projects, houses_completed, ongoing_projects
    experience                  jsonb   NOT NULL DEFAULT '{}'::jsonb,

    -- AI-generated quality scores: timeline_reliability, budget_accuracy, quality_consistency
    ai_scores                   jsonb   NOT NULL DEFAULT '{}'::jsonb,

    updated_at                  timestamptz NOT NULL DEFAULT now()
);

-- GIN indexes for AI matcher queries
CREATE INDEX IF NOT EXISTS cp_flat_areas_gin  ON profiles.company_pricing USING gin (flattened_operational_areas);
CREATE INDEX IF NOT EXISTS cp_package_gin     ON profiles.company_pricing USING gin (package_scope);
CREATE INDEX IF NOT EXISTS cp_services_gin    ON profiles.company_pricing USING gin (services);
CREATE INDEX IF NOT EXISTS cp_ai_scores_gin   ON profiles.company_pricing USING gin (ai_scores);

-- 5.4  profiles.suppliers
CREATE TABLE IF NOT EXISTS profiles.suppliers (
    supplier_id     uuid         PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         uuid         NOT NULL UNIQUE
                                 REFERENCES auth.users(user_id) ON DELETE CASCADE,

    slug            text         NOT NULL UNIQUE,
    supplier_name   text         NOT NULL,
    description     text,
    logo_url        text,

    -- Typed columns for filtering
    rating          numeric(3,2) CHECK (rating BETWEEN 0 AND 5),
    review_count    int          NOT NULL DEFAULT 0 CHECK (review_count >= 0),
    city            text,        -- primary city
    area            text,        -- locality within city

    -- Contact info: {phone, email, website}
    profile_json    jsonb        NOT NULL DEFAULT '{}'::jsonb,

    created_at      timestamptz  NOT NULL DEFAULT now(),
    updated_at      timestamptz  NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS suppliers_name_idx    ON profiles.suppliers (supplier_name);
CREATE INDEX IF NOT EXISTS suppliers_city_idx    ON profiles.suppliers (city);
CREATE INDEX IF NOT EXISTS suppliers_rating_idx  ON profiles.suppliers (rating DESC);
CREATE INDEX IF NOT EXISTS suppliers_profile_gin ON profiles.suppliers USING gin (profile_json);

-- 5.5  profiles.supplier_inventory
--  • Materials catalogue — kept separate so bulk price updates are cheap.
CREATE TABLE IF NOT EXISTS profiles.supplier_inventory (
    supplier_id     uuid    PRIMARY KEY
                            REFERENCES profiles.suppliers(supplier_id) ON DELETE CASCADE,

    -- Array of {name, category, brand, price, unit, stock}
    materials       jsonb   NOT NULL DEFAULT '[]'::jsonb,

    -- Array of city strings where this supplier delivers
    cities_served   jsonb   NOT NULL DEFAULT '[]'::jsonb,

    -- Optional availability flags / schedule
    availability    jsonb   NOT NULL DEFAULT '{}'::jsonb,

    updated_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS si_materials_gin     ON profiles.supplier_inventory USING gin (materials);
CREATE INDEX IF NOT EXISTS si_cities_gin        ON profiles.supplier_inventory USING gin (cities_served);

-- 5.6  profiles.admins
CREATE TABLE IF NOT EXISTS profiles.admins (
    admin_id        uuid         PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         uuid         NOT NULL UNIQUE
                                 REFERENCES auth.users(user_id) ON DELETE CASCADE,

    permissions     jsonb        NOT NULL DEFAULT '{}'::jsonb,

    created_at      timestamptz  NOT NULL DEFAULT now(),
    updated_at      timestamptz  NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS admins_permissions_gin ON profiles.admins USING gin (permissions);

-- ─────────────────────────────────────────────────────────────────────────────
-- 6. ADMIN SCHEMA
-- ─────────────────────────────────────────────────────────────────────────────

-- 6.1  admin.platform_settings  (single row)
CREATE TABLE IF NOT EXISTS admin.platform_settings (
    settings_id int         PRIMARY KEY DEFAULT 1,
    settings    jsonb       NOT NULL DEFAULT '{}'::jsonb,
    updated_at  timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT  single_row CHECK (settings_id = 1)
);

-- 6.2  admin.activity_log  (append-only, never update rows)
--  • FIX: references actor by user_id (UUID FK), not by email string.
CREATE TABLE IF NOT EXISTS admin.activity_log (
    activity_id     bigserial    PRIMARY KEY,
    created_at      timestamptz  NOT NULL DEFAULT now(),

    action          text         NOT NULL,   -- e.g. 'user_approved', 'pricing_updated'
    target_type     text         NOT NULL,   -- e.g. 'user', 'company', 'supplier'
    target_id       text,                    -- UUID or slug of affected entity
    details         text         NOT NULL,

    -- NULL means the action was taken by the system
    actor_user_id   uuid         REFERENCES auth.users(user_id) ON DELETE SET NULL,

    -- Arbitrary extras (old email, old status, IP address, etc.)
    meta            jsonb        NOT NULL DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS activity_ts_idx      ON admin.activity_log (created_at DESC);
CREATE INDEX IF NOT EXISTS activity_action_idx  ON admin.activity_log (action);
CREATE INDEX IF NOT EXISTS activity_actor_idx   ON admin.activity_log (actor_user_id);
CREATE INDEX IF NOT EXISTS activity_meta_gin    ON admin.activity_log USING gin (meta);

-- ─────────────────────────────────────────────────────────────────────────────
-- 7. MARKETPLACE SCHEMA
-- ─────────────────────────────────────────────────────────────────────────────

-- 7.1  marketplace.quote_requests
--  • Replaces the missing quote/request tracking (currently no JSON file for this).
CREATE TABLE IF NOT EXISTS marketplace.quote_requests (
    request_id      uuid         PRIMARY KEY DEFAULT gen_random_uuid(),

    client_id       uuid         NOT NULL
                                 REFERENCES profiles.clients(client_id) ON DELETE CASCADE,
    company_id      uuid         REFERENCES profiles.companies(company_id) ON DELETE SET NULL,

    status          marketplace.request_status NOT NULL DEFAULT 'pending',

    summary         text         NOT NULL,
    location_text   text,

    -- Flexible requirements: plot_size, floors, finish_level, must_have, notes
    requirements    jsonb        NOT NULL DEFAULT '{}'::jsonb,

    -- Timeline preferences: start_date, deadline, flexibility
    timeline        jsonb        NOT NULL DEFAULT '{}'::jsonb,

    -- Budget details: min_pkr, max_pkr, payment_preference
    budget          jsonb        NOT NULL DEFAULT '{}'::jsonb,

    created_at      timestamptz  NOT NULL DEFAULT now(),
    updated_at      timestamptz  NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS qr_client_idx    ON marketplace.quote_requests (client_id, created_at DESC);
CREATE INDEX IF NOT EXISTS qr_company_idx   ON marketplace.quote_requests (company_id, created_at DESC);
CREATE INDEX IF NOT EXISTS qr_status_idx    ON marketplace.quote_requests (status);
CREATE INDEX IF NOT EXISTS qr_req_gin       ON marketplace.quote_requests USING gin (requirements);
CREATE INDEX IF NOT EXISTS qr_budget_gin    ON marketplace.quote_requests USING gin (budget);

-- ─────────────────────────────────────────────────────────────────────────────
-- 8. AI SCHEMA
-- ─────────────────────────────────────────────────────────────────────────────

-- 8.1  ai.chat_sessions
CREATE TABLE IF NOT EXISTS ai.chat_sessions (
    session_id  uuid         PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id     uuid         REFERENCES auth.users(user_id) ON DELETE SET NULL,
    title       text,                              -- optional human-readable summary
    created_at  timestamptz  NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS chat_sessions_user_idx ON ai.chat_sessions (user_id, created_at DESC);

-- 8.2  ai.chat_messages
CREATE TABLE IF NOT EXISTS ai.chat_messages (
    message_id  bigserial    PRIMARY KEY,
    session_id  uuid         NOT NULL
                             REFERENCES ai.chat_sessions(session_id) ON DELETE CASCADE,

    role        text         NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
    content     text         NOT NULL,

    -- Optional: token counts, model used, recommendation links attached
    meta        jsonb        NOT NULL DEFAULT '{}'::jsonb,

    created_at  timestamptz  NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS chat_msgs_session_idx ON ai.chat_messages (session_id, created_at);

-- 8.3  ai.rag_documents  (optional — for RAG knowledge base)
CREATE TABLE IF NOT EXISTS ai.rag_documents (
    document_id uuid         PRIMARY KEY DEFAULT gen_random_uuid(),
    source      text         NOT NULL,  -- e.g. 'company_profile', 'faq', 'spec_sheet'
    title       text,
    doc_json    jsonb        NOT NULL DEFAULT '{}'::jsonb,
    created_at  timestamptz  NOT NULL DEFAULT now()
);

-- 8.4  ai.rag_chunks
CREATE TABLE IF NOT EXISTS ai.rag_chunks (
    chunk_id    uuid         PRIMARY KEY DEFAULT gen_random_uuid(),
    document_id uuid         NOT NULL
                             REFERENCES ai.rag_documents(document_id) ON DELETE CASCADE,
    chunk_index int          NOT NULL,
    content     text         NOT NULL,
    meta        jsonb        NOT NULL DEFAULT '{}'::jsonb,
    -- Future: add embedding vector(1536) when pgvector is available
    UNIQUE (document_id, chunk_index)
);

CREATE INDEX IF NOT EXISTS rag_chunks_doc_idx ON ai.rag_chunks (document_id, chunk_index);

-- ─────────────────────────────────────────────────────────────────────────────
-- 9. ATTACH updated_at TRIGGERS
-- ─────────────────────────────────────────────────────────────────────────────
SELECT shared.create_updated_at_trigger('auth.users');
SELECT shared.create_updated_at_trigger('profiles.clients');
SELECT shared.create_updated_at_trigger('profiles.companies');
SELECT shared.create_updated_at_trigger('profiles.company_pricing');
SELECT shared.create_updated_at_trigger('profiles.suppliers');
SELECT shared.create_updated_at_trigger('profiles.supplier_inventory');
SELECT shared.create_updated_at_trigger('profiles.admins');
SELECT shared.create_updated_at_trigger('admin.platform_settings');
SELECT shared.create_updated_at_trigger('marketplace.quote_requests');

-- ─────────────────────────────────────────────────────────────────────────────
-- 10. DEFAULT SEED DATA
-- ─────────────────────────────────────────────────────────────────────────────

-- 10.1  Platform settings (migrated from admin.json → platform_settings)
INSERT INTO admin.platform_settings (settings_id, settings)
VALUES (1, '{
    "platform_name":            "Smart Construction Connect",
    "require_approval":         true,
    "max_packages_per_company": 20
}'::jsonb)
ON CONFLICT (settings_id) DO NOTHING;
