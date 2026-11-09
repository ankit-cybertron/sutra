"""Usage metrics router."""

from fastapi import APIRouter
from apps.api.app.schemas import UsageResponse
from apps.api.app.services import get_usage_service

router = APIRouter(prefix="/api", tags=["Usage"])


@router.get("/usage", response_model=UsageResponse)
async def get_usage() -> UsageResponse:
    usage_service = get_usage_service()
    return usage_service.get_current_usage()
