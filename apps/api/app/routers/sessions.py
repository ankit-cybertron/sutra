"""Session endpoints: Idea intake and plan generation."""

from fastapi import APIRouter, Depends
from apps.api.app.dependencies import get_device_id, sessions_rate_limiter, plan_rate_limiter
from apps.api.app.schemas import (
    CreateSessionInput,
    CreateSessionResult,
    GeneratePlanInput,
    PlanDoc,
)
from apps.api.app.services import get_plan_service, get_session_service

router = APIRouter(prefix="/api/sessions", tags=["Sessions"])


@router.post(
    "",
    response_model=CreateSessionResult,
    response_model_by_alias=True,
    dependencies=[Depends(sessions_rate_limiter)],
)
async def create_session(
    payload: CreateSessionInput,
    device_id: str = Depends(get_device_id),
) -> CreateSessionResult:
    session_service = get_session_service()
    session_id, detected_lang, questions = await session_service.create_session(
        device_id=device_id,
        idea=payload.idea,
        lang=payload.lang or "auto",
        source=payload.source or "text",
    )
    return CreateSessionResult(
        session_id=session_id,
        detected_lang=detected_lang,
        questions=questions,
    )


@router.post(
    "/{session_id}/plan",
    response_model=PlanDoc,
    response_model_by_alias=True,
    dependencies=[Depends(plan_rate_limiter)],
)
async def generate_plan_from_session(
    session_id: str,
    payload: GeneratePlanInput = GeneratePlanInput(answers=[]),
    device_id: str = Depends(get_device_id),
) -> PlanDoc:
    plan_service = get_plan_service()
    answers = payload.answers if payload and payload.answers else []
    plan_doc = await plan_service.generate_plan(
        device_id=device_id,
        session_id=session_id,
        answers=answers,
    )
    return plan_doc
