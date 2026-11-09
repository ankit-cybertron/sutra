"""Plan endpoints: Viewing, refining, version history, deletion, and markdown export."""

from typing import Any, Dict
from fastapi import APIRouter, Depends, Response
from apps.api.app.dependencies import get_device_id, plan_rate_limiter, standard_rate_limiter
from apps.api.app.schemas import (
    PlanDetailResponse,
    PlanListResponse,
    RefinePlanRequest,
    RefinePlanResponse,
)
from apps.api.app.services import get_plan_service

router = APIRouter(prefix="/api", tags=["Plans"])


@router.get("/plans", response_model=PlanListResponse)
async def list_plans(
    device_id: str = Depends(get_device_id),
) -> PlanListResponse:
    plan_service = get_plan_service()
    plans = await plan_service.list_plans(device_id=device_id)
    return PlanListResponse(plans=plans)


@router.get("/plans/{plan_id}", response_model=PlanDetailResponse)
async def get_plan(
    plan_id: str,
    device_id: str = Depends(get_device_id),
) -> PlanDetailResponse:
    plan_service = get_plan_service()
    plan_doc = await plan_service.get_plan(device_id=device_id, plan_id=plan_id)
    current_version_obj = plan_doc.versions[-1]

    return PlanDetailResponse(
        id=plan_doc.id,
        device_id=plan_doc.device_id,
        session_id=plan_doc.session_id,
        title=plan_doc.title,
        versions=plan_doc.versions,
        current_version=current_version_obj.n,
        plan=current_version_obj.plan,
        created_at=plan_doc.created_at,
        updated_at=plan_doc.updated_at,
    )


@router.post(
    "/plans/{plan_id}/refine",
    response_model=RefinePlanResponse,
    dependencies=[Depends(plan_rate_limiter)],
)
async def refine_plan(
    plan_id: str,
    payload: RefinePlanRequest,
    device_id: str = Depends(get_device_id),
) -> RefinePlanResponse:
    plan_service = get_plan_service()
    _, version_num, plan, change_summary = await plan_service.refine_plan(
        device_id=device_id,
        plan_id=plan_id,
        suggestion=payload.suggestion,
        source=payload.source or "text",
    )
    return RefinePlanResponse(
        version=version_num,
        plan=plan,
        change_summary=change_summary,
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
    """Delete all sessions and plans associated with requesting device."""
    plan_service = get_plan_service()
    result = await plan_service.delete_all_user_data(device_id=device_id)
    return {
        "status": "ok",
        "message": "All device data successfully deleted.",
        **result,
    }
