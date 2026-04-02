"""RAG-style recommendation engine that matches clients to companies/suppliers."""

from __future__ import annotations
import re
from typing import Any

from backend.utils.data_handler import (
    read_json,
    companies_dataset_path,
    suppliers_dataset_path,
)


def _parse_budget(text: str) -> tuple[float | None, float | None]:
    """Extract numeric budget range from text like '8M-12M' or '8000000'."""
    text = text.lower().replace(",", "").replace("pkr", "").strip()
    nums: list[float] = []
    for match in re.finditer(r"(\d+(?:\.\d+)?)\s*(m|million|k|thousand|lakh|lac|l|crore|cr)?", text):
        val = float(match.group(1))
        unit = (match.group(2) or "").strip()
        if unit in ("m", "million"):
            val *= 1_000_000
        elif unit in ("k", "thousand"):
            val *= 1_000
        elif unit in ("lakh", "lac", "l"):
            val *= 100_000
        elif unit in ("crore", "cr"):
            val *= 10_000_000
        nums.append(val)
    if len(nums) >= 2:
        return min(nums), max(nums)
    elif len(nums) == 1:
        return nums[0] * 0.7, nums[0] * 1.3
    return None, None


def _extract_intent(messages: list[dict]) -> dict:
    """Extract structured intent from conversation messages."""
    combined = " ".join(m.get("content", "") for m in messages if m.get("role") == "user").lower()

    intent: dict[str, Any] = {
        "project_type": None,
        "budget_min": None,
        "budget_max": None,
        "city": None,
        "area": None,
        "needs_company": False,
        "needs_supplier": False,
        "material_keywords": [],
        "keywords": [],
    }

    # Project type
    if any(w in combined for w in ["build", "house", "construct", "home", "villa", "bungalow", "marla", "kanal"]):
        intent["project_type"] = "construction"
        intent["needs_company"] = True
    if any(w in combined for w in ["material", "supply", "cement", "steel", "brick", "paint", "tile", "wood", "pipe", "marble"]):
        intent["needs_supplier"] = True
        mat_keywords = ["cement", "steel", "brick", "paint", "tile", "wood", "pipe", "marble",
                        "glass", "electrical", "plumbing", "sanitary", "door", "window", "waterproof"]
        intent["material_keywords"] = [k for k in mat_keywords if k in combined]
    if any(w in combined for w in ["both", "everything", "complete"]):
        intent["needs_company"] = True
        intent["needs_supplier"] = True

    if not intent["needs_company"] and not intent["needs_supplier"]:
        intent["needs_company"] = True  # default

    # Budget
    budget_min, budget_max = _parse_budget(combined)
    intent["budget_min"] = budget_min
    intent["budget_max"] = budget_max

    # City
    pakistan_cities = [
        "karachi", "lahore", "islamabad", "rawalpindi", "faisalabad",
        "multan", "peshawar", "quetta", "hyderabad", "sialkot",
        "gujranwala", "bahawalpur", "sahiwal", "mardan", "abbottabad",
        "sukkur", "nawabshah",
    ]
    for city in pakistan_cities:
        if city in combined:
            intent["city"] = city.title()
            break

    # Area/society
    area_patterns = [
        "dha", "bahria", "gulberg", "model town", "cantt", "wapda town",
        "lake city", "johar town", "garden town", "askari", "defence",
        "satellite town", "hayatabad", "university town",
    ]
    for area in area_patterns:
        if area in combined:
            intent["area"] = area.title()
            break

    return intent


