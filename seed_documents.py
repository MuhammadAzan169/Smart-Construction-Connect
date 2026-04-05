"""
Seed script — generates fake verification documents (PDFs) and assigns
unique profile photos / display-picture URLs for every company and supplier.

Run once:  python seed_documents.py
"""

from __future__ import annotations

import json
import os
import random
import re
import textwrap
from pathlib import Path

ROOT = Path(__file__).resolve().parent
COMPANY_DATA = ROOT / "company_data"
DB = ROOT / "Database"

COMPANIES_JSON = DB / "construction" / "companies.json"
SUPPLIERS_JSON = DB / "suppliers" / "catalog.json"

# ─── Unique Unsplash photos ───
# Construction-themed display pictures (dp) — one per company
_COMPANY_DP_PHOTOS = [
    "photo-1486406146926-c627a92ad1ab",
    "photo-1541976590-713941681591",
    "photo-1504307651254-35680f356dfd",
    "photo-1503387762-592deb58ef4e",
    "photo-1590846083693-f23fdede3a7e",
    "photo-1581094794329-c8112a89af12",
    "photo-1503387762-592deb58ef4e",
    "photo-1479839672679-a46483c0e7c8",
    "photo-1517089596392-fb9a9033e05b",
    "photo-1600585154340-be6161a56a0c",
    "photo-1600596542815-ffad4c1539a9",
    "photo-1600607687939-ce8a6c25118c",
    "photo-1600566753190-17f0baa2a6c3",
    "photo-1512917774080-9991f1c4c750",
    "photo-1560518883-ce09059eeffa",
    "photo-1565953522043-baea692e5e77",
    "photo-1507089947368-19c1da9775ae",
    "photo-1455587734955-081b22074882",
    "photo-1628744448840-55bdb2497bd4",
    "photo-1582268611958-ebfd161ef9cf",
    "photo-1621905252507-b35492cc74b4",
    "photo-1600573472550-8090b5e0745e",
    "photo-1593604340846-4fbe9763a8f3",
    "photo-1600047509807-ba8f99d2cdde",
    "photo-1600566753086-00f18fb6b3ea",
    "photo-1600585153490-76fb20a32601",
    "photo-1600607687644-c7171b42498f",
    "photo-1600563438938-a9a27216b4f5",
    "photo-1613490493576-7fde63acd811",
    "photo-1613977257363-707ba9348227",
    "photo-1605276374104-dee2a0ed3cd6",
    "photo-1600210491736-f7f8e0ed1a33",
    "photo-1600210492493-0946911123ea",
    "photo-1574362848149-11496d93a7c7",
    "photo-1600566752355-35792bedcfea",
    "photo-1600607688969-a5bfcd646154",
    "photo-1600585154526-990dced4db0d",
    "photo-1600047508788-786f3865b4b9",
    "photo-1560184897-ae75f418493e",
    "photo-1560448204-e02f11c3d0e2",
    "photo-1497366754035-f200968a6e72",
    "photo-1497366811353-6870744d04b2",
    "photo-1497366216548-37526070297c",
    "photo-1486325212027-8081e485255e",
    "photo-1545324418-cc1a3fa10c00",
    "photo-1600596542815-ffad4c1539a9",
    "photo-1460472178825-e5240623afd5",
    "photo-1416331108676-a22ccb276e35",
    "photo-1467803738586-46b7eb7b16a1",
    "photo-1531834685032-c34bf0d84c77",
    "photo-1487958449943-2429e8be8625",
    "photo-1488972685288-c3fd157d7c7a",
    "photo-1549407035-53e3eaa31f28",
    "photo-1554469384-e58fac16e23a",
    "photo-1515263487990-61b07816b324",
    "photo-1527192491265-7e15c55b1ed2",
    "photo-1594398901394-4e34939a4fd0",
    "photo-1577495508326-19a1b3cf65b7",
    "photo-1587582423116-ec07293f0395",
    "photo-1574362848149-11496d93a7c7",
    "photo-1600585153490-76fb20a32601",
    "photo-1600047509807-ba8f99d2cdde",
    "photo-1600566752355-35792bedcfea",
    "photo-1512917774080-9991f1c4c750",
    "photo-1560518883-ce09059eeffa",
    "photo-1600573472550-8090b5e0745e",
    "photo-1593604340846-4fbe9763a8f3",
    "photo-1605276374104-dee2a0ed3cd6",
    "photo-1600607688969-a5bfcd646154",
    "photo-1600585154526-990dced4db0d",
    "photo-1497366216548-37526070297c",
    "photo-1497366754035-f200968a6e72",
    "photo-1497366811353-6870744d04b2",
    "photo-1600047508788-786f3865b4b9",
    "photo-1560184897-ae75f418493e",
    "photo-1560448204-e02f11c3d0e2",
    "photo-1541976590-713941681591",
    "photo-1504307651254-35680f356dfd",
    "photo-1503387762-592deb58ef4e",
    "photo-1590846083693-f23fdede3a7e",
    "photo-1581094794329-c8112a89af12",
    "photo-1479839672679-a46483c0e7c8",
    "photo-1517089596392-fb9a9033e05b",
    "photo-1600585154340-be6161a56a0c",
    "photo-1600596542815-ffad4c1539a9",
    "photo-1600607687939-ce8a6c25118c",
    "photo-1600566753190-17f0baa2a6c3",
    "photo-1455587734955-081b22074882",
    "photo-1628744448840-55bdb2497bd4",
    "photo-1582268611958-ebfd161ef9cf",
    "photo-1621905252507-b35492cc74b4",
    "photo-1613490493576-7fde63acd811",
    "photo-1613977257363-707ba9348227",
    "photo-1600210491736-f7f8e0ed1a33",
    "photo-1600210492493-0946911123ea",
    "photo-1565953522043-baea692e5e77",
    "photo-1507089947368-19c1da9775ae",
    "photo-1545324418-cc1a3fa10c00",
    "photo-1460472178825-e5240623afd5",
    "photo-1416331108676-a22ccb276e35",
    "photo-1467803738586-46b7eb7b16a1",
]

