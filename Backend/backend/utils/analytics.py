"""Platform analytics — aggregated stats for admin dashboards."""

from __future__ import annotations
from datetime import datetime, timezone, timedelta
from typing import Any

from backend.utils.data_handler import (
    read_json,
    get_all_users,
    get_users_by_role,
    companies_dataset_path,
    suppliers_dataset_path,
    get_activity_log,
)
from backend.utils.events import _EVENT_LOG_PATH


def get_platform_analytics() -> dict[str, Any]:
    """Return comprehensive platform analytics."""
    users = get_all_users()
    companies = read_json(companies_dataset_path())
    suppliers = read_json(suppliers_dataset_path())
    activity = get_activity_log()

    now = datetime.now(timezone.utc)
    week_ago = (now - timedelta(days=7)).isoformat()

    # User stats
    user_stats = {
        "total": len(users),
        "by_role": {},
        "active": sum(1 for u in users if u.get("status") == "active"),
        "pending": sum(1 for u in users if u.get("status") == "pending"),
        "banned": sum(1 for u in users if u.get("status") == "banned"),
        "recent_signups": sum(1 for u in users if (u.get("created_at") or "") >= week_ago),
    }
    for role in ("client", "company", "supplier", "admin"):
        role_users = get_users_by_role(role)
        user_stats["by_role"][role] = len(role_users)

    # Company stats
    if isinstance(companies, list):
        company_stats = {
            "total": len(companies),
            "verified": sum(1 for c in companies if c.get("verification_status") == "verified"),
            "pending": sum(1 for c in companies if c.get("verification_status") == "pending"),
            "avg_rating": _safe_avg([c.get("rating", 0) for c in companies if c.get("rating")]),
            "top_cities": _top_values([c.get("city", "") for c in companies if c.get("city")], 5),
            "total_reviews": sum(c.get("review_count", 0) for c in companies),
        }
    else:
        company_stats = {"total": 0, "verified": 0, "pending": 0, "avg_rating": 0, "top_cities": [], "total_reviews": 0}

    # Supplier stats
    if isinstance(suppliers, list):
        supplier_stats = {
            "total": len(suppliers),
            "verified": sum(1 for s in suppliers if s.get("verification_status") == "verified"),
            "pending": sum(1 for s in suppliers if s.get("verification_status") == "pending"),
            "avg_rating": _safe_avg([s.get("rating", 0) for s in suppliers if s.get("rating")]),
            "top_cities": _top_values([s.get("city", "") for s in suppliers if s.get("city")], 5),
            "total_materials": sum(len(s.get("materials", [])) for s in suppliers),
        }
    else:
        supplier_stats = {"total": 0, "verified": 0, "pending": 0, "avg_rating": 0, "top_cities": [], "total_materials": 0}

    # Activity stats
    activity_stats = {
        "total_entries": len(activity),
        "recent_week": sum(1 for a in activity if (a.get("timestamp") or "") >= week_ago),
        "by_action": _count_values([a.get("action", "") for a in activity]),
    }

    # AI usage stats from activity log
    ai_entries = [a for a in activity if "ai" in (a.get("action") or "").lower()]
    ai_stats = {
        "total_chats": len(ai_entries),
        "recent_week": sum(1 for a in ai_entries if (a.get("timestamp") or "") >= week_ago),
    }

    # Event log stats
    events = read_json(_EVENT_LOG_PATH)
    event_stats = {
        "total": len(events) if isinstance(events, list) else 0,
        "by_type": _count_values([e.get("type", "") for e in events]) if isinstance(events, list) else {},
    }

    return {
        "users": user_stats,
        "companies": company_stats,
        "suppliers": supplier_stats,
        "activity": activity_stats,
        "ai_usage": ai_stats,
        "events": event_stats,
        "generated_at": now.isoformat(),
    }


def get_top_companies(limit: int = 10) -> list[dict]:
    """Return top-performing companies by composite score."""
    companies = read_json(companies_dataset_path())
    if not isinstance(companies, list):
        return []

    scored = []
    for c in companies:
        if not isinstance(c, dict) or not c.get("company_id"):
            continue
        ai = c.get("ai_scores", {})
        rating = c.get("rating", 0) or 0
        reviews = c.get("review_count", 0) or 0
        timeline = ai.get("timeline_reliability", 0) or 0
        budget = ai.get("budget_accuracy", 0) or 0
        quality = ai.get("quality_consistency", 0) or 0

        composite = (rating * 10) + (reviews * 0.05) + (timeline * 15) + (budget * 15) + (quality * 15)
        scored.append({
            "company_id": c["company_id"],
            "company_name": c.get("company_name", "Unknown"),
            "slug": c.get("slug", ""),
            "city": c.get("city", ""),
            "rating": rating,
            "review_count": reviews,
            "ai_scores": ai,
            "composite_score": round(composite, 1),
            "verification_status": c.get("verification_status", "pending"),
        })

    scored.sort(key=lambda x: x["composite_score"], reverse=True)
    return scored[:limit]


def get_supply_demand_gaps() -> list[dict]:
    """Identify cities where demand (companies) exceeds supply (suppliers) or vice versa."""
    companies = read_json(companies_dataset_path())
    suppliers = read_json(suppliers_dataset_path())

    company_cities: dict[str, int] = {}
    if isinstance(companies, list):
        for c in companies:
            city = (c.get("city") or "").strip()
            if city:
                company_cities[city] = company_cities.get(city, 0) + 1

    supplier_cities: dict[str, int] = {}
    if isinstance(suppliers, list):
        for s in suppliers:
            city = (s.get("city") or "").strip()
            if city:
                supplier_cities[city] = supplier_cities.get(city, 0) + 1

    all_cities = set(company_cities.keys()) | set(supplier_cities.keys())
    gaps = []
    for city in all_cities:
        cc = company_cities.get(city, 0)
        sc = supplier_cities.get(city, 0)
        ratio = cc / max(sc, 1)
        gaps.append({
            "city": city,
            "companies": cc,
            "suppliers": sc,
            "ratio": round(ratio, 2),
            "status": "balanced" if 0.5 <= ratio <= 2 else ("high_demand" if ratio > 2 else "oversupplied"),
        })

    gaps.sort(key=lambda x: abs(x["ratio"] - 1), reverse=True)
    return gaps


def _safe_avg(nums: list) -> float:
    valid = [n for n in nums if isinstance(n, (int, float)) and n > 0]
    return round(sum(valid) / len(valid), 2) if valid else 0


def _top_values(items: list[str], limit: int) -> list[dict]:
    counts: dict[str, int] = {}
    for item in items:
        if item:
            counts[item] = counts.get(item, 0) + 1
    sorted_items = sorted(counts.items(), key=lambda x: x[1], reverse=True)
    return [{"name": k, "count": v} for k, v in sorted_items[:limit]]


def _count_values(items: list[str]) -> dict[str, int]:
    counts: dict[str, int] = {}
    for item in items:
        if item:
            counts[item] = counts.get(item, 0) + 1
    return counts
