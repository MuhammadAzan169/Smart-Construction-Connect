"""
Expand and fix the Database/ JSON files:
1. Add companies for 13 missing major Pakistani cities
2. Add more real societies per city
3. Fix orphan user-profile linkages
4. Add more client accounts
5. Add suppliers for missing cities
"""
import json
import uuid
import random
import re
from pathlib import Path
from copy import deepcopy

DB = Path("Database")
random.seed(42)

def read_json(p):
    with open(p, encoding="utf-8") as f:
        return json.load(f)

def write_json(p, data):
    p.parent.mkdir(parents=True, exist_ok=True)
    with open(p, "w", encoding="utf-8") as f:
        json.dump(data, f, indent=2, ensure_ascii=False)

def new_uuid():
    return str(uuid.uuid4())

def slugify(name):
    slug = name.lower().strip()
    slug = re.sub(r"[^a-z0-9\s-]", "", slug)
    slug = re.sub(r"[\s]+", "-", slug)
    return slug

# ── Load existing data ──
companies = read_json(DB / "construction" / "companies.json")
comp_users = read_json(DB / "construction" / "users.json")
suppliers = read_json(DB / "suppliers" / "catalog.json")
sup_users = read_json(DB / "suppliers" / "users.json")
clients = read_json(DB / "clients" / "users.json")

existing_company_slugs = {c["slug"] for c in companies}
existing_supplier_slugs = {s["slug"] for s in suppliers}
existing_emails = set()
for f in (DB/"clients"/"users.json", DB/"construction"/"users.json", DB/"suppliers"/"users.json", DB/"admin"/"users.json"):
    for u in read_json(f):
        existing_emails.add(u.get("email","").lower())

# ═══════════════════════════════════════════════════════════════════════════
# PAKISTAN CITIES + REAL SOCIETIES
# ═══════════════════════════════════════════════════════════════════════════

