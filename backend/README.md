# Smart Construction Connect — Backend

FastAPI service for **Smart Construction Connect**. Serves the JSON API under
`/api/…`, the real-time chat WebSocket, admin event streams, and legacy static
files (`/company_data/…`, `/uploads/…`).

- **Deployed on Render:** https://smart-contruction-connect-backend.onrender.com
  (interactive docs at [`/docs`](https://smart-contruction-connect-backend.onrender.com/docs),
  health check at `/api/health`)
- **Data & files:** Supabase Postgres + Supabase Storage
- **Consumed by:** the React frontend, deployed on Vercel — see
  [`../frontend/README.md`](../frontend/README.md)

This is the `backend/` directory of the
[`Smart-Construction-Connect`](https://github.com/MuhammadAzan169/Smart-Construction-Connect)
repository; Render is pointed at this directory as its **Root Directory**.

## Layout

```
backend/                  ← Render root directory
├── app.py                ← production entry point (uvicorn app:app)
├── backend/              ← Python package
│   ├── config.py         ← settings loaded from env / .env
│   ├── main.py           ← alternate API entry (uvicorn backend.main:app)
│   ├── routers/          ← admin, ai_chat, auth, companies, events,
│   │                       filereader, messages, requests, suppliers, upload
│   └── utils/            ← retrieval engine, embeddings, data handlers
├── Database/             ← seeded JSON documents (dev store / migration source)
├── company_data/         ← demo company images, documents, galleries
├── index_data/           ← search index cache (rebuilt on startup, git-ignored)
├── uploads/              ← runtime attachments in dev (git-ignored, ephemeral)
├── migrate_to_supabase.py← one-time JSON → Postgres/Storage migration
├── seed_demo.py          ← reseed the demo dataset
├── schema.sql            ← reference schema for the `documents` table
├── requirements.txt
├── Procfile              ← start command
├── render.yaml           ← Render Blueprint
├── runtime.txt           ← Python version pin (3.11.9)
└── .env.example          ← copy to .env for local dev
```

All data paths resolve relative to this directory, so `Database/`,
`company_data/`, `index_data/` and `uploads/` must stay here.

## Local development

```bash
python -m venv .venv
.venv\Scripts\activate            # macOS/Linux: source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env              # fill in JWT_SECRET_KEY + OPENROUTER_API_KEY1

python app.py                     # http://localhost:8000  (docs at /docs)
```

Leave `DATABASE_URL` empty for local development and the app reads and writes the
JSON files in `Database/` directly — no Supabase project required.

Every setting is documented in [`.env.example`](.env.example). `.env` itself is
git-ignored — keep real keys out of the repository.

## Storage modes

| `DATABASE_URL` / `SUPABASE_*` | Documents | Uploaded files |
| --- | --- | --- |
| unset (local dev) | JSON files in `Database/` | local `uploads/` and `company_data/` |
| set (production) | Supabase Postgres, table `documents` | Supabase Storage bucket `media` |

Supabase is required in production because Render's disk is **ephemeral** —
anything written to it is lost on every deploy or restart. Setup and the one-time
data migration are covered in [`DEPLOY_SUPABASE.md`](DEPLOY_SUPABASE.md).

## Deploying to Render

1. In Render, create a **Web Service** from the
   `Smart-Construction-Connect` repository (or use the included `render.yaml`
   Blueprint).
2. Settings:
   - **Root directory:** `backend`
   - **Build command:** `pip install -r requirements.txt`
   - **Start command:** `uvicorn app:app --host 0.0.0.0 --port $PORT`
   - **Health check path:** `/api/health`
3. Environment variables (Render dashboard → *Environment*):

   | Variable | Value |
   | --- | --- |
   | `ENV` | `production` |
   | `JWT_SECRET_KEY` | long random string (`render.yaml` can generate it) |
   | `CORS_ORIGINS` | `https://smart-contruction-connect-frontend.vercel.app` |
   | `DATABASE_URL` | Supabase **Transaction pooler** URI (`…pooler.supabase.com:6543`) |
   | `SUPABASE_URL` | `https://<project-ref>.supabase.co` |
   | `SUPABASE_SERVICE_ROLE_KEY` | legacy `service_role` JWT (backend only — secret) |
   | `SUPABASE_BUCKET` | `media` |
   | `OPENROUTER_API_KEY1` | your OpenRouter key (add `…KEY2`, `…KEY3` to rotate) |
   | `EMBEDDINGS_API_URL` / `EMBEDDINGS_API_KEY` / `EMBEDDINGS_MODEL` | optional; omit to use BM25 keyword search |

   Do **not** set `PORT` — Render injects it.
4. Point the frontend at the deployed URL: the rewrites in
   `../frontend/vercel.json` and the `VITE_API_URL` variable in Vercel.

## Notes & caveats

- **Free plan cold starts.** The service spins down when idle; the first request
  afterwards takes ~30–60s and rebuilds the search index.
- **No heavy ML on the free tier.** `sentence-transformers`, `faiss-cpu` and
  `easyocr` are intentionally left out of `requirements.txt` so the service fits
  in 512 MB. Semantic search therefore uses an external embeddings API, falling
  back to BM25 when no key is set, and OCR of scanned images is disabled
  (PDF/Word/Excel/text extraction still works). To re-enable them, move to a plan
  with ≥2 GB RAM, add those packages back and set `ENABLE_LOCAL_SBERT=1`.
- **Demo data.** `Database/` and `company_data/` hold fictional seeded records
  used for demonstration — no real users or personal data.
