# 🏗 Smart Construction Connect
## AI-Powered Construction Matchmaking Platform — FYP Documentation (Final)

> **Environment:** Localhost only | **Data Layer:** JSON files | **No auth/deployment scope**

---

## 📋 Table of Contents

1. [Project Overview](#1-project-overview)
2. [Problem Statement](#2-problem-statement)
3. [Vision & Goals](#3-vision--goals)
4. [User Personas](#4-user-personas)
5. [User Roles & Permissions](#5-user-roles--permissions)
6. [Client Experience](#6-client-experience)
7. [Company Dashboard](#7-company-dashboard)
8. [Supplier Dashboard](#8-supplier-dashboard)
9. [Admin Dashboard](#9-admin-dashboard)
10. [AI Matchmaking Engine](#10-ai-matchmaking-engine)
11. [Notification System](#11-notification-system)
12. [Review & Trust System](#12-review--trust-system)
13. [Frontend Architecture](#13-frontend-architecture)
14. [Page Inventory (MVP)](#14-page-inventory-mvp)
15. [JSON Data Schema](#15-json-data-schema)
16. [Development Phases](#16-development-phases)
17. [Testing Strategy](#17-testing-strategy)
18. [UI/UX Design System](#18-uiux-design-system)
19. [Out of Scope](#19-out-of-scope)
20. [Feature Comparison Matrix](#20-feature-comparison-matrix)
21. [Key Differentiators](#21-key-differentiators)
22. [Risk Register](#22-risk-register)
23. [Glossary](#23-glossary)

---

## 1. Project Overview

Smart Construction Connect is an AI-powered web platform that intelligently connects four key stakeholders in the construction industry:

| Stakeholder | Role |
|---|---|
| 👤 Client | Homeowners or buyers looking to build or renovate |
| 🏢 Construction Company | Service providers seeking verified project leads |
| 🧱 Material Supplier | Vendors selling construction materials |
| 🛠 Admin | Platform guardian ensuring trust and quality |

The platform replaces fragmented, manual processes — word-of-mouth referrals, cold calls, physical visits — with a centralized, intelligent, and transparent matchmaking system powered by AI.

### Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React.js (Vite), Tailwind CSS, Framer Motion |
| State Management | Zustand |
| Routing | React Router v6 |
| Data Layer | Local JSON files (no database for FYP) |
| AI Chat UI | Custom UI + Claude/OpenAI API (Phase 3) |
| Icons | Lucide React |

---

## 2. Problem Statement

The construction industry in Pakistan (and developing markets broadly) faces:

- No centralized directory of verified, rated construction companies
- No price transparency — clients are often overcharged
- Supplier discovery is manual — companies don't know where to source materials efficiently
- No accountability — bad actors (fraudulent companies, fake reviews) go unchecked
- Language barrier — most platforms are English-only, excluding Urdu-speaking clients

Smart Construction Connect directly addresses all five of these problems.

### Key Statistics (Pakistan Context)

- 60%+ of construction disputes arise from mismatched expectations
- Clients typically contact 5–10 companies manually before deciding
- Material procurement is largely offline, causing 20–30% cost inefficiencies
- No existing platform serves this space in Pakistan at scale

---

## 3. Vision & Goals

### 🎯 Vision
To become the most trusted AI-driven construction ecosystem in Pakistan — where clients find verified companies, companies get quality leads, and suppliers grow their business efficiently.

### ✅ FYP Goals

- Build a complete, role-based frontend with realistic JSON dummy data
- Demonstrate a working AI chatbot UI for premium client matchmaking
- Design a scalable system architecture that can evolve into a real product
- Showcase admin governance tools for platform trust

### 🚀 Long-Term Goals (Post-FYP)

- Real backend with live company/supplier database (PostgreSQL)
- Payments integration (Stripe / JazzCash / EasyPaisa)
- Mobile app (React Native)
- Cloud deployment (Vercel + AWS / Railway)

---

## 4. User Personas

### 👤 Persona 1: Raza (Client — Normal Mode)
- **Age:** 38, Government employee
- **Goal:** Build a 10-Marla house in DHA Lahore on a 1.5 Crore budget
- **Pain:** Doesn't know which company is genuine; has been misquoted before
- **Tech literacy:** Medium — uses WhatsApp, browses Facebook
- **Needs:** Simple filtering, company ratings, compare 2–3 companies side-by-side

### 👤 Persona 2: Hania (Client — Premium Mode)
- **Age:** 29, IT professional
- **Goal:** Custom contemporary home; wants AI assistance in shortlisting
- **Pain:** Too busy to manually research; wants smart recommendations
- **Tech literacy:** High — comfortable with AI chatbots
- **Needs:** AI assistant in English/Urdu, explainable recommendations, fast decision-making

### 🏢 Persona 3: M. Shahid (Construction Company Owner)
- **Age:** 45, runs a mid-size company
- **Goal:** Get 3–4 new verified project leads per month
- **Pain:** Marketing is word-of-mouth; no digital portfolio
- **Needs:** Professional profile page, lead management, material sourcing

### 🧱 Persona 4: Tariq (Material Supplier)
- **Age:** 52, brick and cement wholesale dealer
- **Goal:** Connect directly with construction companies; reduce idle inventory
- **Pain:** Depends on brokers; no digital storefront
- **Needs:** Product listings, inventory management, order tracking

### 🛠 Persona 5: Admin
- **Role:** Platform operator
- **Goal:** Maintain platform integrity and trust
- **Needs:** Full control over approvals, bans, content moderation, analytics

---

## 5. User Roles & Permissions

| Feature | Client (Normal) | Client (Premium) | Company | Supplier | Admin |
|---|---|---|---|---|---|
| Browse Companies | ✅ | ✅ | ❌ | ❌ | ✅ |
| Filter & Search | ✅ | ✅ | ❌ | ❌ | ✅ |
| Compare Companies | ✅ (manual) | ✅ | ❌ | ❌ | ❌ |
| AI Chat Assistant | ❌ | ✅ | ❌ | ❌ | ❌ |
| AI Recommendations | ❌ | ✅ | ❌ | ❌ | ❌ |
| Request Quotes | ✅ | ✅ | ❌ | ❌ | ❌ |
| Manage Projects | ❌ | ❌ | ✅ | ❌ | ❌ |
| Post Materials | ❌ | ❌ | ❌ | ✅ | ❌ |
| Write Reviews | ✅ | ✅ | ❌ | ❌ | ❌ |
| Approve Companies | ❌ | ❌ | ❌ | ❌ | ✅ |
| Ban Users | ❌ | ❌ | ❌ | ❌ | ✅ |
| View Audit Logs | ❌ | ❌ | ❌ | ❌ | ✅ |
| Moderate Reviews | ❌ | ❌ | ❌ | ❌ | ✅ |

> **Note on Onboarding:** Companies and Suppliers enter a **"Pending"** state after signup. They see a read-only dashboard and cannot operate until Admin approves them. For FYP, this state is simulated via JSON flags.

---

## 6. Client Experience

### 6.1 Normal Mode

**Flow:** Dashboard → Browse Companies → Filter → Compare → Request Quote

**Features:**
- Search and browse verified construction companies
- Filter by: budget range, rating, location (city/area), specialization, availability, verified-only toggle
- Sort by: Best Match, Highest Rated, Lowest Price, Most Reviews
- Side-by-side comparison of up to 3 companies (price range, rating, project types, location, completion time, verified status)
- Request a quote: fill Budget, Area, Timeline, Description → company notified
- View company profile: portfolio, reviews, team size, past projects
- Save/bookmark companies to a wishlist

### 6.2 Premium Mode — AI Matchmaking

**Flow:** Activate Premium → AI Chat (Sara/Marcus) → Requirements Collected → Live Analysis Panel → Top 5 Recommendations

**Split-Screen UI Layout:**

```
┌─────────────────────────────────┬──────────────────────────────────┐
│  AI CHAT (LEFT)                 │  LIVE PANEL (RIGHT)              │
│                                 │                                  │
│  Sara: "Assalam o Alaikum!      │  📋 Requirements Summary         │
│  Let's find your perfect        │  Budget:   1.5 Crore             │
│  construction company.          │  Area:     10 Marla              │
│  What is your budget?"          │  Style:    Modern                │
│                                 │  Location: DHA Lahore            │
│  User: "1.5 crore"              │  Timeline: 6 months              │
│                                 │                                  │
│  Sara: "Great! What area        │  ⚙️ AI Processing Logs           │
│  are you building on?"          │  ✔ Budget analyzed               │
│                                 │  ✔ Location matched              │
│  [Text input]  [Send]           │  ⏳ Calculating style score...   │
│  [🎤 Voice]   [اردو]            │                                  │
│                                 │  🏆 Top Recommendations          │
│                                 │  1. BuildPro Lahore  94% ✅      │
│                                 │  2. UrbanCraft Co.   88%         │
│                                 │  3. Noor Builders    82%         │
└─────────────────────────────────┴──────────────────────────────────┘
```

**AI Agent Personas (user selects on first launch):**
- **Sara** — Female, friendly, warm tone (default)
- **Marcus** — Male, professional, formal tone

**Data Sara/Marcus Collects:**

| Field | Example |
|---|---|
| Budget | "1.5 crore", "50 lakh" |
| Area | "10 marla", "1 kanal" |
| Location | "DHA Lahore", "Bahria Town Karachi" |
| Construction Style | "Modern", "Traditional", "Mixed" |
| Timeline | "6 months", "as soon as possible" |
| Special Requirements | "basement needed", "solar-ready" |

**AI Personality:**
- Bilingual (Urdu + English), switches on user preference
- Friendly, professional tone
- Asks one question at a time
- Handles vague answers: *"Don't worry, I'll help you estimate!"*

**Recommendation Card (per result):**
- Company name + verified badge
- Match score (e.g., 94%)
- Score breakdown: Price, Location, Rating, Style, Availability
- Why it matched: *"Budget fits | DHA experience | 4.8★ rating"*
- CTA buttons: `[View Profile]` `[Request Quote]` `[Compare]`

---

## 7. Company Dashboard

### Sections

| Section | Description |
|---|---|
| 📥 Incoming Requests | All client quote requests with status (New / Viewed / Responded / Accepted / Declined) |
| 📁 Active Projects | Track ongoing projects with milestones and client info |
| 🛒 Material Marketplace | Browse and order from verified suppliers |
| 👤 Profile Management | Edit portfolio, team, specializations, upload project photos |
| ⭐ Reviews | View and respond to client reviews |
| 📊 Analytics | Leads received, response rate, profile views |

### Project Status Flow

```
New Request → Accepted → In Progress → Completed → Review Requested
```

### Project Milestones

Each active project supports milestone tracking:

```
Foundation → Structure → Roofing → Finishing → Handover
```

### Incoming Request Card

```
┌──────────────────────────────────────────┐
│  Client: Ahmed Raza                      │
│  Budget: 1.2 – 1.5 Crore                │
│  Area: 10 Marla | Location: DHA Lahore   │
│  Timeline: 6 months                      │
│  Message: "Looking for modern design..." │
│                                          │
│  [Accept]  [Decline]  [Ask for Details]  │
└──────────────────────────────────────────┘
```

---

## 8. Supplier Dashboard

### Sections

| Section | Description |
|---|---|
| 📦 Product Listings | Add, edit, remove products with pricing + availability |
| 📊 Inventory Tracker | Monitor stock levels with low-stock alerts |
| 📬 Order Management | View and respond to purchase inquiries from companies |
| 💰 Pricing Manager | Set bulk-pricing tiers, discount rules |
| 📈 Sales Analytics | Order volume, top-selling products, revenue trends |

### Product Object (JSON)

```json
{
  "id": "prod_001",
  "name": "OPC Cement 50kg",
  "category": "Cement",
  "pricePerUnit": 1050,
  "unit": "bag",
  "stock": 500,
  "minOrderQty": 10,
  "brand": "Lucky Cement",
  "deliveryAvailable": true,
  "location": "Lahore",
  "isActive": true
}
```

---

## 9. Admin Dashboard

### 9.1 Overview Analytics

```
┌─────────────┬─────────────┬─────────────┬─────────────┐
│ Total Users │ Companies   │ Suppliers   │ Requests    │
│   1,240     │     87      │     43      │    312      │
│  +12% ↑     │ Pending: 5  │ Pending: 2  │ Active: 94  │
└─────────────┴─────────────┴─────────────┴─────────────┘
```

### 9.2 User Management

- Paginated table: ID, Name, Email, Role, Status, Joined Date, Last Active
- Actions: View Profile, Suspend, Ban, Restore, Change Role
- Status badges: Active | Suspended | Banned | Pending
- Search by name or email; filter by role, status, date range

### 9.3 Company Verification Panel

**Flow:**
```
Submitted Application
↓
Admin Reviews Documents (License, NTN, Portfolio) — inline PDF viewer
↓
Approve → Verified Badge Added → Company Notified
Reject  → Reason Required     → Company Notified
```

- Filter by: Pending / Approved / Rejected / Flagged
- Admin can add internal notes per application

### 9.4 Supplier Verification Panel

Same flow as Company Verification, with supplier-specific documents (business registration, product catalog). Includes product listing review before approval.

### 9.5 Content Moderation

- Flagged reviews appear in a queue (user-reported)
- Admin actions: Approve, Remove, Escalate
- Fake/spam product listings: Remove with reason
- Response templates for notify-and-remove actions

### 9.6 Audit Logs

```
[2025-06-10 14:32] ADMIN:  Approved company "BuildPro Lahore"
[2025-06-10 14:29] SYSTEM: New company signup — "Noor Builders"
[2025-06-10 14:15] CLIENT: Raza Ahmed submitted quote request #QR-2041
[2025-06-10 14:10] AI:     Premium session started — User #U-882
```

Filterable by: User, Action Type, Date Range | Exportable as CSV (simulated for FYP)

### 9.7 Platform Monitoring

| Log Type | What It Tracks |
|---|---|
| User Activity | Profile edits, account changes |
| Request Logs | Client → Company quote requests |
| AI Usage Logs | Premium chat sessions, token counts (simulated) |
| Moderation Logs | Admin actions (bans, removals) |

---

## 10. AI Matchmaking Engine

### 10.1 Input Schema (JSON)

```json
{
  "budget": 15000000,
  "area_marla": 10,
  "location": { "city": "Lahore", "area": "DHA Phase 5" },
  "style": "modern",
  "timeline_months": 6,
  "special_requirements": ["basement", "solar-ready"]
}
```

### 10.2 Scoring Algorithm

```
Final Score = Weighted Sum of:
  price_match_score  × 0.35
  location_score     × 0.25
  rating_score       × 0.20
  style_similarity   × 0.10
  availability_score × 0.10
```

**Score Details:**

| Factor | Calculation |
|---|---|
| Price Match (35%) | `1.0` if budget in range; penalized linearly if below; `0.9` if budget exceeds (still good) |
| Location (25%) | Same city + same area = 1.0 / Same city only = 0.7 / Different city = 0.3 |
| Rating (20%) | `company.avg_rating / 5.0` — only companies with ≥ 3 reviews |
| Style (10%) | Keyword/tag matching: Modern↔Contemporary = 0.85, Modern↔Traditional = 0.30 |
| Availability (10%) | 0 active projects = 1.0 / ≤2 = 0.8 / ≤5 = 0.5 / >5 = 0.2 |

### 10.3 Output Schema (JSON)

```json
{
  "recommendations": [
    {
      "rank": 1,
      "company_id": "comp_001",
      "company_name": "BuildPro Lahore",
      "match_score": 94,
      "score_breakdown": {
        "price_match": 98,
        "location": 100,
        "rating": 88,
        "style": 90,
        "availability": 80
      },
      "explanation": "BuildPro Lahore's pricing fits your budget perfectly. They specialize in DHA projects and have a 4.8★ rating with 47 completed builds.",
      "verified": true,
      "portfolio_preview": ["img1.jpg", "img2.jpg"]
    }
  ],
  "generated_at": "2025-06-10T14:10:00Z",
  "requirements_used": {}
}
```

### 10.4 RAG Pipeline (Phase 3)

- **Vector Store:** ChromaDB (local) → Pinecone (production)
- **Embeddings:** OpenAI text-embedding-3-small or local Ollama model
- **Indexed documents:** Company profiles, project descriptions, reviews, material listings
- **Retrieval:** Top-K similarity search → reranked by scoring algorithm
- **LLM for explanation:** Claude API (for natural language explanation generation)

### 10.5 Mock AI (Phase 1 & 2)

- Hardcoded company data with metadata in JSON files
- Scoring algorithm runs entirely on frontend with dummy weights
- Fake "processing logs" with `setTimeout` delays for UX realism
- Bilingual responses (Urdu/English) pre-written for common question patterns

**AI Analysis Log (simulated):**
```
[10:42:01] Analyzing budget constraints...
[10:42:03] Filtering by location: Lahore
[10:42:05] Matching construction style: Modern
[10:42:07] Calculating compatibility scores...
[10:42:09] Top 5 companies identified ✓
```

---

## 11. Notification System

> For FYP: All notifications are simulated in-app using Zustand state — no email/SMS/push.

| Trigger | Recipient | Message |
|---|---|---|
| New quote request | Company | "Ahmed Raza requested a quote for 10 Marla house" |
| Quote responded | Client | "Bright Builders responded to your request" |
| Application approved | Company/Supplier | "Your account has been verified ✓" |
| Application rejected | Company/Supplier | "Your application was rejected. Reason: [X]" |
| New review received | Company | "You received a 5★ review from a client" |
| Low stock alert | Supplier | "OPC Cement stock below 50 bags" |

**In-App Messaging (Phase 2+):**
- Client ↔ Company: Project discussion, file sharing
- Company ↔ Supplier: Material quotes, bulk order negotiation

---

## 12. Review & Trust System

### Review Flow

```
Project Completed
↓
Client Receives Review Prompt (auto after project marked complete)
↓
Client Rates: Overall, Communication, Quality, Timeline
↓
Review Published (after spam check)
↓
Company Can Respond Publicly (once only)
```

### Trust Signals on Company Profile

- ✅ Verified Badge (admin-approved)
- ⭐ Aggregate Rating (weighted, recent reviews weighted more)
- 📁 Completed Projects Count
- 🕐 Member Since
- 💬 Response Rate %

### Anti-Fraud Rules

- Reviews only from clients who completed a project with that company
- One review per project
- Admin can flag/remove reviews with notes
- Spam filter for keyword stuffing (simulated for FYP)

---

## 13. Frontend Architecture

### Folder Structure

```
src/
├── components/
│   ├── common/       # Button, Card, Badge, Modal, Input, Avatar, Toast
│   ├── layout/       # Navbar, Sidebar, Footer
│   ├── client/       # ClientDashboard, AIChat, CompanyCard, CompareTable
│   ├── company/      # CompanyDashboard, RequestCard, ProjectCard, Milestones
│   ├── supplier/     # SupplierDashboard, ProductCard, InventoryTable
│   └── admin/        # AdminDashboard, UserTable, VerificationPanel, LogStream
├── pages/
│   ├── Landing.jsx
│   ├── Login.jsx          # (mock — sets role in Zustand, no real auth)
│   ├── Signup.jsx         # (mock — simulates pending state for company/supplier)
│   ├── client/
│   ├── company/
│   ├── supplier/
│   └── admin/
├── store/            # Zustand stores (auth, requests, notifications, products)
├── hooks/            # Custom React hooks
├── utils/            # Helpers, formatters, scoring algorithm
├── data/             # JSON data files (companies, suppliers, requests, users)
└── styles/           # Tailwind config, global CSS
```

### State Management (Zustand)

```javascript
// Auth Store (mock — role set on login, persisted in localStorage)
const useAuthStore = create((set) => ({
  user: null,
  role: null,
  login: (userData) => set({ user: userData, role: userData.role }),
  logout: () => set({ user: null, role: null }),
}));

// Notifications Store
const useNotificationStore = create((set) => ({
  notifications: [],
  addNotification: (n) => set((s) => ({ notifications: [n, ...s.notifications] })),
  markRead: (id) => set((s) => ({
    notifications: s.notifications.map(n => n.id === id ? { ...n, read: true } : n)
  })),
}));
```

### Route Protection

```javascript
// ProtectedRoute — reads role from Zustand/localStorage
<Route path="/client/*" element={
  <ProtectedRoute allowedRoles={["client"]}>
    <ClientDashboard />
  </ProtectedRoute>
} />
```

### Reusable Components

| Component | Usage |
|---|---|
| `<StatusBadge>` | Pending / Approved / Rejected / Banned |
| `<MatchScoreRing>` | Circular progress showing AI match % |
| `<VerifiedBadge>` | Gold checkmark on company profile |
| `<LogStream>` | AI analysis logs panel (scrollable) |
| `<CompanyCard>` | Browse, compare, and recommendation panel |
| `<RequestCard>` | Company dashboard incoming requests |
| `<Skeleton>` | Loading states for all card types |

---

## 14. Page Inventory (MVP)

### Shared Pages

| Page | Path |
|---|---|
| Landing Page | `/` |
| Login (mock) | `/login` |
| Signup (mock) | `/signup` |
| 404 Not Found | `*` |

### Client Pages

| Page | Path |
|---|---|
| Dashboard | `/client/dashboard` |
| Browse Companies | `/client/companies` |
| Company Detail | `/client/companies/:id` |
| Compare Companies | `/client/compare` |
| AI Chat (Premium) | `/client/ai-chat` |
| Premium Upgrade | `/client/upgrade` |
| My Requests | `/client/requests` |
| Saved Companies | `/client/saved` |
| My Reviews | `/client/reviews` |
| Profile Settings | `/client/settings` |

### Company Pages

| Page | Path |
|---|---|
| Dashboard | `/company/dashboard` |
| Incoming Requests | `/company/requests` |
| Active Projects | `/company/projects` |
| Project Detail | `/company/projects/:id` |
| Material Marketplace | `/company/marketplace` |
| Public Profile Builder | `/company/profile` |
| Settings | `/company/settings` |

### Supplier Pages

| Page | Path |
|---|---|
| Dashboard | `/supplier/dashboard` |
| Product Management | `/supplier/products` |
| Inventory | `/supplier/inventory` |
| Orders | `/supplier/orders` |
| Profile | `/supplier/profile` |
| Settings | `/supplier/settings` |

### Admin Pages

| Page | Path |
|---|---|
| Dashboard | `/admin/dashboard` |
| User Management | `/admin/users` |
| Company Verification | `/admin/verify/companies` |
| Supplier Verification | `/admin/verify/suppliers` |
| Content Moderation | `/admin/moderation` |
| Activity Logs | `/admin/logs` |
| Analytics | `/admin/analytics` |

---

## 15. JSON Data Schema

> All data lives in `src/data/` as JSON files. No database or backend for FYP.

### `users.json`

```json
[
  {
    "id": "usr_001",
    "name": "Ahmed Raza",
    "email": "ahmed@example.com",
    "role": "client",
    "isPremium": false,
    "isVerified": true,
    "status": "active",
    "createdAt": "2025-01-10T08:00:00Z"
  },
  {
    "id": "usr_002",
    "name": "Hania Khan",
    "email": "hania@example.com",
    "role": "client",
    "isPremium": true,
    "isVerified": true,
    "status": "active",
    "createdAt": "2025-02-05T10:00:00Z"
  }
]
```

### `companies.json`

```json
[
  {
    "id": "comp_001",
    "userId": "usr_010",
    "name": "Bright Builders",
    "city": "Lahore",
    "area": "DHA",
    "bio": "Premium construction specialists with 15+ years in DHA.",
    "specialization": ["Modern", "Commercial"],
    "minPrice": 10000000,
    "maxPrice": 20000000,
    "rating": 4.8,
    "reviewCount": 32,
    "projectsCompleted": 47,
    "activeProjects": 2,
    "verified": true,
    "status": "approved",
    "teamSize": 45,
    "yearsInBusiness": 12,
    "portfolioImages": ["proj1.jpg", "proj2.jpg"]
  },
  {
    "id": "comp_002",
    "userId": "usr_011",
    "name": "Al-Rehman Constructors",
    "city": "Lahore",
    "area": "Bahria Town",
    "bio": "Trusted residential builders serving Bahria Town since 2008.",
    "specialization": ["Traditional", "Residential"],
    "minPrice": 8000000,
    "maxPrice": 14000000,
    "rating": 4.5,
    "reviewCount": 58,
    "projectsCompleted": 82,
    "activeProjects": 1,
    "verified": true,
    "status": "approved",
    "teamSize": 30,
    "yearsInBusiness": 16,
    "portfolioImages": []
  }
]
```

### `suppliers.json`

```json
[
  {
    "id": "sup_001",
    "userId": "usr_020",
    "businessName": "Tariq Cement Depot",
    "location": "Lahore",
    "categories": ["Cement", "Bricks"],
    "verified": true,
    "status": "approved"
  }
]
```

### `products.json`

```json
[
  {
    "id": "prod_001",
    "supplierId": "sup_001",
    "name": "OPC Cement 50kg",
    "category": "Cement",
    "pricePerUnit": 1050,
    "unit": "bag",
    "stock": 500,
    "minOrderQty": 10,
    "brand": "Lucky Cement",
    "deliveryAvailable": true,
    "isActive": true
  }
]
```

### `requests.json`

```json
[
  {
    "id": "req_001",
    "clientId": "usr_001",
    "companyId": "comp_001",
    "budget": 15000000,
    "area": 10,
    "location": "DHA Lahore",
    "style": "Modern",
    "timeline": 6,
    "message": "Looking for a 10 marla modern house with basement.",
    "status": "pending",
    "createdAt": "2025-06-10T09:00:00Z"
  }
]
```

### `projects.json`

```json
[
  {
    "id": "proj_001",
    "companyId": "comp_001",
    "clientId": "usr_001",
    "requestId": "req_001",
    "title": "10 Marla Modern House - DHA Phase 5",
    "status": "in_progress",
    "currentMilestone": "Structure",
    "milestones": ["Foundation", "Structure", "Roofing", "Finishing", "Handover"],
    "startDate": "2025-03-01",
    "estimatedEndDate": "2025-09-01"
  }
]
```

### `reviews.json`

```json
[
  {
    "id": "rev_001",
    "projectId": "proj_001",
    "clientId": "usr_001",
    "companyId": "comp_001",
    "ratingOverall": 5,
    "ratingQuality": 5,
    "ratingCommunication": 4,
    "ratingTimeline": 5,
    "body": "Excellent work, very professional team.",
    "isFlagged": false,
    "isVisible": true,
    "createdAt": "2025-09-05T12:00:00Z"
  }
]
```

### `notifications.json`

```json
[
  {
    "id": "notif_001",
    "userId": "usr_010",
    "type": "new_request",
    "message": "Ahmed Raza requested a quote for 10 Marla house",
    "read": false,
    "createdAt": "2025-06-10T09:05:00Z"
  }
]
```

### `ai_sessions.json`

```json
[
  {
    "id": "sess_001",
    "clientId": "usr_002",
    "requirements": {
      "budget": 15000000,
      "area_marla": 10,
      "location": "DHA Lahore",
      "style": "Modern",
      "timeline_months": 6,
      "special": ["basement", "solar-ready"]
    },
    "topCompanies": ["comp_001", "comp_002"],
    "createdAt": "2025-06-10T14:10:00Z"
  }
]
```

### `admin_logs.json`

```json
[
  {
    "id": "log_001",
    "adminId": "usr_admin",
    "actionType": "company_approved",
    "targetId": "comp_001",
    "targetType": "company",
    "reason": "All documents verified",
    "createdAt": "2025-06-10T14:32:00Z"
  }
]
```

---

## 16. Development Phases

### Phase 1 — Static UI (Weeks 1–3)
**Goal:** All pages look great, navigation works, JSON dummy data renders.

- Landing page with hero, features, how-it-works sections
- Login / Signup forms with role selection (mock — sets Zustand state)
- Client Normal Mode: Browse + Filter + Compare
- Client Premium Mode: Split-screen AI chat UI + dummy recommendations
- Company Dashboard with dummy requests and projects
- Supplier Dashboard with dummy product listings
- Admin Dashboard with tables and status badges
- Responsive layout (mobile, tablet, desktop)

**Deliverable:** Fully navigable static React app with no network calls.

### Phase 2 — Routing & State (Weeks 4–5)
**Goal:** App behaves like a real product with persistent state.

- React Router setup with role-based protected routes
- Zustand stores (auth, requests, notifications)
- Role-based redirects on login
- Request flow: client submits → appears in company dashboard (via Zustand)
- Admin actions: approve/reject → status updates across app (via Zustand)
- Notification state simulation
- AI chat state machine (multi-step requirement collection)
- Persistent mock data via `localStorage`

**Deliverable:** Working multi-role app with realistic interactions, no backend.

### Phase 3 — AI Integration (Weeks 6–9)
**Goal:** Real AI chat integration (API call to Claude/OpenAI).

- Real AI chat (Claude API / OpenAI API)
- RAG pipeline for matchmaking (LangChain + ChromaDB local)
- Scoring algorithm fully implemented in frontend utilities
- File uploads for company docs (handled client-side, stored as base64 in JSON)

**Deliverable:** AI-powered matchmaking working on localhost.

### Phase 4 — Polish & Demo (Weeks 10–11)
**Goal:** Demo-ready FYP submission.

- Responsive polish on all screens
- Loading states, error states, empty states
- Framer Motion animations (page transitions, card hover, AI log stream)
- Presentation slides and demo video
- Documentation finalization + README

**Deliverable:** Submission-ready FYP.

---

## 17. Testing Strategy

### Unit Testing (Jest + React Testing Library)
- Individual components (Card, Button, Form inputs)
- Utility functions (score calculator, formatters)
- Zustand store actions

### Integration Testing (Cypress or Playwright)
- Login → role redirect flow
- Client submits request → appears in company dashboard
- Admin approves company → verified badge appears

### Manual Functional Testing Checklist

| Scenario | Expected Result |
|---|---|
| Client selects Normal mode | Redirected to browse/filter view |
| Client activates Premium | AI chat UI loads with Sara |
| AI collects all requirements | Recommendations appear on right panel |
| Company submits signup | Status = Pending, read-only dashboard |
| Admin approves company | Company status = Verified, badge added |
| Admin bans user | User role blocked from dashboard |
| Supplier adds product | Appears in company marketplace |

---

## 18. UI/UX Design System

### Design Principles

1. **Clarity first** — Users should never be confused about where they are or what to do next
2. **Role-aware UI** — Each role has a distinct color accent and layout identity
3. **Mobile-responsive** — All layouts work on 375px and above
4. **Progressive disclosure** — Show complexity only when needed (especially Premium AI)

### Color Palette

| Token | Hex | Usage |
|---|---|---|
| `--primary` | `#1D4ED8` | Buttons, links, highlights |
| `--primary-dark` | `#1E3A8A` | Hover states |
| `--client-accent` | `#10B981` | Client UI accents (Emerald) |
| `--company-accent` | `#4F46E5` | Company UI accents (Indigo) |
| `--supplier-accent` | `#F59E0B` | Supplier UI accents (Amber) |
| `--admin-accent` | `#DC2626` | Admin UI accents (Red) |
| `--premium` | `#FBBF24` | Premium badge, gold indicators |
| `--success` | `#22C55E` | Verified badges, success states |
| `--danger` | `#EF4444` | Errors, bans, rejections |
| `--warning` | `#EAB308` | Pending states, alerts |
| `--bg` | `#F8FAFC` | Page background |
| `--text-primary` | `#111827` | Primary text |

### Typography

| Style | Font | Size | Weight |
|---|---|---|---|
| Display / Page Title | Inter | 36px | 700 |
| Section Heading | Inter | 28px | 600 |
| Card Title | Inter | 18px | 600 |
| Body | Inter | 16px | 400 |
| Small / Caption | Inter | 13px | 400 |
| Label | Inter | 12px | 500 |

### Status Badges

- 🟢 **Verified** — green, checkmark icon
- 🟡 **Pending** — amber, clock icon
- 🔴 **Rejected** — red, X icon
- 💎 **Premium** — purple gradient, diamond icon
- 🔵 **Active** — blue, dot icon
- ⚫ **Suspended** — gray, pause icon

### Animations (Framer Motion)

| Trigger | Animation |
|---|---|
| Page transition | Fade + slide up (0.3s) |
| Card hover | Scale 1.02 + shadow increase |
| AI log entry | Slide in from left (staggered) |
| Recommendation card | Fade + scale in (staggered delay) |
| Modal open | Scale from 0.9 + fade |
| Score bar | Width animate from 0% on enter |

### Responsive Breakpoints

| Breakpoint | Width | Layout |
|---|---|---|
| Mobile | < 640px | Single column; collapsed sidebar |
| Tablet | 640–1024px | 2-column grid; slide-out sidebar |
| Desktop | > 1024px | Full layout; persistent sidebar |

---

## 19. Out of Scope

The following are **not** part of this FYP:

| Feature | Reason |
|---|---|
| Payment Processing | Requires PCI compliance, banking integration |
| Cloud Deployment | FYP runs on localhost only |
| Mobile App (iOS/Android) | Separate future project |
| Real-time Chat (WebSockets) | Post-FYP with Socket.io |
| Email / SMS Notifications | Simulated in-app only |
| Third-party Map Integration | Cost; mockable for FYP |
| Multi-language CMS | Content is hardcoded for FYP |
| Legal Contracts / Digital Signatures | Out of scope |
| Real Database (PostgreSQL) | JSON files used instead for FYP |

---

## 20. Feature Comparison Matrix

| Feature | Normal Client | Premium Client | Company | Supplier | Admin |
|---|---|---|---|---|---|
| Browse Companies | ✅ | ✅ | — | — | ✅ |
| Filter & Compare | ✅ | ✅ | — | — | — |
| Request Quote | ✅ | ✅ | — | — | — |
| AI Chat (Sara) | ❌ | ✅ | — | — | — |
| AI Recommendations | ❌ | ✅ | — | — | — |
| View Reviews | ✅ | ✅ | ✅ | — | ✅ |
| Write Review | ✅ (post-project) | ✅ | — | — | — |
| Manage Projects | — | — | ✅ | — | — |
| Marketplace Access | — | — | ✅ | — | — |
| Product Listings | — | — | — | ✅ | — |
| Order Management | — | — | — | ✅ | — |
| Approve Users | — | — | — | — | ✅ |
| View All Logs | — | — | — | — | ✅ |
| Ban / Suspend Users | — | — | — | — | ✅ |
| Platform Analytics | — | — | — | — | ✅ |

---

## 21. Key Differentiators

| Aspect | Regular Directory | Smart Construction Connect |
|---|---|---|
| Discovery | Manual search | AI-powered matchmaking |
| Language | English only | Urdu + English |
| Trust | No verification | Admin-verified + reviews |
| Matching | Generic | Score-based with explanation |
| Supplier link | Not present | Integrated marketplace |
| Governance | None | Full admin control layer |
| Market | Generic | Pakistan-specific (PKR, Marla, DHA) |

> *"The only platform in Pakistan where a homeowner can describe their dream house in Urdu, and receive AI-matched, verified, scored construction companies in under 60 seconds."*

---

## 22. Risk Register

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| AI API rate limits in demo | Medium | High | Pre-generate responses for demo scenarios |
| LLM gives wrong recommendations | Medium | Medium | Scoring algorithm overrides LLM; show breakdown |
| Mock data looks unrealistic | Low | Medium | Use real Pakistani company names and Lahore locations |
| Phase 3 AI not complete for demo | Medium | High | Ensure Phase 1–2 are demo-ready as fallback |
| Urdu AI responses broken | Low | High | Test all Urdu inputs; hardcode fallback responses |
| Admin panel complexity causes delays | Low | Medium | Build admin last; core flows take priority |

---

## 23. Glossary

| Term | Definition |
|---|---|
| RAG | Retrieval-Augmented Generation — AI technique that retrieves relevant documents before generating a response |
| Match Score | A weighted percentage indicating how well a company fits a client's requirements |
| Verified Badge | Visual indicator that a company/supplier has been approved by Admin |
| Premium Mode | AI-powered client mode with chatbot and recommendation features |
| Marla | Pakistani unit of area; 1 Marla ≈ 25.3 m² |
| NTN | National Tax Number (Pakistani business registration) |
| RBAC | Role-Based Access Control — restricts system access based on user role |
| Kanban | Visual project management framework with columns representing stages |
| MOQ | Minimum Order Quantity — minimum units a supplier will sell |
| DHA | Defence Housing Authority — premium residential area in Pakistani cities |

---

*Document Version: 3.0 (Final FYP Edition) | Environment: Localhost | Data: JSON | Last Updated: 2025*
*Project: Smart Construction Connect | Author: Smart Construction Connect FYP Team*