CITY_SOCIETIES = {
    # ── Existing cities: ADD more societies ──
    "Lahore": [
        "DHA Phase 1", "DHA Phase 5", "DHA Phase 6", "DHA Phase 8",
        "Bahria Town", "Bahria Orchard", "Gulberg III", "Gulberg V",
        "Model Town", "Johar Town", "Valencia Town", "Wapda Town",
        "Lake City", "Cantt", "Garden Town", "Askari 10", "Askari 11",
        "State Life Housing", "PCSIR Housing", "Izmir Town",
        "Architects Engineers Society", "EME Society", "NFC Society",
        "Sui Gas Housing", "Punjab Coop Housing", "AL Kabir Town",
    ],
    "Karachi": [
        "DHA Phase 1", "DHA Phase 2", "DHA Phase 5", "DHA Phase 6", "DHA Phase 8",
        "Bahria Town", "Clifton Block 2", "Clifton Block 5", "Clifton Block 9",
        "Gulshan-e-Iqbal Block 13", "Gulshan-e-Iqbal Block 14",
        "PECHS Block 2", "PECHS Block 6",
        "North Nazimabad Block H", "North Nazimabad Block L",
        "Gulistan-e-Jauhar", "Scheme 33", "Malir Cantonment",
        "Navy Housing Scheme", "Askari 5", "Naya Nazimabad",
        "Saadi Town", "Model Colony",
    ],
    "Islamabad": [
        "DHA Phase 1", "DHA Phase 2",
        "Bahria Town Phase 1", "Bahria Town Phase 7", "Bahria Town Phase 8",
        "F-6", "F-7", "F-8", "F-10", "F-11",
        "E-7", "E-11", "G-9", "G-10", "G-11", "G-13",
        "I-8", "I-10", "I-14", "I-16",
        "D-12", "B-17", "CBR Town", "Top City",
        "Park View City", "Capital Smart City",
        "Multi Gardens",
    ],
    "Rawalpindi": [
        "Bahria Town Phase 1", "Bahria Town Phase 7", "Bahria Town Phase 8",
        "DHA Phase 1", "DHA Phase 2",
        "Satellite Town", "Chaklala Scheme 3", "Gulraiz Housing",
        "Askari 14", "Askari 11", "Westridge",
        "Media Town", "PWD Housing", "Adiala Road",
        "Soan Gardens", "Airport Housing Society",
    ],
    "Faisalabad": [
        "DHA", "Gulberg Residencia",
        "Madina Town", "Susan Road", "Canal Road",
        "Citi Housing", "Eden Valley", "FIEDMC",
        "Askari Bypass", "Samanabad",
        "Peoples Colony No 1", "Peoples Colony No 2",
        "Ghulam Muhammad Abad",
    ],
    "Multan": [
        "DHA", "Bahria Town",
        "Gulgasht Colony", "Model Town", "Shah Rukn-e-Alam Colony",
        "Bosan Road", "Cantt Area", "Wapda Town",
        "Mumtazabad", "New Multan",
        "Royal Orchard", "Citi Housing",
    ],
    "Peshawar": [
        "DHA", "Bahria Town",
        "Hayatabad Phase 1", "Hayatabad Phase 3", "Hayatabad Phase 5", "Hayatabad Phase 7",
        "University Town", "Regi Model Town", "Saddar",
        "Cantt Area", "Askari 6",
        "Warsak Road", "GT Road",
    ],
    "Quetta": [
        "DHA", "Satellite Town",
        "Jinnah Town", "Samungli Road", "Airport Road",
        "Shahbaz Town", "Chiltan Housing",
        "Sariab Road", "Brewery Road",
        "Zarghoon Road",
    ],
    "Gujranwala": [
        "DHA", "Peoples Colony", "Satellite Town",
        "Citi Housing", "Model Town",
        "DC Colony", "Palm City",
        "Wapda Town", "Trust Colony",
    ],
    "Sialkot": [
        "Cantt", "Defence Road", "Model Town",
        "Allama Iqbal Colony", "Kashmir Road",
        "Paris Road", "Circular Road",
    ],
    "Bahawalpur": [
        "Model Town A", "Model Town B",
        "Circular Road", "Saraiki Town",
        "Gulberg", "Satellite Town",
    ],

    # ── NEW CITIES ──
    "Hyderabad": [
        "Latifabad Unit 7", "Latifabad Unit 9",
        "Qasimabad", "City Gate", "Heerabad",
        "Cantt Area", "Auto Bhan Road",
        "Hussainabad",
    ],
    "Abbottabad": [
        "Supply", "Jinnahabad", "Mandian",
        "Cantt Area", "Havelian Road",
        "Kashmir Point", "PMA Road",
    ],
    "Mardan": [
        "Cantt Area", "Sheikh Maltoon Town",
        "Par Hoti", "Gujrat Colony",
        "Bank Road", "University Road",
    ],
    "Sukkur": [
        "Military Road", "Minara Road",
        "Cantt Area", "New Sukkur",
        "Barrage Colony", "Airport Road",
    ],
    "Sargodha": [
        "Cantt Area", "Satellite Town",
        "University Road", "Sillanwali Road",
        "Block A", "Block 20",
        "Faisal Colony",
    ],
    "Sahiwal": [
        "Model Town", "Farid Town",
        "High Court Road", "Cantt Area",
        "Noor Shah Road", "Pakpattan Road",
    ],
    "Larkana": [
        "Station Road", "Bunder Road",
        "VIP Road", "Naudero Road",
        "Jinnah Bagh", "Cantt Area",
    ],
    "Gujrat": [
        "GT Road", "Cantt Area",
        "Civil Lines", "Jalalpur Jattan Road",
        "Sarai Alamgir Road", "Model Town",
    ],
    "Jhelum": [
        "Cantt Area", "Civil Lines",
        "GT Road", "Civi Colony",
        "Sarai Alamgir Road",
    ],
    "Rahim Yar Khan": [
        "Model Town", "Cantt Area",
        "Khanpur Road", "National Highway",
        "Sheikh Zayed Colony",
    ],
    "DG Khan": [
        "Block No 1", "Block No 12",
        "Cantt Area", "City Area",
        "DG Khan South", "Jampur Road",
    ],
    "Mirpur": [
        "Sector F-1", "Sector F-2",
        "Allama Iqbal Road", "New City",
        "Mangla Road",
    ],
    "Muzaffarabad": [
        "Chattar", "Upper Chattar",
        "CMH Road", "Domel",
        "Naluchi",
    ],
}

