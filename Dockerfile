# syntax=docker/dockerfile:1
FROM python:3.11-slim

WORKDIR /app

ENV PYTHONUNBUFFERED=1 \
    PORT=8000 \
    DATA_DIR=data \
    TTS_CACHE_DIR=data/tts-cache

# Install system dependencies (curl for healthcheck)
RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Install python backend dependencies
COPY apps/api/pyproject.toml ./apps/api/
RUN pip install --no-cache-dir ./apps/api

# Copy backend code and web dist assets
COPY apps/api/ /app/apps/api/
COPY apps/web/ /app/apps/web/

# Create data directories for JSON storage and TTS audio cache
RUN mkdir -p /app/data/sessions /app/data/plans /app/data/tts-cache

EXPOSE 8000

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD curl -f http://localhost:8000/api/health || exit 1

CMD ["uvicorn", "apps.api.app.main:app", "--host", "0.0.0.0", "--port", "8000"]
