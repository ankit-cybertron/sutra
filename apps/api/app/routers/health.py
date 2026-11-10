"""Health check router."""

import time
from typing import Any, Dict
from fastapi import APIRouter
from apps.api.app.config import settings

router = APIRouter(prefix="/api", tags=["Health"])


@router.get("/health")
async def health_check() -> Dict[str, Any]:
    return {
        "ok": True,
        "status": "ok",
        "app": settings.brand.name,
        "tagline": settings.brand.tagline,
        "env": settings.env,
        "mode": settings.gnani_mode,
        "groq_model": settings.groq_model,
        "timestamp": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
    }
