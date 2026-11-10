"""Voice router: Text-to-Speech, REST Speech-to-Text, and Realtime STT WebSocket relay."""

from typing import Optional
from fastapi import (
    APIRouter,
    Depends,
    File,
    Query,
    Response,
    UploadFile,
    WebSocket,
    WebSocketDisconnect,
)
from apps.api.app.config import settings
from apps.api.app.dependencies import get_device_id, tts_rate_limiter
from apps.api.app.guardrails import validate_input
from apps.api.app.schemas import TTSInput
from apps.api.app.services import get_voice_service

router = APIRouter(tags=["Voice"])


@router.post(
    "/api/tts",
    dependencies=[Depends(tts_rate_limiter)],
)
async def text_to_speech(
    payload: TTSInput,
) -> Response:
    clean_text = validate_input(payload.text, max_chars=240, field_name="TTS text")
    voice_service = get_voice_service()
    audio_bytes, media_type = await voice_service.synthesize_speech(
        text=clean_text,
        lang=payload.lang or "hi",
    )
    return Response(
        content=audio_bytes,
        media_type=media_type,
        headers={
            "Cache-Control": "public, max-age=86400",
        },
    )


@router.post("/api/stt")
async def speech_to_text(
    audio_file: UploadFile = File(...),
    lang: Optional[str] = "indic-auto",
) -> dict:
    content = await audio_file.read()
    voice_service = get_voice_service()
    result = await voice_service.transcribe_file(
        audio_bytes=content,
        filename=audio_file.filename or "audio.wav",
        lang=lang or "indic-auto",
    )
    return {
        "transcript": result.get("transcript", ""),
        "lang": result.get("lang", lang or "auto"),
    }


@router.websocket("/ws/stt")
async def websocket_stt_relay(
    websocket: WebSocket,
    lang: str = Query("auto"),
    device_id: Optional[str] = Query(None),
):
    origin = websocket.headers.get("origin")
    forwarded_host = websocket.headers.get("x-forwarded-host", "")
    host = websocket.headers.get("host", "")

    if origin and "://" in origin:
        origin_domain = origin.split("://", 1)[1].split("/", 1)[0].split(":", 1)[0].lower()
        host_domain = host.split(":", 1)[0].lower() if host else ""
        forwarded_domain = forwarded_host.split(":", 1)[0].lower() if forwarded_host else ""

        allowed_domains = {host_domain, forwarded_domain, "localhost", "127.0.0.1"}
        is_allowed = (
            origin_domain in allowed_domains
            or any(origin in c or origin_domain in c for c in settings.cors_origins)
            or origin_domain.endswith(".onrender.com")
            or origin_domain.endswith(".elasticbeanstalk.com")
            or origin_domain.endswith(".amazonaws.com")
            or origin_domain == "localhost"
            or origin_domain == "127.0.0.1"
            or "*" in settings.cors_origins
        )
        if not is_allowed:
            await websocket.close(code=1008, reason="Origin not allowed")
            return

    client_host = websocket.client.host if websocket.client else "127.0.0.1"
    effective_device = device_id or client_host or "anonymous-device"
    await websocket.accept()
    voice_service = get_voice_service()
    try:
        await voice_service.handle_realtime_websocket(
            websocket=websocket,
            device_id=effective_device,
            lang=lang,
        )
    except WebSocketDisconnect:
        pass