# Company logos — building / corporate themed
_COMPANY_LOGO_PHOTOS = [
    "photo-1560179707-f14e90ef3623",
    "photo-1497366216548-37526070297c",
    "photo-1560520653-9e0e4c89eb11",
    "photo-1486406146926-c627a92ad1ab",
    "photo-1460317442991-0ec209397118",
    "photo-1498409785966-ab341407de6e",
    "photo-1582653291997-079a1c04e5a1",
    "photo-1600880292089-90a7e086ee0c",
    "photo-1600585154526-990dced4db0d",
    "photo-1600596542815-ffad4c1539a9",
    "photo-1600607687939-ce8a6c25118c",
    "photo-1600210491736-f7f8e0ed1a33",
    "photo-1554469384-e58fac16e23a",
    "photo-1599707367812-457c7eb76346",
    "photo-1504307651254-35680f356dfd",
    "photo-1503387762-592deb58ef4e",
    "photo-1515263487990-61b07816b324",
    "photo-1531834685032-c34bf0d84c77",
    "photo-1487958449943-2429e8be8625",
    "photo-1488972685288-c3fd157d7c7a",
]

# Supplier-specific dp / logo photos — warehouses, materials
_SUPPLIER_DP_PHOTOS = [
    "photo-1504307651254-35680f356dfd",
    "photo-1558618666-fcd25c85f82e",
    "photo-1586528116311-ad8dd3c8310d",
    "photo-1621905251189-08b45d6a269e",
    "photo-1600585154340-be6161a56a0c",
    "photo-1580913428023-02c695666d61",
    "photo-1504307651254-35680f356dfd",
    "photo-1558618666-fcd25c85f82e",
    "photo-1586528116311-ad8dd3c8310d",
    "photo-1504307651254-35680f356dfd",
    "photo-1621905251189-08b45d6a269e",
    "photo-1580913428023-02c695666d61",
    "photo-1558618666-fcd25c85f82e",
    "photo-1586528116311-ad8dd3c8310d",
    "photo-1621905251189-08b45d6a269e",
    "photo-1600585154340-be6161a56a0c",
    "photo-1504307651254-35680f356dfd",
    "photo-1580913428023-02c695666d61",
    "photo-1558618666-fcd25c85f82e",
    "photo-1586528116311-ad8dd3c8310d",
    "photo-1621905251189-08b45d6a269e",
    "photo-1600585154340-be6161a56a0c",
    "photo-1580913428023-02c695666d61",
    "photo-1558618666-fcd25c85f82e",
]

