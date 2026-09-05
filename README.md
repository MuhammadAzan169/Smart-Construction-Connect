# Smart Construction Connect

A full-stack construction marketplace and AI assistant that connects clients,
construction companies, material suppliers and administrators in one platform —
role-based dashboards, verified company discovery, project requests, real-time
messaging, bilingual (English / Urdu) UI, and a retrieval-augmented AI assistant
that reads uploaded project documents and recommends matching companies and
suppliers.

**Repository:** [`MuhammadAzan169/Smart-Construction-Connect`](https://github.com/MuhammadAzan169/Smart-Construction-Connect)

One repository, two independently deployed parts:

| Part | Folder | Hosted on | Deploy root |
| --- | --- | --- | --- |
| Frontend (React SPA) | [`frontend/`](frontend/) | **Vercel** | `frontend` |
| Backend (FastAPI API) | [`backend/`](backend/) | **Render** (free plan) | `backend` |
| Database + file storage | — | **Supabase** — Postgres + public Storage bucket | your own project |

Locally you do not deploy anything: [`app.py`](app.py) at the repository root
starts **both** parts with one command.

---

## Table of contents

1. [Repository layout](#repository-layout)
2. [Architecture](#architecture)
3. [Prerequisites](#prerequisites)
4. [Local installation](#local-installation)
5. [Running the whole app locally with `app.py`](#running-the-whole-app-locally-with-apppy)
6. [Environment variables](#environment-variables)
7. [Local models vs API-based models](#local-models-vs-api-based-models)
8. [Deploying the frontend on Vercel](#deploying-the-frontend-on-vercel)
9. [Deploying the backend on Render (free plan)](#deploying-the-backend-on-render-free-plan)
10. [Render free-plan limitations](#render-free-plan-limitations)
11. [Local vs production behaviour](#local-vs-production-behaviour)
12. [Troubleshooting](#troubleshooting)

---

## Repository layout

```
Smart-Construction-Connect/
├── app.py                  ← LOCAL runner: starts backend + frontend together
├── README.md  .gitignore
├── docs/                   ← infrastructure & containerisation handbook (PDF)
├── backend/                ← FastAPI service → Render
│   ├── app.py              ← ASGI entry point (uvicorn app:app)
│   ├── backend/            ← application package (config, routers, utils)
│   ├── requirements.txt        ← what Render installs (light, no PyTorch)
│   ├── requirements-local.txt  ← local-only extras (SBERT + FAISS + OCR)
│   ├── Dockerfile  .dockerignore
│   ├── render.yaml  Procfile  runtime.txt
│   ├── .env.example
│   ├── Database/  company_data/  uploads/  index_data/
│   └── README.md  DEPLOY_SUPABASE.md
└── frontend/               ← React + Vite SPA → Vercel
    ├── src/  public/  index.html
    ├── package.json  vite.config.ts  vercel.json  .nvmrc
    ├── Dockerfile  nginx.conf.template  .dockerignore
    ├── .env.example
    └── README.md
```

Everything lives inside `backend/` or `frontend/` — the repository root holds
only the local runner, this README, `docs/` and `.gitignore`, so Vercel and
Render each point at one self-contained folder.

## Architecture

```
Browser ──► Vercel (static SPA)
              │  /api/*, /uploads/*, /company_data/*  → rewritten to Render
              │  WebSocket (chat) ─────────────────────► Render directly (VITE_API_URL)
              ▼
          Render: FastAPI (uvicorn app:app)
              ├── Supabase Postgres  — all JSON documents (users, companies, …)
              ├── Supabase Storage   — images, documents, attachments
              ├── OpenRouter         — LLM chat with model/key failover
              └── Embeddings API     — semantic search (no local PyTorch)
```

Because HTTP traffic is proxied through Vercel's rewrites, the browser only
talks to the Vercel origin for the REST API (no CORS setup needed). WebSockets
are *not* proxied by Vercel, so the chat socket dials the Render origin directly
using `VITE_API_URL`.

Locally the same shape holds, with the Vite dev server (`:8080`) proxying
`/api`, `/uploads` and `/company_data` — including WebSockets — to the local
backend on `:8000`. **Nothing local depends on the deployed backend.**

**Tech stack** — Frontend: React 18, TypeScript, Vite, Tailwind, shadcn/ui,
Zustand, TanStack Query, React Router, i18next (EN/UR + RTL), Framer Motion,
Recharts, Vitest, Playwright. Backend: FastAPI, Pydantic, Uvicorn, PyJWT +
bcrypt, httpx, psycopg, PyMuPDF / pdfplumber / python-docx / openpyxl,
WebSockets + SSE. AI: OpenRouter chat with key/model rotation, hybrid
BM25 + embedding retrieval.

---

## Prerequisites

| Tool | Version | Notes |
| --- | --- | --- |
| **Python** | 3.11 (recommended) or 3.12 | Render pins 3.11.9 via `runtime.txt`. The local ML extras have the widest wheel coverage on 3.11. |
| **Node.js** | 18+ (22 LTS recommended) | `frontend/.nvmrc` pins 22. Ships with npm. |
| **Git** | any | |
| Disk | ~3 GB free | `node_modules` + the local ML extras (PyTorch is large). |
| RAM | 4 GB+ | For the local embedding model. |

Optional (only for production-like data): a free **Supabase** project, an
**OpenRouter** API key (AI chat), and a **Cohere/OpenAI** key (API embeddings).

## Local installation

```bash
git clone https://github.com/MuhammadAzan169/Smart-Construction-Connect.git
cd Smart-Construction-Connect
python app.py
```

That is the whole installation. On the first run `app.py`:

1. installs `backend/requirements.txt` **and** `backend/requirements-local.txt`
   (local SBERT + FAISS + OCR) into the Python interpreter you ran it with —
   no virtual environment is created,
2. runs `npm install` in `frontend/`,
3. creates `backend/.env` from `.env.example` with a freshly generated
   `JWT_SECRET_KEY`, and `frontend/.env` for local dev,
4. starts both servers and opens the browser.

Then open `backend/.env` and add your `OPENROUTER_API_KEY1` if you want the AI
chat to answer (everything else works without it).

> `app.py` installs into whatever Python you launch it with. If you want the
> packages isolated, activate your own virtual environment first and then run
> `python app.py` from inside it — the runner uses the active interpreter.
>
> **Manual alternative** — if you prefer two terminals:
>
> ```bash
> # terminal 1
> cd backend
> pip install -r requirements.txt -r requirements-local.txt
> cp .env.example .env
> python app.py                       # http://localhost:8000  (docs at /docs)
>
> # terminal 2
> cd frontend && npm install && npm run dev    # http://localhost:8080
> ```

## Running the whole app locally with `app.py`

```bash
python app.py
```

| URL | What |
| --- | --- |
| http://localhost:8080 | The application (Vite dev server, HMR enabled) |
| http://localhost:8000 | Backend API |
| http://localhost:8000/docs | Interactive OpenAPI docs |
| http://localhost:8000/api/health | Health check |

Both logs stream into the one terminal, prefixed `[backend]` / `[frontend]`.
Press **Ctrl+C** once to stop everything.

### Flags

| Flag | Effect |
| --- | --- |
| `--skip-install` | Skip pip/npm entirely — fastest restart |
| `--skip-local-ml` | Don't install PyTorch/FAISS/EasyOCR (light install, API path) |
| `--api-embeddings` | Run locally with the *production* embeddings path (`ENABLE_LOCAL_SBERT=0`) — useful to reproduce Render behaviour |
| `--backend-only` / `--frontend-only` | Start just one side |
| `--backend-port N` / `--frontend-port N` | Change ports (default 8000 / 8080) |
| `--no-browser` | Don't open a browser tab |

Examples:

```bash
python app.py --skip-install                 # quick restart
python app.py --skip-local-ml                # light setup, no PyTorch download
python app.py --api-embeddings               # behave exactly like Render
python app.py --backend-only --backend-port 9000
```

## Environment variables

Secrets live only in `.env` files (git-ignored) or in the Render/Vercel
dashboards. **No key, secret or credential is hardcoded anywhere in the source.**
Both parts ship a fully documented example file:
[`backend/.env.example`](backend/.env.example),
[`frontend/.env.example`](frontend/.env.example).

> Anything prefixed `VITE_` is compiled into the public client bundle — never
> put a secret there.

### Backend (`backend/.env` locally, Render dashboard in production)

| Variable | Required | Local default | Production (Render) |
| --- | --- | --- | --- |
| `ENV` | – | `development` | `production` (enforces a strong JWT secret) |
| `PORT` | – | `8000` | **do not set** — Render injects it |
| `JWT_SECRET_KEY` | ✅ | generated by `app.py` | `generateValue: true` in `backend/render.yaml` |
| `JWT_ALGORITHM`, `JWT_ACCESS_TOKEN_EXPIRE_MINUTES` | – | `HS256`, `60` | same |
| `CORS_ORIGINS` | ✅ (prod) | localhost ports auto-added | `https://<your-app>.vercel.app` |
| `OPENROUTER_API_KEY1` … `KEY29` | for AI chat | your key | your key (rotated on rate limits) |
| `OPENROUTER_BASE_URL`, `OPENROUTER_MODEL_1..5` | – | defaults in `.env.example` | same |
| `DATABASE_URL` | ✅ (prod) | empty → local JSON files | Supabase **Transaction pooler** URI (port 6543) |
| `SUPABASE_URL` | ✅ (prod) | empty → local disk | `https://<ref>.supabase.co` |
| `SUPABASE_SERVICE_ROLE_KEY` | ✅ (prod) | empty | *legacy* `service_role` JWT (`eyJ…`) — secret |
| `SUPABASE_BUCKET` | – | `media` | `media` (public bucket) |
| `ENABLE_LOCAL_SBERT` | – | **`1`** (local model) | **`0`** (must be off on free plan) |
| `SBERT_MODEL` | – | `all-MiniLM-L6-v2` | unused |
| `EMBEDDINGS_API_URL` / `_API_KEY` / `_MODEL` | recommended in prod | unused | e.g. `https://api.cohere.ai/compatibility/v1`, your key, `embed-multilingual-light-v3.0` |
| `MAX_IMAGE_SIZE`, `MAX_DOC_SIZE` | – | 5 MB, 10 MB | same |
| `LOG_LEVEL` | – | `INFO` | `INFO` |

### Frontend (`frontend/.env` locally, Vercel dashboard in production)

| Variable | Local | Vercel |
| --- | --- | --- |
| `VITE_API_URL` | **leave unset** — Vite proxies to `localhost:8000` | `https://<your-backend>.onrender.com` — required so the chat **WebSocket** can reach Render (Vercel rewrites proxy HTTP but not WebSockets) |

## Local models vs API-based models

The application picks its retrieval backend automatically from
`ENABLE_LOCAL_SBERT`, so the *same code* serves both environments:

| | Local (`python app.py`) | Render free plan |
| --- | --- | --- |
| `ENABLE_LOCAL_SBERT` | `1` | `0` |
| Embeddings | **local** `sentence-transformers` / `all-MiniLM-L6-v2` — offline, free, no API key | OpenAI-compatible **embeddings API** (`EMBEDDINGS_*`) |
| Vector index | **FAISS** (`faiss-cpu`) | in-memory numpy cosine similarity |
| Keyword search | BM25 (always on, hybrid with the above) | BM25 (also the fallback if no embeddings key is set) |
| OCR of scanned images | **EasyOCR** (local) | disabled — PDF / Word / Excel / text extraction still works |
| Chat LLM | OpenRouter API | OpenRouter API |
| Documents & files | local JSON under `backend/Database/` + local disk | Supabase Postgres + Supabase Storage |

Degradation chain in `backend/backend/utils/semantic_embeddings.py`:
`local SBERT + FAISS → SBERT + numpy → embeddings API → BM25 only`. Nothing
crashes when a tier is unavailable; search quality simply steps down.

Heavy dependencies are isolated in `backend/requirements-local.txt` and every
import of them is guarded by `try/except`, so Render never installs — and never
needs — PyTorch, FAISS or EasyOCR.

## Deploying the frontend on Vercel

1. **New Project → import this repository.**
2. **Root Directory:** `frontend` ← important.
3. Framework preset: **Vite**. Build `npm run build`, output `dist` (already
   declared in [`frontend/vercel.json`](frontend/vercel.json)).
4. **Environment variables:** add `VITE_API_URL` = your Render URL
   (e.g. `https://smart-construction-connect-api.onrender.com`) for
   Production, Preview and Development.
5. **Point the rewrites at your backend.** `frontend/vercel.json` contains the
   proxy rules; replace the Render hostname in all three `destination` values
   with your own:

   ```jsonc
   { "source": "/api/(.*)",          "destination": "https://<your-backend>.onrender.com/api/$1" }
   { "source": "/uploads/(.*)",      "destination": "https://<your-backend>.onrender.com/uploads/$1" }
   { "source": "/company_data/(.*)", "destination": "https://<your-backend>.onrender.com/company_data/$1" }
   ```

   (Vercel does not expand environment variables inside `vercel.json`, so this
   value has to be committed.) The final `/(.*) → /index.html` rewrite is what
   makes client-side routing work on refresh — keep it last.
6. **Deploy**, then copy the resulting `https://….vercel.app` URL into the
   backend's `CORS_ORIGINS` on Render and redeploy the backend.

## Deploying the backend on Render (free plan)

**Option A — Blueprint.** Render → **New → Blueprint** → pick this repo and set
the blueprint path / root directory to `backend`, so Render reads
[`backend/render.yaml`](backend/render.yaml). It already declares the free plan,
the build and start commands, the health check and every env var. Fill in the
`sync: false` values when prompted.

**Option B — manual web service.**

| Setting | Value |
| --- | --- |
| Root Directory | `backend` |
| Runtime | Python 3 (`runtime.txt` pins 3.11.9) |
| Build Command | `pip install -r requirements.txt` |
| Start Command | `uvicorn app:app --host 0.0.0.0 --port $PORT` |
| Health Check Path | `/api/health` |
| Instance Type | Free |

**Option C — Docker.** Set Root Directory `backend` and Runtime **Docker**; the
[`backend/Dockerfile`](backend/Dockerfile) builds a slim non-root image with the
same light dependency set and a `/api/health` healthcheck.

Then set the environment variables (Render dashboard → *Environment*):

```
ENV=production
JWT_SECRET_KEY=<64 hex chars>          # python -c "import secrets;print(secrets.token_hex(32))"
ENABLE_LOCAL_SBERT=0
CORS_ORIGINS=https://<your-app>.vercel.app
DATABASE_URL=postgresql://…pooler.supabase.com:6543/postgres
SUPABASE_URL=https://<ref>.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJ…
SUPABASE_BUCKET=media
OPENROUTER_API_KEY1=sk-or-v1-…
EMBEDDINGS_API_URL=https://api.cohere.ai/compatibility/v1
EMBEDDINGS_API_KEY=<cohere key>
EMBEDDINGS_MODEL=embed-multilingual-light-v3.0
LOG_LEVEL=INFO
```

Do **not** set `PORT` — Render injects it. Supabase setup and the one-time data
migration are documented in
[`backend/DEPLOY_SUPABASE.md`](backend/DEPLOY_SUPABASE.md)
(`schema.sql`, then `python migrate_to_supabase.py`).

Verify: `https://<your-backend>.onrender.com/api/health` → `{"status":"ok"}`.

## Render free-plan limitations

| Limit | Consequence | How this project handles it |
| --- | --- | --- |
| **512 MB RAM** | PyTorch/FAISS/EasyOCR cannot load | They are not in `requirements.txt`; `ENABLE_LOCAL_SBERT=0` selects the embeddings API, and BM25 is the final fallback |
| **Ephemeral disk** | Uploads and JSON writes vanish on redeploy/restart | All documents go to Supabase Postgres and all binaries to Supabase Storage when `DATABASE_URL` / `SUPABASE_*` are set |
| **Spins down after ~15 min idle** | First request takes 30–60 s | Frontend request timeout is 15 s, so the *first* call after a cold start may need a retry. Optionally ping `/api/health` every 10 min from an uptime monitor |
| **No persistent build cache / 750 h month** | Slow cold builds | Dependency list kept small; Docker layer caching if you use the Docker runtime |
| **Single instance, no autoscale** | WebSocket chat is single-process | Fine at demo scale; scale-out needs a shared pub/sub |
| **Free Supabase pauses after ~7 days idle** | API 500s on DB calls | Resume the project from the Supabase dashboard |

## Local vs production behaviour

| | Local (`python app.py`) | Production |
| --- | --- | --- |
| Frontend | Vite dev server `:8080`, HMR | Static build on Vercel CDN |
| Backend | uvicorn `:8000` | uvicorn on Render |
| API routing | Vite proxy (`/api` → `:8000`), WS proxied too | Vercel rewrites for HTTP; WS direct to Render via `VITE_API_URL` |
| Data store | JSON files in `backend/Database/` | Supabase Postgres |
| File storage | `backend/company_data/`, `backend/uploads/` | Supabase Storage bucket |
| Embeddings | Local SBERT + FAISS | Embeddings API (or BM25) |
| OCR | EasyOCR | Disabled |
| CORS | localhost origins auto-allowed | Explicit `CORS_ORIGINS` |
| Secrets | `backend/.env` | Render / Vercel dashboards |

## Troubleshooting

**`python app.py` — "npm was not found on PATH"**
Install Node.js 18+ and reopen the terminal.

**"port 8000/8080 is already in use"**
Stop the other process, or `python app.py --backend-port 9000 --frontend-port 5173`.

**PyTorch / faiss / easyocr install fails or is too slow**
Run `python app.py --skip-local-ml`. Everything still works; semantic search
falls back to the embeddings API (if configured) or BM25.

**Backend starts but the page shows network errors**
Check the `[backend]` log for a startup exception. Confirm
`http://localhost:8000/api/health` returns `{"status":"ok"}`. `app.py` points the
Vite proxy at whichever backend port it started (via `DEV_API_TARGET`); if you
run `npm run dev` by hand on a non-default port, set `DEV_API_TARGET` yourself.

**`RuntimeError: JWT_SECRET_KEY must be set to a strong secret in production`**
`ENV=production` with the placeholder secret. Set a real `JWT_SECRET_KEY`.

**CORS error in the browser on the deployed site**
Add the exact Vercel origin (scheme + host, no trailing slash) to `CORS_ORIGINS`
on Render and redeploy. Preview deployments have their own URLs — add them too.

**Vercel 404 on refresh of a nested route**
The `/(.*) → /index.html` rewrite must be the **last** entry in `vercel.json`.

**Vercel build fails: "Could not read package.json"**
Root Directory is not set to `frontend`.

**Render build fails / out of memory**
Something heavy leaked into `requirements.txt` — keep PyTorch, faiss and easyocr
in `requirements-local.txt` only. Confirm `ENABLE_LOCAL_SBERT=0` on Render.

**First request after idle times out**
Render cold start. Retry after ~60 s, or keep the service warm with an external
health-check ping.

**Uploaded images disappear after a redeploy**
`SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY` are unset, so files went to Render's
ephemeral disk. Set them and use a **public** bucket. Use the *legacy*
`service_role` JWT (`eyJ…`), not an `sb_secret_…` key — Storage rejects the
latter with `Invalid Compact JWS`.

**Chat / real-time messaging doesn't connect in production**
`VITE_API_URL` is missing on Vercel. Vercel rewrites don't proxy WebSockets, so
the socket needs the Render origin directly. Redeploy after setting it.

**AI assistant replies with a generic error**
`OPENROUTER_API_KEY1` missing or rate-limited. Add more keys
(`OPENROUTER_API_KEY2`, `3`, …) — they are auto-discovered and rotated.

**Semantic search results look weak on production**
No embeddings provider is configured, so it is running on BM25. Set
`EMBEDDINGS_API_URL` / `EMBEDDINGS_API_KEY` / `EMBEDDINGS_MODEL`.

---

## Data in this repository

`backend/Database/`, `backend/company_data/` and `frontend/src/data/` contain
**seeded demo data only** — fictional companies, suppliers, contact details and
chat history used to demonstrate the platform. No real user data, credentials or
personal information is stored in this repository.

Further reading: [`backend/README.md`](backend/README.md),
[`frontend/README.md`](frontend/README.md),
[`backend/DEPLOY_SUPABASE.md`](backend/DEPLOY_SUPABASE.md), and
[`docs/Smart-Construction-Connect-Infrastructure-Handbook.pdf`](docs/Smart-Construction-Connect-Infrastructure-Handbook.pdf).
