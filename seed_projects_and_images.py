"""
Seed script: adds fake projects to construction companies
and image_urls + descriptions to supplier materials.
Run from project root:  python seed_projects_and_images.py
"""
import json
import random
import hashlib
from pathlib import Path

DB = Path(__file__).parent / "Database"
COMPANIES_PATH = DB / "construction" / "companies.json"
CATALOG_PATH = DB / "suppliers" / "catalog.json"

# ── Construction project images (Unsplash, construction-themed) ────────────
PROJECT_IMAGES = [
    "https://images.unsplash.com/photo-1503387762-592deb58ef4e?w=800&h=600&fit=crop",
    "https://images.unsplash.com/photo-1541976590-713941681591?w=800&h=600&fit=crop",
    "https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?w=800&h=600&fit=crop",
    "https://images.unsplash.com/photo-1504307651254-35680f356dfd?w=800&h=600&fit=crop",
    "https://images.unsplash.com/photo-1590846083693-f23fdede3a7e?w=800&h=600&fit=crop",
    "https://images.unsplash.com/photo-1581094794329-c8112a89af12?w=800&h=600&fit=crop",
    "https://images.unsplash.com/photo-1600585154340-be6161a56a0c?w=800&h=600&fit=crop",
    "https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?w=800&h=600&fit=crop",
    "https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?w=800&h=600&fit=crop",
    "https://images.unsplash.com/photo-1600566753086-00f18fb6b3ea?w=800&h=600&fit=crop",
    "https://images.unsplash.com/photo-1600573472550-8090b5e0745e?w=800&h=600&fit=crop",
    "https://images.unsplash.com/photo-1512917774080-9991f1c4c750?w=800&h=600&fit=crop",
    "https://images.unsplash.com/photo-1605146769289-440113cc3d00?w=800&h=600&fit=crop",
    "https://images.unsplash.com/photo-1580587771525-78b9dba3b914?w=800&h=600&fit=crop",
    "https://images.unsplash.com/photo-1564013799919-ab600027ffc6?w=800&h=600&fit=crop",
    "https://images.unsplash.com/photo-1613490493576-7fde63acd811?w=800&h=600&fit=crop",
    "https://images.unsplash.com/photo-1449844908441-8829872d2607?w=800&h=600&fit=crop",
    "https://images.unsplash.com/photo-1416331108676-a22ccb276e35?w=800&h=600&fit=crop",
    "https://images.unsplash.com/photo-1600047509807-ba8f99d2cdde?w=800&h=600&fit=crop",
    "https://images.unsplash.com/photo-1600585153490-76fb20a32601?w=800&h=600&fit=crop",
]

