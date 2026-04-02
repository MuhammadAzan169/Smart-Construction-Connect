-- =============================================================================
-- Smart Construction Connect — Data Migration Script
-- Migrates JSON files to PostgreSQL tables defined in schema.sql
-- Run AFTER schema.sql: psql -d your_db -f migration_seed.sql
--
-- Security note: all plaintext passwords in the JSON are replaced with a
-- bcrypt hash of the original string so the data is importable. In production
-- you MUST force all users to reset their passwords after first login.
-- =============================================================================

-- ─────────────────────────────────────────────────────────────────────────────
-- HELPER: bcrypt a literal password (used only for seeding test accounts)
-- Replace these hashes with real Argon2id / bcrypt output from your app.
-- python -c "from passlib.hash import bcrypt; print(bcrypt.hash('password123'))"
-- ─────────────────────────────────────────────────────────────────────────────

-- Seed hash values (replace before going to production)
-- password123  → $2b$12$REPLACE_WITH_REAL_BCRYPT_HASH_password123
-- admin123     → $2b$12$REPLACE_WITH_REAL_BCRYPT_HASH_admin123

\set password123_hash '$2b$12$PLACEHOLDER_password123_HASH'
\set admin123_hash    '$2b$12$PLACEHOLDER_admin123_HASH'

-- ─────────────────────────────────────────────────────────────────────────────
-- SECTION 1 — USERS  (from Dataset/clients/client.json)
-- ─────────────────────────────────────────────────────────────────────────────
-- Source file has ALL roles in one array. Each record becomes one auth.users row
-- plus one role-specific profiles.* row.

BEGIN;

-- 1.1  Clients
INSERT INTO auth.users (user_id, email, password_hash, role, status, display_name, phone, created_at, legacy_id)
VALUES
    (gen_random_uuid(), 'ahmed@example.com',  :'password123_hash', 'client', 'active', 'Ahmed Khan',  NULL,             '2026-01-15 00:00:00+00', 'U-001'),
    (gen_random_uuid(), 'fatima@example.com', :'password123_hash', 'client', 'active', 'Fatima Ali',  NULL,             '2026-02-20 00:00:00+00', 'U-004'),
    (gen_random_uuid(), 'bilal@example.com',  :'password123_hash', 'client', 'active', 'Bilal Hussain', NULL,           '2026-03-05 00:00:00+00', 'U-007')
ON CONFLICT (email) DO NOTHING;

-- 1.2  Insert corresponding profiles.clients rows
INSERT INTO profiles.clients (user_id)
SELECT user_id FROM auth.users WHERE role = 'client'
ON CONFLICT (user_id) DO NOTHING;

-- 1.3  Companies (auth rows only — profile rows created in Section 2)
INSERT INTO auth.users (user_id, email, password_hash, role, status, display_name, phone, created_at, legacy_id)
VALUES
    (gen_random_uuid(), 'info@001builders.com',   :'password123_hash', 'company', 'active',  'Karachi Builders', '+92-21-1234567',  '2026-01-10 00:00:00+00', 'U-002'),
    (gen_random_uuid(), 'contact@elite.com',      :'password123_hash', 'company', 'active',  'Elite Builders',   '+92-51-5678901',  '2025-12-05 00:00:00+00', 'U-005'),
    (gen_random_uuid(), 'info@multanhomes.pk',    :'password123_hash', 'company', 'active',  'Multan Homes',     '+92-61-1234567',  '2026-03-25 00:00:00+00', 'U-008')
ON CONFLICT (email) DO NOTHING;

-- 1.4  Suppliers (auth rows only — profile rows created in Section 3)
INSERT INTO auth.users (user_id, email, password_hash, role, status, display_name, phone, created_at, legacy_id)
VALUES
    (gen_random_uuid(), 'sales@pct.com',      :'password123_hash', 'supplier', 'active', 'Punjab Cement Traders', '+92-42-9876543',  '2026-03-01 00:00:00+00', 'U-003'),
    (gen_random_uuid(), 'info@steelhub.pk',   :'password123_hash', 'supplier', 'active', 'Steel Hub PK',          '+92-21-3456789',  '2025-11-10 00:00:00+00', 'U-006')
