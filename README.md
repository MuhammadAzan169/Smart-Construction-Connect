# Smart Construction Connect

A full-stack construction marketplace and AI assistant that connects clients,
construction companies, material suppliers and administrators in one platform —
role-based dashboards, verified company discovery, project requests, real-time
messaging, bilingual (English / Urdu) UI, and a retrieval-augmented AI assistant
that reads uploaded project documents and recommends matching companies and
suppliers.

**Repository:** [`MuhammadAzan169/Smart-Construction-Connect`](https://github.com/MuhammadAzan169/Smart-Construction-Connect)

## Live deployments

| Part | Hosted on | URL |
| --- | --- | --- |
| Frontend (React SPA) | **Vercel** — project root `Frontend/` | https://smart-contruction-connect-frontend.vercel.app |
| Backend (FastAPI API) | **Render** — Web Service, root `Backend/` | https://smart-contruction-connect-backend.onrender.com |
| Database + file storage | **Supabase** — Postgres (`documents` table) + public Storage bucket `media` | your own Supabase project |

API docs are served by the backend at [`/docs`](https://smart-contruction-connect-backend.onrender.com/docs);
health check at `/api/health`.

> Both hosts use free tiers: Render spins the service down when idle (first
> request after a cold start takes ~30–60s), and a free Supabase project pauses
> after ~7 days of inactivity and must be resumed from its dashboard.

## Repository layout

```
Smart-Construction-Connect/
├── Backend/     ← FastAPI service deployed on Render   (see Backend/README.md)
└── Frontend/    ← React + Vite SPA deployed on Vercel  (see Frontend/README.md)
```

Each part deploys independently from this single repository by pointing the host
at the corresponding subdirectory — there is no separate repo per service.

## Architecture

```
Browser ──► Vercel (static SPA)
              │  /api/*, /uploads/*, /company_data/*  → rewritten to Render
              │  WebSocket (chat) ─────────────────────► Render directly (VITE_API_URL)
              ▼
          Render: FastAPI (uvicorn app:app)
              ├── Supabase Postgres  — all JSON documents (users, companies, …)
              ├── Supabase Storage   — images, documents, attachments
              └── OpenRouter         — LLM chat with model/key failover
```

Because HTTP traffic is proxied through Vercel's rewrites, the browser only
talks to the Vercel origin for the REST API (no CORS setup needed). WebSockets
are *not* proxied by Vercel, so the chat socket dials the Render origin directly
using `VITE_API_URL`.

## Tech stack

- **Frontend:** React 18, TypeScript, Vite, Tailwind CSS, shadcn/ui, Zustand,
  TanStack Query, React Router, i18next (English + Urdu with RTL), Framer Motion,
  Recharts. Tests with Vitest + Testing Library, E2E with Playwright.
- **Backend:** FastAPI, Pydantic, Uvicorn, PyJWT + bcrypt auth, httpx,
  psycopg (Supabase Postgres), PyMuPDF / pdfplumber / python-docx / openpyxl for
  document extraction, WebSockets and Server-Sent Events.
- **AI & search:** OpenRouter chat models with key/model rotation, BM25 keyword
  retrieval by default, optional external embeddings API for semantic search.

## Features

- Multi-role accounts — client, construction company, supplier, admin — each with
  its own dashboard and permissions.
- JWT authentication with bcrypt password hashing and role-scoped API routes.
- Company and supplier marketplace with verification status, galleries and documents.
- Project requests and quotations between clients and companies.
- Real-time messaging over WebSockets with attachments and read receipts.
- AI assistant (RAG): extracts intent, searches company/supplier data, reads
  uploaded PDFs/Word/Excel/images, and returns context-aware recommendations.
- Admin console: user and company approval, document verification, activity log,
  live monitoring via Server-Sent Events.
- Bilingual English/Urdu interface with full RTL support.

## Quick start (local)

Run both parts side by side — the Vite dev server proxies the API to `:8000`.

```bash
git clone https://github.com/MuhammadAzan169/Smart-Construction-Connect.git
cd Smart-Construction-Connect
```

**Backend** (terminal 1):

```bash
cd Backend
python -m venv .venv
.venv\Scripts\activate          # macOS/Linux: source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env            # fill in JWT_SECRET_KEY and OPENROUTER_API_KEY1
python app.py                   # http://localhost:8000  (docs at /docs)
```

**Frontend** (terminal 2):

```bash
cd Frontend
npm install
npm run dev                     # http://localhost:8080
```

With `DATABASE_URL` left empty the backend runs entirely on local JSON files
under `Backend/Database/` — no Supabase account needed for development.

## Configuration & secrets

Every secret is read from environment variables. `.env` files are **git-ignored**
and must never be committed; each part ships a documented `.env.example`:

- [`Backend/.env.example`](Backend/.env.example) — JWT secret, CORS origins,
  OpenRouter keys, `DATABASE_URL`, `SUPABASE_*`, embeddings, upload limits.
- [`Frontend/.env.example`](Frontend/.env.example) — `VITE_API_URL` only.

Set the production values in the Render and Vercel dashboards, not in the repo.
Anything under `VITE_` is bundled into the client and is therefore public — never
put a secret there.

## Deployment

Full, step-by-step instructions live with each part:

- **Backend → Render:** [`Backend/README.md`](Backend/README.md), plus
  [`Backend/DEPLOY_SUPABASE.md`](Backend/DEPLOY_SUPABASE.md) for the Supabase
  Postgres + Storage setup and one-time data migration.
- **Frontend → Vercel:** [`Frontend/README.md`](Frontend/README.md).
- **Containers / Kubernetes / EKS:**
  [`docs/Smart-Construction-Connect-Infrastructure-Handbook.pdf`](docs/Smart-Construction-Connect-Infrastructure-Handbook.pdf)
  — storage architecture (what is durable, what is ephemeral), reference
  Dockerfiles (the repo ships none), env-var reference, ingress/WebSocket
  requirements, probes and resource sizing.

## Data in this repository

`Backend/Database/`, `Backend/company_data/` and `Frontend/src/data/` contain
**seeded demo data only** — fictional companies, suppliers, contact details and
chat history used to demonstrate the platform. No real user data, credentials or
personal information is stored in this repository.