# ── Company templates ──
COMPANY_TIERS = {
    "budget": {
        "standard_range": (2200, 3200),
        "premium_range": (3000, 4000),
        "executive_range": (4000, 5200),
    },
    "mid": {
        "standard_range": (3000, 3800),
        "premium_range": (3800, 4800),
        "executive_range": (4800, 6500),
    },
    "premium": {
        "standard_range": (3500, 4500),
        "premium_range": (4500, 6000),
        "executive_range": (6000, 8500),
    },
}

COMPANY_NAME_PATTERNS = {
    "Hyderabad": ["Sindh Valley Constructions", "Indus Modern Builders", "Hyderabad Elite Developers"],
    "Abbottabad": ["Pine Hills Construction", "Galiyat Modern Builders", "Abbottabad Green Developers"],
    "Mardan": ["Mardan Premier Builders", "Takht Bahi Construction", "Swabi Road Developers"],
    "Sukkur": ["Sukkur Bridge Builders", "Upper Sindh Construction", "Lansdowne Developers"],
    "Sargodha": ["Sargodha City Builders", "Sillanwali Developers", "Punjab Heart Constructions"],
    "Sahiwal": ["Sahiwal Modern Builders", "Farid Town Developers", "Canal City Constructions"],
    "Larkana": ["Larkana Heritage Builders", "Mohenjo Developers", "Sindh Star Constructions"],
    "Gujrat": ["Gujrat Royal Builders", "Chenab River Developers", "Industrial City Constructions"],
    "Jhelum": ["Jhelum Fort Builders", "Salt Range Developers", "Pind Dadan Khan Constructions"],
    "Rahim Yar Khan": ["RYK Modern Builders", "Desert Rose Developers", "Khan City Constructions"],
    "DG Khan": ["DG Khan Valley Builders", "Sulaiman Range Developers", "Fort Munro Constructions"],
    "Mirpur": ["Mirpur City Builders", "Mangla Lake Developers", "AJK Premier Constructions"],
    "Muzaffarabad": ["Neelum Valley Builders", "Capital AJK Developers", "Jhelum View Constructions"],
}

def make_price(low, high):
    return round(random.randint(low, high) / 10) * 10