def _score_company(company: dict, intent: dict) -> float:
    """Score a company 0-100 based on how well it matches the intent."""
    score = 50.0  # base

    # City match
    op_areas = company.get("operational_areas", {})
    flat = company.get("flattened_operational_areas", [])

    company_cities = set()
    for c in (list(op_areas.keys()) if isinstance(op_areas, dict) else []):
        company_cities.add(c.lower())
    for row in flat:
        if row.get("city"):
            company_cities.add(row["city"].lower())

    if intent["city"]:
        if intent["city"].lower() in company_cities:
            score += 20
        else:
            score -= 15

    # Area match
    if intent["area"] and flat:
        area_lower = intent["area"].lower()
        areas_in_company = set()
        for row in flat:
            if row.get("area"):
                areas_in_company.add(row["area"].lower())
            if row.get("subarea"):
                areas_in_company.add(row["subarea"].lower())
        if any(area_lower in a for a in areas_in_company):
            score += 15

    # Budget match (price per sqft vs total budget)
    if intent["budget_min"] is not None:
        prices = [r.get("price_per_sqft", 0) for r in flat if isinstance(r.get("price_per_sqft"), (int, float))]
        if prices:
            avg_price = sum(prices) / len(prices)
            # Rough: 5 marla = ~1125 sqft, assume mid-size
            est_min = avg_price * 1000
            est_max = avg_price * 2000
            if intent["budget_min"] and intent["budget_max"]:
                if est_min <= intent["budget_max"] and est_max >= intent["budget_min"]:
                    score += 15
                else:
                    score -= 10

    # Rating boost
    rating = company.get("customer_feedback", {}).get("average_rating", 0)
    if rating >= 4.5:
        score += 10
    elif rating >= 4.0:
        score += 5

    # AI scores
    ai = company.get("ai_scores", {})
    for key in ["timeline_reliability", "budget_accuracy", "quality_consistency"]:
        val = ai.get(key, 0)
        if isinstance(val, (int, float)):
            score += val * 3  # 0-1 range → 0-3 points each

    # Experience
    completed = company.get("experience", {}).get("houses_completed", 0)
    if completed >= 50:
        score += 5
    elif completed >= 20:
        score += 3

    return max(0, min(100, score))


def _score_supplier(supplier: dict, intent: dict) -> float:
    """Score a supplier 0-100 based on intent."""
    score = 50.0

    # City match
    cities_served = [c.lower() for c in supplier.get("cities_served", [])]
    if intent["city"]:
        if intent["city"].lower() in cities_served:
            score += 20
        else:
            score -= 15

    # Material keyword match
    materials = supplier.get("materials", [])
    mat_names = " ".join(m.get("name", "").lower() + " " + m.get("category", "").lower() for m in materials)
    matched_keywords = 0
    for kw in intent.get("material_keywords", []):
        if kw in mat_names:
            matched_keywords += 1
    if matched_keywords > 0:
        score += min(20, matched_keywords * 8)

    # Rating
    rating = supplier.get("rating", 0)
    if rating >= 4.5:
        score += 10
    elif rating >= 4.0:
        score += 5

    # Variety of materials
    if len(materials) >= 6:
        score += 5

    return max(0, min(100, score))


def get_recommendations(messages: list[dict]) -> dict:
    """Return top 3 recommendations based on conversation history."""
    intent = _extract_intent(messages)

    results: list[dict] = []

    if intent["needs_company"]:
        companies = read_json(companies_dataset_path())
        if isinstance(companies, list):
            for c in companies:
                if not isinstance(c, dict) or not c.get("company_id"):
                    continue
                sc = _score_company(c, intent)
                results.append({
                    "type": "company",
                    "id": c["company_id"],
                    "name": c.get("company_name", "Unknown"),
                    "score": round(sc),
                    "location": ", ".join(list(c.get("operational_areas", {}).keys())[:2]) if isinstance(c.get("operational_areas"), dict) else "Pakistan",
                    "rating": c.get("customer_feedback", {}).get("average_rating", 0),
                    "reviews": c.get("customer_feedback", {}).get("review_count", 0),
                    "specializations": c.get("experience", {}).get("specializations", [])[:3],
                    "price_range": _get_company_price_range(c),
                    "completed_projects": c.get("experience", {}).get("houses_completed", 0),
                })

    if intent["needs_supplier"]:
        suppliers = read_json(suppliers_dataset_path())
        if isinstance(suppliers, list):
            for s in suppliers:
                if not isinstance(s, dict) or not s.get("supplier_id"):
                    continue
                sc = _score_supplier(s, intent)
                categories = list(set(m.get("category", "") for m in s.get("materials", [])))
                results.append({
                    "type": "supplier",
                    "id": s["supplier_id"],
                    "name": s.get("supplier_name", "Unknown"),
                    "score": round(sc),
                    "location": s.get("location", {}).get("city", "Pakistan"),
                    "rating": s.get("rating", 0),
                    "reviews": s.get("review_count", 0),
                    "categories": categories[:5],
                    "materials_count": len(s.get("materials", [])),
                })

    # Sort by score descending, take top 3
    results.sort(key=lambda x: x["score"], reverse=True)
    top = results[:3]

    # Build response message
    response_text = _build_response_text(top, intent)

    return {
        "intent": intent,
        "recommendations": top,
        "response": response_text,
    }


