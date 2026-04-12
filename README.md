# Smart Construction Connect

> A full-stack, AI-powered SaaS platform connecting construction clients with verified construction companies and material suppliers across Pakistan — featuring a RAG-based AI assistant, real-time messaging, role-based dashboards, and bilingual (English / Urdu) support.

---

## Table of Contents

1. [Overview](#overview)
2. [Architecture](#architecture)
3. [Tech Stack](#tech-stack)
4. [Project Structure](#project-structure)
5. [Database Design](#database-design)
6. [API Reference](#api-reference)
7. [AI / RAG Pipeline](#ai--rag-pipeline)
8. [User Roles](#user-roles)
9. [Getting Started](#getting-started)
10. [Configuration](#configuration)
11. [Running the App](#running-the-app)
12. [Development Workflow](#development-workflow)
13. [Demo Accounts](#demo-accounts)
14. [Feature Overview](#feature-overview)

---

## Overview

Smart Construction Connect (SCC) is a marketplace and AI-assistant platform with four distinct user roles:

| Role | Who | What They Do |
|---|---|---|
| **Client** | Homeowners, property developers | Browse companies/suppliers, submit project requests, use AI chat to get personalized recommendations |
| **Construction Company** | Builders, contractors | List their services, receive client requests, find material suppliers, upload project documents |
| **Material Supplier** | Vendors, distributors | List their materials catalog, manage inquiries, upload product documents |
| **Admin** | Platform operators | Manage all users, approve/verify accounts and documents, monitor platform activity |

---

## Architecture

```
+---------------------------------------------------------------------------+
|                          Browser / Client                                 |
|                                                                           |
|  React 18 + TypeScript + Vite        Zustand   TanStack Query             |
|  +-----------+  +--------------+  +----------------------------------+    |
|  | Landing   |  | Auth Pages   |  | Dashboard  (role-based)         |    |
|  | Page      |  | Login/Signup |  | Companies / Suppliers /         |    |
|  +-----------+  +--------------+  | AI Chat / Messages /            |    |
|                                   | Requests / Admin                |    |
|                                   +----------------------------------+    |
+----------------------------+----------------------------------------------+
                             |  HTTP / REST  (Bearer JWT)
                             |  WebSocket    (messages)
                             |  SSE          (admin events)
                             v
+----------------------------+----------------------------------------------+
|               FastAPI Backend  (Python 3.10+)                             |
|                                                                           |
|  app.py  --  serves built frontend SPA + mounts all routers              |
|  (Uvicorn ASGI)                                                           |
|                                                                           |
|  +----------------------------------------------------------------------+ |
|  |  Routers                                                             | |
|  |  /api/auth       /api/companies   /api/suppliers                    | |
|  |  /api/admin      /api/ai          /api/upload                       | |
|  |  /api/messages   /api/requests    /api/events (SSE)                 | |
|  +------------------------------------+---------------------------------+ |
|                                       |                                   |
|  +------------------------------------v---------------------------------+ |
|  |  Utils / Services                                                    | |
|  |  data_handler.py    <- atomic JSON read/write, user CRUD            | |
|  |  auth_deps.py       <- JWT decode, role guards                      | |
|  |  rag_engine.py      <- TF-IDF index, intent extraction              | |
|  |  embeddings.py      <- lightweight TF-IDF semantic search           | |
|  |  semantic_embeddings.py <- optional sentence-transformers           | |
|  |  market_prices.py   <- hardcoded PKR reference prices               | |
|  |  filereader.py      <- PDF/Word/Excel/Image OCR pipeline            | |
|  |  conversation_memory.py <- per-session chat context                 | |
|  |  response_cache.py  <- in-memory LLM response cache                 | |
|  |  analytics.py       <- platform stats, supply/demand gaps           | |
|  +------------------------------------+---------------------------------+ |
+----------------------------+----------------------------------------------+
                             |
       +---------------------+------------------+
       v                     v                  v
 JSON flat files       OpenRouter LLM       File system
 Database/             (httpx async)        company_data/
 clients/              multi-key +          uploads/
 construction/         multi-model
 suppliers/            rotation
 admin/
 ai_chats/
```

### Request Lifecycle

```
Browser                     FastAPI                    Storage / AI
  |                            |                           |
  |--- POST /api/auth/login -->|                           |
  |                            |-- read Database/*/users ->|
  |<-- { token, user } --------|                           |
  |                            |                           |
  |--- GET /api/companies ---->|                           |
  |    Authorization: Bearer   |-- read companies.json --->|
  |<-- { items, total, ... } --|                           |
  |                            |                           |
  |--- POST /api/ai/chat ----->|                           |
  |    { message, session_id } |-- extract intent -------->|
  |                            |-- TF-IDF search --------->|
  |                            |-- build prompt ---------->|
  |                            |-- OpenRouter API -------->  (LLM)
  |<-- { reply, companies } <--|<--------------------------  |
  |                            |-- save session ----------->|
  |                            |                           |
  |-- WS /api/messages/ws ---->|                           |
  |   ?token=<JWT>             |-- JWT validate ---------->|
  |<-- real-time messages -----|                           |
```

---

## Tech Stack

### Frontend

| Package | Version | Role |
|---|---|---|
| React | 18.3 | UI framework |
| TypeScript | 5.8 | Type safety |
| Vite (SWC) | 7.3 | Build tool & dev server |
| Tailwind CSS | 3.4 | Utility-first styling |
| shadcn/ui (Radix) | latest | Accessible component primitives |
| Framer Motion | 12 | Page & element animations |
| react-parallax-tilt | 1.7 | 3-D tilt hover on cards |
| tsParticles | 3.9 | Particle background effects |
| Zustand | 5.0 | Global state (auth, theme, language) |
| TanStack Query | 5.83 | Server-state, caching, pagination |
| React Router DOM | 6.30 | SPA routing |
| React Hook Form + Zod | 7.61 / 3.25 | Forms & validation |
| Recharts | 2.15 | Charts & analytics |
| i18next + react-i18next | latest | i18n (English / Urdu, RTL) |
| Sonner | 1.7 | Toast notifications |
| @dnd-kit | 6/10 | Drag-and-drop |
| date-fns | 3.6 | Date utilities |

**Design Tokens:** amber/gold primary `#F59E0B`, orange highlight `#EA580C`, premium gold `#D4AF37`, dark background `#0B0F14`

### Backend

| Package | Role |
|---|---|
| FastAPI | REST API framework, WebSocket, SSE |
| Uvicorn [standard] | ASGI server |
| Pydantic v2 | Request/response model validation |
| bcrypt | Password hashing |
| PyJWT | JWT generation & verification |
| httpx | Async HTTP client for OpenRouter |
| python-multipart | File upload handling |
| python-dotenv | `.env` loading |
| numpy | TF-IDF vector maths |
| sentence-transformers + faiss-cpu | Optional semantic embedding (falls back to BM25) |
| EasyOCR | Image text extraction (in `filereader.py`) |

### Infrastructure

- **No database server** -- all data stored in atomic JSON files
- **OpenRouter.ai** -- LLM gateway (supports 200+ models); up to 28 API keys + 5 models with automatic failover
- **Static file serving** -- `Frontend/dist/` bundled into the same process as the API

---

## Project Structure

```
Smart-Construction-Connect/
|
+-- app.py                        # Main entry point -- API + SPA in one process
+-- requirements.txt
+-- .env                          # (git-ignored) your local environment
+-- .env.example                  # Template -- copy to .env and fill in keys
|
+-- backend/
|   +-- config.py                 # All env vars read here (single source of truth)
|   +-- main.py                   # Standalone API entry (dev: uvicorn backend.main:app)
|   +-- routers/
|   |   +-- auth.py               # POST /api/auth/{signup,login,logout,me}
|   |   +-- companies.py          # GET/POST/PUT /api/companies
|   |   +-- suppliers.py          # GET/POST/PUT /api/suppliers
|   |   +-- admin.py              # GET/POST /api/admin/{users,stats,approve,ban}
|   |   +-- ai_chat.py            # POST /api/ai/chat  GET /api/ai/sessions
|   |   +-- upload.py             # POST /api/upload/{company,supplier,client,admin}
|   |   +-- messages.py           # GET /api/messages  WS /api/messages/ws
|   |   +-- requests.py           # GET/POST /api/requests
|   |   +-- events.py             # GET /api/events (SSE)
|   |   +-- filereader.py         # POST /api/files/read (PDF/Word/Excel/Image)
|   +-- utils/
|       +-- data_handler.py       # Atomic JSON I/O, user CRUD, per-file asyncio locks
|       +-- auth_deps.py          # FastAPI dependency -- verify JWT, role guards
|       +-- rag_engine.py         # TF-IDF index, intent extraction, LLM orchestration
|       +-- embeddings.py         # Lightweight TF-IDF semantic search
|       +-- semantic_embeddings.py # sentence-transformers / FAISS (optional)
|       +-- market_prices.py      # Hardcoded PKR reference prices (cement, steel, ...)
|       +-- conversation_memory.py # Per-session message history
|       +-- response_cache.py     # In-memory LLM response cache
|       +-- analytics.py          # Platform stats, supply/demand trend computation
|       +-- events.py             # SSE queue management
|
+-- Database/                     # JSON flat-file storage (git-tracked samples)
|   +-- admin/
|   |   +-- users.json
|   |   +-- settings.json
|   |   +-- activity_log.json
|   +-- clients/users.json
|   +-- construction/
|   |   +-- users.json
|   |   +-- companies.json        # 99-company dataset (multi-city, pricing, AI scores)
|   +-- suppliers/
|   |   +-- users.json
|   |   +-- catalog.json
|   +-- messages/
|   +-- requests/
|   +-- ai_chats/
|       +-- requirements/         # Extracted client requirements per email
|       +-- {safe_email}/
|           +-- index.json        # Session list
|           +-- session_{id}.json # Individual chat session
|
+-- Frontend/
|   +-- index.html
|   +-- vite.config.ts
|   +-- tailwind.config.ts
|   +-- src/
|   |   +-- App.tsx               # Router + ErrorBoundary per route
|   |   +-- main.tsx
|   |   +-- pages/
|   |   |   +-- Index.tsx         # Public landing page
|   |   |   +-- LoginPage.tsx
|   |   |   +-- SignupPage.tsx
|   |   |   +-- Dashboard.tsx     # Role-aware dashboard
|   |   |   +-- CompaniesPage.tsx # Company/supplier browse
|   |   |   +-- AIChatPage.tsx    # AI assistant
|   |   |   +-- MessagesPage.tsx  # Real-time WebSocket messaging
|   |   |   +-- RequestsPage.tsx
|   |   |   +-- ApprovalsPage.tsx # Document verification (admin)
|   |   |   +-- UsersPage.tsx     # User management (admin)
|   |   |   +-- ActivityPage.tsx
|   |   |   +-- SettingsPage.tsx
|   |   +-- components/
|   |   |   +-- layout/           # AppSidebar, DashboardLayout, TopNavbar
|   |   |   +-- shared/           # SpotlightCard, GlassCard, AnimatedBackground,
|   |   |   |                     # MagneticButton, PremiumSkeleton, EmptyState,
|   |   |   |                     # MatchScoreRing, TiltCard, ParticleBackground
|   |   |   +-- ui/               # shadcn/ui primitives (50+ components)
|   |   +-- stores/
|   |   |   +-- authStore.ts      # Zustand: user, token, role -- persisted to localStorage
|   |   |   +-- themeStore.ts     # Dark / light with next-themes
|   |   |   +-- languageStore.ts  # EN / UR + RTL dir on <html>
|   |   +-- lib/
|   |   |   +-- api.ts            # Typed fetch wrapper, token injection
|   |   |   +-- i18n.ts           # i18next init (en.json + ur.json ~500 keys each)
|   |   |   +-- animations.ts     # Framer Motion shared variants
|   |   |   +-- utils.ts
|   |   +-- data/
|   |   |   +-- companyData.ts
|   |   |   +-- supplierData.ts
|   |   |   +-- mockData.ts
|   |   |   +-- locationOptions.ts
|   |   +-- hooks/
|   |       +-- use-mobile.tsx
|   |       +-- use-toast.ts
|   |       +-- useVoiceRecorder.ts  # Speech-to-text for AI chat
|   |       +-- useAnimations.ts
|   +-- public/
|
+-- company_data/                 # Uploaded documents & images per company
|   +-- client/
|   +-- construction_company/     # 99 sub-folders
|   +-- material_supplier/
|
+-- uploads/                      # User-uploaded runtime files
```

---

## Database Design

All data is stored as JSON files. Writes are **atomic** (write to temp file then `os.replace`) and protected by per-file `asyncio.Lock`.

### File Map

| File | Description |
|---|---|
| `Database/clients/users.json` | Client profiles: `email, password_hash, name, phone, status` |
| `Database/construction/users.json` | Company user accounts |
| `Database/construction/companies.json` | Company catalog (see schema below) |
| `Database/suppliers/users.json` | Supplier user accounts |
| `Database/suppliers/catalog.json` | Supplier materials: `id, name, city, materials[], rating, contact, verification_status` |
| `Database/admin/users.json` | Admin accounts |
| `Database/admin/activity_log.json` | Platform action log |
| `Database/admin/settings.json` | Platform-wide settings |
| `Database/messages/` | Conversation threads per pair |
| `Database/requests/` | Project requests from clients to companies |
| `Database/ai_chats/{email}/index.json` | Chat session list for a user |
| `Database/ai_chats/{email}/session_{id}.json` | Full message history for a session |
| `Database/ai_chats/requirements/{email}.json` | Extracted requirements (city, budget, plot_size, project_type) |

### Company Schema (simplified)

```json
{
  "id": "gulberg-elite-developers",
  "name": "Gulberg Elite Developers",
  "city": "Lahore",
  "services": ["Grey Structure", "Full Construction", "Renovation"],
  "experience": 12,
  "rating": 4.7,
  "verified": true,
  "operational_areas": [],
  "flattened_operational_areas": {
    "Lahore":     { "economy": 3200, "standard": 4500, "premium": 6800 },
    "Islamabad":  { "economy": 3500, "standard": 5000, "premium": 7500 }
  },
  "customer_feedback": [],
  "ai_scores": { "quality": 87, "reliability": 91, "value": 78 }
}
```

---

## API Reference

All authenticated endpoints require `Authorization: Bearer <token>`.

### Auth `/api/auth`

| Method | Path | Auth | Description |
|---|---|---|---|
| POST | `/signup` | -- | Register a new user (any role) |
| POST | `/login` | -- | Login, returns JWT token + user object |
| GET | `/me` | Yes | Get current user profile |
| POST | `/logout` | Yes | Invalidate session |

### Companies `/api/companies`

| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/` | -- | List companies `{items, total, page, limit}` |
| GET | `/{id}` | -- | Get single company |
| POST | `/` | company | Create company profile |
| PUT | `/{id}` | company | Update company profile |

### Suppliers `/api/suppliers`

| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/` | -- | List suppliers `{items, total, page, limit}` |
| GET | `/{id}` | -- | Get single supplier |
| POST | `/` | supplier | Create supplier catalog entry |
| PUT | `/{id}` | supplier | Update supplier catalog entry |

### AI Chat `/api/ai`

| Method | Path | Auth | Description |
|---|---|---|---|
| POST | `/chat` | Yes | Send message, receive AI reply + matched companies |
| GET | `/sessions` | Yes | List all chat sessions |
| GET | `/sessions/{id}` | Yes | Load a chat session |
| DELETE | `/sessions/{id}` | Yes | Delete a chat session |

### Admin `/api/admin`

| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/users` | admin | Paginated user list across all roles |
| PATCH | `/users/{email}/status` | admin | Approve / ban / activate a user |
| GET | `/stats` | admin | Platform overview statistics |
| GET | `/activity` | admin | Recent activity log |

### Upload `/api/upload`

| Method | Path | Auth | Description |
|---|---|---|---|
| POST | `/company` | company | Upload company document/image (<=10 MB) |
| POST | `/supplier` | supplier | Upload supplier document/image (<=10 MB) |
| POST | `/client` | client | Upload client document (<=10 MB) |
| POST | `/admin` | admin | Upload admin document (<=10 MB) |

### Messages `/api/messages`

| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/` | Yes | List conversations |
| GET | `/{thread_id}` | Yes | Get messages in a thread |
| WS | `/ws?token=<JWT>` | Yes | Real-time WebSocket channel |

### Events `/api/events`

| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/stream` | admin | SSE stream of platform events |
| GET | `/analytics` | admin | Supply/demand analytics |
| POST | `/embeddings/rebuild` | admin | Trigger full index rebuild |

---

## AI / RAG Pipeline

```
User Message (natural language)
         |
         v
+----------------------------------+
|  Intent Extraction               |
|  rag_engine.py                   |
|  - city detection                |
|  - budget range parsing (PKR)    |
|  - plot size extraction (marla)  |
|  - project type classification   |
|  - materials list                |
+---------------+------------------+
                |   (requirements gate -- client role only)
                |   >= 3 of {city, budget, plot_size, project_type}
                |   AND >= 2 user messages before revealing companies
                v
+----------------------------------+
|  TF-IDF Index Search             |
|  embeddings.py / rag_engine.py   |
|  - all 99 companies              |
|  - all suppliers in catalog      |
|  - per-entity embedding update   |
+---------------+------------------+
                |
                v
+----------------------------------+
|  Structural Boosting             |
|  - city exact match      +20     |
|  - budget within +-10%   +8      |
|  - area match            +8      |
|  - rating > 4.5          +8      |
|  - AI score contribution  +X     |
|  - verified badge         +3     |
+---------------+------------------+
                |
                v
+----------------------------------+
|  Prompt Assembly                 |
|  Role-specific system prompt +   |
|  TOP 3 matched companies +       |
|  TOP 3 matched suppliers +       |
|  market prices (PKR) +           |
|  conversation history            |
+---------------+------------------+
                |
                v
+----------------------------------+
|  OpenRouter LLM Call             |
|  - httpx async POST              |
|  - multi-key round-robin         |
|  - model rotation on 429/error   |
|  - up to 28 keys x 5 models      |
+---------------+------------------+
                |
                v
+----------------------------------+
|  Response + Persistence          |
|  - AI reply to client            |
|  - company cards returned        |
|  - session saved immediately     |
|  - requirements updated          |
+----------------------------------+
```

### Role-Specific AI Behaviours

| Role | System Prompt Mode | Company Data Shown? |
|---|---|---|
| **Landing (unauthenticated)** | Marketing bot -- platform benefits only | No |
| **Client** | PHASE 1: understand -> PHASE 2: recommend -> PHASE 3: guide | Only after requirements gate passes |
| **Company** | Immediate supplier + market price recommendations | Supplier data only |
| **Supplier** | Market analytics and pricing insights | No |
| **Admin** | Full platform data -- users, stats, top companies, pending approvals | Yes (all) |

### File Processing (filereader.py, 1400+ lines)

Uploaded files are processed by a modular handler pipeline before being sent to the LLM:

- **PDF** -- PyPDF2 + text cleanup
- **Word** -- python-docx
- **Excel** -- openpyxl
- **Images** -- EasyOCR (English + Urdu)
- **JSON** -- direct parse + pretty-print
- **Code files** -- plain-text conversion
- TTL cache (3600 s) keyed by file hash
- Max 5 cached files per user session

---

## User Roles

### Client
- Browse the full company and supplier directory
- Use AI chat to describe a project and get personalized TOP 3 recommendations
- Submit project requests directly to companies
- In-app messaging with companies/suppliers
- Upload supporting documents to share with vendors
- View and manage requirements profile (city, budget, plot size, etc.)

### Construction Company
- Maintain a company profile (services, operational areas, pricing tiers)
- Receive and manage project requests from clients
- Browse material suppliers filtered by city and category
- Get AI-assisted supplier recommendations and market pricing
- Upload project portfolio and certifications
- Message clients and suppliers

### Material Supplier
- Maintain a product/material catalog
- Receive inquiries from construction companies
- Get AI market analytics (price trends, supply/demand gaps)
- Upload product catalogs and certifications

### Admin
- View platform-wide stats: users by role, active sessions, documents pending
- Approve or ban users across all roles
- Verify uploaded company and supplier documents
- Check recent activity log
- Trigger embedding index rebuilds
- Monitor SSE real-time event stream

---

## Getting Started

### Prerequisites

| Requirement | Version |
|---|---|
| Python | 3.10+ |
| Node.js | 18+ |
| npm or bun | latest |

### 1. Clone the Repository

```bash
git clone https://github.com/your-org/smart-construction-connect.git
cd Smart-Construction-Connect
```

### 2. Configure Environment Variables

```bash
cp .env.example .env
```

Open `.env` and fill in your values -- at minimum set `OPENROUTER_API_KEY_1` and `JWT_SECRET_KEY`. See the [Configuration](#configuration) section below.

### 3. Install Python Dependencies

```bash
pip install -r requirements.txt
```

Optional extras for better performance:
```bash
pip install easyocr                          # OCR for image documents
pip install sentence-transformers faiss-cpu  # Semantic embeddings (higher AI accuracy)
```

### 4. Install Frontend Dependencies

```bash
cd Frontend
npm install      # or: bun install
cd ..
```

### 5. Build the Frontend

```bash
cd Frontend
npm run build
cd ..
```

### 6. Start the Server

```bash
python app.py
```

Open [http://localhost:8000](http://localhost:8000)

---

## Configuration

All environment variables are loaded through `backend/config.py`. Copy `.env.example` to `.env` and fill in your values.

### Getting an OpenRouter API Key

1. Visit [https://openrouter.ai](https://openrouter.ai) and create a free account
2. Go to **Keys** -> **Create Key**
3. Copy the `sk-or-v1-...` key into your `.env` as `OPENROUTER_API_KEY_1`
4. Add credits (free tier gives limited usage; pricing varies by model)

### Generating a Secure JWT Secret

```bash
python -c "import secrets; print(secrets.token_hex(32))"
```

Copy the output into `JWT_SECRET_KEY` in your `.env`.

---

## Running the App

### Production Mode (single process, port 8000)

```bash
python app.py
```

### Development Mode (hot reload)

```bash
python app.py --dev
```

| URL | What |
|---|---|
| `http://localhost:8000` | Full app (API + SPA) |
| `http://localhost:5173` | Vite dev frontend (hot reload) |
| `http://localhost:8000/docs` | Swagger UI (interactive API docs) |
| `http://localhost:8000/redoc` | ReDoc API docs |

### Backend Only (standalone)

```bash
uvicorn backend.main:app --reload --port 8000
```

### Frontend Only

```bash
cd Frontend
npm run dev
```

---

## Development Workflow

### Type Check

```bash
cd Frontend && npx tsc --noEmit
```

### Lint

```bash
cd Frontend && npm run lint
```

### Unit Tests

```bash
cd Frontend
npm run test          # run once
npm run test:watch    # watch mode
```

### End-to-End Tests (Playwright)

```bash
cd Frontend && npx playwright test
```

### Rebuild Search Index (via API)

```
POST /api/events/embeddings/rebuild
Authorization: Bearer <admin-token>
```

---

## Demo Accounts

The following accounts are preloaded in the sample database files:

| Role | Email | Password |
|---|---|---|
| Admin | `admin@scc.com` | `Admin@123!` |
| Client | `client@scc.com` | `Client@123!` |
| Company | `company@scc.com` | `Company@123!` |
| Supplier | `supplier@scc.com` | `Supplier@123!` |

> Passwords must contain at least one uppercase letter, one digit, and one special character.

---

## Feature Overview

| Feature | Notes |
|---|---|
| Role-based auth (JWT) | Client / Company / Supplier / Admin |
| Company directory | 99 companies, multi-city, per-city tier pricing |
| Supplier marketplace | Filter by category, city, verified status |
| AI chat (RAG + LLM) | Requirements gate, role-specific system prompts |
| Chat session persistence | Restored from localStorage + backend |
| File upload & OCR | PDF, Word, Excel, Images (EasyOCR) |
| Real-time messaging | JWT-authenticated WebSocket |
| Admin panel | User management, approval queue, stats |
| SSE event stream | Live platform events (admin only) |
| Bilingual UI (EN / UR) | Full RTL support with logical CSS properties |
| Dark / light theme | next-themes, persisted to localStorage |
| Paginated APIs | `{items, total, page, limit}` on all list endpoints |
| Atomic JSON writes | Thread-safe, os.replace pattern + asyncio locks |
| Multi-key LLM failover | Up to 28 API keys x 5 models on OpenRouter |
| Market price reference | PKR prices for cement, steel, marble, tiles, etc. |
| Voice input | Web Speech API for AI chat input |
| Semantic embeddings | sentence-transformers optional layer |
| Mobile responsive | Touch targets, reduced-motion accessible |
| Path traversal protection | All upload endpoints use `_ensure_within()` guard |

---

## License

MIT