def make_company(city, name, tier_name, societies, idx):
    tier = COMPANY_TIERS[tier_name]
    slug = slugify(name)
    cid = f"CC-{100 + idx:03d}"

    # Pick 3-6 random societies from the city
    n_socs = min(len(societies), random.randint(3, 6))
    chosen_socs = random.sample(societies, n_socs)

    # Build operational areas
    op_areas = {city: {}}
    flat_areas = []
    for soc in chosen_socs:
        std = make_price(*tier["standard_range"])
        prem = make_price(*tier["premium_range"])
        exe = make_price(*tier["executive_range"])
        op_areas[city][soc] = {"standard": std, "premium": prem, "executive": exe}
        for pkg, price in [("standard", std), ("premium", prem), ("executive", exe)]:
            flat_areas.append({
                "city": city,
                "area": soc,
                "subarea": soc,
                "package": pkg,
                "price_per_sqft": float(price),
            })

    rating = round(random.uniform(3.2, 4.9), 1)
    reviews = random.randint(20, 300)
    projects = random.randint(5, 80)
    completed = int(projects * random.uniform(0.5, 0.9))
    ongoing = projects - completed

    phone_prefix = {
        "Hyderabad": "+92-22", "Abbottabad": "+92-992", "Mardan": "+92-937",
        "Sukkur": "+92-71", "Sargodha": "+92-48", "Sahiwal": "+92-40",
        "Larkana": "+92-74", "Gujrat": "+92-53", "Jhelum": "+92-544",
        "Rahim Yar Khan": "+92-68", "DG Khan": "+92-64",
        "Mirpur": "+92-5827", "Muzaffarabad": "+92-5822",
    }.get(city, "+92-42")

    email_domain = slug.replace("-", "") + ".pk"
    email = f"info@{email_domain}"

    min_plot = random.choice([2, 3, 5])
    max_plot = random.choice([10, 15, 20])
    max_floors = random.choice([2, 3, 4])

    return {
        "company_id": cid,
        "company_name": name,
        "slug": slug,
        "description": None,
        "logo_url": None,
        "rating": rating,
        "review_count": reviews,
        "city": city,
        "contact": {
            "phone": f"{phone_prefix}-{random.randint(1000000,9999999)}",
            "email": email,
            "website": f"www.{email_domain}",
        },
        "legal_info": {
            "registered": random.choice([True, True, True, False]),
            "secp_registered": random.choice([True, True, False]),
            "ntn": f"{random.randint(1000000,9999999)}-{random.randint(1,9)}",
            "year_established": random.randint(2010, 2024),
        },
        "construction_capability": {
            "min_plot_marla": min_plot,
            "max_plot_marla": max_plot,
            "max_floors": max_floors,
            "basement_supported": random.choice([True, False]),
            "house_types": random.sample(["residential", "small_commercial", "villa", "duplex"], k=random.randint(1, 3)),
        },
        "services": {
            "construction": random.sample(["grey_structure", "complete_finish", "renovation"], k=random.randint(1, 2)),
            "design": random.sample(["architectural", "interior", "3d_modeling"], k=random.randint(1, 2)),
            "approvals_support": [f"{city} Development Authority"],
            "extras": random.sample(["landscaping", "solar_panel", "smart_home", "security_system"], k=random.randint(0, 2)),
        },
        "operational_areas": op_areas,
        "flattened_operational_areas": flat_areas,
        "package_scope": {
            "standard": {"design_included": False, "fixtures": "economy_brands", "ceiling": "no_pop", "kitchen": "basic_shelves", "bathroom": "economy_fittings"},
            "premium": {"design_included": True, "fixtures": "local_brands", "ceiling": "simple_pop", "kitchen": "basic_modular", "bathroom": "standard_fittings"},
            "executive": {"design_included": True, "fixtures": "imported_brands", "ceiling": "designer_pop", "kitchen": "full_modular", "bathroom": "branded_fittings"},
        },
        "materials_used": {
            "standard": {"cement": random.choice(["Bestway", "Lucky", "DG Khan"]), "steel": "Grade 40 Local", "bricks": "Local Clay", "wiring": "Local Cables", "plumbing": "Local", "paint": random.choice(["Jawad", "Diamond"])},
            "premium": {"cement": random.choice(["Bestway", "Lucky"]), "steel": "Grade 60 Local", "bricks": "A-Grade Clay", "wiring": "Pakistan Cables", "plumbing": "Popular", "paint": "Diamond"},
            "executive": {"cement": "DG Khan", "steel": "Grade 60 Imported", "bricks": "A+ Grade Clay", "wiring": "Fast Cables", "plumbing": "Master", "paint": "Dulux"},
        },
        "estimated_cost_range": {
            "3_marla": {"standard": {"min": 3200000, "max": 3800000}, "premium": {"min": 4500000, "max": 5200000}, "executive": {"min": 5800000, "max": None}},
            "5_marla": {"standard": {"min": 5200000, "max": 6000000}, "premium": {"min": 7200000, "max": 8000000}, "executive": {"min": 9000000, "max": None}},
            "10_marla": {"standard": {"min": 10500000, "max": 12000000}, "premium": {"min": 14500000, "max": 16000000}, "executive": {"min": 18000000, "max": None}},
        },
        "payment_terms": {
            "advance_percentage": random.choice([20, 25, 30]),
            "installments": random.choice(["stage_wise", "monthly", "milestone"]),
            "price_type": random.choice(["fixed", "variable"]),
            "variation_clause": random.choice([True, False]),
        },
        "timeline_estimates": {
            "time_units": "months",
            "3_marla": {"single_storey": {"minimum": 3, "typical": 4, "maximum": 5}, "double_storey": {"minimum": 5, "typical": 6, "maximum": 8}},
            "5_marla": {"single_storey": {"minimum": 4, "typical": 6, "maximum": 7}, "double_storey": {"minimum": 7, "typical": 9, "maximum": 11}},
            "10_marla": {"single_storey": {"minimum": 6, "typical": 8, "maximum": 10}, "double_storey": {"minimum": 10, "typical": 13, "maximum": 16}},
            "reliability_score": round(random.uniform(0.7, 0.95), 2),
        },
        "experience": {
            "total_projects": projects,
            "houses_completed": completed,
            "ongoing_projects": ongoing,
            "specializations": random.sample(["residential", "economy_housing", "luxury_homes", "grey_structure", "commercial"], k=random.randint(1, 3)),
        },
        "customer_feedback": {
            "average_rating": rating,
            "review_count": reviews,
            "common_praises": random.sample(["quality_work", "on_time", "good_communication", "fair_pricing", "clean_site"], k=2),
            "common_complaints": random.sample(["minor_delays", "change_orders", "slow_response", "basic_finishing"], k=1),
        },
        "quality_control": {
            "site_engineer_assigned": True,
            "material_verification": random.choice([True, True, False]),
            "weekly_reporting": random.choice([True, False]),
        },
        "after_handover_support": {
            "defect_liability_period_months": random.choice([3, 6, 12]),
            "maintenance_support": True,
            "support_response_time_days": random.choice([2, 3, 5, 7]),
        },
        "legal_and_contract": {
            "written_contract": True,
            "boq_provided": random.choice([True, True, False]),
            "penalty_for_delay": random.choice([True, False]),
            "warranty_years": random.choice([1, 2, 3]),
        },
        "ideal_customer_profile": {
            "best_for": random.sample(["first_time_builders", "investors", "upgraders", "commercial_clients", "luxury_seekers"], k=2),
            "not_ideal_for": random.sample(["ultra_luxury", "high_rise", "rural_areas", "industrial"], k=1),
        },
        "ai_scores": {
            "timeline_reliability": round(random.uniform(0.65, 0.95), 2),
            "budget_accuracy": round(random.uniform(0.70, 0.95), 2),
            "quality_consistency": round(random.uniform(0.60, 0.90), 2),
        },
    }