def _get_company_price_range(company: dict) -> str:
    flat = company.get("flattened_operational_areas", [])
    prices = [r.get("price_per_sqft", 0) for r in flat if isinstance(r.get("price_per_sqft"), (int, float)) and r.get("price_per_sqft", 0) > 0]
    if not prices:
        return "Contact for pricing"
    mn, mx = min(prices), max(prices)
    fmt = lambda n: f"{n:,.0f}"
    return f"{fmt(mn)} - {fmt(mx)} PKR/sq ft"


def _build_response_text(recommendations: list[dict], intent: dict) -> str:
    if not recommendations:
        return "I couldn't find matches based on your criteria. Could you provide more details about your project requirements, preferred city, or budget range?"

    parts = ["Based on your requirements, here are my top recommendations:\n"]

    for i, rec in enumerate(recommendations, 1):
        if rec["type"] == "company":
            parts.append(f"**{i}. {rec['name']}** (Construction Company)")
            parts.append(f"   📍 {rec['location']} | ⭐ {rec['rating']}/5 ({rec['reviews']} reviews)")
            parts.append(f"   💰 {rec['price_range']}")
            if rec.get("specializations"):
                parts.append(f"   🔧 {', '.join(rec['specializations'])}")
            parts.append(f"   Match Score: {rec['score']}%\n")
        else:
            parts.append(f"**{i}. {rec['name']}** (Material Supplier)")
            parts.append(f"   📍 {rec['location']} | ⭐ {rec['rating']}/5 ({rec['reviews']} reviews)")
            if rec.get("categories"):
                parts.append(f"   📦 {', '.join(rec['categories'])}")
            parts.append(f"   Match Score: {rec['score']}%\n")

    parts.append("Would you like more details about any of these, or would you like to refine your search?")
    return "\n".join(parts)


def generate_ai_response(messages: list[dict]) -> dict:
    """Generate a conversational AI response with optional recommendations."""
    if not messages:
        return {
            "response": "Hello! I'm your Smart Construction Connect AI assistant. I can help you find the perfect construction company or material supplier in Pakistan. Tell me about your project — what are you looking to build, your budget range, and preferred city?",
            "recommendations": [],
        }

    last_msg = messages[-1].get("content", "").lower() if messages else ""

    # Check if we have enough info to make recommendations
    combined = " ".join(m.get("content", "") for m in messages if m.get("role") == "user").lower()

    has_project = any(w in combined for w in ["build", "house", "construct", "material", "supply", "cement", "steel", "marla", "kanal"])
    has_budget = any(w in combined for w in ["budget", "pkr", "million", "lakh", "lac", "crore", "m ", "k "])
    has_city = any(w in combined for w in [
        "karachi", "lahore", "islamabad", "rawalpindi", "faisalabad",
        "multan", "peshawar", "quetta", "hyderabad",
    ])

    # If greeting or very short
    if len(last_msg.split()) <= 3 and any(w in last_msg for w in ["hi", "hello", "hey", "help", "start"]):
        return {
            "response": "Welcome! I'd love to help you find the right construction partner. To give you the best recommendations, could you tell me:\n\n1. **What type of project?** (e.g., building a house, buying materials, renovation)\n2. **Your budget range?** (e.g., 8-12 million PKR)\n3. **Preferred city or area?** (e.g., Lahore, DHA Islamabad)",
            "recommendations": [],
        }

    # If we have enough info, generate recommendations
    if has_project and (has_budget or has_city):
        return get_recommendations(messages)

    # Ask for missing info
    missing = []
    if not has_project:
        missing.append("What type of project are you planning? (house construction, material purchase, renovation)")
    if not has_budget:
        missing.append("What's your approximate budget range?")
    if not has_city:
        missing.append("Which city or area are you looking in?")

    response = "Thanks for the details! To find the best matches for you, I still need a bit more info:\n\n"
    for i, m in enumerate(missing, 1):
        response += f"{i}. {m}\n"

    return {
        "response": response,
        "recommendations": [],
    }
