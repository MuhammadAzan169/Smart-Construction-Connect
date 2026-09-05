"""Seed a polished, fully-interconnected demo for the 4 showcase accounts.

Creates one account per role and wires them together so a visitor can log in via
the one-click buttons and immediately see real activity:

    Client   : Ahmed Khan            ahmed@example.com
    Company  : Elite Builders        contact@elite.com     (slug: elite-builders)
    Supplier : Steel Hub PK          info@steelhub.pk      (slug: steel-hub-pk)
    Admin    : Platform Admin        admin@smartconnect.pk

All four share the demo password below. The script seeds:
  • a known password on each of the 4 accounts (so one-click login works)
  • a full mesh of conversations (every pair has chatted) with read receipts
  • an AI chat history for each role
  • quote requests from the client with varied statuses

Idempotent: re-running replaces the demo-tagged data, never touching other rows.
Writes to whatever store is configured (Supabase when DATABASE_URL is set).

Run from backend/:  python seed_demo.py
"""

from __future__ import annotations

import sys
import uuid
from datetime import datetime, timedelta, timezone
from pathlib import Path

for _s in (sys.stdout, sys.stderr):
    if hasattr(_s, "reconfigure"):
        _s.reconfigure(encoding="utf-8")

ROOT = Path(__file__).resolve().parent
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from dotenv import load_dotenv
load_dotenv(ROOT / ".env")

import bcrypt

from backend.utils.data_handler import (
    DB_DIR, read_json, write_json,
    get_users_by_role, save_users_by_role, find_user_by_email,
)

DEMO_PASSWORD = "Demo@1234"

CLIENT = "ahmed@example.com"
COMPANY = "contact@elite.com"
SUPPLIER = "info@steelhub.pk"
ADMIN = "admin@smartconnect.pk"

MESSAGES_DIR = DB_DIR / "messages"
CHATS_ROOT = DB_DIR / "ai_chats"
REQUESTS_PATH = DB_DIR / "requests" / "requests.json"

NOW = datetime.now(timezone.utc)


def _iso(days_ago: float) -> str:
    return (NOW - timedelta(days=days_ago)).isoformat()


def _safe_email(email: str) -> str:
    import re
    return re.sub(r"[^a-z0-9]", "-", email.lower())[:80]


# ─────────────────────────────────────────────────────────────────────────────
#  1. Passwords — give the 4 demo accounts a known, policy-compliant password
# ─────────────────────────────────────────────────────────────────────────────

def seed_passwords() -> dict[str, dict]:
    pw_hash = bcrypt.hashpw(DEMO_PASSWORD.encode(), bcrypt.gensalt()).decode()
    resolved: dict[str, dict] = {}
    role_of = {CLIENT: "client", COMPANY: "company", SUPPLIER: "supplier", ADMIN: "admin"}

    for email, role in role_of.items():
        users = get_users_by_role(role)
        found = None
        for u in users:
            if u.get("email", "").strip().lower() == email:
                u["password_hash"] = pw_hash
                u["status"] = "active"
                u["updated_at"] = NOW.isoformat()
                found = u
                break
        if not found:
            raise SystemExit(f"ERROR: demo account not found: {email} ({role})")
        save_users_by_role(role, users)
        resolved[email] = found
        print(f"  password set: {email} ({role})")
    return resolved


# ─────────────────────────────────────────────────────────────────────────────
#  2. Conversation mesh — every pair of the 4 has a realistic thread
# ─────────────────────────────────────────────────────────────────────────────

def _msg(sender: str, name: str, content: str, days_ago: float, *, read: bool = True) -> dict:
    return {
        "id": str(uuid.uuid4()),
        "sender": sender,
        "sender_name": name,
        "content": content,
        "timestamp": _iso(days_ago),
        "read": read,
        "status": "read" if read else "delivered",
        "deleted_by": [],
    }


def _conversation(conv_id: str, a: tuple[str, str], b: tuple[str, str], msgs: list[dict]) -> dict:
    """a, b = (email, display_name). msgs already built via _msg()."""
    parts = sorted([a[0], b[0]])
    names_by_email = {a[0]: a[1], b[0]: b[1]}
    last = msgs[-1]
    # Leave the final message unread for its recipient → a realistic unread badge.
    recipient = a[0] if last["sender"] == b[0] else b[0]
    last["read"] = False
    last["status"] = "delivered"
    unread = {a[0]: 0, b[0]: 0}
    unread[recipient] = 1

    write_json(MESSAGES_DIR / f"{conv_id}.json", msgs)
    return {
        "id": conv_id,
        "participants": parts,
        "participant_names": [names_by_email[p] for p in parts],
        "created_at": msgs[0]["timestamp"],
        "updated_at": last["timestamp"],
        "last_message": {
            "content": last["content"][:100],
            "sender": last["sender"],
            "timestamp": last["timestamp"],
        },
        "unread": unread,
        "deleted_by": [],
    }