_SUPPLIER_LOGO_PHOTOS = [
    "photo-1504307651254-35680f356dfd",
    "photo-1580913428023-02c695666d61",
    "photo-1558618666-fcd25c85f82e",
    "photo-1586528116311-ad8dd3c8310d",
    "photo-1621905251189-08b45d6a269e",
    "photo-1600585154340-be6161a56a0c",
    "photo-1504307651254-35680f356dfd",
    "photo-1558618666-fcd25c85f82e",
    "photo-1580913428023-02c695666d61",
    "photo-1586528116311-ad8dd3c8310d",
    "photo-1621905251189-08b45d6a269e",
    "photo-1600585154340-be6161a56a0c",
    "photo-1504307651254-35680f356dfd",
    "photo-1558618666-fcd25c85f82e",
    "photo-1580913428023-02c695666d61",
    "photo-1586528116311-ad8dd3c8310d",
    "photo-1621905251189-08b45d6a269e",
    "photo-1600585154340-be6161a56a0c",
    "photo-1504307651254-35680f356dfd",
    "photo-1558618666-fcd25c85f82e",
    "photo-1580913428023-02c695666d61",
    "photo-1586528116311-ad8dd3c8310d",
    "photo-1621905251189-08b45d6a269e",
    "photo-1600585154340-be6161a56a0c",
]


def _unsplash(photo_id: str, w: int = 800, h: int = 600) -> str:
    return f"https://images.unsplash.com/{photo_id}?w={w}&h={h}&fit=crop"


def _safe_folder_name(name: str) -> str:
    name = name.strip().lower()
    name = re.sub(r"[^a-z0-9_-]", "-", name)
    name = re.sub(r"-+", "-", name).strip("-")
    return name[:60] or "unknown"


# ─── Minimal PDF generator (no external dependencies) ───

def _create_pdf(title: str, body_lines: list[str]) -> bytes:
    """Create a very simple, valid single-page PDF with the given text."""
    # We build a bare-bones PDF 1.4 manually
    lines = [title, ""] + body_lines

    # Build the text stream
    text_ops = ["BT", "/F1 14 Tf", "50 750 Td", "16 TL"]
    for line in lines:
        # Escape PDF special chars; strip non-latin-1 chars
        safe = line.encode("latin-1", errors="replace").decode("latin-1")
        safe = safe.replace("\\", "\\\\").replace("(", "\\(").replace(")", "\\)")
        text_ops.append(f"({safe}) '")
    text_ops.append("ET")
    stream_content = "\n".join(text_ops)
    stream_bytes = stream_content.encode("latin-1")

    objects: list[str] = []

    # 1 — Catalog
    objects.append("1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj")
    # 2 — Pages
    objects.append("2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj")
    # 3 — Page
    objects.append(
        "3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792]\n"
        "   /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>\nendobj"
    )
    # 4 — Stream
    objects.append(
        f"4 0 obj\n<< /Length {len(stream_bytes)} >>\nstream\n"
        f"{stream_content}\nendstream\nendobj"
    )
    # 5 — Font
    objects.append(
        "5 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj"
    )

    # Assemble
    pdf = "%PDF-1.4\n"
    offsets: list[int] = []
    for obj in objects:
        offsets.append(len(pdf.encode("latin-1")))
        pdf += obj + "\n"

    xref_offset = len(pdf.encode("latin-1"))
    pdf += f"xref\n0 {len(objects) + 1}\n"
    pdf += "0000000000 65535 f \n"
    for off in offsets:
        pdf += f"{off:010d} 00000 n \n"
    pdf += f"trailer\n<< /Size {len(objects) + 1} /Root 1 0 R >>\n"
    pdf += f"startxref\n{xref_offset}\n%%EOF\n"

    return pdf.encode("latin-1")


