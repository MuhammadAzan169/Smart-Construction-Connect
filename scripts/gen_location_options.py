"""Generate Frontend/src/data/locationOptions.ts from Database/construction/companies.json"""
import json
from pathlib import Path
from collections import defaultdict

companies = json.loads(Path("Database/construction/companies.json").read_text(encoding="utf-8"))

cities = set()
sbc = defaultdict(set)

for c in companies:
    op = c.get("operational_areas", {})
    for city, areas in op.items():
        cities.add(city)
        if isinstance(areas, dict):
            for area in areas.keys():
                sbc[city].add(area)

cities_list = sorted(cities)
lines = ["// Auto-generated from Database/construction/companies.json\n"]
lines.append("export const cities = [")
for c in cities_list:
    lines.append(f'  "{c}",')
lines.append("] as const;\n")
lines.append("export const societiesByCity: Record<string, string[]> = {")
for c in cities_list:
    socs = sorted(sbc[c])
    lines.append(f'  "{c}": [')
    for s in socs:
        lines.append(f'    "{s}",')
    lines.append("  ],")
lines.append("};\n")

Path("Frontend/src/data/locationOptions.ts").write_text("\n".join(lines), encoding="utf-8")
print(f"Generated with {len(cities_list)} cities, {sum(len(v) for v in sbc.values())} societies")