def seed_conversations(users: dict[str, dict]) -> None:
    def nm(email: str) -> str:
        return users[email].get("display_name", email)

    client = (CLIENT, nm(CLIENT))
    company = (COMPANY, nm(COMPANY))
    supplier = (SUPPLIER, nm(SUPPLIER))
    admin = (ADMIN, nm(ADMIN))

    convos: list[dict] = []

    # 1) Client ↔ Company — house construction quote
    convos.append(_conversation("demo-mesh-client-company", client, company, [
        _msg(CLIENT, client[1], "Assalam o Alaikum! I'm planning a 10 marla house in DHA Lahore. Do you handle full grey structure + finishing?", 9),
        _msg(COMPANY, company[1], "Walaikum Assalam Ahmed! Yes, we do complete turnkey projects. For 10 marla in DHA we typically deliver grey structure in ~7 months. What's your budget range?", 9),
        _msg(CLIENT, client[1], "Around 2.5 crore for grey + basic finish. Is that realistic?", 8),
        _msg(COMPANY, company[1], "That's workable for a quality grey structure with standard finishing. I'll prepare a detailed BOQ and share a quote through the platform.", 8),
        _msg(CLIENT, client[1], "Perfect. I've also submitted a formal quote request. Please include material specs.", 6),
        _msg(COMPANY, company[1], "Received it — reviewing now. We'll use grade-60 steel and DG cement. I'll send the itemized quote by tomorrow. 👍", 5),
    ]))

    # 2) Client ↔ Supplier — material pricing
    convos.append(_conversation("demo-mesh-client-supplier", client, supplier, [
        _msg(CLIENT, client[1], "Hello, what's your current rate for grade-60 steel (sariya) per ton? Building a house in Lahore.", 7),
        _msg(SUPPLIER, supplier[1], "Hi Ahmed! Grade-60 is currently PKR 268,000/ton, delivered within Lahore. Bulk (10+ tons) gets a 3% discount.", 7),
        _msg(CLIENT, client[1], "Great. And do you supply cement too, or only steel?", 6),
        _msg(SUPPLIER, supplier[1], "We specialise in steel, but we can coordinate cement through a partner. For ~10 marla grey structure you'll need roughly 9–11 tons of steel.", 6),
        _msg(CLIENT, client[1], "Noted, thank you! My contractor is Elite Builders — they may place the order directly.", 5),
        _msg(SUPPLIER, supplier[1], "Perfect, we already supply Elite Builders regularly. Just have them reference your project. 🙌", 4),
    ]))

    # 3) Client ↔ Admin — support
    convos.append(_conversation("demo-mesh-client-admin", client, admin, [
        _msg(CLIENT, client[1], "Hi, how do I know a construction company on the platform is verified?", 4),
        _msg(ADMIN, admin[1], "Great question! Verified companies show a green ✔ badge on their profile — it means we've checked their SECP registration and NTN. Elite Builders, for example, is fully verified.", 4),
        _msg(CLIENT, client[1], "That's reassuring. Thanks for the quick help!", 3),
        _msg(ADMIN, admin[1], "Anytime, Ahmed. Feel free to reach out if you need anything during your project. 🏗️", 3),
    ]))

    # 4) Company ↔ Supplier — B2B bulk order
    convos.append(_conversation("demo-mesh-company-supplier", company, supplier, [
        _msg(COMPANY, company[1], "Hi, we need a quote for 40 tons of grade-60 steel for a DHA project starting next week.", 6),
        _msg(SUPPLIER, supplier[1], "Hello Elite team! For 40 tons we can offer PKR 259,000/ton (bulk rate), delivered in 2 batches. Payment 50% advance.", 6),
        _msg(COMPANY, company[1], "Rate works. Can you guarantee delivery within 5 days of order?", 5),
        _msg(SUPPLIER, supplier[1], "Yes — first batch (25 tons) in 3 days, remaining in 5. I'll lock the rate for 48 hours.", 5),
        _msg(COMPANY, company[1], "Confirmed, we'll process the advance today. Please share your account details.", 4),
        _msg(SUPPLIER, supplier[1], "Sent to your registered email. Pleasure doing business as always! 🤝", 4),
    ]))

    # 5) Company ↔ Admin — verification
    convos.append(_conversation("demo-mesh-company-admin", company, admin, [
        _msg(ADMIN, admin[1], "✅ Document Approved\n\nYour SECP Registration Certificate has been reviewed and approved. Your profile is now marked Verified.", 12),
        _msg(COMPANY, company[1], "Thank you! Quick question — can we showcase more than 6 project photos in our gallery?", 10),
        _msg(ADMIN, admin[1], "Currently the gallery supports up to 8 project sets. You can manage them from Settings → Company Profile → Gallery.", 10),
        _msg(COMPANY, company[1], "Perfect, appreciate it.", 9),
    ]))

    # 6) Supplier ↔ Admin — listing help
    convos.append(_conversation("demo-mesh-supplier-admin", supplier, admin, [
        _msg(SUPPLIER, supplier[1], "Hello admin, we'd like to add a new product category (rebar mesh). How do we update our catalog?", 8),
        _msg(ADMIN, admin[1], "Hi Steel Hub! Go to Settings → Materials → Add Material. New items appear in search once saved and the index refreshes.", 8),
        _msg(SUPPLIER, supplier[1], "Done, added 3 new items. Thanks for the smooth process!", 7),
        _msg(ADMIN, admin[1], "Great — they're already live and showing up in supplier search. 📦", 7),
    ]))

    # Merge into conversations.json (replace any prior demo-mesh-* entries)
    existing = read_json(MESSAGES_DIR / "conversations.json")
    if not isinstance(existing, list):
        existing = []
    existing = [c for c in existing if not str(c.get("id", "")).startswith("demo-mesh-")]
    existing.extend(convos)
    write_json(MESSAGES_DIR / "conversations.json", existing)
    print(f"  conversations: {len(convos)} demo threads (mesh of all 4 accounts)")


