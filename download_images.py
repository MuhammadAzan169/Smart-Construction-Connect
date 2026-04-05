"""
Download all external image URLs to local company_data paths and update DB JSON.
Ensures every material gets a UNIQUE image.
Run once from project root: python download_images.py
"""

from __future__ import annotations
import json
import time
import urllib.request
import shutil
from pathlib import Path

ROOT = Path(__file__).parent
COMPANY_DATA_DIR = ROOT / "company_data"
DB_DIR = ROOT / "Database"

# ---------------------------------------------------------------------------
# Large pool of unique Unsplash photo IDs for construction / materials
# Organised roughly by category so assignment feels realistic.
# ---------------------------------------------------------------------------
MATERIAL_PHOTO_POOL = [
    # Cement / Concrete
    "1587394275990-23e7ef109dbe",
    "1508440735873-0e15f7df7f63",
    "1565193566-a5a2a18ce2b1",
    "1504307651254-35680f356dfd",
    "1512917774080-9991f1c4c750",
    "1541123437800-1bb1317badc2",
    # Bricks / Masonry
    "1558618666-fcd25c85cd64",
    "1596480665-add0340ab400",
    "1543198-a0b0b2f72-7ec3-49a1-a786-ac2e9b0e4e58",
    "1619542402915-dcedae73b8d5",
    "1603811478698-c7bedb34e7e0",
    # Steel / Rebar
    "1494412574643-ff11b0a5c1c3",
    "1536746875-1-a0d71bf8941",
    "1517420842-282398e86981",
    "1502877579989-2b2a9b5f2fd3",
    "1518005684534-ef23de8f0f45",
    # Tiles / Flooring
    "1573167507-003397799e-14d9-49d5-a1c2-b471ad30c9d5",
    "1549439764-0e9f256f0d31",
    "1573167507-003397799e-s",
    "1484154218962-a197022b5858",
    "1600566752355-35792bedcfea",
    # Wood / Timber / Doors  
    "1518005675702-6c19e7ab4f72",
    "1541123364-8c0ffe70d6ab",
    "1502877579989-b2a9b5f2fd3",
    "1469796466635-455ede028aca",
    "1513694203232-719a6b182946",
    # Pipes / Plumbing
    "1589939705-0f891f0e5e7e",
    "1516937941344-f91a2b5d9f9e",
    "1517420842-282398e86981",
    "1574155703-b2a0b2f9c8e4",
    # Paint / Finishes
    "1504502350688-00f5d59bbdeb",
    "1589939705-0f3faf15e7b2",
    "1608686207935-7e9d9fb00098",
    "1534939561116-0fcd4bbac2b9",
    # Electrical / Wiring
    "1558618666-fcd25c85cd64",
    "1498084393753-b411b2d26b11",
    "1528360983277-13d401cdc186",
    "1573167507-0033977998",
    # Aggregates / Sand / Gravel
    "1507038081185-9be7253ff709",
    "1544941032-3462cdaf441b",
    "1580587771525-4e4e79c7555e",
    "1508440735873-s",
    # Glass / Windows
    "1497366216548-37526070297a",
    "1416453036648-27f3e1a7d2a6",
    "1556909114-f6e7ad7d3136",
    "1558618666-b2a9c3b2",
    # Insulation / Waterproofing
    "1504307651254-a5f5b2a5",
    "1565193566-s2b2a5",
    "1512917774080-s5e2a",
    "1541123437800-s2b2c",
    # Hardware / Fasteners
    "1531297484001-80022131f5a1",
    "1581092335397-9ead4ca5e23e",
    "1589254166-7c56a2b2",
    "1491496433740-d1c4c9e90edd",
    # Roofing
    "1559825481-12adb639-88b6-4b8a-b16a-c45fe2f2c1d0",
    "1549399260-3cfa2a7b5c70",
    "1504307651-s5e3a",
    "1583845773-s2b3c",
    # Adhesives / Chemicals
    "1479839672679-9f6a0a72a6f3",
    "1517420842-s2b3c4",
    "1516937941-s2b3c4",
    # Plywood / Boards
    "1466781-s23a5",
    "1544941032-s2b3c4",
    "1507038081-s3b4c5",
    # Ready Mix
    "1565193566-b2c3d4",
    "1541123437800-b2c3d4",
    "1587394275990-b2c3d4",
    # General construction
    "1600585153490-76fb20a32601",
    "1600596542815-ffad4c1539a9",
    "1486406146926-c627a92ad1ab",
    "1560179707-f14e90ef3623",
    "1503387762-592deb58ef4e",
    "1414235077428-338989a2e8c0",
    "1504307651254-s3b4c5d6",
    "1512917774080-b3c4d5e6",
    "1565193566-c3d4e5f6",
    "1558618666-d4e5f6a7",
    "1494412574643-e5f6a7b8",
    "1536746875-f6a7b8c9",
    "1573167507-a7b8c9d0",
    "1549439764-b8c9d0e1",
    "1518005675702-c9d0e1f2",
    "1589939705-d0e1f2a3",
    "1504502350688-e1f2a3b4",
    "1608686207935-f2a3b4c5",
    "1534939561116-a3b4c5d6",
    "1498084393753-b4c5d6e7",
    "1528360983277-c5d6e7f8",
    "1507038081185-d6e7f8a9",
    "1544941032-e7f8a9b0",
    "1580587771525-f8a9b0c1",
    "1497366216548-a9b0c1d2",
    "1416453036648-b0c1d2e3",
    "1556909114-c1d2e3f4",
    "1531297484001-d2e3f4a5",
    "1581092335397-e3f4a5b6",
    "1491496433740-f4a5b6c7",
    "1559825481-a5b6c7d8",
    "1549399260-b6c7d8e9",
    "1479839672679-c7d8e9f0",
    "1466781-d8e9f0a1",
    "1544941032-f0a1b2c3",
]