def make_user(name, email, role, slug_key, slug_val):
    return {
        "user_id": new_uuid(),
        "email": email,
        "password_hash": "__PLAINTEXT__password123__HASH_BEFORE_PRODUCTION__",
        "display_name": name,
        "phone": None,
        "role": role,
        "status": "active",
        "created_at": "2026-01-01T00:00:00+00:00",
        "updated_at": "2026-01-01T00:00:00+00:00",
        "last_login_at": None,
        "legacy_id": None,
        slug_key: slug_val,
    }


# ═══════════════════════════════════════════════════════════════════════════
# 1. ADD NEW COMPANIES FOR MISSING CITIES
# ═══════════════════════════════════════════════════════════════════════════
print("Adding companies for missing cities...")
new_cities = [c for c in COMPANY_NAME_PATTERNS.keys()]
idx = len(companies) + 1

for city in new_cities:
    names = COMPANY_NAME_PATTERNS[city]
    societies = CITY_SOCIETIES[city]
    tiers = ["budget", "mid", "premium"]

    for i, name in enumerate(names):
        slug = slugify(name)
        if slug in existing_company_slugs:
            continue

        tier = tiers[i % len(tiers)]
        company = make_company(city, name, tier, societies, idx)
        companies.append(company)
        existing_company_slugs.add(slug)

        # Create user account
        email = company["contact"]["email"]
        if email.lower() not in existing_emails:
            comp_users.append(make_user(name, email, "company", "company_slug", slug))
            existing_emails.add(email.lower())

        idx += 1
        print(f"  + {city}: {name}")

# ═══════════════════════════════════════════════════════════════════════════
# 2. ENRICH EXISTING COMPANIES WITH MORE SOCIETIES
# ═══════════════════════════════════════════════════════════════════════════
print("\nEnriching existing companies with more societies...")
for c in companies:
    city = c.get("city")
    if city not in CITY_SOCIETIES:
        continue

    all_socs = CITY_SOCIETIES[city]
    current_socs = set(c.get("operational_areas", {}).get(city, {}).keys())

    # Add 2-3 more societies if the company has fewer than 5
    if len(current_socs) < 5:
        available = [s for s in all_socs if s not in current_socs]
        to_add = random.sample(available, min(len(available), 3))

        if city not in c["operational_areas"]:
            c["operational_areas"][city] = {}

        for soc in to_add:
            std = make_price(2500, 3800)
            prem = make_price(3500, 5000)
            exe = make_price(4500, 7000)
            c["operational_areas"][city][soc] = {"standard": std, "premium": prem, "executive": exe}
            for pkg, price in [("standard", std), ("premium", prem), ("executive", exe)]:
                c["flattened_operational_areas"].append({
                    "city": city,
                    "area": soc,
                    "subarea": soc,
                    "package": pkg,
                    "price_per_sqft": float(price),
                })


