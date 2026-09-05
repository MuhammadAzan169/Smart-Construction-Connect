# Smart Construction Connect — Frontend

React 18 + Vite + TypeScript single-page app (Tailwind CSS + shadcn/ui, Zustand,
TanStack Query, i18next with English/Urdu RTL support).

- **Deployed on Vercel:** https://smart-contruction-connect-frontend.vercel.app
- **Talks to** the FastAPI backend deployed on Render:
  https://smart-contruction-connect-backend.onrender.com — see
  [`../backend/README.md`](../backend/README.md)

This is the `frontend/` directory of the
[`Smart-Construction-Connect`](https://github.com/MuhammadAzan169/Smart-Construction-Connect)
repository; Vercel is pointed at this directory as its **Root Directory**.

## Local development

```bash
npm install
npm run dev          # http://localhost:8080
```

The dev server proxies `/api`, `/uploads`, `/company_data` and the chat WebSocket
to the backend at `http://localhost:8000` (see `vite.config.ts`), so run the
backend locally too. No `.env` is needed for local development.

## Scripts

| Command | What it does |
| --- | --- |
| `npm run dev` | Vite dev server on port 8080 |
| `npm run build` | production build into `dist/` |
| `npm run preview` | serve the production build locally |
| `npm run lint` | ESLint over the project |
| `npm test` | Vitest unit/component tests (`npm run test:watch` to watch) |
| `npx playwright test` | end-to-end tests (`playwright.config.ts`) |

## Layout

```
frontend/               ← Vercel root directory
├── src/                ← pages, components, stores, hooks, i18n, data
├── public/             ← static assets copied verbatim
├── index.html          ← SPA shell
├── vercel.json         ← build settings, backend rewrites, SPA fallback
├── vite.config.ts      ← dev server + local proxy to the backend
├── tailwind.config.ts / components.json   ← Tailwind + shadcn/ui config
└── .env.example        ← copy to .env only if you need to override VITE_API_URL
```

## Deploying to Vercel

1. Import the `Smart-Construction-Connect` repository in Vercel and set the
   project's **Root Directory** to `frontend`. Vercel auto-detects Vite:
   - **Build command:** `vite build`
   - **Output directory:** `dist`
2. Set the environment variable **`VITE_API_URL`** to the Render backend origin
   (`https://smart-contruction-connect-backend.onrender.com`). This is required
   for real-time chat — Vercel rewrites proxy HTTP but **not** WebSockets, so the
   message socket connects to the backend directly. Only `VITE_`-prefixed
   variables reach the browser bundle, so never put a secret here.
3. If the backend URL ever changes, update it in **both** `vercel.json` (all three
   rewrites) and the `VITE_API_URL` variable.

### How the frontend reaches the backend

`vercel.json` rewrites proxy these paths to the Render backend, so the browser
only talks to the Vercel origin for HTTP (no CORS configuration needed):

| Path in the app   | Proxied to |
| ----------------- | ---------- |
| `/api/*`          | `https://smart-contruction-connect-backend.onrender.com/api/*` |
| `/uploads/*`      | `https://smart-contruction-connect-backend.onrender.com/uploads/*` |
| `/company_data/*` | `https://smart-contruction-connect-backend.onrender.com/company_data/*` |

Everything else falls back to `index.html` so client-side routing works. Files
uploaded in production return absolute Supabase Storage URLs and load directly.

> The backend runs on Render's free plan and spins down when idle, so the first
> request after a period of inactivity can take ~30–60s.
