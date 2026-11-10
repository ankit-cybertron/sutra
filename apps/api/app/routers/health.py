"""Health check router."""

import time
from typing import Any, Dict
from fastapi import APIRouter
from apps.api.app.adapters import get_gnani_adapter, get_groq_adapter
from apps.api.app.config import settings

router = APIRouter(prefix="/api", tags=["Health"])


@router.get("/health")
async def health_check() -> Dict[str, Any]:
    groq = get_groq_adapter()
    gnani = get_gnani_adapter()
    return {
        "ok": True,
        "status": "ok",
        "app": settings.brand.name,
        "tagline": settings.brand.tagline,
        "env": settings.env,
        "mode": settings.gnani_mode,
        "groq_model": groq.model,
        "providers": {
            "groq": groq.get_status(),
            "gnani": gnani.get_status(),
        },
        "timestamp": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
    }