# ── Material images by category ───────────────────────────────────────────
MATERIAL_IMAGES = {
    "Cement": [
        "https://images.unsplash.com/photo-1518709766631-a6a7f45921c3?w=400&h=300&fit=crop",
        "https://images.unsplash.com/photo-1590074072786-a66914d668f1?w=400&h=300&fit=crop",
        "https://images.unsplash.com/photo-1587394275990-23e7ef109dbe?w=400&h=300&fit=crop",
    ],
    "Steel / Rebar": [
        "https://images.unsplash.com/photo-1530982011887-3cc11cc85693?w=400&h=300&fit=crop",
        "https://images.unsplash.com/photo-1504328345606-18bbc8c9d7d1?w=400&h=300&fit=crop",
        "https://images.unsplash.com/photo-1558618666-fcd25c85f82e?w=400&h=300&fit=crop",
    ],
    "Bricks & Blocks": [
        "https://images.unsplash.com/photo-1590069261209-f8e9b8642343?w=400&h=300&fit=crop",
        "https://images.unsplash.com/photo-1589939705384-5185137a7f0f?w=400&h=300&fit=crop",
    ],
    "Sand & Aggregate": [
        "https://images.unsplash.com/photo-1558618666-fcd25c85f82e?w=400&h=300&fit=crop",
        "https://images.unsplash.com/photo-1504328345606-18bbc8c9d7d1?w=400&h=300&fit=crop",
    ],
    "Tiles & Flooring": [
        "https://images.unsplash.com/photo-1615971677499-5467cbab01c0?w=400&h=300&fit=crop",
        "https://images.unsplash.com/photo-1502005229762-cf1b2da7c5d6?w=400&h=300&fit=crop",
        "https://images.unsplash.com/photo-1616486338812-3dadae4b4ace?w=400&h=300&fit=crop",
    ],
    "Paint & Finishes": [
        "https://images.unsplash.com/photo-1562259929-b4e1fd3aef09?w=400&h=300&fit=crop",
        "https://images.unsplash.com/photo-1560448204-e02f11c3d0e2?w=400&h=300&fit=crop",
    ],
    "Electrical": [
        "https://images.unsplash.com/photo-1558618666-fcd25c85f82e?w=400&h=300&fit=crop",
        "https://images.unsplash.com/photo-1621905251189-08b45d6a269e?w=400&h=300&fit=crop",
    ],
    "Plumbing": [
        "https://images.unsplash.com/photo-1585704032915-c3400ca199e7?w=400&h=300&fit=crop",
        "https://images.unsplash.com/photo-1504328345606-18bbc8c9d7d1?w=400&h=300&fit=crop",
    ],
    "Glass & Windows": [
        "https://images.unsplash.com/photo-1502005229762-cf1b2da7c5d6?w=400&h=300&fit=crop",
        "https://images.unsplash.com/photo-1615971677499-5467cbab01c0?w=400&h=300&fit=crop",
    ],
    "Doors & Frames": [
        "https://images.unsplash.com/photo-1558618666-fcd25c85f82e?w=400&h=300&fit=crop",
        "https://images.unsplash.com/photo-1502005229762-cf1b2da7c5d6?w=400&h=300&fit=crop",
    ],
}

DEFAULT_MATERIAL_IMAGES = [
    "https://images.unsplash.com/photo-1504328345606-18bbc8c9d7d1?w=400&h=300&fit=crop",
    "https://images.unsplash.com/photo-1558618666-fcd25c85f82e?w=400&h=300&fit=crop",
]

# ── Project generation data ───────────────────────────────────────────────
PROJECT_TYPES = [
    "Residential House", "Residential Villa", "Commercial Building",
    "Apartment Complex", "Renovation", "Office Building",
    "Farmhouse", "Town House", "Duplex House", "Boundary Wall & Plot Development",
]

PROJECT_TITLES = [
    "Modern 5-Marla House", "Luxury 1-Kanal Villa", "10-Marla Contemporary Home",
    "Commercial Plaza Construction", "3-Storey Apartment Building",
    "Office Tower Development", "Premium Farmhouse Estate",
    "Smart Home 7-Marla", "Executive 2-Kanal Residence",
    "Heritage Style Bungalow", "Minimalist Urban Home",
    "Green Building Eco-House", "Industrial Warehouse",
    "Community Center Project", "Multi-Family Town Houses",
    "Penthouse Renovation", "Retail Shopping Complex",
    "Residential Extension & Remodel", "Double-Storey 10-Marla",
    "Compact 3-Marla Smart Home",
]

PLOT_SIZES = ["3 Marla", "5 Marla", "7 Marla", "10 Marla", "1 Kanal", "2 Kanal"]
CITIES = ["Lahore", "Islamabad", "Rawalpindi", "Karachi", "Faisalabad", "Multan", "Peshawar"]
STATUSES = ["completed", "completed", "completed", "completed", "ongoing"]

