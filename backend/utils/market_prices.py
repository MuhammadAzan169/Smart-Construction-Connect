"""Pakistan construction material market prices — curated reference data.

Updated periodically.  The LLM uses this as grounding context so clients,
companies and suppliers get accurate price guidance.
"""

from __future__ import annotations

from datetime import datetime

# Last manual update — bump when you refresh the table
_LAST_UPDATED = "2026-04-01"

# ── Cement prices (PKR per 50 kg bag) ────────────────────────────────────────
CEMENT_PRICES: list[dict] = [
    {"brand": "Lucky Cement",    "price": 1450, "unit": "50kg bag"},
    {"brand": "DG Khan Cement",  "price": 1400, "unit": "50kg bag"},
    {"brand": "Bestway Cement",  "price": 1380, "unit": "50kg bag"},
    {"brand": "Maple Leaf",      "price": 1420, "unit": "50kg bag"},
    {"brand": "Fauji Cement",    "price": 1410, "unit": "50kg bag"},
    {"brand": "Cherat Cement",   "price": 1390, "unit": "50kg bag"},
    {"brand": "Kohat Cement",    "price": 1360, "unit": "50kg bag"},
    {"brand": "Pioneer Cement",  "price": 1370, "unit": "50kg bag"},
]

# ── Steel prices (PKR per ton) ───────────────────────────────────────────────
STEEL_PRICES: list[dict] = [
    {"brand": "Amreli Steel",   "grade": "Grade 40", "price": 270000, "unit": "ton"},
    {"brand": "Amreli Steel",   "grade": "Grade 60", "price": 285000, "unit": "ton"},
    {"brand": "Ittefaq Steel",  "grade": "Grade 40", "price": 265000, "unit": "ton"},
    {"brand": "Mughal Steel",   "grade": "Grade 40", "price": 268000, "unit": "ton"},
    {"brand": "Mughal Steel",   "grade": "Grade 60", "price": 280000, "unit": "ton"},
    {"brand": "Kamran Steel",   "grade": "Grade 40", "price": 260000, "unit": "ton"},
    {"brand": "AF Steel",       "grade": "Grade 60", "price": 278000, "unit": "ton"},
]

# ── Brick prices (PKR per brick) ─────────────────────────────────────────────
BRICK_PRICES: list[dict] = [
    {"type": "A-Class Brick",    "price": 18, "unit": "brick"},
    {"type": "B-Class Brick",    "price": 14, "unit": "brick"},
    {"type": "Concrete Block",   "price": 85, "unit": "block"},
    {"type": "AAC Block (4\")",  "price": 95, "unit": "block"},
]

# ── Sand & aggregate (PKR per cubic foot) ────────────────────────────────────
SAND_AGGREGATE: list[dict] = [
    {"type": "Ravi Sand (Lahore)",       "price": 75,  "unit": "cft"},
    {"type": "Chenab Sand (Punjab)",     "price": 70,  "unit": "cft"},
    {"type": "Lawrencepur Sand (Isb)",   "price": 80,  "unit": "cft"},
    {"type": "Margalla Crush (Isb)",     "price": 90,  "unit": "cft"},
    {"type": "Sargodha Crush",           "price": 85,  "unit": "cft"},
]

# ── Other common materials ───────────────────────────────────────────────────
OTHER_MATERIALS: list[dict] = [
    {"name": "Paint (Nippon Weatherbond 10L)",  "price": 12500, "unit": "10L bucket"},
    {"name": "Paint (Diamond Supreme 10L)",     "price": 10500, "unit": "10L bucket"},
    {"name": "Marble (Ziarat White /sqft)",     "price": 180,   "unit": "sqft"},
    {"name": "Marble (Sunny Grey /sqft)",       "price": 120,   "unit": "sqft"},
    {"name": "Tiles (Master /sqft)",            "price": 110,   "unit": "sqft"},
    {"name": "Tiles (Shabbir /sqft)",           "price": 85,    "unit": "sqft"},
    {"name": "PVC Pipe (6\" /10ft)",            "price": 2200,  "unit": "10ft pipe"},
    {"name": "Electric Wire (3/29 /bundle)",    "price": 6800,  "unit": "bundle"},
    {"name": "Wooden Door (Diyar)",             "price": 35000, "unit": "door"},
    {"name": "Aluminium Window (4x4 ft)",       "price": 18000, "unit": "window"},
]

# ── Per-sqft construction cost estimates by city ─────────────────────────────
CONSTRUCTION_COST_PER_SQFT: list[dict] = [
    {"city": "Lahore",      "grey_structure": "2,800 – 4,500", "full_finish": "4,500 – 8,000"},
    {"city": "Islamabad",   "grey_structure": "3,200 – 5,000", "full_finish": "5,000 – 9,500"},
    {"city": "Karachi",     "grey_structure": "3,000 – 4,800", "full_finish": "4,800 – 8,500"},
    {"city": "Rawalpindi",  "grey_structure": "2,800 – 4,200", "full_finish": "4,200 – 7,500"},
    {"city": "Faisalabad",  "grey_structure": "2,500 – 3,800", "full_finish": "3,800 – 6,500"},
    {"city": "Multan",      "grey_structure": "2,200 – 3,500", "full_finish": "3,500 – 6,000"},
    {"city": "Peshawar",    "grey_structure": "2,600 – 4,000", "full_finish": "4,000 – 7,000"},
    {"city": "Quetta",      "grey_structure": "2,400 – 3,800", "full_finish": "3,800 – 6,500"},
]


def get_market_prices_context() -> str:
    """Return a formatted string of market prices for LLM context injection."""
    lines = [
        f"\n\n--- PAKISTAN CONSTRUCTION MARKET PRICES (Updated: {_LAST_UPDATED}) ---\n",
        "**Cement Prices (PKR / 50 kg bag):**",
    ]
    for c in CEMENT_PRICES:
        lines.append(f"  • {c['brand']}: Rs. {c['price']:,}")

    lines.append("\n**Steel Prices (PKR / metric ton):**")
    for s in STEEL_PRICES:
        lines.append(f"  • {s['brand']} {s['grade']}: Rs. {s['price']:,}")

    lines.append("\n**Brick Prices:**")
    for b in BRICK_PRICES:
        lines.append(f"  • {b['type']}: Rs. {b['price']:,} / {b['unit']}")

    lines.append("\n**Sand & Aggregate (PKR / cft):**")
    for s in SAND_AGGREGATE:
        lines.append(f"  • {s['type']}: Rs. {s['price']:,}")

    lines.append("\n**Other Common Materials:**")
    for m in OTHER_MATERIALS:
        lines.append(f"  • {m['name']}: Rs. {m['price']:,} / {m['unit']}")

    lines.append("\n**Construction Cost Per Sq Ft (PKR range by city):**")
    lines.append("  City | Grey Structure | Full Finish")
    for row in CONSTRUCTION_COST_PER_SQFT:
        lines.append(f"  {row['city']}: {row['grey_structure']} | {row['full_finish']}")

    lines.append("\n--- END MARKET PRICES ---")
    return "\n".join(lines)
