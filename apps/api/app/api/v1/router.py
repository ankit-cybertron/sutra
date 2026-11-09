from fastapi import APIRouter

from app.api.v1.audio import router as audio_router
from app.api.v1.projects import router as projects_router
from app.api.v1.sessions import router as sessions_router

api_v1_router = APIRouter()

api_v1_router.include_router(projects_router)
api_v1_router.include_router(sessions_router)
api_v1_router.include_router(audio_router)


@api_v1_router.get("/ping")
async def ping() -> dict[str, str]:
    return {"message": "pong"}