# ─────────────────────────────────────────────────────────────────────────────
#  3. AI chat history — one realistic session per role
# ─────────────────────────────────────────────────────────────────────────────

def _seed_ai_chat(email: str, session_id: str, title: str, turns: list[tuple[str, str]], days_ago: float) -> None:
    user_dir = CHATS_ROOT / _safe_email(email)
    messages = [{"role": r, "content": c} for r, c in turns]
    write_json(user_dir / f"{session_id}.json", messages)

    index = read_json(user_dir / "index.json")
    if not isinstance(index, list):
        index = []
    index = [s for s in index if not str(s.get("session_id", "")).startswith("demo-ai-")]
    index.insert(0, {
        "session_id": session_id,
        "title": title,
        "created_at": _iso(days_ago),
        "updated_at": _iso(days_ago),
        "message_count": len(messages),
    })
    write_json(user_dir / "index.json", index)


def seed_ai_chats() -> None:
    _seed_ai_chat(CLIENT, "demo-ai-client-1", "Building a 10 marla house in Lahore", [
        ("user", "I want to build a 10 marla house in DHA Lahore. Budget around 2.5 crore. Where do I start?"),
        ("assistant", "Great project! For a 10 marla (≈2250 sq ft) house in DHA Lahore at ~2.5 crore, that's a solid grey-structure + standard-finish budget (~PKR 3,500–4,500/sq ft). A few quick questions: how many floors, and do you want grey structure only or full turnkey?"),
        ("user", "Double storey, full finish. Timeline is flexible."),
        ("assistant", "Perfect. For a double-storey full-finish home in DHA, expect ~12–16 months. Based on your requirements, here are strong verified matches:\n\n**Elite Builders** ⭐ 4.7/5 — DHA specialists, turnkey delivery.\n\nWould you like me to compare their package pricing and timelines?"),
    ], 5)

    _seed_ai_chat(COMPANY, "demo-ai-company-1", "Best steel suppliers & current cement rates", [
        ("user", "Which suppliers give the best rate for grade-60 steel in bulk, and what's the current cement price?"),
        ("assistant", "For bulk grade-60 steel, **Steel Hub PK** is a top verified supplier (competitive bulk rates, reliable Lahore delivery). Current market reference: grade-60 steel ~PKR 259,000–270,000/ton; DG/Lucky cement ~PKR 1,350–1,450/bag. Want me to draft a material cost estimate for a specific project size?"),
        ("user", "Yes, for a 10 marla double storey grey structure."),
        ("assistant", "Rough grey-structure material estimate (10 marla, double storey):\n• Steel: ~10–11 tons → ~PKR 2.7M\n• Cement: ~600 bags → ~PKR 0.85M\n• Bricks/blocks + sand + crush: ~PKR 1.6M\nTotal materials ≈ PKR 5.1–5.5M (excl. labour). Prices from live market data."),
    ], 4)

    _seed_ai_chat(SUPPLIER, "demo-ai-supplier-1", "Steel price trend & competitive positioning", [
        ("user", "How are my steel prices compared to the market, and what's the demand trend?"),
        ("assistant", "Based on current platform market data, grade-60 steel is trading at PKR 259,000–270,000/ton. Your listed rate sits within the competitive band. Demand signal: steel and cement are the most-requested materials this quarter, with strongest pull from Lahore and Islamabad construction projects. Consider a small bulk-order incentive to capture more B2B contractor demand."),
        ("user", "Good idea. Any product gaps I should fill?"),
        ("assistant", "Rebar mesh and binding wire show recurring contractor demand but limited verified suppliers — adding those could differentiate your catalog."),
    ], 3)

    _seed_ai_chat(ADMIN, "demo-ai-admin-1", "Platform overview & top performers", [
        ("user", "Give me a quick platform summary — users, top companies, pending approvals."),
        ("assistant", "**Platform Snapshot**\n• Users: 139 (clients, companies, suppliers, admin)\n• Construction companies: 99 | Material suppliers: 24\n• Top-rated: Elite Builders (4.7★), Ravi Grey Builders, Punjab Modern Constructions\n• Most-requested materials: steel, cement, bricks\n• Coverage: strongest in Lahore, Karachi, Islamabad\n\nWould you like the list of companies still pending document verification?"),
        ("user", "Yes, show pending verifications."),
        ("assistant", "Pending verification is concentrated among newer supplier signups. You can action each from Approvals → filter by 'pending'. Most are awaiting SECP/NTN document review."),
    ], 2)

    print("  ai chats: 4 sessions (client, company, supplier, admin)")


