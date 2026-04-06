# Smart Construction Connect

> A full-stack SaaS platform connecting construction clients with verified construction companies and material suppliers in Pakistan — powered by AI-driven recommendations.

---

## Overview

Smart Construction Connect (SCC) is a role-based marketplace that bridges the gap between:

- **Clients** — individuals or businesses looking to hire construction companies
- **Construction Companies** — firms seeking to list their services, manage requests, and receive matches
- **Material Suppliers** — vendors offering construction materials, browsable by category, city, and price
- **Admins** — platform administrators managing users, approvals, and dataset quality

The platform features an AI chat assistant that takes plain-language project descriptions and uses a RAG-style recommendation engine to surface the best-matched companies and suppliers.

---

## Tech Stack

### Frontend

| Technology | Version | Purpose |
|---|---|---|
| **React** | 18.3 | UI framework |
| **TypeScript** | 5.8 | Type-safe JavaScript |
| **Vite** | 7.3 | Build tool & dev server |
| **Tailwind CSS** | 3.4 | Utility-first CSS |
| **shadcn/ui** | latest | Accessible component library (Radix UI) |
| **Framer Motion** | 12 | Animations & transitions |
| **React Router DOM** | 6.30 | Client-side routing |
| **Zustand** | 5.0 | Global state management |
| **TanStack Query** | 5.83 | Server-state management & caching |
| **Recharts** | 2.15 | Data visualization / charts |
| **tsParticles** | 3.9 | Particle background effects |
| **react-parallax-tilt** | 1.7 | 3D tilt card effects |
| **Lucide React** | 0.462 | Icon set |
| **React Hook Form** | 7.61 | Form state management |
| **Zod** | 3.25 | Schema validation |
| **Sonner** | 1.7 | Toast notifications |
| **next-themes** | 0.3 | Dark/light theme management |
| **date-fns** | 3.6 | Date utilities |
| **Embla Carousel** | 8.6 | Carousel / slider |
| **Vaul** | 0.9 | Drawer component |
| **cmdk** | 1.1 | Command palette |
| **@dnd-kit** | 6/10 | Drag-and-drop |

### Backend

| Technology | Version | Purpose |
|---|---|---|
| **Python** | 3.10+ | Runtime |
| **FastAPI** | latest | REST API framework |
| **Uvicorn** | standard | ASGI server |
| **Pydantic** | v2 | Data validation & serialization |
| **httpx** | latest | Async HTTP client for LLM API calls |
| **python-dotenv** | latest | Environment variable management |
| **bcrypt** | latest | Password hashing |
| **python-multipart** | latest | File upload handling |

### Data Storage

- **JSON flat files** — role-separated user records (`Database/{role}/users.json`)
- **Dataset files** — construction company dataset (`Database/construction/companies.json`), supplier catalog (`Database/suppliers/catalog.json`)
- **Uploaded files** — stored under `company_data/{role}/` directory, served as static files

---

## Project Structure

```
Smart-Construction-Connect/
├── app.py                          # Unified launcher (API + frontend SPA)
├── backend/
│   ├── main.py                     # Standalone FastAPI entry (dev mode)
│   ├── requirements.txt
│   ├── routers/
│   │   ├── auth.py                 # /api/auth — signup, login, session
│   │   ├── admin.py                # /api/admin — user management, stats
│   │   ├── companies.py            # /api/companies — company listings
│   │   ├── suppliers.py            # /api/suppliers — supplier listings
│   │   ├── ai_chat.py              # /api/ai — RAG chat & recommendations
│   │   ├── upload.py               # /api/upload — document/image upload
│   │   ├── messages.py             # /api/messages — in-app messaging
│   │   └── requests.py             # /api/requests — project requests
│   └── utils/
│       ├── data_handler.py         # JSON DB helpers, user CRUD
│       └── rag_engine.py           # AI recommendation engine
├── Database/
│   ├── admin/
│   │   ├── users.json
│   │   ├── activity_log.json
│   │   └── settings.json
│   ├── clients/users.json
│   ├── construction/
│   │   ├── users.json
│   │   └── companies.json          # 99-company dataset with multi-city pricing
│   └── suppliers/
│       ├── users.json
│       └── catalog.json
├── Frontend/
│   ├── src/
│   │   ├── App.tsx                 # Root component + routes
│   │   ├── pages/                  # Route-level page components
│   │   │   ├── Index.tsx           # Landing page
│   │   │   ├── Dashboard.tsx       # Role-based dashboard
│   │   │   ├── CompaniesPage.tsx   # Browse companies + suppliers
│   │   │   ├── AIChatPage.tsx      # AI assistant chat
│   │   │   ├── CompanyProfilePage.tsx
│   │   │   ├── SupplierProfilePage.tsx
│   │   │   ├── RequestsPage.tsx
│   │   │   ├── MessagesPage.tsx
│   │   │   ├── ApprovalsPage.tsx   # Document verification (admin)
│   │   │   ├── UsersPage.tsx       # User management (admin)
│   │   │   ├── ActivityPage.tsx
│   │   │   ├── SettingsPage.tsx
│   │   │   └── ...
│   │   ├── components/
│   │   │   ├── layout/
│   │   │   │   ├── AppSidebar.tsx
│   │   │   │   ├── DashboardLayout.tsx
│   │   │   │   └── TopNavbar.tsx
│   │   │   ├── shared/
│   │   │   │   ├── GlassCard.tsx
│   │   │   │   ├── AnimatedBackground.tsx
│   │   │   │   ├── ParticleBackground.tsx
│   │   │   │   ├── MatchScoreRing.tsx
│   │   │   │   ├── TiltCard.tsx
│   │   │   │   ├── AnimationPrimitives.tsx
│   │   │   │   └── ...
│   │   │   └── ui/                 # shadcn/ui components (50+)
│   │   ├── stores/
│   │   │   ├── authStore.ts        # Zustand auth state
│   │   │   └── themeStore.ts       # Dark/light theme state
│   │   ├── lib/
│   │   │   ├── api.ts              # Typed API client
│   │   │   ├── animations.ts       # Framer Motion variants
│   │   │   └── utils.ts
│   │   ├── data/
│   │   │   ├── companyData.ts      # Company directory + helpers
│   │   │   ├── supplierData.ts     # Supplier directory + helpers
│   │   │   ├── mockData.ts
│   │   │   └── locationOptions.ts
│   │   └── hooks/
│   │       ├── use-mobile.tsx
│   │       ├── use-toast.ts
│   │       └── useAnimations.ts
│   ├── package.json
│   ├── tailwind.config.ts
│   ├── vite.config.ts
│   └── tsconfig.json
└── images/                         # Dataset reference images
```