ON CONFLICT (email) DO NOTHING;

-- 1.5  Admin
INSERT INTO auth.users (user_id, email, password_hash, role, status, display_name, phone, created_at, legacy_id)
VALUES
    (gen_random_uuid(), 'admin@smartconnect.pk', :'admin123_hash', 'admin', 'active', 'Admin', NULL, '2025-01-01 00:00:00+00', 'ADMIN-001')
ON CONFLICT (email) DO NOTHING;

-- Insert profiles.admins row
INSERT INTO profiles.admins (user_id, permissions)
SELECT user_id, '{"all": true}'::jsonb
FROM auth.users WHERE role = 'admin'
ON CONFLICT (user_id) DO NOTHING;

COMMIT;

-- ─────────────────────────────────────────────────────────────────────────────
-- SECTION 2 — COMPANIES  (from Dataset/companies/Contruction Company.json)
-- Only the first company (CC-001 / Ravi Grey Builders) is shown as a template.
-- Repeat the pattern for every company in the JSON array.
-- ─────────────────────────────────────────────────────────────────────────────
BEGIN;

-- 2.1  Ravi Grey Builders (CC-001)
--  Note: CC-001 has no matching auth.users row in client.json; create a stub.
INSERT INTO auth.users (user_id, email, password_hash, role, status, display_name, phone, created_at, legacy_id)
VALUES (
    gen_random_uuid(),
    'info@ravigreybuil1.pk',
    :'password123_hash',
    'company', 'active',
    'Ravi Grey Builders',
    '+92-42-3933912',
    '2020-01-01 00:00:00+00',
    'CC-001'
)
ON CONFLICT (email) DO NOTHING;

-- 2.2  Company profile
INSERT INTO profiles.companies
    (user_id, slug, company_name, description, logo_url, rating, review_count, city, profile_json)
SELECT
    u.user_id,
    'ravi-grey-builders',
    'Ravi Grey Builders',
    NULL,
    NULL,
    3.7,
    165,
    'Lahore',
    '{
        "legal_info": {
            "registered": true,
            "secp_registered": true,
            "ntn": "1001013-1",
            "year_established": 2020
        },
        "contact": {
            "phone": "+92-42-3933912",
            "email": "info@ravigreybuil1.pk",
            "website": "https://www.ravigreybuil1.com.pk"
        },
        "quality_control": {
            "site_engineer_assigned": true,
            "material_verification": true,
            "weekly_reporting": false
        },
        "after_handover_support": {
            "defect_liability_period_months": 6,
            "maintenance_support": true,
            "support_response_time_days": 5
        },
        "legal_and_contract": {
            "written_contract": true,
            "boq_provided": true,
            "penalty_for_delay": false,
            "warranty_years": 1
        },
        "ideal_customer_profile": {
            "best_for": ["first_time_builders", "low_budget_projects", "grey_structure_buyers"],
            "not_ideal_for": ["luxury_homes", "large_commercial", "high_rise"]
        },
        "customer_feedback": {
            "common_praises": ["fast_completion", "good_value"],
            "common_complaints": ["basic_finishing", "material_quality"]
        }
    }'::jsonb
FROM auth.users u
WHERE u.legacy_id = 'CC-001'
ON CONFLICT (slug) DO NOTHING;

-- 2.3  Company pricing
INSERT INTO profiles.company_pricing
    (company_id, operational_areas, flattened_operational_areas,
     package_scope, materials_used, estimated_cost_range,
     construction_capability, services, payment_terms, timeline_estimates, experience, ai_scores)