# ─────────────────────────────────────────────────────────────────────────────
#  4. Quote requests — client → company, varied statuses
# ─────────────────────────────────────────────────────────────────────────────

def seed_requests(users: dict[str, dict]) -> None:
    client = users[CLIENT]
    reqs = read_json(REQUESTS_PATH)
    if not isinstance(reqs, list):
        reqs = []
    reqs = [r for r in reqs if not str(r.get("id", "")).startswith("R-DEMO")]

    base = {
        "client_email": CLIENT,
        "client_name": client.get("display_name", "Ahmed Khan"),
        "client_id": client.get("user_id", ""),
    }
    demo = [
        {
            **base, "id": "R-DEMO001", "company_slug": "elite-builders",
            "project_title": "10 Marla House — Grey Structure + Finishing",
            "description": "Double-storey 10 marla house in DHA Lahore. Need grey structure with standard finishing, grade-60 steel, DG cement.",
            "location": "DHA Phase 5, Lahore", "budget": "2.5 crore", "plot_size": "10 marla",
            "status": "accepted", "created_at": _iso(6), "updated_at": _iso(5),
            "company_notes": "Accepted. Detailed BOQ shared. Grey structure target: 7 months.",
        },
        {
            **base, "id": "R-DEMO002", "company_slug": "elite-builders",
            "project_title": "Boundary Wall & Foundation Work",
            "description": "Boundary wall (approx 200 running ft) plus foundation for the main structure.",
            "location": "DHA Phase 5, Lahore", "budget": "35 lakh", "plot_size": "10 marla",
            "status": "pending", "created_at": _iso(2), "updated_at": _iso(2),
            "company_notes": "",
        },
        {
            **base, "id": "R-DEMO003", "company_slug": "ravi-grey-builders",
            "project_title": "Renovation Quote — Kitchen & Bathrooms",
            "description": "Renovation of kitchen and 2 bathrooms with modern fittings.",
            "location": "Model Town, Lahore", "budget": "18 lakh", "plot_size": "5 marla",
            "status": "completed", "created_at": _iso(20), "updated_at": _iso(8),
            "company_notes": "Completed and handed over. Client satisfied.",
        },
    ]
    reqs = demo + reqs
    write_json(REQUESTS_PATH, reqs)
    print(f"  requests: {len(demo)} demo quote requests (accepted / pending / completed)")


# ─────────────────────────────────────────────────────────────────────────────

def main() -> None:
    from backend.utils import db
    store = "Supabase Postgres" if db.is_enabled() else "local JSON files"
    print(f"Seeding demo data into: {store}\n")

    print("1. Passwords")
    users = seed_passwords()
    print("\n2. Conversations")
    seed_conversations(users)
    print("\n3. AI chats")
    seed_ai_chats()
    print("\n4. Quote requests")
    seed_requests(users)

    print("\nDone. All 4 demo accounts share password:", DEMO_PASSWORD)
    print("  client   :", CLIENT)
    print("  company  :", COMPANY)
    print("  supplier :", SUPPLIER)
    print("  admin    :", ADMIN)


if __name__ == "__main__":
    main()
