# Deploying to Supabase + Render (free tier)

This backend now persists to **Supabase Postgres** (data) and **Supabase Storage**
(uploaded files) instead of the local disk, so it survives Render redeploys.
Auth stays as-is (custom JWT + bcrypt); user records just live in Postgres now.

## How it works

- Every JSON document (users, companies, suppliers, messages, requests, chat
  history, activity log…) is stored as a row in one Postgres table `documents`,
  keyed by its old file path (e.g. `Database/clients/users.json`).
  `data_handler.read_json/write_json` route there automatically when
  `DATABASE_URL` is set.
- Uploaded images/documents/attachments go to a Supabase Storage bucket.
- Semantic search uses an **external embeddings API** (no PyTorch), so it fits
  in Render's 512 MB. With no embeddings key it falls back to BM25 keyword search.
- If `DATABASE_URL` is empty, everything uses local JSON files (unchanged dev flow).

## 1. Create the Supabase project

1. Create a project at https://supabase.com.
2. **Database → Connect →** copy the **Transaction pooler** URI
   (host `...pooler.supabase.com`, port `6543`). Put your DB password in it.
   → this is `DATABASE_URL`.
3. **Settings → API →** copy **Project URL** (`SUPABASE_URL`).
   For the service key: **Settings → API Keys → "Legacy anon, service_role API
   keys"** tab → copy **`service_role`** (`SUPABASE_SERVICE_ROLE_KEY` — secret,
   backend only). It's a JWT starting with `eyJ...`. Do **not** use the newer
   `sb_secret_...` key shown on the default tab — Supabase Storage's REST API
   requires a JWT bearer token and rejects that format with "Invalid Compact JWS".
4. **Storage →** create a **public** bucket named `media` (matches `SUPABASE_BUCKET`).
5. (Optional) Run `schema.sql` in the SQL editor. The app also auto-creates the
   table on boot, so this is just for reference.

## 2. Migrate your existing local data (one time)

From the `Backend/` directory, fill `.env` (copy from `.env.example`) with
`DATABASE_URL` + the `SUPABASE_*` vars, then:

```bash
pip install -r requirements.txt
python migrate_to_supabase.py --dry-run   # preview
python migrate_to_supabase.py             # migrate JSON + upload files
```

Re-runnable and non-destructive (local files are never modified).

## 3. Deploy the backend to Render

Render reads `render.yaml`; set the service's **Root Directory** to `Backend`.
The live service is https://smart-contruction-connect-backend.onrender.com.
In the service's **Environment** tab set (marked `sync: false`):

| Var | Value |
|---|---|
| `DATABASE_URL` | Supabase transaction-pooler URI |
| `SUPABASE_URL` | `https://<ref>.supabase.co` |
| `SUPABASE_SERVICE_ROLE_KEY` | service_role key |
| `CORS_ORIGINS` | your Vercel URL, e.g. `https://smart-contruction-connect-frontend.vercel.app` |
| `OPENROUTER_API_KEY1` | your OpenRouter key |
| `EMBEDDINGS_API_URL` / `EMBEDDINGS_API_KEY` | *(optional)* e.g. `https://api.openai.com/v1` + key. Omit → BM25 search. |

`JWT_SECRET_KEY` is auto-generated; `SUPABASE_BUCKET` defaults to `media`.

## 4. Frontend (Vercel)

1. Set the Vercel project's **Root Directory** to `Frontend`. Its `vercel.json`
   already points at the Render backend; if that URL changes, update all three
   rewrites. The `/api`, `/uploads`, `/company_data` rewrites proxy HTTP to the
   backend and serve legacy static files; new uploads return absolute Supabase
   URLs and load directly.
2. In the Vercel project's **Environment Variables**, set
   **`VITE_API_URL`** = the Render origin
   (`https://smart-contruction-connect-backend.onrender.com`).
   This is REQUIRED for real-time chat: Vercel rewrites proxy HTTP but NOT
   WebSockets, so the message socket connects to the backend directly via this
   variable. (Locally it's unset and the Vite dev server proxies the socket.)

## Free-tier notes (Supabase + Render — no paid plan needed)

This setup uses **only Supabase free-tier features**: Postgres (500 MB — your
data is a few MB), a public Storage bucket (1 GB), and the connection pooler.
No pgvector, no paid add-ons. The **only** thing that can cost money is an
external embeddings provider — leave `EMBEDDINGS_API_*` blank and search uses
BM25 for **$0**.

Two free-tier gotchas:

1. **Use the Transaction pooler URL, not the direct connection.** Supabase's
   free direct connection (`db.<ref>.supabase.co:5432`) is often IPv6-only,
   which Render free **can't reach** — connection will fail. The pooler URI
   (`...pooler.supabase.com:6543`) is IPv4 and works. The app is already
   configured for it.
2. **Free Supabase projects pause after ~7 days idle.** While paused the DB is
   unreachable and the app errors until you click **Resume** in the dashboard.
   Free Render also spins down when idle — so an untouched demo goes fully cold.

## Notes

- Free Render spins down when idle; the first request after a cold start rebuilds
  the search index (one small embeddings call, or instant in BM25 mode).
- To use local PyTorch embeddings + OCR instead of the API, move to a plan with
  ≥2 GB RAM, add `sentence-transformers`, `faiss-cpu`, `easyocr` back to
  `requirements.txt`, and set `ENABLE_LOCAL_SBERT=1`.