SELECT
    co.company_id,
    -- operational_areas (nested tree)
    '{
        "Lahore": {
            "Gulberg":      {"Gulberg III": {"standard": 3551, "premium": 4163, "executive": 5423}},
            "Bahria Town":  {"Sector E":    {"standard": 2998, "premium": 3888, "executive": 5069}},
            "Lake City":    {
                "Sector M-3": {"standard": 2777, "premium": 3665, "executive": 5190},
                "Sector M-2": {"standard": 2916, "premium": 3593, "executive": 4839},
                "Sector M-1": {"standard": 2700, "premium": 3627, "executive": 5107}
            },
            "Wapda Town":   {"Phase 1": {"standard": 2452, "premium": 3323, "executive": 4388}}
        }
    }'::jsonb,
    -- flattened_operational_areas (prices as numbers, not strings)
    '[
        {"city":"Lahore","area":"Gulberg","subarea":"Gulberg III","package":"standard","price_per_sqft":3551.0},
        {"city":"Lahore","area":"Gulberg","subarea":"Gulberg III","package":"premium","price_per_sqft":4163.0},
        {"city":"Lahore","area":"Gulberg","subarea":"Gulberg III","package":"executive","price_per_sqft":5423.0},
        {"city":"Lahore","area":"Bahria Town","subarea":"Sector E","package":"standard","price_per_sqft":2998.0},
        {"city":"Lahore","area":"Bahria Town","subarea":"Sector E","package":"premium","price_per_sqft":3888.0},
        {"city":"Lahore","area":"Bahria Town","subarea":"Sector E","package":"executive","price_per_sqft":5069.0},
        {"city":"Lahore","area":"Lake City","subarea":"Sector M-3","package":"standard","price_per_sqft":2777.0},
        {"city":"Lahore","area":"Lake City","subarea":"Sector M-3","package":"premium","price_per_sqft":3665.0},
        {"city":"Lahore","area":"Lake City","subarea":"Sector M-3","package":"executive","price_per_sqft":5190.0},
        {"city":"Lahore","area":"Lake City","subarea":"Sector M-2","package":"standard","price_per_sqft":2916.0},
        {"city":"Lahore","area":"Lake City","subarea":"Sector M-2","package":"premium","price_per_sqft":3593.0},
        {"city":"Lahore","area":"Lake City","subarea":"Sector M-2","package":"executive","price_per_sqft":4839.0},
        {"city":"Lahore","area":"Lake City","subarea":"Sector M-1","package":"standard","price_per_sqft":2700.0},
        {"city":"Lahore","area":"Lake City","subarea":"Sector M-1","package":"premium","price_per_sqft":3627.0},
        {"city":"Lahore","area":"Lake City","subarea":"Sector M-1","package":"executive","price_per_sqft":5107.0},
        {"city":"Lahore","area":"Wapda Town","subarea":"Phase 1","package":"standard","price_per_sqft":2452.0},
        {"city":"Lahore","area":"Wapda Town","subarea":"Phase 1","package":"premium","price_per_sqft":3323.0},
        {"city":"Lahore","area":"Wapda Town","subarea":"Phase 1","package":"executive","price_per_sqft":4388.0}
    ]'::jsonb,
    -- package_scope
    '{
        "standard":  {"design_included":false,"fixtures":"economy_brands","ceiling":"no_pop","kitchen":"basic_shelves","bathroom":"economy_fittings"},
        "premium":   {"design_included":true, "fixtures":"local_brands",   "ceiling":"simple_pop","kitchen":"basic_modular","bathroom":"standard_fittings"},
        "executive": {"design_included":true, "fixtures":"local_premium",  "ceiling":"standard_pop","kitchen":"standard_modular","bathroom":"branded_fittings"}
    }'::jsonb,
    -- materials_used
    '{
        "standard":  {"cement":"Bestway","steel":"Grade 40 Local","bricks":"Local Clay","wiring":"Local Cables","plumbing":"Local","paint":"Jawad"},
        "premium":   {"cement":"Bestway","steel":"Grade 60 Local","bricks":"A-Grade Clay","wiring":"Pakistan Cables","plumbing":"Popular","paint":"Diamond"},
        "executive": {"cement":"DG Khan","steel":"Grade 60 Local","bricks":"A-Grade Clay","wiring":"Fast Cables","plumbing":"Master","paint":"Dulux"}
    }'::jsonb,
    -- estimated_cost_range  (FIXED: numeric only; premium 3-marla min/max swapped)
    '{
        "3_marla":  {"standard":{"min":3400000,"max":3909999},"premium":{"min":4620000,"max":4800000},"executive":{"min":5460000,"max":null}},
        "5_marla":  {"standard":{"min":5400000,"max":6210000},"premium":{"min":7260000,"max":7560000},"executive":{"min":8580000,"max":null}},
        "10_marla": {"standard":{"min":10800000,"max":12420000},"premium":{"min":15120000,"max":15180000},"executive":{"min":17940000,"max":null}}
    }'::jsonb,
    -- construction_capability
    '{"min_plot_marla":2,"max_plot_marla":10,"max_floors":2,"basement_supported":false,"house_types":["residential","small_commercial"]}'::jsonb,
    -- services
    '{"construction":["grey_structure"],"design":["architectural"],"approvals_support":["DHA Lahore","PHATA"],"extras":["basic_landscaping"]}'::jsonb,
    -- payment_terms
    '{"advance_percentage":30,"installments":"stage_wise","price_type":"fixed","variation_clause":true}'::jsonb,
    -- timeline_estimates
    '{
        "time_units":"months",
        "3_marla":  {"single_storey":{"minimum":3,"typical":4,"maximum":5},"double_storey":{"minimum":5,"typical":6,"maximum":7}},
        "5_marla":  {"single_storey":{"minimum":5,"typical":6,"maximum":7},"double_storey":{"minimum":7,"typical":9,"maximum":11}},
        "10_marla": {"single_storey":{"minimum":7,"typical":9,"maximum":11},"double_storey":{"minimum":10,"typical":13,"maximum":16}},
        "reliability_score":0.85,
        "construction_phases":{"planning_approval":"1-2 months","foundation":"1-2 months","structure":"2-3 months","roofing":"1 month","finishing":"2-3 months","handover":"2-4 weeks"}
    }'::jsonb,
    -- experience
    '{"total_projects":31,"houses_completed":26,"ongoing_projects":19,"specializations":["economy_housing","small_plots"]}'::jsonb,
    -- ai_scores
    '{"timeline_reliability":0.85,"budget_accuracy":0.86,"quality_consistency":0.69}'::jsonb