# ═══════════════════════════════════════════════════════════════════════════
# 3. FIX ORPHAN USER ACCOUNTS (users with no matching company profile)
# ═══════════════════════════════════════════════════════════════════════════
print("\nFixing orphan company users...")
company_slug_set = {c["slug"] for c in companies}
for u in comp_users:
    slug = u.get("company_slug")
    if slug and slug not in company_slug_set:
        name = u.get("display_name", slug)
        city = "Lahore"  # default for legacy users
        societies = CITY_SOCIETIES[city]
        company = make_company(city, name, "mid", societies, idx)
        company["slug"] = slug
        company["company_name"] = name
        company["contact"]["email"] = u.get("email", "")
        companies.append(company)
        company_slug_set.add(slug)
        idx += 1
        print(f"  Fixed: {slug} -> created profile for {name}")

print("\nFixing orphan supplier users...")
supplier_slug_set = {s["slug"] for s in suppliers}
for u in sup_users:
    slug = u.get("supplier_slug")
    if slug and slug not in supplier_slug_set:
        name = u.get("display_name", slug)
        suppliers.append({
            "supplier_id": f"MS-{100 + len(suppliers):03d}",
            "supplier_name": name,
            "slug": slug,
            "description": f"General construction materials supplier in Pakistan.",
            "logo_url": None,
            "rating": round(random.uniform(3.5, 4.8), 1),
            "review_count": random.randint(20, 100),
            "city": "Lahore",
            "area": "Gulberg",
            "contact": {"phone": u.get("phone", ""), "email": u.get("email", ""), "website": ""},
            "cities_served": ["Lahore", "Islamabad", "Rawalpindi"],
            "materials": [
                {"name": "Cement (50kg)", "category": "Cement", "brand": "Bestway", "price": 1350, "unit": "bag", "stock": 5000},
                {"name": "TOR Steel 40G (per ton)", "category": "Steel", "brand": "Amreli", "price": 265000, "unit": "ton", "stock": 100},
            ],
            "status": "active",
        })
        supplier_slug_set.add(slug)
        print(f"  Fixed: {slug} -> created profile for {name}")


# ═══════════════════════════════════════════════════════════════════════════
# 4. ADD MORE SUPPLIERS FOR UNDERSERVED CITIES
# ═══════════════════════════════════════════════════════════════════════════
print("\nAdding suppliers for new cities...")