# Document specs for companies
COMPANY_DOC_TYPES = {
    "secp_certificate": "SECP Registration Certificate",
    "ntn_certificate": "NTN Tax Registration Certificate",
    "registration_certificate": "Company Registration Certificate",
}

SUPPLIER_DOC_TYPES = {
    "secp_certificate": "SECP Registration Certificate",
    "ntn_certificate": "NTN Tax Registration Certificate",
    "business_license": "Business License Certificate",
}


def _generate_company_docs(company: dict, idx: int) -> dict[str, str]:
    """Generate fake PDF docs for a company, return {doc_type_url: served_url}."""
    slug = company["slug"]
    name = company["company_name"]
    city = company.get("city", "Pakistan")
    ntn = company.get("legal_info", {}).get("ntn", f"NTN-{random.randint(1000000, 9999999)}")
    year = company.get("legal_info", {}).get("year_established", 2020)
    safe = _safe_folder_name(slug)
    folder = COMPANY_DATA / "construction_company" / safe / "documents"
    folder.mkdir(parents=True, exist_ok=True)

    urls: dict[str, str] = {}

    for doc_type, label in COMPANY_DOC_TYPES.items():
        body = [
            f"Certificate Type: {label}",
            f"Issued To: {name}",
            f"Registration City: {city}",
            f"NTN Number: {ntn}",
            f"Year Established: {year}",
            f"Certificate No: {doc_type.upper()}-{idx:04d}-{random.randint(1000, 9999)}",
            "",
            "This is a computer-generated document for demonstration purposes.",
            f"Issued by: Government of Pakistan - {city} Division",
            f"Date of Issue: {random.randint(1, 28)}/{random.randint(1, 12)}/{year}",
            "",
            "VERIFIED — This certificate is valid and has been cross-referenced",
            f"with the {label.split()[0]} database records.",
        ]
        pdf_bytes = _create_pdf(label, body)
        dest = folder / f"{doc_type}.pdf"
        dest.write_bytes(pdf_bytes)
        urls[f"{doc_type}_url"] = f"/company_data/construction_company/{safe}/documents/{doc_type}.pdf"

    return urls


def _generate_supplier_docs(supplier: dict, idx: int) -> dict[str, str]:
    """Generate fake PDF docs for a supplier."""
    slug = supplier["slug"]
    name = supplier["supplier_name"]
    city = supplier.get("city", "Pakistan")
    safe = _safe_folder_name(slug)
    folder = COMPANY_DATA / "material_supplier" / safe / "documents"
    folder.mkdir(parents=True, exist_ok=True)

    urls: dict[str, str] = {}

    for doc_type, label in SUPPLIER_DOC_TYPES.items():
        body = [
            f"Certificate Type: {label}",
            f"Issued To: {name}",
            f"City: {city}",
            f"Certificate No: {doc_type.upper()}-MS-{idx:04d}-{random.randint(1000, 9999)}",
            "",
            "This is a computer-generated document for demonstration purposes.",
            f"Issued by: Government of Pakistan",
            f"Date of Issue: {random.randint(1, 28)}/{random.randint(1, 12)}/2024",
            "",
            "VERIFIED — This certificate is valid.",
        ]
        pdf_bytes = _create_pdf(label, body)
        dest = folder / f"{doc_type}.pdf"
        dest.write_bytes(pdf_bytes)
        urls[f"{doc_type}_url"] = f"/company_data/material_supplier/{safe}/documents/{doc_type}.pdf"

    return urls


