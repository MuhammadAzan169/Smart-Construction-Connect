# =============================================================================
# Smart Construction Connect — BACKEND container
#
# Works both on Render (choose "Docker" as the runtime, root directory
# `backend`) and locally:
#
#     docker build -t scc-api ./backend
#     docker run --rm -p 8000:8000 --env-file backend/.env scc-api
#
# The image deliberately installs ONLY requirements.txt (no PyTorch/FAISS/OCR)
# so it stays small enough for Render's free plan. Semantic search uses the
# external embeddings API configured through EMBEDDINGS_* env vars.
# =============================================================================

FROM python:3.11.9-slim AS base

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PYTHONIOENCODING=utf-8 \
    PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1 \
    ENV=production

WORKDIR /app

# Minimal system deps: build tools for the few wheels that may need them,
# libgomp for numpy/pandas threading. Removed again in the same layer.
RUN apt-get update \
 && apt-get install -y --no-install-recommends build-essential libgomp1 curl \
 && rm -rf /var/lib/apt/lists/*

# Dependencies first — this layer is cached across code-only changes.
COPY requirements.txt ./
RUN pip install --upgrade pip \
 && pip install -r requirements.txt \
 && apt-get purge -y --auto-remove build-essential

# Application code
COPY . .

# Runtime directories (ephemeral on Render — durable data lives in Supabase)
RUN mkdir -p company_data/construction_company company_data/client \
             company_data/material_supplier uploads index_data

# Run as a non-root user
RUN useradd --create-home --uid 10001 appuser \
 && chown -R appuser:appuser /app
USER appuser

EXPOSE 8000

HEALTHCHECK --interval=30s --timeout=5s --start-period=40s --retries=3 \
  CMD curl -fsS "http://127.0.0.1:${PORT:-8000}/api/health" || exit 1

# Render injects $PORT; default to 8000 for local `docker run`.
CMD ["sh", "-c", "uvicorn app:app --host 0.0.0.0 --port ${PORT:-8000}"]