NEW_SUPPLIERS = [
    {"name": "Hyderabad Building Supplies", "city": "Hyderabad", "area": "Latifabad",
     "cities_served": ["Hyderabad", "Sukkur", "Nawabshah"],
     "materials": [
         {"name": "Lucky Cement (50kg)", "category": "Cement", "brand": "Lucky", "price": 1370, "unit": "bag", "stock": 6000},
         {"name": "Sand (per CFT)", "category": "Aggregate", "brand": "Local", "price": 60, "unit": "cft", "stock": 20000},
         {"name": "Crush Stone (per CFT)", "category": "Aggregate", "brand": "Local", "price": 90, "unit": "cft", "stock": 15000},
         {"name": "Red Bricks A-Grade", "category": "Bricks", "brand": "Local", "price": 16, "unit": "piece", "stock": 500000},
     ]},
    {"name": "Abbottabad Timber House", "city": "Abbottabad", "area": "Supply",
     "cities_served": ["Abbottabad", "Mansehra", "Haripur"],
     "materials": [
         {"name": "Deodar Wood (per cft)", "category": "Wood", "brand": "Local Premium", "price": 4800, "unit": "cft", "stock": 400},
         {"name": "Pine Wood (per cft)", "category": "Wood", "brand": "Local", "price": 2500, "unit": "cft", "stock": 700},
         {"name": "Plywood 8x4 ft (18mm)", "category": "Wood", "brand": "Imported", "price": 4300, "unit": "sheet", "stock": 300},
         {"name": "MDF Board 8x4 ft", "category": "Wood", "brand": "Imported", "price": 3600, "unit": "sheet", "stock": 200},
     ]},
    {"name": "Sargodha Cement & Steel", "city": "Sargodha", "area": "Cantt Area",
     "cities_served": ["Sargodha", "Faisalabad", "Jhang"],
     "materials": [
         {"name": "Fauji Cement (50kg)", "category": "Cement", "brand": "Fauji", "price": 1360, "unit": "bag", "stock": 5000},
         {"name": "DG Khan Cement (50kg)", "category": "Cement", "brand": "DG Khan", "price": 1330, "unit": "bag", "stock": 4000},
         {"name": "TOR Steel 40G (per ton)", "category": "Steel", "brand": "Ittefaq", "price": 262000, "unit": "ton", "stock": 80},
         {"name": "TOR Steel 60G (per ton)", "category": "Steel", "brand": "Amreli", "price": 282000, "unit": "ton", "stock": 60},
     ]},
    {"name": "DG Khan Hardware Center", "city": "DG Khan", "area": "City Area",
     "cities_served": ["DG Khan", "Multan", "Rajanpur"],
     "materials": [
         {"name": "DG Khan Cement (50kg)", "category": "Cement", "brand": "DG Khan", "price": 1300, "unit": "bag", "stock": 8000},
         {"name": "Sand (per CFT)", "category": "Aggregate", "brand": "Local", "price": 55, "unit": "cft", "stock": 25000},
         {"name": "Construction Nails (per kg)", "category": "Hardware", "brand": "Local", "price": 340, "unit": "kg", "stock": 3000},
         {"name": "Door Hinges SS (pair)", "category": "Hardware", "brand": "Local", "price": 750, "unit": "pair", "stock": 600},
     ]},
    {"name": "Mirpur Marble & Granite", "city": "Mirpur", "area": "Sector F-1",
     "cities_served": ["Mirpur", "Muzaffarabad", "Islamabad"],
     "materials": [
         {"name": "Marble Floor Tile (per sq ft)", "category": "Tiles", "brand": "AJK Marble", "price": 380, "unit": "sq ft", "stock": 12000},
         {"name": "Granite Floor Tile (per sq ft)", "category": "Tiles", "brand": "Imported", "price": 520, "unit": "sq ft", "stock": 6000},
         {"name": "Ceramic Wall Tile (per sq ft)", "category": "Tiles", "brand": "Master", "price": 140, "unit": "sq ft", "stock": 18000},
         {"name": "Marble Steps (per rft)", "category": "Tiles", "brand": "AJK Marble", "price": 650, "unit": "rft", "stock": 3000},
     ]},
    {"name": "Sahiwal Paint & Finish", "city": "Sahiwal", "area": "Model Town",
     "cities_served": ["Sahiwal", "Okara", "Pakpattan"],
     "materials": [
         {"name": "Dulux Weathershield (20L)", "category": "Paint", "brand": "Dulux", "price": 14200, "unit": "bucket", "stock": 150},
         {"name": "Diamond Emulsion (20L)", "category": "Paint", "brand": "Diamond", "price": 8500, "unit": "bucket", "stock": 250},
         {"name": "Wall Primer (20L)", "category": "Paint", "brand": "Dulux", "price": 5400, "unit": "bucket", "stock": 300},
         {"name": "Wood Varnish (4L)", "category": "Paint", "brand": "Berger", "price": 3100, "unit": "tin", "stock": 120},
     ]},
    {"name": "Rahim Yar Khan Steel Works", "city": "Rahim Yar Khan", "area": "Model Town",
     "cities_served": ["Rahim Yar Khan", "Bahawalpur", "Sadiqabad"],
     "materials": [
         {"name": "TOR Steel 40G (per ton)", "category": "Steel", "brand": "Ittefaq", "price": 258000, "unit": "ton", "stock": 100},
         {"name": "MS Pipe 2 inch (per ft)", "category": "Steel", "brand": "International Steel", "price": 440, "unit": "ft", "stock": 4000},
         {"name": "GI Wire (per kg)", "category": "Steel", "brand": "Local", "price": 320, "unit": "kg", "stock": 5000},
         {"name": "Angle Iron 2x2 (per ft)", "category": "Steel", "brand": "Mughal", "price": 275, "unit": "ft", "stock": 3000},
     ]},
]

phone_prefixes = {
    "Hyderabad": "+92-22", "Abbottabad": "+92-992", "Sargodha": "+92-48",
    "DG Khan": "+92-64", "Mirpur": "+92-5827", "Sahiwal": "+92-40",
    "Rahim Yar Khan": "+92-68",
}

