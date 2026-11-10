"""Plan endpoints: Viewing, chat refinements, version history, deletion, and markdown export."""

from typing import Any, Dict
from fastapi import APIRouter, Depends, Response
from apps.api.app.dependencies import get_device_id, chat_rate_limiter, standard_rate_limiter
from apps.api.app.schemas import (
    ChatInput,
    ChatResult,
    PlanDoc,
)
from apps.api.app.services import get_plan_service

router = APIRouter(prefix="/api", tags=["Plans"])


@router.get(
    "/plans/{plan_id}",
    response_model=PlanDoc,
    response_model_by_alias=True,
)
async def get_plan(
    plan_id: str,
    device_id: str = Depends(get_device_id),
) -> PlanDoc:
    plan_service = get_plan_service()
    return await plan_service.get_plan_doc(device_id=device_id, plan_id=plan_id)


@router.post(
    "/plans/{plan_id}/chat",
    response_model=ChatResult,
    response_model_by_alias=True,
    response_model_exclude_none=True,
    dependencies=[Depends(chat_rate_limiter)],
)
async def chat_plan(
    plan_id: str,
    payload: ChatInput,
    device_id: str = Depends(get_device_id),
) -> ChatResult:
    plan_service = get_plan_service()
    return await plan_service.chat(
        device_id=device_id,
        plan_id=plan_id,
        message=payload.message,
        source=payload.source,
        lang=payload.lang,
    )


@router.delete("/plans/{plan_id}")
async def delete_plan(
    plan_id: str,
    device_id: str = Depends(get_device_id),
) -> Dict[str, Any]:
    plan_service = get_plan_service()
    deleted = await plan_service.delete_plan(device_id=device_id, plan_id=plan_id)
    return {"deleted": deleted, "id": plan_id}


@router.get("/plans/{plan_id}/export.md")
async def export_plan_markdown(
    plan_id: str,
    device_id: str = Depends(get_device_id),
) -> Response:
    plan_service = get_plan_service()
    md_content = await plan_service.export_markdown(device_id=device_id, plan_id=plan_id)
    return Response(
        content=md_content,
        media_type="text/markdown; charset=utf-8",
        headers={
            "Content-Disposition": f'attachment; filename="{plan_id}.md"',
        },
    )


@router.delete("/data")
async def delete_all_user_data(
    device_id: str = Depends(get_device_id),
) -> Dict[str, Any]:
    plan_service = get_plan_service()
    deleted_count = await plan_service.delete_all_device_data(device_id=device_id)
    return {"ok": True, "deletedCount": deleted_count}
