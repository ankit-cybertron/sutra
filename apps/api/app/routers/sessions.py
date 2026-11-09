"""Session endpoints: Idea intake, clarifying questions, and answer submissions."""

from fastapi import APIRouter, Depends
from apps.api.app.dependencies import get_device_id, standard_rate_limiter, plan_rate_limiter
from apps.api.app.schemas import (
    CreateSessionRequest,
    CreateSessionResponse,
    GeneratePlanResponse,
    SubmitAnswersRequest,
    SubmitAnswersResponse,
)
from apps.api.app.services import get_plan_service, get_session_service

router = APIRouter(prefix="/api/sessions", tags=["Sessions"])


@router.post(
    "",
    response_model=CreateSessionResponse,
    dependencies=[Depends(standard_rate_limiter)],
)
async def create_session(
    payload: CreateSessionRequest,
    device_id: str = Depends(get_device_id),
) -> CreateSessionResponse:
    session_service = get_session_service()
    session, questions = await session_service.create_session(
        device_id=device_id,
        idea=payload.idea,
        lang=payload.lang or "auto",
        source=payload.source or "text",
    )
    return CreateSessionResponse(session_id=session.id, questions=questions)


@router.post(
    "/{session_id}/answers",
    response_model=SubmitAnswersResponse,
    dependencies=[Depends(standard_rate_limiter)],
)
async def submit_answers(
    session_id: str,
    payload: SubmitAnswersRequest,
    device_id: str = Depends(get_device_id),
) -> SubmitAnswersResponse:
    session_service = get_session_service()
    await session_service.submit_answers(
        device_id=device_id,
        session_id=session_id,
        answers=payload.answers,
    )
    return SubmitAnswersResponse(ready=True)


@router.post(
    "/{session_id}/plan",
    response_model=GeneratePlanResponse,
    dependencies=[Depends(plan_rate_limiter)],
)
async def generate_plan_from_session(
    session_id: str,
    device_id: str = Depends(get_device_id),
) -> GeneratePlanResponse:
    plan_service = get_plan_service()
    plan_doc, plan = await plan_service.generate_plan(
        device_id=device_id,
        session_id=session_id,
    )
    return GeneratePlanResponse(plan_id=plan_doc.id, plan=plan)