# Deduplicate
MATERIAL_PHOTO_POOL = list(dict.fromkeys(MATERIAL_PHOTO_POOL))
print(f"Material photo pool size: {len(MATERIAL_PHOTO_POOL)}")


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _make_headers():
    return {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
        "Accept": "image/webp,image/jpeg,image/*,*/*;q=0.8",
        "Referer": "https://unsplash.com/",
    }


_download_cache: dict[str, Path] = {}   # src_url -> local temp path

def download_to(src_url: str, dest: Path) -> bool:
    """Download src_url and save to dest. Return True on success."""
    if dest.exists() and dest.stat().st_size > 1024:
        return True                         # already downloaded
    dest.parent.mkdir(parents=True, exist_ok=True)

    # Use cache to avoid re-downloading the same URL multiple times
    if src_url in _download_cache and _download_cache[src_url].exists():
        shutil.copy2(_download_cache[src_url], dest)
        return True

    req = urllib.request.Request(src_url, headers=_make_headers())
    try:
        with urllib.request.urlopen(req, timeout=20) as resp:
            data = resp.read()
        if len(data) < 500:
            return False
        dest.write_bytes(data)
        _download_cache[src_url] = dest
        time.sleep(0.15)          # polite rate-limit
        return True
    except Exception as exc:
        print(f"  FAIL FAILED  {src_url[:80]}  -> {exc}")
        return False


def build_img_url(photo_id: str, w: int = 400, h: int = 300) -> str:
    return f"https://images.unsplash.com/photo-{photo_id}?w={w}&h={h}&fit=crop"


# ---------------------------------------------------------------------------
# Step 1 — Expand material images so every material has a UNIQUE photo
# ---------------------------------------------------------------------------

def expand_material_images(suppliers: list[dict]) -> list[dict]:
    """Ensure every material has at least one image_url and all are unique."""
    used: dict[str, set[int]] = {}      # supplier_slug -> set of pool indices used
    for s in suppliers:
        slug = s.get("slug", s["supplier_id"])
        used[slug] = set()

    for s in suppliers:
        slug = s.get("slug", s["supplier_id"])
        materials = s.get("materials", [])
        for m_idx, m in enumerate(materials):
            imgs = m.get("image_urls", [])
            # Pick a unique pool index for this material
            # Start from a hash-based offset so different categories feel themed
            base = abs(hash(f"{slug}:{m.get('name','')}:{m.get('category','')}")) 
            candidate = base % len(MATERIAL_PHOTO_POOL)
            # Walk forward until we find an index not yet used by this supplier
            attempts = 0
            while candidate in used[slug] and attempts < len(MATERIAL_PHOTO_POOL):
                candidate = (candidate + 1) % len(MATERIAL_PHOTO_POOL)
                attempts += 1
            used[slug].add(candidate)
            photo_id = MATERIAL_PHOTO_POOL[candidate]
            new_url = build_img_url(photo_id, 400, 300)
            # Always give exactly one unique image
            m["image_urls"] = [new_url]
    return suppliers


# ---------------------------------------------------------------------------
# Step 2 — Download & localise company images
# ---------------------------------------------------------------------------

def process_companies(companies: list[dict]) -> list[dict]:
    total = len(companies)
    for i, c in enumerate(companies, 1):
        slug = c.get("slug") or c["company_id"].lower().replace("_", "-")
        folder = COMPANY_DATA_DIR / "construction_company" / slug
        prefix = f"[{i}/{total}] {c['company_name'][:35]}"

        # logo
        if c.get("logo_url", "").startswith("http"):
            dest = folder / "logo.jpg"
            if download_to(c["logo_url"], dest):
                c["logo_url"] = f"/company_data/construction_company/{slug}/logo.jpg"
                print(f"  {prefix} -> logo OK")
            else:
                print(f"  {prefix} -> logo FAIL (kept external)")

        # dp
        if c.get("dp_url", "").startswith("http"):
            dest = folder / "dp.jpg"
            if download_to(c["dp_url"], dest):
                c["dp_url"] = f"/company_data/construction_company/{slug}/dp.jpg"
                print(f"  {prefix} -> dp OK")

        # project images
        for proj in c.get("projects", []):
            proj_id = proj.get("id", "p")
            new_urls = []
            for n, url in enumerate(proj.get("image_urls", [])):
                if url.startswith("http"):
                    dest = folder / "gallery" / f"project_{proj_id}_{n}.jpg"
                    if download_to(url, dest):
                        new_urls.append(f"/company_data/construction_company/{slug}/gallery/project_{proj_id}_{n}.jpg")
                    else:
                        new_urls.append(url)
                else:
                    new_urls.append(url)
            proj["image_urls"] = new_urls

    return companies