---

## User Roles

| Role | Capabilities |
|---|---|
| **Client** | Browse companies/suppliers, send requests, use AI chat, message vendors |
| **Company** | Browse material suppliers, manage requests, upload documents, update profile |
| **Supplier** | Manage product catalog, handle inquiries, upload documents |
| **Admin** | Full user management, approvals, document verification, platform stats |

---

## Key Features

### AI Chat & Recommendations
- Natural-language project input ("I want to build a 10-marla house in Lahore, budget 8M-12M")
- RAG-style intent extraction — detects city, budget, project type, material needs
- Scored recommendations ranked by city match, budget compatibility, rating, and verified status

### Company Directory
- 99 construction companies with multi-city coverage (2-4 cities each)
- Per-city price picker on each card — shows price/sqft for the selected city
- Package-level breakdown (Economy / Standard / Premium) pulled from `flattened_operational_areas`
- Filter by city, specialization, and verified status
- Sort by match score, rating, price (asc/desc), completed projects
- Side-by-side compare panel (up to 3 companies)

### Supplier Marketplace
- Browse material suppliers by category (Cement, Steel, Marble, Tiles, etc.)
- Filter by category, verified status
- Sort by rating, price, material count
- PKR price range display per supplier

### Messaging
- In-app conversation threads between clients and vendors
- Initiated directly from company/supplier cards

### Admin Panel
- User stats dashboard (active, pending, banned)
- Document verification queue
- Activity log
- Platform settings

---

## Getting Started

### Prerequisites

- Python 3.10+
- Node.js 18+ and npm (or bun)

### Installation

```bash
# 1. Clone the repository
git clone <repo-url>
cd Smart-Construction-Connect

# 2. Set up environment variables
cp .env.example .env  # Copy the example file
# Edit .env and add your OpenRouter API keys (see Configuration section below)

# 3. Install Python dependencies
pip install -r backend/requirements.txt

# 4. Install frontend dependencies
cd Frontend
npm install
cd ..
```

---

## Configuration

### Environment Variables

Create a `.env` file in the project root with the following variables:

```env
# OpenRouter API Configuration (Required for AI Chat)
OPENROUTER_API_KEY_1=sk-or-v1-xxxxxxxxxxxxx
OPENROUTER_API_KEY_2=sk-or-v1-xxxxxxxxxxxxx
# Add up to 28 API keys for load balancing and rate limit handling
OPENROUTER_API_KEY_3=sk-or-v1-xxxxxxxxxxxxx
# ... up to OPENROUTER_API_KEY_28

# Available models (optional, defaults provided)
OPENROUTER_MODEL_1=microsoft/wizardlm-2-8x22b
OPENROUTER_MODEL_2=meta-llama/llama-3.1-8b-instruct
# Add up to 5 models for rotation
OPENROUTER_MODEL_3=anthropic/claude-3-haiku
# ... up to OPENROUTER_MODEL_5
```

**Getting OpenRouter API Keys:**
1. Sign up at [OpenRouter.ai](https://openrouter.ai)
2. Generate API keys from your dashboard
3. Add credits to your account (free tier available)
4. Copy keys to your `.env` file

**Note:** The AI assistant uses multiple API keys and models for redundancy and load balancing. At minimum, you need `OPENROUTER_API_KEY_1`.

---

## Getting Started

```bash
# Build the frontend first
cd Frontend && npm run build && cd ..

# Start the unified server (API + SPA) on port 8000
python app.py
```

Open [http://localhost:8000](http://localhost:8000)

### Running in Development Mode

```bash
# Start FastAPI backend (port 8000) + Vite dev server (port 5173) simultaneously
python app.py --dev
```

Frontend dev server: [http://localhost:5173](http://localhost:5173)  
API: [http://localhost:8000/api](http://localhost:8000/api)

### API Documentation

With the server running, visit:
- Swagger UI: [http://localhost:8000/docs](http://localhost:8000/docs)
- ReDoc: [http://localhost:8000/redoc](http://localhost:8000/redoc)

---

## Environment Notes

- No `.env` file is required for local development — the API client uses relative paths (`/api`) and the Vite proxy handles routing.
- All data is stored in JSON files — no database setup needed.
- File uploads are stored under `company_data/` at the repo root.

---

## Demo Accounts

| Role | Email | Password |
|---|---|---|
| Admin | admin@scc.com | admin123 |
| Client | client@scc.com | client123 |
| Company | company@scc.com | company123 |
| Supplier | supplier@scc.com | supplier123 |

---

## License

MIT