MATERIAL_DESCRIPTIONS = {
    "Cement": "High-grade Portland cement suitable for all structural work. Meets ASTM standards.",
    "Steel / Rebar": "Premium reinforcement steel bars with high tensile strength for foundations and columns.",
    "Bricks & Blocks": "Kiln-fired bricks with consistent dimensions and excellent load-bearing capacity.",
    "Sand & Aggregate": "Clean, graded construction sand and aggregate for concrete mixing.",
    "Tiles & Flooring": "Durable porcelain and ceramic tiles in various designs for floors and walls.",
    "Paint & Finishes": "Weather-resistant premium paint with rich color retention and smooth finish.",
    "Electrical": "Certified electrical supplies including wiring, switches, and panels.",
    "Plumbing": "High-quality PVC and CPVC pipes with fittings for water supply and drainage.",
    "Glass & Windows": "Tempered safety glass and aluminum-frame windows for modern construction.",
    "Doors & Frames": "Solid wood and engineered doors with premium hardware and frames.",
}


def _hash_seed(s: str) -> int:
    return int(hashlib.md5(s.encode()).hexdigest(), 16)


def seed_projects():
    """Add 2-5 fake projects to each company that has none."""
    companies = json.loads(COMPANIES_PATH.read_text(encoding="utf-8"))
    updated = 0
    for c in companies:
        if c.get("projects"):
            continue
        cid = c.get("company_id", "")
        rng = random.Random(_hash_seed(cid))
        n_projects = rng.randint(2, 5)
        city = c.get("city") or "Lahore"
        op_cities = []
        if c.get("operational_areas") and isinstance(c["operational_areas"], dict):
            op_cities = list(c["operational_areas"].keys())

        projects = []
        for i in range(n_projects):
            proj_city = rng.choice(op_cities) if op_cities else rng.choice(CITIES)
            n_images = rng.randint(2, 4)
            imgs = rng.sample(PROJECT_IMAGES, min(n_images, len(PROJECT_IMAGES)))
            year = rng.randint(2019, 2024)
            projects.append({
                "id": f"proj-{cid[:8]}-{i}",
                "title": rng.choice(PROJECT_TITLES),
                "type": rng.choice(PROJECT_TYPES),
                "city": proj_city.replace("_", " ").title(),
                "year": year,
                "description": f"A beautiful {rng.choice(['modern', 'contemporary', 'classic', 'luxury', 'minimalist'])} construction project completed in {proj_city.replace('_', ' ').title()}. Features premium materials and expert craftsmanship.",
                "image_urls": imgs,
                "plot_size": rng.choice(PLOT_SIZES),
                "budget_range": rng.choice(["20-40 Lac", "40-80 Lac", "80 Lac - 1.5 Cr", "1.5 - 3 Cr", "3 - 5 Cr", "5+ Cr"]),
                "duration_months": rng.randint(6, 24),
                "status": rng.choice(STATUSES),
            })
        c["projects"] = projects
        updated += 1

    COMPANIES_PATH.write_text(json.dumps(companies, indent=2, ensure_ascii=False), encoding="utf-8")
    print(f"Seeded projects for {updated} companies ({len(companies)} total)")


def seed_material_images():
    """Add image_urls and descriptions to all supplier materials."""
    catalog = json.loads(CATALOG_PATH.read_text(encoding="utf-8"))
    updated = 0
    for supplier in catalog:
        sid = supplier.get("supplier_id", "")
        rng = random.Random(_hash_seed(sid))
        for i, mat in enumerate(supplier.get("materials", [])):
            cat = mat.get("category", "")
            cat_images = MATERIAL_IMAGES.get(cat, DEFAULT_MATERIAL_IMAGES)
            n_images = rng.randint(1, min(3, len(cat_images)))
            mat["image_urls"] = rng.sample(cat_images, n_images)
            if not mat.get("description"):
                base_desc = MATERIAL_DESCRIPTIONS.get(cat, f"Quality {cat} materials for construction projects.")
                mat["description"] = f"{mat.get('brand', '')} - {base_desc}".strip(" -")
            updated += 1

    CATALOG_PATH.write_text(json.dumps(catalog, indent=2, ensure_ascii=False), encoding="utf-8")
    print(f"Updated {updated} materials across {len(catalog)} suppliers")


if __name__ == "__main__":
    seed_projects()
    seed_material_images()
    print("Done!")
