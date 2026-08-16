"""Binary file storage abstraction — Supabase Storage in prod, local disk in dev.

Profile images, verification documents, gallery images and message attachments
are binary blobs that cannot live in the Postgres document store and cannot
survive on Render's ephemeral disk. They go to Supabase Storage instead.

Activation
──────────
* If ``SUPABASE_URL`` + ``SUPABASE_SERVICE_ROLE_KEY`` are set → uploads go to a
  Supabase Storage bucket and the returned URL is the public CDN URL.
* Otherwise → files are written under the repo root exactly as before and the
  returned URL is the relative path (``/company_data/...`` or ``/uploads/...``)
  served by the FastAPI StaticFiles mounts. This keeps local dev unchanged.

All paths passed in here are already sanitised by the caller (upload.py), so
they contain no ``..`` traversal.
"""

from __future__ import annotations

import logging
from pathlib import Path

import httpx

logger = logging.getLogger(__name__)

# Repo root = two levels up from backend/utils/
_REPO_ROOT = Path(__file__).resolve().parents[2]


def _cfg():
    from backend.config import (
        SUPABASE_URL,
        SUPABASE_SERVICE_ROLE_KEY,
        SUPABASE_BUCKET,
    )
    return SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, SUPABASE_BUCKET


def is_remote() -> bool:
    url, key, _ = _cfg()
    return bool(url and key)


def save_bytes(rel_path: str, data: bytes, content_type: str = "application/octet-stream") -> str:
    """Persist *data* at *rel_path* and return a URL that can serve it.

    ``rel_path`` is a posix path without a leading slash, e.g.
    ``company_data/construction_company/acme/profile.jpg`` or
    ``uploads/user-at-x/convo123/file_ab12.pdf``.
    """
    rel_path = rel_path.lstrip("/")

    if is_remote():
        url, key, bucket = _cfg()
        endpoint = f"{url}/storage/v1/object/{bucket}/{rel_path}"
        resp = httpx.post(
            endpoint,
            headers={
                "Authorization": f"Bearer {key}",
                "Content-Type": content_type,
                "x-upsert": "true",
            },
            content=data,
            timeout=60.0,
        )
        if resp.status_code not in (200, 201):
            logger.error("Supabase upload failed (%s): %s", resp.status_code, resp.text[:300])
            raise RuntimeError(f"Storage upload failed: HTTP {resp.status_code}")
        # Public URL (bucket must be public, or swap for a signed URL if private)
        return f"{url}/storage/v1/object/public/{bucket}/{rel_path}"

    # ── Local disk fallback ──
    dest = _REPO_ROOT / rel_path
    dest.parent.mkdir(parents=True, exist_ok=True)
    dest.write_bytes(data)
    return f"/{rel_path}"


def delete_by_url(url: str) -> bool:
    """Delete a file previously returned by ``save_bytes``. Best-effort."""
    if not url:
        return False

    sb_url, key, bucket = _cfg()

    # Remote Supabase public URL
    marker = f"/storage/v1/object/public/{bucket}/"
    if sb_url and key and marker in url:
        rel_path = url.split(marker, 1)[1]
        endpoint = f"{sb_url}/storage/v1/object/{bucket}/{rel_path}"
        try:
            resp = httpx.request(
                "DELETE",
                endpoint,
                headers={"Authorization": f"Bearer {key}"},
                timeout=30.0,
            )
            return resp.status_code in (200, 204)
        except Exception as exc:
            logger.warning("Supabase delete failed for %s: %s", url, exc)
            return False

    # Local file (relative URL like /uploads/...)
    if url.startswith("/"):
        p = _REPO_ROOT / url.lstrip("/")
        try:
            if p.exists() and p.resolve().is_relative_to(_REPO_ROOT.resolve()):
                p.unlink()
                return True
        except Exception as exc:
            logger.warning("Local delete failed for %s: %s", url, exc)
    return False
