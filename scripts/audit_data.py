"""Audit the current Database/ JSON files for data coverage and quality."""
import json
from pathlib import Path

DB = Path("Database")

# ── Companies ──
with open(DB / "construction" / "companies.json", encoding="utf-8") as f:
    companies = json.load(f)

cities = {}
for c in companies:
    city = c.get("city", "Unknown")
    if city not in cities:
        cities[city] = {"count": 0, "societies": set()}
    cities[city]["count"] += 1
    for city_key, area_data in c.get("operational_areas", {}).items():
        for area_name in area_data.keys():
            cities[city]["societies"].add(area_name)

print("=" * 60)
print("COMPANY COVERAGE BY CITY")
print("=" * 60)
total_socs = 0
for city in sorted(cities.keys()):
    info = cities[city]
    socs = sorted(info["societies"])
    total_socs += len(socs)
    print(f"\n{city}: {info['count']} companies, {len(socs)} societies/areas")
    for s in socs:
        print(f"  - {s}")

print(f"\nTotal: {len(companies)} companies, {len(cities)} cities, {total_socs} societies")

# ── Suppliers ──
with open(DB / "suppliers" / "catalog.json", encoding="utf-8") as f:
    suppliers = json.load(f)

print("\n" + "=" * 60)
print("SUPPLIER COVERAGE BY CITY")
print("=" * 60)
sup_cities = {}
for s in suppliers:
    city = s.get("city", "Unknown")
    if city not in sup_cities:
        sup_cities[city] = []
    sup_cities[city].append(s["supplier_name"])

for city in sorted(sup_cities.keys()):
    print(f"\n{city}: {len(sup_cities[city])} suppliers")
    for name in sup_cities[city]:
        print(f"  - {name}")

# ── Users ──
print("\n" + "=" * 60)
print("USER ACCOUNTS")
print("=" * 60)
for role in ("clients", "construction", "suppliers", "admin"):
    with open(DB / role / "users.json", encoding="utf-8") as f:
        users = json.load(f)
    print(f"{role}: {len(users)} accounts")

# ── Data quality: check company slugs match user slugs ──
print("\n" + "=" * 60)
print("COMPANY-USER LINKAGE CHECK")
print("=" * 60)
with open(DB / "construction" / "users.json", encoding="utf-8") as f:
    comp_users = json.load(f)

user_slugs = {u.get("company_slug") for u in comp_users}
company_slugs = {c.get("slug") for c in companies}

orphan_companies = company_slugs - user_slugs
orphan_users = user_slugs - company_slugs - {None}

if orphan_companies:
    print(f"Companies with no user account: {len(orphan_companies)}")
    for s in sorted(orphan_companies):
        print(f"  - {s}")
else:
    print("All companies have matching user accounts")

if orphan_users:
    print(f"User accounts with no company profile: {len(orphan_users)}")
    for s in sorted(orphan_users):
        print(f"  - {s}")
else:
    print("All company users have matching profiles")

# ── Supplier-user linkage ──
print("\n" + "=" * 60)
print("SUPPLIER-USER LINKAGE CHECK")
print("=" * 60)
with open(DB / "suppliers" / "users.json", encoding="utf-8") as f:
    sup_users = json.load(f)

user_slugs_s = {u.get("supplier_slug") for u in sup_users}
supplier_slugs = {s.get("slug") for s in suppliers}

orphan_suppliers = supplier_slugs - user_slugs_s
orphan_sup_users = user_slugs_s - supplier_slugs - {None}

if orphan_suppliers:
    print(f"Suppliers with no user account: {len(orphan_suppliers)}")
    for s in sorted(orphan_suppliers):
        print(f"  - {s}")
else:
    print("All suppliers have matching user accounts")

if orphan_sup_users:
    print(f"User accounts with no supplier profile: {len(orphan_sup_users)}")
    for s in sorted(orphan_sup_users):
        print(f"  - {s}")
else:
    print("All supplier users have matching profiles")

# ── Missing Pakistani cities ──
print("\n" + "=" * 60)
print("MISSING MAJOR PAKISTANI CITIES")
print("=" * 60)
major_cities = [
    "Lahore", "Karachi", "Islamabad", "Rawalpindi", "Faisalabad",
    "Multan", "Peshawar", "Quetta", "Sialkot", "Gujranwala",
    "Bahawalpur", "Hyderabad", "Abbottabad", "Mardan", "Sukkur",
    "Sargodha", "Sahiwal", "Larkana", "Mirpur", "Gujrat",
    "Jhelum", "Rahim Yar Khan", "DG Khan", "Muzaffarabad"
]
covered = set(cities.keys())
missing = [c for c in major_cities if c not in covered]
print(f"Covered: {sorted(covered)}")
print(f"Missing: {missing}")
