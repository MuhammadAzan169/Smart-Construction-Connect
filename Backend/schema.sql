-- =============================================================================
-- Smart Construction Connect — Supabase / Postgres schema
-- =============================================================================
-- The application stores its JSON documents (users, companies, suppliers,
-- messages, requests, chat history, activity log, …) as rows in a single
-- key/value table. The `key` is the path the document used to live at,
-- relative to the backend repo root — e.g. "Database/clients/users.json".
--
-- Run this once against your Supabase database (SQL editor or psql). The app
-- also creates the table automatically on first boot, so this file is mainly
-- for reference / manual setup.
-- =============================================================================

CREATE TABLE IF NOT EXISTS documents (
    key         TEXT PRIMARY KEY,
    data        JSONB NOT NULL,
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Fast prefix scans (e.g. all of a user's chat sessions).
CREATE INDEX IF NOT EXISTS documents_key_prefix_idx ON documents (key text_pattern_ops);

-- -----------------------------------------------------------------------------
-- Storage bucket (create via the Supabase dashboard, or the SQL below).
-- Bucket name must match SUPABASE_BUCKET (default: "media").
-- Make it PUBLIC so image/document URLs load directly in the browser.
-- -----------------------------------------------------------------------------
-- insert into storage.buckets (id, name, public)
-- values ('media', 'media', true)
-- on conflict (id) do update set public = true;