s_idx = len(suppliers) + 1
for ns in NEW_SUPPLIERS:
    slug = slugify(ns["name"])
    if slug in existing_supplier_slugs:
        continue

    sid = f"MS-{100 + s_idx:03d}"
    email_domain = slug.replace("-", "") + ".pk"
    email = f"info@{email_domain}"
    phone = f"{phone_prefixes.get(ns['city'], '+92-42')}-{random.randint(1000000,9999999)}"

    supplier = {
        "supplier_id": sid,
        "supplier_name": ns["name"],
        "slug": slug,
        "description": f"Quality construction materials supplier serving {ns['city']} and surrounding areas.",
        "logo_url": None,
        "rating": round(random.uniform(3.8, 4.8), 1),
        "review_count": random.randint(30, 150),
        "city": ns["city"],
        "area": ns["area"],
        "contact": {"phone": phone, "email": email, "website": f"www.{email_domain}"},
        "cities_served": ns["cities_served"],
        "materials": ns["materials"],
        "status": "active",
    }
    suppliers.append(supplier)
    existing_supplier_slugs.add(slug)

    if email.lower() not in existing_emails:
        sup_users.append(make_user(ns["name"], email, "supplier", "supplier_slug", slug))
        existing_emails.add(email.lower())

    s_idx += 1
    print(f"  + {ns['city']}: {ns['name']}")


# ═══════════════════════════════════════════════════════════════════════════
# 5. ADD MORE CLIENT ACCOUNTS
# ═══════════════════════════════════════════════════════════════════════════
print("\nAdding more client accounts...")

NEW_CLIENTS = [
    {"name": "Sara Ahmed", "email": "sara@example.com", "phone": "+92-300-1234567"},
    {"name": "Hassan Raza", "email": "hassan.raza@example.com", "phone": "+92-321-2345678"},
    {"name": "Ayesha Khan", "email": "ayesha.k@example.com", "phone": "+92-333-3456789"},
    {"name": "Usman Ali", "email": "usman.ali@example.com", "phone": "+92-345-4567890"},
    {"name": "Zainab Fatima", "email": "zainab.f@example.com", "phone": "+92-300-5678901"},
    {"name": "Imran Malik", "email": "imran.malik@example.com", "phone": "+92-312-6789012"},
    {"name": "Nadia Hussain", "email": "nadia.h@example.com", "phone": "+92-331-7890123"},
    {"name": "Tariq Mahmood", "email": "tariq.m@example.com", "phone": "+92-302-8901234"},
    {"name": "Mehreen Shah", "email": "mehreen.s@example.com", "phone": "+92-344-9012345"},
    {"name": "Kamran Akbar", "email": "kamran.a@example.com", "phone": "+92-315-0123456"},
    {"name": "Rizwan Qadir", "email": "rizwan.q@example.com", "phone": "+92-306-1122334"},
    {"name": "Sadia Parveen", "email": "sadia.p@example.com", "phone": "+92-322-2233445"},
]

for nc in NEW_CLIENTS:
    if nc["email"].lower() in existing_emails:
        continue
    clients.append({
        "user_id": new_uuid(),
        "email": nc["email"].lower(),
        "password_hash": "__PLAINTEXT__password123__HASH_BEFORE_PRODUCTION__",
        "display_name": nc["name"],
        "phone": nc["phone"],
        "role": "client",
        "status": "active",
        "created_at": "2026-01-15T00:00:00+00:00",
        "updated_at": "2026-01-15T00:00:00+00:00",
        "last_login_at": None,
        "legacy_id": None,
        "preferences": {},
    })
    existing_emails.add(nc["email"].lower())
    print(f"  + {nc['name']}")


# ═══════════════════════════════════════════════════════════════════════════
# SAVE EVERYTHING
# ═══════════════════════════════════════════════════════════════════════════
print("\nSaving...")
write_json(DB / "construction" / "companies.json", companies)
write_json(DB / "construction" / "users.json", comp_users)
write_json(DB / "suppliers" / "catalog.json", suppliers)
write_json(DB / "suppliers" / "users.json", sup_users)
write_json(DB / "clients" / "users.json", clients)

print(f"\n{'='*60}")
print("FINAL COUNTS")
print(f"{'='*60}")
print(f"Companies:        {len(companies)}")
print(f"Company users:    {len(comp_users)}")
print(f"Suppliers:        {len(suppliers)}")
print(f"Supplier users:   {len(sup_users)}")
print(f"Clients:          {len(clients)}")

# Count cities
all_cities = set()
for c in companies:
    all_cities.add(c.get("city"))
print(f"Cities covered:   {len(all_cities)}")
print(f"  {sorted(all_cities)}")