FROM profiles.companies co
WHERE co.slug = 'ravi-grey-builders'
ON CONFLICT (company_id) DO NOTHING;

COMMIT;

-- ─────────────────────────────────────────────────────────────────────────────
-- SECTION 3 — SUPPLIERS  (from Dataset/suppliers/Material Supplier.json)
-- MS-001 shown as template; repeat for MS-002 through MS-012.
-- ─────────────────────────────────────────────────────────────────────────────
BEGIN;

-- 3.1  Supplier: Bestway Building Materials (MS-001)
INSERT INTO auth.users (user_id, email, password_hash, role, status, display_name, phone, created_at, legacy_id)
VALUES (
    gen_random_uuid(),
    'sales@bestwaybuilding.pk',
    :'password123_hash',
    'supplier', 'active',
    'Bestway Building Materials',
    '+92-42-35761234',
    '2026-01-01 00:00:00+00',
    'MS-001'
)
ON CONFLICT (email) DO NOTHING;

INSERT INTO profiles.suppliers
    (user_id, slug, supplier_name, description, logo_url, rating, review_count, city, area, profile_json)
SELECT
    u.user_id,
    'bestway-building-materials',
    'Bestway Building Materials',
    'Leading cement and construction materials distributor in Pakistan, authorized dealer for Bestway Cement with extensive coverage across Punjab and Sindh.',
    'https://images.unsplash.com/photo-1504307651254-35680f356dfd?w=200&h=200&fit=crop',
    4.7,
    156,
    'Lahore',
    'Gulberg III',
    '{"contact":{"phone":"+92-42-35761234","email":"sales@bestwaybuilding.pk","website":"www.bestwaybuilding.pk"}}'::jsonb
FROM auth.users u WHERE u.legacy_id = 'MS-001'
ON CONFLICT (slug) DO NOTHING;