def main():
    random.seed(42)  # Reproducible

    # ── Companies ──
    print("Loading companies…")
    companies: list[dict] = json.loads(COMPANIES_JSON.read_text(encoding="utf-8"))
    print(f"  Found {len(companies)} companies.")

    for i, c in enumerate(companies):
        slug = c.get("slug", "")
        vs = c.get("verification_status", "not_submitted")

        # Assign unique dp_url and logo_url
        dp_photo = _COMPANY_DP_PHOTOS[i % len(_COMPANY_DP_PHOTOS)]
        logo_photo = _COMPANY_LOGO_PHOTOS[i % len(_COMPANY_LOGO_PHOTOS)]
        c["dp_url"] = _unsplash(dp_photo, 1200, 600)
        c["logo_url"] = _unsplash(logo_photo, 200, 200)

        # Generate documents for verified + pending companies
        if vs in ("verified", "pending"):
            doc_urls = _generate_company_docs(c, i)
            c["verification_documents"] = doc_urls

            # For verified companies, mark all docs as approved in verification
            if vs == "verified":
                verification: dict = c.get("verification", {})
                for key in COMPANY_DOC_TYPES:
                    verification[key] = {"status": "approved", "notes": "Auto-verified during seed."}
                c["verification"] = verification
            elif vs == "pending":
                verification = c.get("verification", {})
                for key in COMPANY_DOC_TYPES:
                    if key not in verification:
                        verification[key] = {"status": "pending", "notes": ""}
                c["verification"] = verification

            print(f"  ✓ {slug} ({vs}) — {len(doc_urls)} docs generated")
        else:
            print(f"  – {slug} ({vs}) — skipped (not_submitted)")

    COMPANIES_JSON.write_text(json.dumps(companies, indent=2, ensure_ascii=False), encoding="utf-8")
    print(f"  Saved {COMPANIES_JSON}")

    # ── Suppliers ──
    print("\nLoading suppliers…")
    suppliers: list[dict] = json.loads(SUPPLIERS_JSON.read_text(encoding="utf-8"))
    print(f"  Found {len(suppliers)} suppliers.")

    # Mark ~60% of suppliers as verified with docs, rest as pending with docs
    for i, s in enumerate(suppliers):
        slug = s.get("slug", "")

        # Assign unique dp_url and logo_url
        dp_photo = _SUPPLIER_DP_PHOTOS[i % len(_SUPPLIER_DP_PHOTOS)]
        logo_photo = _SUPPLIER_LOGO_PHOTOS[i % len(_SUPPLIER_LOGO_PHOTOS)]
        s["dp_url"] = _unsplash(dp_photo, 1200, 600)
        s["logo_url"] = _unsplash(logo_photo, 200, 200)

        # Give documents to all suppliers
        doc_urls = _generate_supplier_docs(s, i)
        s["verification_documents"] = doc_urls

        # ~60% verified, ~40% pending
        if i % 5 < 3:
            s["verification_status"] = "verified"
            verification: dict = {}
            for key in SUPPLIER_DOC_TYPES:
                verification[key] = {"status": "approved", "notes": "Auto-verified during seed."}
            s["verification"] = verification
        else:
            s["verification_status"] = "pending"
            verification = {}
            for key in SUPPLIER_DOC_TYPES:
                verification[key] = {"status": "pending", "notes": ""}
            s["verification"] = verification

        print(f"  ✓ {slug} — {s['verification_status']}")

    SUPPLIERS_JSON.write_text(json.dumps(suppliers, indent=2, ensure_ascii=False), encoding="utf-8")
    print(f"  Saved {SUPPLIERS_JSON}")

    print("\n✅ Done! Documents and photos seeded successfully.")


if __name__ == "__main__":
    main()