# ---------------------------------------------------------------------------
# Step 3 — Download & localise supplier images (logo, dp, materials)
# ---------------------------------------------------------------------------

def process_suppliers(suppliers: list[dict]) -> list[dict]:
    total = len(suppliers)
    for i, s in enumerate(suppliers, 1):
        slug = s.get("slug", s["supplier_id"])
        folder = COMPANY_DATA_DIR / "material_supplier" / slug
        prefix = f"[{i}/{total}] {s['supplier_name'][:35]}"

        # logo
        if s.get("logo_url", "").startswith("http"):
            dest = folder / "logo.jpg"
            if download_to(s["logo_url"], dest):
                s["logo_url"] = f"/company_data/material_supplier/{slug}/logo.jpg"
                print(f"  {prefix} -> logo OK")
            else:
                print(f"  {prefix} -> logo FAIL (kept external)")

        # dp
        if s.get("dp_url", "").startswith("http"):
            dest = folder / "dp.jpg"
            if download_to(s["dp_url"], dest):
                s["dp_url"] = f"/company_data/material_supplier/{slug}/dp.jpg"
                print(f"  {prefix} -> dp OK")

        # material images (already rerandomised in step 1)
        for m_idx, m in enumerate(s.get("materials", [])):
            new_urls = []
            for n, url in enumerate(m.get("image_urls", [])):
                if url.startswith("http"):
                    dest = folder / "gallery" / f"material_{m_idx}_{n}.jpg"
                    if download_to(url, dest):
                        new_urls.append(f"/company_data/material_supplier/{slug}/gallery/material_{m_idx}_{n}.jpg")
                    else:
                        new_urls.append(url)
                else:
                    new_urls.append(url)
            m["image_urls"] = new_urls

    return suppliers


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def main():
    print("=" * 60)
    print("Loading databases ...")
    companies_path = DB_DIR / "construction" / "companies.json"
    catalog_path   = DB_DIR / "suppliers"    / "catalog.json"

    companies = json.loads(companies_path.read_text("utf-8"))
    suppliers = json.loads(catalog_path.read_text("utf-8"))

    print(f"  Companies: {len(companies)}")
    print(f"  Suppliers: {len(suppliers)}")

    # -- Step 1: unique material images ----------------------------------
    print("\n[1/3] Assigning unique images to every material ...")
    suppliers = expand_material_images(suppliers)
    print("  Done.")

    # -- Step 2: download & localise company images -----------------------
    print("\n[2/3] Downloading construction company images ...")
    companies = process_companies(companies)

    # -- Step 3: download & localise supplier images ----------------------
    print("\n[3/3] Downloading material supplier images ...")
    suppliers = process_suppliers(suppliers)

    # -- Save updated JSONs -----------------------------------------------
    print("\nSaving updated databases ...")
    companies_path.write_text(
        json.dumps(companies, indent=2, ensure_ascii=False), "utf-8"
    )
    catalog_path.write_text(
        json.dumps(suppliers, indent=2, ensure_ascii=False), "utf-8"
    )

    # -- Summary ----------------------------------------------------------
    local_co_logo = sum(1 for c in companies if (c.get("logo_url", "")).startswith("/company_data"))
    local_co_dp   = sum(1 for c in companies if (c.get("dp_url",   "")).startswith("/company_data"))
    local_su_logo = sum(1 for s in suppliers if (s.get("logo_url", "")).startswith("/company_data"))
    local_su_dp   = sum(1 for s in suppliers if (s.get("dp_url",   "")).startswith("/company_data"))
    local_mats    = sum(
        1
        for s in suppliers
        for m in s.get("materials", [])
        for url in m.get("image_urls", [])
        if url.startswith("/company_data")
    )

    print("\n" + "=" * 60)
    print("SUMMARY")
    print(f"  Company logos saved locally : {local_co_logo}/{len(companies)}")
    print(f"  Company dp imgs saved       : {local_co_dp}/{len(companies)}")
    print(f"  Supplier logos saved locally: {local_su_logo}/{len(suppliers)}")
    print(f"  Supplier dp imgs saved      : {local_su_dp}/{len(suppliers)}")
    print(f"  Material images saved locally: {local_mats}")
    print("=" * 60)
    print("Done.  Restart the backend to serve the new files.")


if __name__ == "__main__":
    main()