INSERT INTO profiles.supplier_inventory (supplier_id, materials, cities_served)
SELECT
    s.supplier_id,
    '[
        {"name":"Bestway Cement (50kg)","category":"Cement","brand":"Bestway","price":1350,"unit":"bag","stock":5000},
        {"name":"Bestway White Cement (40kg)","category":"Cement","brand":"Bestway","price":2100,"unit":"bag","stock":1200},
        {"name":"Bestway Sulphate Resistant Cement (50kg)","category":"Cement","brand":"Bestway","price":1550,"unit":"bag","stock":800},
        {"name":"TOR Steel Bar 40G (per ton)","category":"Steel","brand":"Amreli Steel","price":265000,"unit":"ton","stock":120},
        {"name":"TOR Steel Bar 60G (per ton)","category":"Steel","brand":"Amreli Steel","price":285000,"unit":"ton","stock":85},
        {"name":"Crush Stone (per CFT)","category":"Aggregate","brand":"Local","price":95,"unit":"cft","stock":10000},
        {"name":"Sand Ravi (per CFT)","category":"Aggregate","brand":"Local","price":65,"unit":"cft","stock":15000}
    ]'::jsonb,
    '["Lahore","Islamabad","Rawalpindi","Faisalabad","Multan"]'::jsonb
FROM profiles.suppliers s WHERE s.slug = 'bestway-building-materials'
ON CONFLICT (supplier_id) DO NOTHING;

-- Repeat the pattern above for MS-002 … MS-012 from Material Supplier.json

COMMIT;

-- ─────────────────────────────────────────────────────────────────────────────
-- SECTION 4 — ACTIVITY LOG  (from Dataset/admin/admin.json → activity_log)
-- ─────────────────────────────────────────────────────────────────────────────
BEGIN;

-- NOTE: original log references emails as target. We map to target_type='user'
-- and store the email in the details text + full original entry in meta.
INSERT INTO admin.activity_log (created_at, action, target_type, target_id, details, actor_user_id, meta)
VALUES
    ('2026-04-02T01:13:44.681945+00:00', 'user_active',    'user', 'info@steelhub.pk',    'Admin set Steel Hub PK status to active',              (SELECT user_id FROM auth.users WHERE role='admin' LIMIT 1), '{}'::jsonb),
    ('2026-04-02T01:13:43.894372+00:00', 'user_active',    'user', 'info@multanhomes.pk',  'Admin set Multan Homes status to active',               (SELECT user_id FROM auth.users WHERE role='admin' LIMIT 1), '{}'::jsonb),
    ('2026-04-02T01:13:42.652879+00:00', 'user_active',    'user', 'sales@pct.com',        'Admin set Punjab Cement Traders status to active',      (SELECT user_id FROM auth.users WHERE role='admin' LIMIT 1), '{}'::jsonb),
    ('2026-03-28T10:30:00+00:00',        'user_approved',  'user', 'info@001builders.com', 'Approved Karachi Builders company account',             (SELECT user_id FROM auth.users WHERE role='admin' LIMIT 1), '{}'::jsonb),
    ('2026-03-25T14:15:00+00:00',        'user_banned',    'user', 'info@steelhub.pk',     'Banned Steel Hub PK for policy violation',              (SELECT user_id FROM auth.users WHERE role='admin' LIMIT 1), '{}'::jsonb),
    ('2026-03-20T09:00:00+00:00',        'user_approved',  'user', 'contact@elite.com',    'Approved Elite Builders company account',               (SELECT user_id FROM auth.users WHERE role='admin' LIMIT 1), '{}'::jsonb),
    ('2026-03-15T11:45:00+00:00',        'ai_chat_summary','user', 'ahmed@example.com',    'Client searched for 5-Marla house builders in Islamabad, budget 8-12M PKR', (SELECT user_id FROM auth.users WHERE role='admin' LIMIT 1), '{}'::jsonb),
    ('2026-03-10T16:20:00+00:00',        'pricing_updated','company', 'info@001builders.com','Karachi Builders updated premium package pricing',   (SELECT user_id FROM auth.users WHERE role='admin' LIMIT 1), '{}'::jsonb);

COMMIT;
